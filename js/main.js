import { RARITIES, SLOTS, TYPE_ICONS, zoneFor, zoneIndex, ZONES, isBossStage, MONSTERS_PER_STAGE, resistPenalty, S, MYTHIC_BY_ID } from './data.js';
import {
  fmt, describeAffix, describeImplicit, salvageValue, upgradeCost, canUpgrade, rerollCost, rerollItem,
  canPromote, promoteCost, promoteItem,
} from './items.js';
import { computeStats, xpToNext, targetSlot } from './stats.js';
import {
  CLASSES, CLASS_BY_ID, NODES, KEYSTONES, ROLES, ROLE_ORDER, treePointsFree, treePointsTotal, pathTo, canRefund,
  nodeLines, refundCost, resetCost, allocatedSet,
} from './tree.js';
import { SKILLS, skillsFor, SKILL_BY_ID, skillSlots, skillUpgradeCost, MAX_SKILL_RANK, MILESTONES, skillMods, skillEffective, skillDescFull, respecModCost } from './skills.js';
import { Arena } from './fx.js';
import { CLASS_WEAPONS, WEAPON_MASTERY, SETS, SET_SLOTS, setCounts, ASCENDANCY, ASC_LEVELS, ascRespecCost, isClassWeapon } from './classdata.js';
import { PETS, PET_BY_ID, PET_MAX_LEVEL, petUpgradeCost, bonusText, invasionStatus, worldBossToday, INVASION_TIME, BOX_INFO, SHOP } from './pets.js';
import { renderTreeSvg, zoom, centerOn, getSelected, setSelected, resetView } from './treeview.js';
import {
  newState, newHero, load, save, tick, ensureCombat, refreshStats, simulate, salvage, equipFromBag, unequip, BAG_SIZE, SAVE_KEY,
  startRun, abandonRun, syncSkills, dungeonTiers, raidUnlocked, dungeonLevel, raidLevel, dungeonName, raidName, DUNGEON,
  enrageMult, autoAllocate, charOf, partyReady, bestHeroFor, hatchEgg, openBox, buyShop,
} from './game.js';

let state = load() || newState();
const arena = new Arena();
ensureCombat(state);
let tab = 'battle';
let heroSub = 'gear';
let bagFilter = -1;
let skillPick = null;
let modalCtx = null;
const $ = (s) => document.querySelector(s);
const view = $('#view');
const ev = [];

// ---------- helpers ----------
const HI = () => state.ui.hero;
const H = () => state.heroes[HI()];
const C = () => charOf(state, HI());
const HC = (i = HI()) => state.combat.heroes[i];
const HS = (i = HI()) => HC(i).stats;
const rc = (r) => 'r' + r;
const nc = (it) => (it.set ? 'rset' : 'r' + it.rarity);
const bcl = (it) => (it.set ? 'bcset' : 'bc' + it.rarity);
const WICONS = { Dagger: '🗡️', Sword: '⚔️', Axe: '🪓', Mace: '🔨', Wand: '🪄', Staff: '🔮', Claw: '🐾', Bow: '🏹', Sceptre: '🏵️' };
const icon = (item) => item.type === 'weapon' ? WICONS[item.kind] || '🗡️' : TYPE_ICONS[item.type];
const costOk = (c) => state.gold >= c.gold && state.shards >= c.shards;
const costText = (c) => `🪙${fmt(c.gold)} 💠${fmt(c.shards)}`;
const heroImg = (cls, cl = 'portrait') => cls ? `<img class="${cl}" src="assets/heroes/${cls}.webp" alt="">` : `<div class="${cl} empty">?</div>`;
const petImg = (id, cl = 'pet-img') => `<img class="${cl}" src="assets/pets/${id}.webp" alt="">`;
const roleOf = (i) => state.heroes[i].role;
const heroName = (i) => { const h = state.heroes[i]; return h.cls ? CLASS_BY_ID[h.cls].name : ROLES[h.role].name; };
function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.innerHTML = msg;
  $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), 2500);
  while ($('#toasts').children.length > 3) $('#toasts').firstChild.remove();
}
function zoneLabel(stage) {
  const cycle = Math.floor(zoneIndex(stage) / ZONES.length);
  return zoneFor(stage).name + (cycle ? ` <span class="muted">· Cycle ${cycle + 1}</span>` : '');
}
function afterChange() { refreshStats(state); save(state); render(); }
const fmtTime = (s) => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h ? `${h}h ${m}m` : `${m}m ${s % 60}s`; };

// ---------- HUD ----------
function renderHud() {
  const need = xpToNext(state.level);
  $('#hud-level').textContent = state.level;
  $('#hud-xp').style.width = (100 * state.xp / need) + '%';
  $('#hud-xp-text').textContent = `${fmt(state.xp)} / ${fmt(need)} XP`;
  $('#hud-gold').textContent = fmt(state.gold);
  $('#hud-shards').textContent = fmt(state.shards);
  $('#hud-emblems').textContent = fmt(state.emblems);
  $('#hud-power').textContent = fmt(state.combat.party.power);
  const newCount = state.bag.filter((b) => b.isNew).length;
  $('#bag-badge').textContent = newCount ? (newCount > 99 ? '99+' : newCount) : '';
  const pts = state.heroes.reduce((a, h, i) => a + (h.cls ? Math.max(0, treePointsFree(charOf(state, i))) : 0), 0);
  $('#tree-badge').textContent = !partyReady(state) ? '!' : pts > 0 ? pts : (state.heroes.some((_, i) => ascPending(i)) ? '!' : '');
  const inv = invasionStatus(state);
  const eg = (inv.open && !inv.used ? 1 : 0) + Object.values(state.boxes).reduce((a, b) => a + b, 0);
  $('#end-badge').textContent = state.run ? '⚔️' : eg ? eg : '';
  $('#pet-badge').textContent = state.eggs ? state.eggs : '';
}

// ---------- Battle ----------
function renderBattle() {
  const p = state.combat.party;
  const boss = isBossStage(state.stage);
  const run = state.run;
  const runTitle = run ? (run.kind === 'raid' ? '🔱 ' + raidName(run.tier) : run.kind === 'invasion' ? `🐉 World Boss: ${run.name}` : '🗝️ ' + dungeonName(run.tier)) : '';
  const header = run ? `
    <div class="panel run-panel ${run.kind}">
      <div class="zone"><span class="name">${runTitle}</span><span class="muted">Lv ${run.level}</span></div>
      <div class="hud-row" style="margin-top:6px">
        <b id="run-prog" style="white-space:nowrap"></b>
        <div class="bar stage"><div id="run-time" class="fill"></div><span id="run-time-t"></span></div>
      </div>
      <div class="stage-ctl"><button class="btn small danger" data-act="abandon" style="flex:1">${run.kind === 'invasion' ? 'End fight & collect' : 'Abandon run'}</button></div>
    </div>` : `
    <div class="panel">
      <div class="zone"><span class="name">${zoneLabel(state.stage)}</span><span class="muted">Best ${state.maxStage}</span></div>
      <div class="hud-row" style="margin-top:6px">
        <b style="white-space:nowrap">Stage ${state.stage}${boss ? ' 👑' : ''}</b>
        <div class="bar stage"><div id="stage-fill" class="fill"></div><span id="stage-text"></span></div>
      </div>
      <div class="stage-ctl">
        <button class="btn small" data-act="stage-prev" ${state.stage <= 1 ? 'disabled' : ''}>◀</button>
        <button class="btn small" data-act="stage-next" ${state.stage >= state.maxStage ? 'disabled' : ''}>▶</button>
        <button class="btn small toggle ${state.settings.autoAdvance ? 'on' : ''}" data-act="auto-adv" style="flex:1">
          Auto-advance ${state.settings.autoAdvance ? 'ON' : 'OFF'}</button>
      </div>
    </div>`;
  view.innerHTML = `${header}
    <div id="blocked" class="blocked-note ${state.pushBlocked && state.settings.autoAdvance && !run ? '' : 'hidden'}">
      <span>☠️ Too strong here. Farming stage ${state.stage} until your party gets stronger.</span>
      <button class="btn small primary" data-act="push">Push</button>
    </div>
    <div class="arena" id="arena">
      <div class="fighter m" id="fm">
        <div class="bar mhp"><div class="trail" id="m-trail"></div><div class="fill" id="m-hp"></div><span id="m-hp-t"></span></div>
        <div class="label" id="m-name"></div>
      </div>
    </div>
    <div class="party-row">${state.heroes.map((h, i) => `
      <div class="pchip" data-act="goto-hero" data-i="${i}">
        ${heroImg(h.cls, 'pc-img')}
        <div class="pc-body">
          <div class="pc-name"><span class="role-ic">${ROLES[h.role].icon}</span> ${heroName(i)}</div>
          <div class="bar hp small"><div class="fill" id="php-${i}"></div></div>
          <div class="pc-skills">${h.skills.bar.slice(0, skillSlots(state.level)).map((id) => id && SKILL_BY_ID[id] ? `<span class="sk mini"><span>${SKILL_BY_ID[id].icon}</span><i class="cd" data-cd="${i}:${id}"></i></span>` : '').join('')}</div>
        </div>
      </div>`).join('')}</div>
    <div class="kv panel">
      <div><b id="b-dps">${fmt(p.dps)}</b><small>Party DPS</small></div>
      <div><b id="b-hps">${fmt(p.hps)}</b><small>Healing/s</small></div>
      <div><b id="b-ehp">${fmt(p.tankEhp)}</b><small>Tank EHP</small></div>
    </div>
    <div class="panel">
      <h2>Loot</h2>
      <div class="feed" id="feed"></div>
    </div>`;
  arena.mount($('#arena'));
  renderFeed();
  updateBattle();
}
function renderFeed() {
  const f = $('#feed');
  if (!f) return;
  f.innerHTML = state.lootLog.slice(0, 12).map((l) =>
    `<div><span class="${l.set ? 'rset' : rc(l.rarity)}">${TYPE_ICONS[l.type]} ${l.name} <span class="muted">i${l.ilvl}</span></span><span class="act ${l.action}">${l.action === 'equipped' && l.hero != null ? `→ ${ROLES[roleOf(l.hero)].icon} ${heroName(l.hero)}` : l.action}</span></div>`
  ).join('') || '<div class="muted">Kill monsters to find loot.</div>';
}
let lastMonster = null;
function updateBattle() {
  if (tab !== 'battle' || !$('#arena')) return;
  const c = state.combat, m = c.monster, run = state.run;
  if (!!run !== !!$('.run-panel')) { renderBattle(); return; }
  if (run) {
    $('#run-prog').textContent = run.kind === 'raid' ? `Phase ${run.phase}/3` : run.kind === 'invasion' ? `💥 ${fmt(run.damage)}` : run.room > DUNGEON.rooms ? 'Boss' : `Room ${run.room}/${DUNGEON.rooms}`;
    const left = Math.max(0, run.timeLimit - run.time);
    $('#run-time').style.width = (100 * left / run.timeLimit) + '%';
    $('#run-time-t').textContent = `${Math.ceil(left)}s left`;
  } else {
    const needed = isBossStage(state.stage) ? 1 : MONSTERS_PER_STAGE;
    $('#stage-fill').style.width = (100 * state.kills / needed) + '%';
    $('#stage-text').textContent = `${state.kills} / ${needed}`;
  }
  c.heroes.forEach((h, i) => { const el = $(`#php-${i}`); if (el) el.style.width = (h.dead ? 0 : Math.max(0, 100 * h.hp / h.stats.maxLife)) + '%'; });
  document.querySelectorAll('.cd[data-cd]').forEach((el) => {
    const [hi, id] = el.dataset.cd.split(':');
    const sk = SKILL_BY_ID[id], hero = state.heroes[+hi], hc = c.heroes[+hi];
    if (!sk || !hero || !hc) return;
    const tot = skillEffective(sk, hero.skills.ranks[id] || 1, hero.skills.mods[id]).cooldown * (1 - hc.stats.cdr / 100);
    const left = Math.max(0, hc.cds[id] ?? tot);
    el.style.setProperty('--p', (100 * left / tot).toFixed(1) + '%');
  });
  const nm = $('#m-name');
  if (m !== lastMonster) {
    lastMonster = m;
    $('#m-trail').style.transition = 'none'; $('#m-trail').style.width = '100%'; void $('#m-trail').offsetWidth; $('#m-trail').style.transition = '';
    nm.dataset.base = m.boss || m.raid ? `👑 ${m.name}` : m.elite ? 'Elite' : '';
    $('#fm').classList.toggle('elite', !!m.elite);
    $('#fm').classList.toggle('bossname', !!(m.boss || m.raid));
  }
  const enr = enrageMult(m);
  const label = (nm.dataset.base || '') + (m.frozen > 0 ? (m.stunned ? ' 💫' : ' ❄️') : '') + (enr > 1 ? ` 🔥x${enr.toFixed(1)}` : '');
  if (nm.textContent !== label) nm.textContent = label;
  $('#m-hp').style.width = m.world ? '100%' : Math.max(0, 100 * m.hp / m.maxHp) + '%';
  $('#m-trail').style.width = $('#m-hp').style.width;
  $('#m-hp-t').textContent = m.world ? '∞' : fmt(Math.max(0, m.hp));
  const p = c.party;
  $('#b-dps').textContent = fmt(p.dps); $('#b-hps').textContent = fmt(p.hps); $('#b-ehp').textContent = fmt(p.tankEhp);
  const prev = document.querySelector('[data-act="stage-prev"]'), next = document.querySelector('[data-act="stage-next"]');
  if (prev) { prev.disabled = state.stage <= 1; next.disabled = state.stage >= state.maxStage; }
  $('#blocked').classList.toggle('hidden', !!run || !(state.pushBlocked && state.settings.autoAdvance));
}

// ---------- Heroes tab ----------
function heroSelector() {
  return `<div class="hero-sel">${state.heroes.map((h, i) => `
    <div class="hs ${i === HI() ? 'on' : ''}" data-act="sel-hero" data-i="${i}">
      ${heroImg(h.cls, 'hs-img')}
      <div class="hs-role">${ROLES[h.role].icon} ${ROLES[h.role].name}</div>
      <div class="hs-name">${heroName(i)}</div>
      ${h.cls && (treePointsFree(charOf(state, i)) > 0 || ascPending(i)) ? '<i class="dot"></i>' : ''}
    </div>`).join('')}</div>`;
}
function renderHeroes() {
  const h = H();
  if (!h.cls) {
    view.innerHTML = heroSelector() + `<div class="panel" style="text-align:center"><p>This ${ROLES[h.role].name} has no class yet.</p>
      <button class="btn primary" data-act="pick-role-class" data-role="${h.role}">Choose a ${ROLES[h.role].name} class</button></div>`;
    return;
  }
  const free = treePointsFree(C());
  view.innerHTML = heroSelector() + `
    <div class="seg">
      <button class="${heroSub === 'gear' ? 'on' : ''}" data-act="sub" data-s="gear">🛡️ Gear</button>
      <button class="${heroSub === 'tree' ? 'on' : ''}" data-act="sub" data-s="tree">🌳 Tree${free ? ` <i>${free}</i>` : ''}</button>
      <button class="${heroSub === 'skills' ? 'on' : ''}" data-act="sub" data-s="skills">✴️ Skills</button>
      <button class="${heroSub === 'class' ? 'on' : ''}" data-act="sub" data-s="class">${CLASS_BY_ID[h.cls].icon} Class${ascPending(HI()) ? ' <i>!</i>' : ''}</button>
    </div>
    <div id="hero-body"></div>`;
  const body = $('#hero-body');
  ({ gear: renderGear, tree: renderTree, skills: renderSkills, class: renderClass })[heroSub](body);
}

function renderGear(body) {
  const st = HS(), h = H();
  body.innerHTML = `
    <div class="slots">${SLOTS.map((s) => {
      const it = h.gear[s.id];
      if (!it) return `<div class="slot empty"><div class="ic">${TYPE_ICONS[s.type]}</div><div><div class="nm muted">${s.name}</div><div class="sub">Empty</div></div></div>`;
      return `<div class="slot ${bcl(it)}" data-act="open-eq" data-slot="${s.id}">
        <div class="ic">${icon(it)}</div>
        <div><div class="nm ${nc(it)}">${it.name}${it.upgrade ? ` +${it.upgrade}` : ''}</div>
        <div class="sub">${it.set ? 'Set' : it.mythic ? '✦ Mythic' : RARITIES[it.rarity].name} · ilvl ${it.ilvl}</div></div></div>`;
    }).join('')}</div>
    <div class="panel" style="margin-top:10px">
      <div class="kv">
        <div><b>${fmt(st.role === 'healer' ? st.hps : st.dps)}</b><small>${st.role === 'healer' ? 'Healing/s' : 'DPS'}</small></div>
        <div><b>${fmt(st.ehp)}</b><small>Eff. HP</small></div>
        <div><b>${fmt(st.power)}</b><small>Power</small></div>
      </div>
      ${Object.entries(setCounts(h.gear)).map(([id, n]) => `<div class="set-sum"><b class="rset">${SETS[id].name}</b> <span class="muted">${n}/5</span>
        ${[2, 3, 5].map((t) => `<div class="${n >= t ? 'good' : 'muted'}">(${t}) ${SETS[id].text[t]}</div>`).join('')}</div>`).join('')}
      ${h.gear.weapon ? `<div class="${st.mastery ? 'good' : 'muted'}" style="font-size:12px;margin-top:6px">${st.mastery ? `⚔️ Weapon mastery: ${Math.round(WEAPON_MASTERY * 100)}% more damage` : `Masters: ${(CLASS_WEAPONS[h.cls] || []).join(', ')} (${Math.round(WEAPON_MASTERY * 100)}% more damage)`}</div>` : ''}
      <p class="muted" style="font-size:12px;margin:8px 0 0">Drops go to whichever hero they help most. Tap a slot to upgrade, reroll or promote.</p>
    </div>`;
}

function renderTree(body) {
  const cls = CLASS_BY_ID[H().cls];
  const free = treePointsFree(C());
  body.innerHTML = `
    <div class="toolbar">
      <span>${cls.icon} <b>${cls.name}</b></span><span style="flex:1"></span>
      <b class="${free ? 'good' : 'muted'}">${free} pts</b>
      <button class="btn small" data-act="auto-alloc" ${free ? '' : 'disabled'}>Auto</button>
    </div>
    <div class="tree-wrap"><div id="tree-svg"></div>
      <div class="tree-zoom"><button class="btn small" data-act="zin">＋</button><button class="btn small" data-act="zout">－</button><button class="btn small" data-act="zhome">⌂</button></div>
    </div>
    <div id="node-info" class="panel node-info"></div>
    <p class="muted" style="font-size:11px">Each hero has their own tree. Points: 1 per level up to 100, then 1 per 4 levels (${treePointsTotal(state.level)} total). Drag to move, pinch to zoom.</p>
    <button class="btn danger" style="width:100%" data-act="tree-reset" ${H().tree.length && state.gold >= resetCost(state.level) ? '' : 'disabled'}>Reset tree · 🪙${fmt(resetCost(state.level))}</button>`;
  drawTree();
}
let treeHero = null;
function drawTree() {
  const wrap = $('#tree-svg');
  if (!wrap) return;
  if (treeHero !== HI()) { resetView(); treeHero = HI(); }
  renderTreeSvg(wrap, C(), (id) => { setSelected(id); drawTree(); });
  renderNodeInfo();
}
function renderNodeInfo() {
  const el = $('#node-info');
  if (!el) return;
  const id = getSelected();
  if (!id) { el.innerHTML = '<div class="muted" style="font-size:12px">Tap a node to see it. Gold nodes are notables; the big ones at the edge are <b>keystones</b> that change the rules.</div>'; return; }
  const ch = C();
  const n = NODES[id];
  const set = allocatedSet(ch);
  const own = id === `start_${ch.cls}`;
  const title = n.name || (n.kind === 'small' ? 'Passive' : '');
  const kindLabel = { small: 'Passive', notable: 'Notable', keystone: 'Keystone', start: own ? 'Your class' : 'Class start' }[n.kind];
  const has = set.has(id);
  const path = has ? [] : pathTo(ch, id);
  const free = treePointsFree(ch);
  let btns = '';
  if (!has && path.length) {
    btns = `<button class="btn primary" data-act="alloc-path" ${path.length <= free ? '' : 'disabled'}>${path.length === 1 ? 'Allocate' : `Allocate path (${path.length} pts)`}</button>`;
  } else if (has && !own) {
    const c = refundCost(state.level);
    btns = canRefund(ch, id)
      ? `<button class="btn danger" data-act="refund" ${state.gold >= c ? '' : 'disabled'}>Refund · 🪙${fmt(c)}</button>`
      : '<span class="muted" style="font-size:11px">Refund the nodes beyond this first.</span>';
  }
  el.innerHTML = `<div class="ni-head"><span class="ni-k ${n.kind}">${kindLabel}</span><b>${n.icon ? n.icon + ' ' : ''}${title}</b>${has ? ' <span class="good">✓</span>' : ''}</div>
    ${nodeLines(n, own).map((l) => `<div class="ni-line">${l}</div>`).join('')}
    <div class="ni-btns">${btns}</div>`;
}

function renderSkills(body) {
  const h = H();
  const slots = skillSlots(state.level);
  const bar = Array.from({ length: 4 }, (_, i) => h.skills.bar[i]);
  body.innerHTML = `
    <p class="muted" style="font-size:12px;margin-top:0">Skills cast themselves. Tap a slot, then a skill. Tap a skill to rank it up; at ranks 5, 10 and 15 pick one of two upgrades. Slots: 2 → 3 at Lv 20 → 4 at Lv 50.</p>
    <div class="skillbar big">${bar.map((id, i) => i >= slots
      ? `<div class="sk locked">🔒<small>Lv ${i === 2 ? 20 : 50}</small></div>`
      : `<div class="sk ${skillPick === i ? 'picking' : ''}" data-act="pick-slot" data-i="${i}">${id && SKILL_BY_ID[id] ? `<span>${SKILL_BY_ID[id].icon}</span><small>${h.skills.ranks[id]}</small>` : '+'}</div>`).join('')}</div>
    ${skillPick != null ? `<div class="pick-hint">Choose a skill for slot ${skillPick + 1} <button class="btn small" data-act="pick-cancel">Cancel</button></div>` : ''}
    ${skillsFor(h.cls).map((sk) => {
      const rank = h.skills.ranks[sk.id];
      const tag = sk.cls ? '<span class="cls-tag">CLASS</span> ' : '';
      if (!rank) return `<div class="node locked"><div class="ic">${sk.icon}</div><div class="info"><b>${tag}${sk.name}</b><div>Unlocks at level ${sk.unlock}</div></div></div>`;
      const c = skillUpgradeCost(rank, state.level);
      const inBar = h.skills.bar.slice(0, slots).includes(sk.id);
      const picks = h.skills.mods[sk.id] || [];
      const pending = MILESTONES.some((m, i) => rank >= m && picks[i] == null);
      const pips = MILESTONES.map((m, i) => `<span class="pip ${picks[i] != null && rank >= m ? 'on' : rank >= m ? 'ready' : ''}"></span>`).join('');
      return `<div class="node ${inBar ? 'inbar' : ''}" data-act="${skillPick != null ? 'assign' : 'skill-open'}" data-id="${sk.id}">
        <div class="ic">${sk.icon}</div>
        <div class="info"><b>${tag}${sk.name} <span class="muted">R${rank}</span>${inBar ? ' <span class="good">●</span>' : ''} <span class="pips">${pips}</span>${pending ? ' <span class="newmod">NEW</span>' : ''}</b><div>${skillDescFull(sk, rank, picks)}</div></div>
        ${skillPick == null ? `<button class="btn small primary" data-act="skill-up" data-id="${sk.id}" ${rank < MAX_SKILL_RANK && costOk(c) ? '' : 'disabled'}>⬆️<small style="display:block;font-size:9px">${rank < MAX_SKILL_RANK ? `💠${fmt(c.shards)}` : 'MAX'}</small></button>` : ''}
      </div>`;
    }).join('')}`;
}

function openSkill(id) {
  const h = H();
  const sk = SKILL_BY_ID[id], rank = h.skills.ranks[id];
  const picks = h.skills.mods[id] || [];
  const c = skillUpgradeCost(rank, state.level);
  const mods = skillMods(sk);
  $('#modal-card').innerHTML = `
    <div class="item-head"><div class="nm">${sk.icon} ${sk.name}</div><div class="meta">${heroName(HI())} · Rank ${rank}/${MAX_SKILL_RANK} · each rank +10% effect, −2% cooldown</div></div>
    <div class="lines"><div class="imp">${skillDescFull(sk, rank, picks)}</div></div>
    <button class="btn primary" style="width:100%" data-act="skill-up" data-id="${id}" ${rank < MAX_SKILL_RANK && costOk(c) ? '' : 'disabled'}>
      ⬆️ Rank up${rank < MAX_SKILL_RANK ? ` · ${costText(c)}` : ' (max)'}</button>
    <h2 style="margin-top:14px">Upgrades</h2>
    ${MILESTONES.map((m, i) => `<div class="ms ${rank >= m ? '' : 'locked'}"><div class="ms-h">Rank ${m}${rank >= m ? '' : ' 🔒'}</div>
      <div class="ms-opts">${mods[i].map((o, j) => {
        const chosen = picks[i] === j;
        return `<div class="ms-opt ${chosen ? 'on' : ''}" ${rank >= m && !chosen ? `data-act="mod-pick" data-id="${id}" data-i="${i}" data-o="${j}"` : ''}><b>${o.name}</b><small>${o.desc}</small></div>`;
      }).join('')}</div></div>`).join('')}
    <p class="muted" style="font-size:11px">Your first choice at each rank is free. Changing it later costs 💠${respecModCost(rank).shards}.</p>
    <button class="btn full" style="width:100%" data-act="close">Close</button>`;
  modalCtx = { skill: id };
  $('#modal').classList.remove('hidden');
}

function ascPending(i = HI()) {
  const h = state.heroes[i];
  return !!h.cls && ASC_LEVELS.some((lv, k) => state.level >= lv && (h.asc || [])[k] == null);
}
function renderClass(body) {
  const h = H();
  const cls = CLASS_BY_ID[h.cls];
  const asc = ASCENDANCY[h.cls];
  const set = SETS[h.cls];
  const n = setCounts(h.gear)[h.cls] || 0;
  const classSkills = SKILLS.filter((s) => s.cls === h.cls);
  body.innerHTML = `
    <div class="panel class-hero" style="--c:${cls.color}">${heroImg(h.cls, 'ch-img')}
      <div><b>${cls.name}</b><div class="muted">${ROLES[cls.role].icon} ${ROLES[cls.role].name} · ${cls.desc}</div>
      <div class="muted" style="font-size:11px;margin-top:4px">${ROLES[cls.role].desc}</div>
      <button class="btn small" style="margin-top:6px" data-act="change-class" ${state.gold >= resetCost(state.level) * 2 && !state.run ? '' : 'disabled'}>Change class · 🪙${fmt(resetCost(state.level) * 2)}</button></div></div>
    <div class="panel"><h2>Class Passives</h2>
      <p class="muted" style="font-size:12px;margin-top:0">At levels ${ASC_LEVELS.join(', ')} choose one of two passives. First pick is free; changing costs 🪙${fmt(ascRespecCost(state.level))}.</p>
      ${asc.map((opts, i) => `<div class="ms ${state.level >= ASC_LEVELS[i] ? '' : 'locked'}"><div class="ms-h">Level ${ASC_LEVELS[i]}${state.level >= ASC_LEVELS[i] ? '' : ' 🔒'}</div>
        <div class="ms-opts">${opts.map((o, j) => {
          const on = h.asc[i] === j;
          return `<div class="ms-opt ${on ? 'on' : ''}" ${state.level >= ASC_LEVELS[i] && !on ? `data-act="asc-pick" data-i="${i}" data-o="${j}"` : ''}><b>${o.name}</b><small>${o.desc}</small></div>`;
        }).join('')}</div></div>`).join('')}
    </div>
    <div class="panel"><h2>Weapon Mastery</h2>
      <div style="font-size:13px">${CLASS_WEAPONS[h.cls].map((k) => `${WICONS[k]} ${k}`).join(' · ')}</div>
      <div class="muted" style="font-size:12px">${Math.round(WEAPON_MASTERY * 100)}% more damage while wielding one. ${h.gear.weapon ? (isClassWeapon(h, h.gear.weapon) ? '<span class="good">Active</span>' : '<span class="bad">Not active</span>') : ''}</div></div>
    <div class="panel"><h2>Class Set</h2>
      <div><b class="rset">${set.name}</b> <span class="muted">${n}/5 equipped</span></div>
      <div class="muted" style="font-size:12px;margin:4px 0">${SET_SLOTS.map((t) => `${TYPE_ICONS[t]} ${set.prefix} ${t}`).join(' · ')}</div>
      ${[2, 3, 5].map((t) => `<div class="${n >= t ? 'good' : 'muted'}" style="font-size:13px">(${t}) ${set.text[t]}</div>`).join('')}
      <div class="muted" style="font-size:11px;margin-top:6px">Set pieces drop from zone bosses (stage 20+), dungeon Wardens, raids and Box II/III.</div></div>
    <div class="panel"><h2>Class Skills</h2>
      ${classSkills.map((sk) => `<div class="row"><span>${sk.icon} <b>${sk.name}</b> <span class="muted">Lv ${sk.unlock}</span></span>
        <span class="${h.skills.ranks[sk.id] ? 'good' : 'muted'}">${h.skills.ranks[sk.id] ? 'Unlocked' : 'Locked'}</span></div>`).join('')}</div>`;
}

// ---------- Bag ----------
function renderBag() {
  let items = state.bag;
  const types = ['weapon', 'offhand', 'helm', 'chest', 'gloves', 'boots', 'belt', 'amulet', 'ring'];
  if (bagFilter >= 0) items = items.filter((i) => i.type === types[bagFilter]);
  const icons = ['🗡️', '🛡️', '⛑️', '🥋', '🧤', '🥾', '🎗️', '📿', '💍'];
  view.innerHTML = `
    <div class="toolbar">
      <b>${state.bag.length}/${BAG_SIZE}</b>
      <span style="flex:1"></span>
      <button class="btn small" data-act="sort">Sort</button>
      <button class="btn small danger" data-act="salvage-menu">Salvage…</button>
    </div>
    <div class="toolbar">
      <span class="chip ${bagFilter < 0 ? 'on' : ''}" data-act="filter" data-f="-1">All</span>
      ${icons.map((t, i) => `<span class="chip ${bagFilter === i ? 'on' : ''}" data-act="filter" data-f="${i}">${t}</span>`).join('')}
    </div>
    <div class="grid">${items.map((it) => {
      const b = partyReady(state) ? bestHeroFor(state, it) : { hero: -1 };
      return `<div class="cell ${bcl(it)}" data-act="open-bag" data-uid="${it.uid}">
        ${icon(it)}
        ${it.upgrade ? `<span class="up">+${it.upgrade}</span>` : ''}
        ${it.locked ? '<span class="lk">🔒</span>' : it.isNew ? '<span class="new"></span>' : ''}
        ${b.hero >= 0 ? `<span class="arrow">▲${ROLES[roleOf(b.hero)].icon}</span>` : ''}
        <span class="il">${it.ilvl}</span></div>`;
    }).join('') || '<p class="muted" style="grid-column:span 5">Your bag is empty.</p>'}</div>`;
  state.bag.forEach((b) => { b.isNew = false; });
}

// ---------- Item modal ----------
function openItem(item, where, heroIdx, slot) {
  const r = RARITIES[item.rarity];
  const imp = describeImplicit(item);
  const affs = item.affixes.map((a) => describeAffix(a, item));
  affs.sort((a, b) => (a.type === b.type ? 0 : a.type === 'prefix' ? -1 : 1));
  let cmp = '';
  if (where === 'bag' && partyReady(state)) {
    cmp = `<div class="equip-on">${state.heroes.map((h, i) => {
      const ch = charOf(state, i);
      const ts = targetSlot(ch, item);
      const cur = HS(i).power;
      const nxt = computeStats(ch, { ...h.gear, [ts]: item }).power;
      const v = (nxt / cur - 1) * 100;
      return `<button class="btn eq-btn" data-act="equip" data-uid="${item.uid}" data-i="${i}">${heroImg(h.cls, 'eq-img')}
        <span>${ROLES[h.role].icon} ${heroName(i)}<small class="${v >= 0 ? 'good' : 'bad'}">${v >= 0 ? '+' : ''}${v.toFixed(1)}% power</small></span></button>`;
    }).join('')}</div>`;
  }
  const up = upgradeCost(item), rr = rerollCost(item), pr = promoteCost(item), sv = salvageValue(item);
  const owner = where === 'eq' ? state.heroes[heroIdx] : H();
  const setN = item.set ? (setCounts(owner.gear)[item.set] || 0) : 0;
  $('#modal-card').innerHTML = `
    <div class="item-head ${bcl(item)}">
      <div class="nm ${nc(item)}">${icon(item)} ${item.name}${item.upgrade ? ` +${item.upgrade}` : ''}</div>
      <div class="meta">${item.set ? 'Set' : item.mythic ? '✦ Mythic' : r.name} ${item.baseName ? item.baseName + ' · ' : ''}${item.kind || SLOTS.find((s) => s.type === item.type).name} · Item Level ${item.ilvl} · Upgrade ${item.upgrade}/${r.maxUpgrade}</div>
      ${where === 'eq' ? `<div class="meta">Worn by ${ROLES[owner.role].icon} ${heroName(heroIdx)}</div>` : ''}
    </div>
    <div class="lines">
      ${imp.map((l) => `<div class="imp">${l}</div>`).join('')}
      ${affs.length ? '<hr>' : ''}
      ${affs.map((a) => `<div class="aff"><span>${a.text}</span><span class="t ${a.tier === 'T1' ? 'top' : ''}">${a.type === 'prefix' ? 'P' : 'S'} ${a.tier}</span></div>`).join('')}
      ${item.mythic ? `<hr><div class="mythic-pow"><div class="mp-h">✦ Mythic Power</div>${MYTHIC_BY_ID[item.mythic].text.map((t) => `<div>${t}</div>`).join('')}</div>` : ''}
      ${item.set ? `<hr><div class="set-box"><b class="rset">${SETS[item.set].name}</b> <span class="muted">(${SETS[item.set].prefix} · ${CLASS_BY_ID[item.set].name} set)</span>
        ${[2, 3, 5].map((t) => `<div class="${setN >= t ? 'good' : 'muted'}">(${t}) ${SETS[item.set].text[t]}</div>`).join('')}</div>` : ''}
      ${item.type === 'weapon' ? `<hr><div style="text-align:center;font-size:12px" class="muted">${item.kind}: mastered by ${CLASSES.filter((c) => CLASS_WEAPONS[c.id].includes(item.kind)).map((c) => c.name).join(', ')}</div>` : ''}
    </div>
    ${cmp}
    <div class="actions">
      <button class="btn" data-act="upgrade" ${canUpgrade(item) && costOk(up) ? '' : 'disabled'}>⬆️ Upgrade<small>${canUpgrade(item) ? costText(up) : 'Max level'}</small></button>
      <button class="btn" data-act="reroll" ${item.rarity > 0 && costOk(rr) ? '' : 'disabled'}>🎲 Reroll mods<small>${item.rarity > 0 ? costText(rr) : 'Needs Magic+'}</small></button>
      <button class="btn" data-act="promote" ${canPromote(item) && costOk(pr) ? '' : 'disabled'}>✨ Promote<small>${canPromote(item) ? `→ ${RARITIES[item.rarity + 1].name} · ${costText(pr)}` : 'Max rarity'}</small></button>
      ${where === 'bag'
        ? `<button class="btn" data-act="lock">${item.locked ? '🔓 Unlock' : '🔒 Lock'}<small>Protect from salvage</small></button>
           <button class="btn danger full" data-act="salvage-one" ${item.locked ? 'disabled' : ''}>♻️ Salvage <small>+💠${sv.shards} +🪙${fmt(sv.gold)}</small></button>`
        : `<button class="btn" data-act="unequip">Unequip<small>Move to bag</small></button>`}
      <button class="btn full" data-act="close">Close</button>
    </div>`;
  modalCtx = { item, where, hero: heroIdx, slot };
  $('#modal').classList.remove('hidden');
}
function closeModal() {
  if (modalCtx && modalCtx.picker && !modalCtx.cancellable) return;
  $('#modal').classList.add('hidden'); modalCtx = null;
}
function reopen() { if (modalCtx && modalCtx.item) openItem(modalCtx.item, modalCtx.where, modalCtx.hero, modalCtx.slot); }

function openSalvageMenu() {
  const counts = RARITIES.map((r) => state.bag.filter((b) => !b.locked && !b.set && !b.mythic && b.rarity === r.id).length);
  $('#modal-card').innerHTML = `<h2>Salvage</h2><p class="muted" style="font-size:12px">Turns unlocked items into 💠 shards and gold. Locked items, set pieces and Mythics are kept.</p>
    <div class="actions">${RARITIES.slice(0, 5).map((r, i) =>
      `<button class="btn" data-act="salvage-upto" data-r="${i}">All ≤ <span class="${rc(i)}">${r.name}</span><small>${counts.slice(0, i + 1).reduce((a, b) => a + b, 0)} items</small></button>`).join('')}
      <button class="btn full" data-act="close">Cancel</button></div>`;
  modalCtx = null;
  $('#modal').classList.remove('hidden');
}

// ---------- Pets ----------
function renderPets() {
  const act = state.pets.active;
  const owned = state.pets.owned;
  const ap = PET_BY_ID[act];
  const lvl = owned[act] || 1;
  const c = petUpgradeCost(lvl);
  view.innerHTML = `
    ${ap ? `<div class="panel pet-hero">${petImg(act, 'pet-big')}
      <div class="pet-info"><b>${ap.name}</b> <span class="muted">Lv ${lvl}/${PET_MAX_LEVEL}</span>
        <div class="muted" style="font-size:12px">${ap.desc}</div>
        <div class="good" style="font-size:12px">${bonusText(ap.bonus(lvl))}</div>
        <div class="muted" style="font-size:11px">Also attacks every 2s for ${Math.round((0.35 + lvl * 0.025) * 100)}% of the party's average hit.</div>
        <button class="btn small primary" style="margin-top:6px" data-act="pet-up" ${lvl < PET_MAX_LEVEL && costOk(c) ? '' : 'disabled'}>⬆️ Level up · ${costText(c)}</button>
      </div></div>` : ''}
    <div class="panel egg-row"><span>🥚 Pet Eggs: <b>${state.eggs}</b></span>
      <button class="btn small primary" data-act="hatch" ${state.eggs ? '' : 'disabled'}>Hatch</button></div>
    <p class="muted" style="font-size:12px">Eggs drop from first zone-boss kills, dungeons, raids and boxes, or buy them with 🏅 emblems. A duplicate pet levels up the one you have.</p>
    <div class="pet-grid">${PETS.map((p) => {
      const l = owned[p.id];
      return `<div class="pet-card ${l ? '' : 'unowned'} ${act === p.id ? 'on' : ''}" ${l ? `data-act="pet-set" data-id="${p.id}"` : ''}>
        ${petImg(p.id)}<b>${p.name}</b><small>${l ? `Lv ${l}` : 'Not found'}</small>
        ${act === p.id ? '<span class="pet-tag">Active</span>' : ''}</div>`;
    }).join('')}</div>`;
}

// ---------- Events: world boss, boxes, shop, dungeons, raids ----------
function renderEvents() {
  const inv = invasionStatus(state);
  const wb = worldBossToday();
  const tiers = dungeonTiers(state);
  const run = state.run;
  const rows = [];
  for (let t = tiers; t >= 1; t--) {
    const dc = state.dungeonsCleared[t] || 0, rcl = state.raidsCleared[t] || 0;
    rows.push(`<div class="eg-row">
      <div class="info"><b>${dungeonName(t)}</b><div class="muted">Tier ${t} · Lv ${dungeonLevel(t)} · cleared ${dc}×</div></div>
      <button class="btn small primary" data-act="enter" data-k="dungeon" data-t="${t}" ${!run && state.keys > 0 ? '' : 'disabled'}>Enter 🗝️</button></div>
      <div class="eg-row raid ${raidUnlocked(state, t) ? '' : 'locked'}">
      <div class="info"><b>🔱 ${raidName(t)}</b><div class="muted">${raidUnlocked(state, t) ? `Raid · Lv ${raidLevel(t)} · cleared ${rcl}×` : 'Clear this tier\'s vault to unlock'}</div></div>
      <button class="btn small raidbtn" data-act="enter" data-k="raid" data-t="${t}" ${!run && state.sigils > 0 && raidUnlocked(state, t) ? '' : 'disabled'}>Raid 🔱</button></div>`);
  }
  const canFight = !run && partyReady(state) && ((inv.open && !inv.used) || state.horns > 0);
  view.innerHTML = `
    <div class="panel wb-card">
      <img class="wb-img" src="assets/${wb.art === 'dragon' ? 'bosses/dragon' : 'monsters/demonlord'}.webp" alt="">
      <div class="wb-info"><div class="wb-t">⚔️ World Boss Invasion</div>
        <b>${wb.name}</b>
        <div class="muted" style="font-size:12px">${inv.open ? (inv.used ? `You've fought this invasion. Ends in ${fmtTime(inv.secondsLeft)}.` : `<span class="good">Invading now!</span> Ends in ${fmtTime(inv.secondsLeft)}.`) : `Next: ${inv.window.name} in ${fmtTime(inv.secondsUntil)} (${inv.window.start}:00–${inv.window.end}:00)`}</div>
        <div class="muted" style="font-size:11px">${INVASION_TIME}s to deal as much damage as you can. Rewards: 🏅 emblems and boxes by rank (D → S).${state.invasion.best ? ` Best: ${fmt(state.invasion.best)}` : ''}</div>
        <button class="btn small primary" style="margin-top:6px" data-act="enter" data-k="invasion" ${canFight ? '' : 'disabled'}>${inv.open && !inv.used ? 'Fight!' : `Use 📯 Horn (${state.horns})`}</button>
      </div></div>
    <div class="panel"><h2>Boxes</h2>
      <div class="box-row">${[1, 2, 3].map((t) => `<div class="box"><div class="bi">${BOX_INFO[t].icon}</div><b>${BOX_INFO[t].name} ×${state.boxes[t] || 0}</b>
        <small>${BOX_INFO[t].desc}</small><button class="btn small" data-act="open-box" data-t="${t}" ${state.boxes[t] ? '' : 'disabled'}>Open</button></div>`).join('')}</div></div>
    <div class="panel"><h2>Emblem Shop <span class="muted" style="float:right">🏅 ${state.emblems}</span></h2>
      ${SHOP.map((s) => `<div class="row"><span>${s.icon} <b>${s.name}</b><br><small class="muted">${s.desc}</small></span>
        <button class="btn small" data-act="buy" data-id="${s.id}" ${state.emblems >= s.cost ? '' : 'disabled'}>🏅${s.cost}</button></div>`).join('')}</div>
    <div class="kv panel"><div><b>🗝️ ${state.keys}</b><small>Keys</small></div><div><b>🔱 ${state.sigils}</b><small>Sigils</small></div><div><b>📯 ${state.horns}</b><small>Horns</small></div></div>
    ${run ? `<div class="blocked-note"><span>Your party is in a fight…</span><button class="btn small" data-act="tab-battle">Watch</button></div>` : ''}
    <div class="panel"><h2>Vaults & Raids</h2><div class="muted" style="font-size:12px;line-height:1.5">
      <b>Zone bosses</b> enrage after 30s and slam the whole party. They drop 🗝️ keys (always the first time).<br>
      <b>Vaults</b>: 5 rooms then a Warden in ${DUNGEON.timeLimit}s. Rare+ loot, set pieces, and a 🔱 sigil (guaranteed first clear).<br>
      <b>Raids</b>: a 3-phase boss in 180s. Legendary, Epic+ and set loot, a chance at Mythic, plus a 📯 horn.</div></div>
    ${tiers ? rows.join('') : '<p class="muted">Beat the zone boss at stage 10 to unlock your first vault.</p>'}`;
}

// ---------- Class picker (per role) ----------
function openClassPicker(role, cancellable, heroIdx) {
  const list = CLASSES.filter((c) => c.role === role);
  $('#modal-card').innerHTML = `<h2>Choose your ${ROLES[role].icon} ${ROLES[role].name}</h2>
    <p class="muted" style="font-size:12px;margin-top:0">${ROLES[role].desc} Each class has its own skills, weapons, armour set, passives and starting point on the tree.</p>
    <div class="class-grid">${list.map((c) => `<div class="class-card" data-act="pick-class" data-id="${c.id}" data-i="${heroIdx}" style="--c:${c.color}">
      ${heroImg(c.id, 'cc-img')}<b>${c.name}</b><small>${c.attr} · ${(CLASS_WEAPONS[c.id] || []).join('/')}</small>
      <div class="cd">${c.desc}</div></div>`).join('')}</div>
    ${cancellable ? '<button class="btn full" data-act="close" style="width:100%;margin-top:10px">Cancel</button>' : ''}`;
  modalCtx = { picker: true, cancellable };
  $('#modal').classList.remove('hidden');
}
function ensureParty() {
  const i = state.heroes.findIndex((h) => !h.cls);
  if (i >= 0) { openClassPicker(state.heroes[i].role, false, i); return false; }
  return true;
}

// ---------- More: stats & settings ----------
function renderMore() {
  const s = state.settings;
  const st = HS();
  const row = (k, v) => `<span>${k}</span><b>${v}</b>`;
  view.innerHTML = `
    <div class="panel"><h2>Settings</h2>
      <div class="row"><span>Auto-equip upgrades</span><button class="btn small toggle ${s.autoEquip ? 'on' : ''}" data-act="set-autoequip">${s.autoEquip ? 'ON' : 'OFF'}</button></div>
      <div class="row"><span>Auto-salvage drops up to</span>
        <select id="sel-salvage">${['Off', ...RARITIES.slice(0, 4).map((r) => r.name)].map((n, i) => `<option value="${i}" ${s.autoSalvage === i ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
    </div>
    ${heroSelector()}
    <div class="panel"><h2>${heroName(HI())} stats</h2>
      ${[...st.keystones].map((k) => `<span class="ks-chip">${KEYSTONES[k].icon} ${KEYSTONES[k].name}</span>`).join('')}
      <div class="sheet">
      <div class="h">Offence</div>
      ${row('Physical damage', `${fmt(st.physMin)}–${fmt(st.physMax)}`)}
      ${row('Elemental damage', `${fmt(st.eleMin)}–${fmt(st.eleMax)}`)}
      ${row('Attacks / sec', st.aps.toFixed(2))}
      ${row('Crit chance', st.crit.toFixed(1) + '%')}
      ${row('Crit multiplier', Math.round(st.critMulti) + '%')}
      ${row('DPS', fmt(st.dps))}
      ${st.role === 'healer' ? row('Healing / sec', fmt(st.hps)) : ''}
      ${row('Healing multiplier', '×' + st.healMult.toFixed(2))}
      ${row('Skill recharge', `${st.cdr.toFixed(0)}% faster`)}
      <div class="h">Defence</div>
      ${row('Life', fmt(st.maxLife))}
      ${row('Armour', `${fmt(st.armour)} <span class="muted">(${(st.armourRed * 100).toFixed(0)}%)</span>`)}
      ${row('Evasion', `${fmt(st.evasion)} <span class="muted">(${(st.evadeChance * 100).toFixed(0)}%)</span>`)}
      ${row('Elemental resist', `<span class="${st.resist < 0 ? 'bad' : ''}">${st.resist.toFixed(0)}%</span> <span class="muted">(−${resistPenalty(state.run ? state.run.level : state.stage)} zone)</span>`)}
      ${row('Block', st.block.toFixed(0) + '%')}
      ${row('Damage reduction', (st.dr * 100).toFixed(0) + '%')}
      ${row('Regen / sec', fmt(st.regen))}
      ${row('Leech', st.leech.toFixed(1) + '%')}
      ${row('Effective HP', fmt(st.ehp))}
      <div class="h">Party</div>
      ${row('Gold found', '+' + state.combat.party.goldFind.toFixed(0) + '%')}
      ${row('Item rarity', '+' + state.combat.party.rarity.toFixed(0) + '%')}
      ${row('Experience', '+' + state.combat.party.xpGain.toFixed(0) + '%')}
      ${row('Best stage', state.maxStage)}
      ${row('Monsters slain', fmt(state.totalKills))}
      ${row('Party wipes', state.deaths)}
    </div></div>
    <div class="panel"><h2>Save</h2>
      <div class="actions">
        <button class="btn" data-act="export">Export</button>
        <button class="btn" data-act="import">Import</button>
        <button class="btn danger full" data-act="reset">Delete save &amp; restart</button>
      </div>
      <textarea id="save-box" class="hidden" placeholder="Paste a save here, then tap Import again"></textarea>
    </div>`;
  $('#sel-salvage').onchange = (e) => { state.settings.autoSalvage = +e.target.value; save(state); };
}

// ---------- Render dispatch ----------
function render() {
  renderHud();
  ({ battle: renderBattle, heroes: renderHeroes, bag: renderBag, pets: renderPets, events: renderEvents, more: renderMore })[tab]();
}
document.querySelector('#tabs').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-tab]');
  if (!b) return;
  tab = b.dataset.tab;
  skillPick = null;
  syncTabs();
  render();
});
function syncTabs() { view.scrollTop = 0; document.querySelectorAll('#tabs button').forEach((x) => x.classList.toggle('active', x.dataset.tab === tab)); }

// ---------- Actions ----------
function doAction(el) {
  const a = el.dataset.act;
  const m = modalCtx;
  switch (a) {
    case 'stage-prev': if (state.run) return; state.stage = Math.max(1, state.stage - 1); state.kills = 0; state.settings.autoAdvance = false; state.combat = null; ensureCombat(state); break;
    case 'stage-next': if (state.run) return; state.stage = Math.min(state.maxStage, state.stage + 1); state.kills = 0; state.combat = null; ensureCombat(state); break;
    case 'auto-adv': state.settings.autoAdvance = !state.settings.autoAdvance; state.pushBlocked = false; break;
    case 'push': state.pushBlocked = false; break;
    case 'sel-hero': state.ui.hero = +el.dataset.i; setSelected(null); skillPick = null; break;
    case 'goto-hero': state.ui.hero = +el.dataset.i; tab = 'heroes'; syncTabs(); break;
    case 'open-eq': openItem(H().gear[el.dataset.slot], 'eq', HI(), el.dataset.slot); return;
    case 'open-bag': openItem(state.bag.find((b) => b.uid === el.dataset.uid), 'bag'); return;
    case 'close': closeModal(); return;
    case 'equip': { const i = +el.dataset.i; equipFromBag(state, el.dataset.uid, i); closeModal(); toast(`Equipped on ${heroName(i)}`); break; }
    case 'unequip': unequip(state, m.hero, m.slot); closeModal(); break;
    case 'lock': m.item.locked = !m.item.locked; save(state); reopen(); render(); return;
    case 'salvage-one': {
      const v = salvage(state, m.item);
      state.bag = state.bag.filter((b) => b !== m.item);
      closeModal(); toast(`♻️ +💠${v.shards}`); break;
    }
    case 'upgrade': {
      const c = upgradeCost(m.item);
      if (!canUpgrade(m.item) || !costOk(c)) return;
      state.gold -= c.gold; state.shards -= c.shards; m.item.upgrade++; state.pushBlocked = false;
      afterChange(); reopen(); return;
    }
    case 'reroll': {
      const c = rerollCost(m.item);
      if (!costOk(c)) return;
      state.gold -= c.gold; state.shards -= c.shards; rerollItem(m.item); state.pushBlocked = false;
      afterChange(); reopen(); return;
    }
    case 'promote': {
      const c = promoteCost(m.item);
      if (!canPromote(m.item) || !costOk(c)) return;
      state.gold -= c.gold; state.shards -= c.shards; promoteItem(m.item); state.pushBlocked = false;
      afterChange(); reopen(); toast(`✨ Now <span class="${rc(m.item.rarity)}">${RARITIES[m.item.rarity].name}</span>`); return;
    }
    case 'salvage-menu': openSalvageMenu(); return;
    case 'salvage-upto': {
      const r = +el.dataset.r; let n = 0, sh = 0;
      state.bag = state.bag.filter((b) => { if (!b.locked && !b.set && !b.mythic && b.rarity <= r) { sh += salvage(state, b).shards; n++; return false; } return true; });
      closeModal(); toast(`♻️ Salvaged ${n} items · +💠${sh}`); break;
    }
    case 'sort': state.bag.sort((x, y) => (y.mythic ? 1 : 0) - (x.mythic ? 1 : 0) || (y.set ? 1 : 0) - (x.set ? 1 : 0) || y.rarity - x.rarity || y.ilvl - x.ilvl); break;
    case 'filter': bagFilter = +el.dataset.f; break;
    case 'sub': heroSub = el.dataset.s; skillPick = null; break;
    case 'zin': zoom($('#tree-svg'), 1.25); return;
    case 'zout': zoom($('#tree-svg'), 0.8); return;
    case 'zhome': centerOn($('#tree-svg'), `start_${H().cls}`); return;
    case 'auto-alloc': { const n = autoAllocate(state, HI()); toast(n ? `🌳 Allocated ${n} point${n > 1 ? 's' : ''}` : 'No useful nodes in reach'); break; }
    case 'alloc-path': {
      const id = getSelected(), path = pathTo(C(), id);
      if (!path.length || path.length > treePointsFree(C())) return;
      H().tree.push(...path); state.pushBlocked = false;
      if (NODES[id].keystone) toast(`${NODES[id].icon} ${NODES[id].name}!`);
      break;
    }
    case 'refund': {
      const id = getSelected(), c = refundCost(state.level);
      if (!canRefund(C(), id) || state.gold < c) return;
      state.gold -= c; H().tree = H().tree.filter((x) => x !== id); break;
    }
    case 'tree-reset': {
      const c = resetCost(state.level);
      if (state.gold < c || !confirm('Refund every passive point for this hero?')) return;
      state.gold -= c; H().tree = []; setSelected(null); break;
    }
    case 'pick-slot': skillPick = +el.dataset.i; break;
    case 'pick-cancel': skillPick = null; break;
    case 'assign': {
      const id = el.dataset.id, bar = H().skills.bar;
      const prev = bar.indexOf(id);
      if (prev >= 0) bar[prev] = bar[skillPick] || null;
      bar[skillPick] = id; skillPick = null; break;
    }
    case 'skill-up': {
      const h = H(), id = el.dataset.id, rank = h.skills.ranks[id], c = skillUpgradeCost(rank, state.level);
      if (rank >= MAX_SKILL_RANK || !costOk(c)) return;
      state.gold -= c.gold; state.shards -= c.shards; h.skills.ranks[id]++; state.pushBlocked = false;
      if (MILESTONES.includes(h.skills.ranks[id])) toast(`✨ ${SKILL_BY_ID[id].name}: choose an upgrade!`);
      if (m && m.skill) { afterChange(); openSkill(id); return; }
      break;
    }
    case 'skill-open': openSkill(el.dataset.id); return;
    case 'mod-pick': {
      const h = H(), id = el.dataset.id, i = +el.dataset.i, o = +el.dataset.o;
      const picks = h.skills.mods[id] || (h.skills.mods[id] = []);
      if (picks[i] != null) {
        const c = respecModCost(h.skills.ranks[id]);
        if (state.shards < c.shards) { toast('Not enough 💠'); return; }
        state.shards -= c.shards;
      }
      picks[i] = o; afterChange(); openSkill(id); return;
    }
    case 'asc-pick': {
      const h = H(), i = +el.dataset.i, o = +el.dataset.o;
      if (h.asc[i] != null) {
        const c = ascRespecCost(state.level);
        if (state.gold < c) { toast('Not enough gold'); return; }
        if (!confirm(`Change class passive for 🪙${fmt(c)}?`)) return;
        state.gold -= c;
      }
      h.asc[i] = o; state.pushBlocked = false;
      toast(`${CLASS_BY_ID[h.cls].icon} ${ASCENDANCY[h.cls][i][o].name}!`); break;
    }
    case 'tab-battle': tab = 'battle'; syncTabs(); break;
    case 'enter': {
      const err = startRun(state, el.dataset.k, +el.dataset.t);
      if (err) { toast(err); return; }
      tab = 'battle'; syncTabs();
      toast({ raid: '🔱 Raid started!', dungeon: '🗝️ Vault opened!', invasion: '🐉 The world boss attacks!' }[el.dataset.k]); break;
    }
    case 'abandon':
      if (state.run && state.run.kind !== 'invasion' && !confirm('Abandon this run? Your key/sigil is lost.')) return;
      abandonRun(state, ev); break;
    case 'pick-role-class': { const i = HI(); openClassPicker(state.heroes[i].role, true, i); return; }
    case 'pick-class': {
      const id = el.dataset.id, i = +el.dataset.i;
      const h = state.heroes[i];
      const changing = !!h.cls;
      if (changing) {
        const c = resetCost(state.level) * 2;
        if (state.gold < c) return;
        state.gold -= c;
      }
      h.cls = id; h.tree = []; h.asc = []; h.skills.bar = h.skills.bar.map((s) => (s && SKILL_BY_ID[s] && SKILL_BY_ID[s].cls ? null : s));
      if (!changing && h.gear.weapon && h.gear.weapon.rarity === 0 && h.gear.weapon.ilvl <= 1) h.gear.weapon = newHero(h.role, id).gear.weapon;
      syncSkills(state);
      modalCtx = null; $('#modal').classList.add('hidden');
      state.combat = null; ensureCombat(state);
      toast(`${CLASS_BY_ID[id].icon} ${CLASS_BY_ID[id].name} joins the party`);
      afterChange();
      if (ensureParty() && !changing) offlineCatchUp();
      return;
    }
    case 'change-class': openClassPicker(H().role, true, HI()); return;
    case 'pet-set': state.pets.active = el.dataset.id; break;
    case 'pet-up': {
      const id = state.pets.active, l = state.pets.owned[id], c = petUpgradeCost(l);
      if (l >= PET_MAX_LEVEL || !costOk(c)) return;
      state.gold -= c.gold; state.shards -= c.shards; state.pets.owned[id]++; break;
    }
    case 'hatch': {
      const r = hatchEgg(state);
      if (r) toast(r.dup ? `🥚 ${r.pet.name} again: now Lv ${state.pets.owned[r.pet.id]}!` : `🥚 New pet: ${r.pet.name}!`);
      break;
    }
    case 'open-box': {
      const t = +el.dataset.t;
      const r = openBox(state, t, ev);
      if (r) showBox(t, r);
      afterChange();
      return;
    }
    case 'buy': { if (buyShop(state, el.dataset.id)) toast(`Bought ${SHOP.find((s) => s.id === el.dataset.id).name}`); break; }
    case 'set-autoequip': state.settings.autoEquip = !state.settings.autoEquip; break;
    case 'export': {
      save(state);
      const box = $('#save-box'); box.classList.remove('hidden');
      box.value = btoa(unescape(encodeURIComponent(localStorage.getItem(SAVE_KEY))));
      box.select(); try { navigator.clipboard.writeText(box.value); toast('Save copied'); } catch {}
      return;
    }
    case 'import': {
      const box = $('#save-box');
      if (box.classList.contains('hidden') || !box.value.trim()) { box.classList.remove('hidden'); box.value = ''; box.focus(); return; }
      try {
        const json = decodeURIComponent(escape(atob(box.value.trim())));
        JSON.parse(json); localStorage.setItem(SAVE_KEY, json); location.reload();
      } catch { toast('Invalid save'); }
      return;
    }
    case 'reset':
      if (!confirm('Delete your save and start over? This cannot be undone.')) return;
      localStorage.removeItem(SAVE_KEY); state = newState(); ensureCombat(state); render(); ensureParty(); return;
    default: return;
  }
  afterChange();
}
function showBox(t, r) {
  $('#modal-card').innerHTML = `<h2>${BOX_INFO[t].icon} ${BOX_INFO[t].name}</h2>
    <div class="feed">${r.items.map((l) => `<div><span class="${l.set ? 'rset' : rc(l.rarity)}">${TYPE_ICONS[l.type]} ${l.name}</span><span class="act ${l.action}">${l.action === 'equipped' && l.hero != null ? `→ ${heroName(l.hero)}` : l.action}</span></div>`).join('')}
    ${r.extras.map((x) => `<div><span>${x}</span></div>`).join('')}</div>
    <div class="actions"><button class="btn primary full" data-act="close">Nice</button></div>`;
  modalCtx = null;
  $('#modal').classList.remove('hidden');
}
document.body.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (el && !el.disabled) doAction(el);
});
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });

// ---------- Main loop ----------
function showRunEnd(e) {
  if (e.run.kind === 'invasion') {
    $('#modal-card').innerHTML = `<h2>🐉 Invasion over</h2>
      <p>Your party dealt <b>${fmt(e.damage)}</b> damage to ${e.run.name}.</p>
      <div class="rank rank-${e.reward.tier}">Rank ${e.reward.tier}</div>
      <p class="good">+🏅${e.reward.emblems} emblems · ${Object.entries(e.reward.boxes).map(([k, n]) => `${n}× ${BOX_INFO[k].name}`).join(' · ')}</p>
      <div class="actions"><button class="btn primary full" data-act="close">Collect</button></div>`;
    modalCtx = null;
    $('#modal').classList.remove('hidden');
    return;
  }
  const name = e.run.kind === 'raid' ? raidName(e.run.tier) : dungeonName(e.run.tier);
  toast(e.success ? `🏆 ${name} cleared! ${e.reason}` : `💀 ${name} failed: ${e.reason}`);
}
let battleDirty = false;
let last = performance.now(), acc = 0, lastSave = Date.now(), dirtyAt = 0, lastRender = 0;
const STEP = 0.05;
function frame(now) {
  const dt = Math.min(1, (now - last) / 1000);
  last = now;
  if (partyReady(state)) {
    acc += dt * state.settings.speed;
    while (acc >= STEP) { tick(state, STEP, ev); acc -= STEP; }
  }
  let structural = false;
  for (const e of ev) {
    switch (e.t) {
      case 'skillUnlock': toast(`✴️ ${heroName(e.hero)} learned ${e.sk.icon} ${e.sk.name}`); break;
      case 'key': toast(`🗝️ Vault Key${e.first ? ' (first kill)' : ''}`); break;
      case 'egg': toast('🥚 Pet Egg found!'); break;
      case 'phase': toast(`🔱 Phase ${e.phase}!`); break;
      case 'room': toast(e.room > DUNGEON.rooms ? '💀 The Warden awakens' : `🚪 Room ${e.room}`); break;
      case 'heroDown': toast(`💀 ${heroName(e.i)} is down!`); break;
      case 'phoenix': toast(`🔥 Phoenix revives ${heroName(e.i)}!`); break;
      case 'runEnd': structural = true; battleDirty = true; showRunEnd(e); break;
      case 'level': toast(`⭐ Level ${e.level}! +1 passive point for each hero`); structural = true; battleDirty = true; break;
      case 'stage': structural = true; battleDirty = true; if (isBossStage(e.stage)) toast(`👑 Boss: ${zoneFor(e.stage).bossName}`); break;
      case 'death': toast('☠️ Party wiped. Falling back a stage.'); structural = true; battleDirty = true; break;
      case 'equip': toast(`▲ ${ROLES[roleOf(e.hero)].icon} <span class="${nc(e.item)}">${e.item.name}</span> <span class="good">+${(e.gain * 100).toFixed(1)}%</span>`); structural = true; break;
      case 'loot': if (e.item.rarity >= 3 || e.item.set) toast(`<span class="${nc(e.item)}">${e.item.set ? 'Set' : e.item.mythic ? '✦ Mythic' : RARITIES[e.item.rarity].name}: ${e.item.name}</span>`); structural = true; break;
      case 'kill': if (tab === 'battle') renderFeed(); break;
    }
  }
  if (tab === 'battle' && !document.hidden) {
    state._zoneBg = zoneFor(state.stage).bg;
    for (const e of ev) { try { arena.onEvent(e, state); } catch (err) { console.warn(err); } }
    arena.frame(dt, state);
  }
  ev.length = 0;
  if (structural) dirtyAt = now;
  if (dirtyAt > lastRender && now - lastRender > 700 && $('#modal').classList.contains('hidden')) {
    lastRender = now;
    if (tab === 'battle') { if (battleDirty) { battleDirty = false; renderBattle(); } else renderFeed(); }
    else if (tab === 'bag' || tab === 'events') render(); else renderHud();
  }
  renderHud();
  updateBattle();
  if (Date.now() - lastSave > 10000) { save(state); lastSave = Date.now(); }
  requestAnimationFrame(frame);
}

// ---------- Offline progress ----------
function offlineCatchUp() {
  const away = (Date.now() - (state.lastSave || Date.now())) / 1000;
  if (away < 30 || !partyReady(state)) return;
  const secs = Math.min(away, 8 * 3600);
  const r = simulate(state, secs, 0.25);
  save(state);
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60);
  $('#modal-card').innerHTML = `<h2>While you were away</h2>
    <p class="muted">${h ? h + 'h ' : ''}${m}m of fighting${away > secs ? ' (8h max)' : ''}</p>
    <div class="sheet">
      <span>Monsters slain</span><b>${fmt(r.kills)}</b>
      <span>Gold</span><b>🪙 ${fmt(r.gold)}</b>
      <span>Shards</span><b>💠 ${fmt(r.shards)}</b>
      <span>Levels gained</span><b>${r.levels}</b>
      <span>New best stage</span><b>${r.stages > 0 ? '+' + r.stages : '—'}</b>
      <span>Upgrades equipped</span><b>${r.equips}</b>
    </div>
    <div class="actions"><button class="btn primary full" data-act="close">Continue</button></div>`;
  modalCtx = null;
  $('#modal').classList.remove('hidden');
  render();
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) save(state);
  else { offlineCatchUp(); last = performance.now(); }
});
window.addEventListener('pagehide', () => save(state));
window.addEventListener('resize', () => arena.resize());

render();
if (state.migrated) {
  delete state.migrated;
  setTimeout(() => toast('⚔️ Your hero now leads a party of three! Pick classes for your new allies.'), 300);
}
if (state.treeReset) { delete state.treeReset; setTimeout(() => toast('🌳 The passive tree was redesigned. All points refunded!'), 1200); }
if (ensureParty()) offlineCatchUp();
requestAnimationFrame(frame);

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

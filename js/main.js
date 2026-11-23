// Eternal Ascent UI: 5 tabs (Battle, Character, Equipment, Skills, Activities), modals, settings, offline report.
import { CLASSES, CLASS_KEYS, ATTRS, ATTR_KEYS, UNLOCKS, unlocked, SLOTS, SLOT_INFO, RARITIES, UNIQUES, GEMS, GEM_KEYS, GEM_TIERS, gemValue, RUNES, RUNE_KEYS, RUNE_MAX, runeCraftCost, runeSlots,
  INSCR_TAGS, INSCR_SLOTS, COMPANIONS, COMP_KEYS, evoOf, EVOLUTIONS, MATERIALS, MAT_KEYS, RECIPES, REGIONS, STAGES_PER_REGION, WAVES_PER_STAGE, regionOf, stageLevel, MAX_STAGE,
  WORLD_TIERS, DUNGEONS, DUNGEON_KEYS, ACTIVITIES, ASC_PERKS, STAT_NAMES, PCT_STATS, TALENT_STATS, TALENT_VAL, specOf, LEVEL_CAP, ELITE_MODS, AFFIXES } from './data.js';
import { itemStats, statLine, fmt, enhanceCost, refineCost, enchantCost, awakenItemCost, canAwaken, ENHANCE_MAX, REFINE_MAX, ENCHANT_MAX, salvageValue } from './items.js';
import { computeStats, xpToNext, masteryXp, talentPointsTotal, talentPointsSpent, talentFree, talentMax, talentRowOpen, attrPointsTotal, attrPointsSpent, unlockedSlots, inscriptionSets, companionBonus } from './stats.js';
import { SKILLS, SLOT_ROLES, skillsForRole, skillText, skillUpgradeCost, SKILL_MAX, awakenCost, STATUS, ELEM_ICONS } from './skills.js';
import * as sys from './systems.js';
import { tick, ensureCombat, setStage, startRun, leaveRun, simulateOffline, refreshStats, runLevel } from './game.js';
import { optimiseAll } from './optimize.js';
import { Arena, setSkillNamer, fmtN } from './fx.js';
import { Scene3D } from './scene3d.js';

const VERSION = '2026.11.23-ea6';
const $ = (s, r = document) => r.querySelector(s);
const view = $('#view');
const arena = new Arena();
let scene3d = null;
const use3D = () => state && state.settings.view !== '2d' && (scene3d || (scene3d = new Scene3D())).ok;
setSkillNamer((id) => SKILLS[id]?.name || id);
let state = sys.load();
let tab = 'battle';
const sub = { character: 'stats', equipment: 'gear', skills: 'slots', activities: 'list' };
let bagFilter = { slot: 'all', rarity: -1 };
const lootLog = [];
let pendingReport = null;
let resetting = false;
const saveNow = () => { if (state && state.picked && !resetting) sys.save(state); };

// ---------------- helpers ----------------
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const rc = (r) => RARITIES[r].color;
const costHtml = (cost) => Object.entries(cost).filter(([, v]) => v).map(([k, v]) => {
  const have = k === 'gold' ? state.gold : state.mats[k] || 0;
  return `<span class="${have >= v ? '' : 'bad'}">${k === 'gold' ? '🪙' : MATERIALS[k].icon}${fmt(v)}</span>`;
}).join(' ');
const st = () => sys.stats(state);
function toast(html, cls = '') {
  const t = document.createElement('div');
  t.className = 'toast ' + cls; t.innerHTML = html;
  $('#toasts').appendChild(t);
  setTimeout(() => t.classList.add('out'), 2600);
  setTimeout(() => t.remove(), 3100);
  while ($('#toasts').children.length > 4) $('#toasts').firstChild.remove();
}
function modal(html, cls = '') { $('#modal-card').className = 'modal-card ' + cls; $('#modal-card').innerHTML = html; $('#modal').classList.remove('hidden'); }
function closeModal() { $('#modal').classList.add('hidden'); }
const stageName = (s) => `${Math.ceil(s / STAGES_PER_REGION)}-${((s - 1) % STAGES_PER_REGION) + 1}`;
let audioCtx = null;
function sfx(kind) {
  if (!state?.settings.sound) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    const f = { crit: 520, loot: 880, level: 660, boss: 180, hurt: 120 }[kind] || 440;
    o.frequency.value = f; o.type = kind === 'boss' || kind === 'hurt' ? 'sawtooth' : 'triangle';
    g.gain.value = 0.05; g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.25);
    o.connect(g).connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + 0.25);
  } catch (_) {}
}
function applySettings() {
  document.documentElement.dataset.text = state.settings.text;
  arena.opt(state.settings);
  if (scene3d) scene3d.opt(state.settings);
}

// ---------------- HUD ----------------
function hud() {
  const s = st();
  $('#hud-cls').textContent = CLASSES[state.cls].icon;
  $('#hud-level').textContent = state.level >= LEVEL_CAP ? `${LEVEL_CAP} · M${state.mastery}` : state.level;
  const need = state.level >= LEVEL_CAP ? masteryXp(state.mastery) : xpToNext(state.level);
  const cur = state.level >= LEVEL_CAP ? state.masteryXp : state.xp;
  $('#hud-xp').style.width = Math.min(100, (cur / need) * 100) + '%';
  $('#hud-xp-text').textContent = `${fmt(cur)} / ${fmt(need)} ${state.level >= LEVEL_CAP ? 'mastery' : 'xp'}`;
  $('#hud-gold').textContent = fmt(state.gold);
  $('#hud-power').textContent = fmt(s.power);
  const wt = WORLD_TIERS[state.worldTier];
  $('#hud-tier').textContent = wt.name; $('#hud-tier').style.color = wt.color;
  $('#hud-asc').textContent = state.ascensions ? `✦${state.ascensions}` : '';
  // badges
  const freeT = unlocked(state, 'talents') ? talentFree(state) : 0;
  $('#badge-character').textContent = (state.level >= 10 && !state.spec ? '!' : '') || (freeT > 0 ? freeT : '');
  const nb = state.bag.filter((i) => i.isNew).length;
  $('#badge-equipment').textContent = nb ? (nb > 9 ? '9+' : nb) : '';
}

// ---------------- Battle ----------------
function renderBattle() {
  const r = state.run;
  const reg = REGIONS[regionOf(state.stage)];
  const head = r ? `<div class="zone"><div><div class="name">${ACTIVITIES[r.kind].icon} ${runTitle(r)}</div><div class="muted small">${runSub(r)}</div></div>
      <button class="btn small danger" data-act="leave">Leave</button></div>`
    : `<div class="zone"><div><div class="name">${reg.name}</div><div class="muted small">Stage <b>${stageName(state.stage)}</b> · monster lvl ${stageLevel(state.stage)} · best ${stageName(state.maxStage)}</div></div>
      <div class="stage-ctl"><button class="btn small" data-act="stage" data-d="-1">◀</button><button class="btn small ${state.autoAdvance ? 'toggle on' : 'toggle'}" data-act="auto">Auto ${state.autoAdvance ? 'on' : 'off'}</button><button class="btn small" data-act="stage" data-d="1">▶</button></div></div>`;
  view.innerHTML = `
    <div class="panel tight">${head}<div class="waves" id="waves"></div></div>
    <div class="arena ${use3D() ? 'iso' : ''}" id="arena"><div class="bossbar hidden" id="bossbar"><div class="bb-name" id="bb-name"></div><div class="bar boss"><div class="fill" id="bb-fill"></div><span id="bb-text"></span></div><div class="tele hidden" id="tele"><div class="fill" id="tele-fill"></div><span id="tele-text"></span></div></div></div>
    <div class="herobars">
      <div class="bar hp"><div class="fill" id="h-hp"></div><div class="shield" id="h-sh"></div><span id="h-hp-t"></span></div>
      <div class="bar res"><div class="fill" id="h-res"></div><span id="h-res-t"></span></div>
    </div>
    <div class="skillbar" id="skillbar">${SLOT_ROLES.map((ro) => `<div class="sk" data-role="${ro.id}" data-act="gotoSkills"><div class="ic"></div><div class="cd"></div><div class="lbl"></div></div>`).join('')}</div>
    <div class="row2">
      <button class="btn primary grow" data-act="optimise">⚡ Optimise</button>
      <button class="btn grow" data-act="tab" data-tab="activities">🗺️ Activities</button>
    </div>
    <div class="panel"><h3>Next goals</h3><div id="goals"></div></div>
    <div class="panel"><h3>Recent loot</h3><div id="lootlog" class="lootlog"></div></div>`;
  if (use3D()) { scene3d.opt(state.settings); scene3d.mount($('#arena')); } else arena.mount($('#arena'));
  refreshGoals(); refreshLootLog();
  battleTick(true);
}
function runTitle(r) {
  if (r.kind === 'dungeon') return `${DUNGEONS[r.key].name} T${r.tier}`;
  if (r.kind === 'tower') return `Endless Tower — floor ${r.floor}`;
  if (r.kind === 'rift') return `Rift ${r.tier}`;
  return ACTIVITIES[r.kind].name;
}
function runSub(r) {
  if (r.kind === 'rift') return r.modList.map((m) => m.text).join(' · ');
  if (r.kind === 'dungeon') return DUNGEONS[r.key].text + ` · lvl ${r.lvl}`;
  if (r.kind === 'vault') return `${Math.max(0, Math.ceil(r.timeLimit - r.t))}s left`;
  if (r.kind === 'tower') return `Best floor ${state.towerBest} · milestone every 10 floors`;
  return `Level ${r.lvl}`;
}
function refreshGoals() { const el = $('#goals'); if (el) el.innerHTML = sys.nextGoals(state).slice(0, 3).map((g) => `<div class="goal" data-act="tab" data-tab="${g.tab}">➜ ${esc(g.text)}</div>`).join(''); }
function refreshLootLog() { const el = $('#lootlog'); if (el) el.innerHTML = lootLog.length ? lootLog.map((l) => `<div style="color:${rc(l.rarity)}">${esc(l.name)} <span class="muted">${l.res === 'equipped' ? '✓ equipped' : l.res === 'salvaged' ? 'salvaged' : 'to bag'}</span></div>`).join('') : '<div class="muted">Nothing yet.</div>'; }

let lastBattleDom = 0;
function battleTick(force) {
  if (tab !== 'battle') return;
  const now = performance.now();
  if (!force && now - lastBattleDom < 100) return;
  lastBattleDom = now;
  const c = state.combat; if (!c) return;
  const h = c.hero, S = c.st;
  const hpk = Math.max(0, h.hp / S.hp);
  const hp = $('#h-hp'); if (!hp) return;
  hp.style.width = hpk * 100 + '%';
  $('#h-sh').style.width = Math.min(100, (h.shield / S.hp) * 100) + '%';
  $('#h-hp-t').textContent = h.dead > 0 ? `Respawning ${Math.ceil(h.dead)}s` : `${fmt(h.hp)} / ${fmt(S.hp)}${h.shield > 0 ? ` (+${fmt(h.shield)})` : ''}`;
  $('#h-res').style.width = h.res + '%';
  $('#h-res-t').textContent = `${CLASSES[state.cls].res} ${Math.floor(h.res)}`;
  const waves = $('#waves');
  const total = state.run ? (state.run.kind === 'tower' ? 0 : c.waves) : WAVES_PER_STAGE;
  if (waves) waves.innerHTML = total ? Array.from({ length: total }, (_, i) => `<i class="${i < c.wave ? 'done' : i === c.wave ? 'cur' : ''} ${(!state.run && state.stage % 10 === 0 && i === total - 1) || (state.run && i === total - 1 && ['dungeon', 'rift'].includes(state.run.kind)) ? 'boss' : ''}"></i>`).join('') : '';
  const boss = c.enemies.find((e) => e.boss && e.hp > 0);
  const bb = $('#bossbar');
  if (boss) {
    bb.classList.remove('hidden');
    $('#bb-name').innerHTML = `${esc(boss.name)} <span class="muted">· ${esc(boss.phaseNames[boss.phase] || '')}${boss.enraged ? ' · <b class="bad">Enraged</b>' : ''}</span>`;
    $('#bb-fill').style.width = (boss.hp / boss.maxHp) * 100 + '%';
    $('#bb-text').textContent = `${fmt(boss.hp)} (${Math.ceil((boss.hp / boss.maxHp) * 100)}%)`;
    const te = $('#tele');
    if (boss.tele) { te.classList.remove('hidden'); $('#tele-fill').style.width = (1 - boss.tele.t / boss.tele.total) * 100 + '%'; $('#tele-text').textContent = `⚠ ${boss.tele.name}`; }
    else te.classList.add('hidden');
  } else bb.classList.add('hidden');
  // skill bar
  const slots = unlockedSlots(state);
  for (const el of document.querySelectorAll('#skillbar .sk')) {
    const role = el.dataset.role, id = state.skills[role], ro = SLOT_ROLES.find((x) => x.id === role);
    const open = slots.includes(role);
    el.classList.toggle('locked', !open);
    el.querySelector('.ic').textContent = open ? (id ? SKILLS[id].icon : '＋') : '🔒';
    el.querySelector('.lbl').textContent = open ? (id ? `R${state.skillRanks[id] || 1}` : ro.name) : `L${ro.lvl}`;
    const cd = h.cds[role] || 0, full = id ? SKILLS[id].cd : 1;
    el.querySelector('.cd').style.height = open && cd > 0 ? Math.min(100, (cd / full) * 100) + '%' : '0';
  }
  if (state.run?.kind === 'vault' || state.run?.kind === 'tower') { const t = document.querySelector('.zone .small'); if (t) t.textContent = runSub(state.run); const n = document.querySelector('.zone .name'); if (n) n.textContent = `${ACTIVITIES[state.run.kind].icon} ${runTitle(state.run)}`; }
}

// ---------------- Character ----------------
function renderCharacter() {
  const tabs = [['stats', 'Stats'], ['spec', 'Spec & Talents'], ['attrs', 'Attributes'], ['comp', 'Companions'], ['asc', 'Ascension']];
  let body = '';
  const s = st();
  if (sub.character === 'stats') {
    const cls = CLASSES[state.cls];
    const rows = [
      ['Power', fmt(s.power)], ['Life', fmt(s.hp)], ['Attack', fmt(s.attack)], ['Armour', fmt(s.armour)], [`${cls.dmg === 'phys' ? 'Physical' : 'Magic'} damage`, `+${Math.round(s.typePct)}%`],
      ['Attack speed', `${s.aspd.toFixed(2)}/s`], ['Crit chance', `${s.crit.toFixed(1)}%`], ['Crit damage', `+${Math.round(s.critDmg)}%`], ['Cooldown reduction', `${s.cdr.toFixed(1)}%`],
      ['Resistances', `${Math.round(s.resist)}%`], ['Damage reduction', `${Math.round(s.dr)}%`], ['Life steal', `${s.leech.toFixed(1)}%`], ['Boss damage', `+${Math.round(s.boss)}%`],
      ['More damage', `x${s.more.toFixed(2)}`], ['Gold find', `+${Math.round(s.gold)}%`], ['Rarity find', `+${Math.round(s.mf)}%`], ['Experience', `+${Math.round(s.xp)}%`],
    ];
    const elems = Object.entries(s.elem).filter(([k, v]) => v && k !== 'nature').map(([k, v]) => `${ELEM_ICONS[k]} +${Math.round(v)}%`).join(' · ');
    body = `<div class="panel"><div class="hero-card"><img src="assets/heroes/${cls.art}.webp" alt=""><div><h2>${cls.icon} ${cls.name}${specOf(state) ? ' · ' + specOf(state).name : ''}</h2>
        <div class="muted">Level ${state.level}${state.level >= LEVEL_CAP ? ` · Mastery ${state.mastery}` : ''} · ${WORLD_TIERS[state.worldTier].name}${state.ascensions ? ` · Ascension ${state.ascensions}` : ''}</div>
        <div class="muted small">Kills ${fmt(state.totals.kills)} · Bosses ${fmt(state.totals.bosses)} · Deaths ${state.totals.deaths}</div></div></div></div>
      <div class="panel"><div class="kv">${rows.map(([k, v]) => `<div>${k}</div><b>${v}</b>`).join('')}</div>${elems ? `<div class="muted small" style="margin-top:6px">Elements: ${elems}</div>` : ''}
        ${s.flags.size ? `<div class="small" style="margin-top:6px">${[...s.flags].filter((f) => UNIQUES[f]).map((f) => `<div class="uniq">★ ${UNIQUES[f].text}</div>`).join('')}</div>` : ''}</div>
      <div class="panel"><h3>Milestones</h3>${UNLOCKS.map((u) => `<div class="unlock ${state.level >= u.lvl || state.ascensions ? 'done' : ''}"><b>L${u.lvl}</b> ${u.text}</div>`).join('')}</div>`;
  } else if (sub.character === 'spec') {
    const cls = CLASSES[state.cls];
    const free = talentFree(state);
    body = `<div class="panel"><h3>Specialisation ${state.level < 10 && !state.ascensions ? '<span class="muted small">(unlocks at level 10)</span>' : ''}</h3>
      <div class="specs">${cls.specs.map((sp) => `<div class="spec ${state.spec === sp.id ? 'on' : ''}" data-act="spec" data-id="${sp.id}">
        <b>${cls.trees.find((t) => t.id === sp.tree).icon} ${sp.name}</b><div class="small">${sp.desc}</div>
        <div class="small good">${Object.entries(sp.t1).map(([k, v]) => statLine(k, v)).join(', ')}</div><div class="small ${state.level >= 40 || state.ascensions ? 'good' : 'muted'}">L40: ${sp.t2txt}</div></div>`).join('')}</div>
      <div class="muted small">Respec: ${sys.respecCost(state) ? '🪙' + fmt(sys.respecCost(state)) : 'free until level 30'}</div></div>
      <div class="panel"><h3>Talents <span class="muted small">${unlocked(state, 'talents') ? `${free} free of ${talentPointsTotal(state)}` : 'unlock at level 25'}</span></h3>
      <div class="trees">${cls.trees.map((t) => {
        const ranks = state.talents[t.id] || [];
        const max = talentMax(state, t.id);
        return `<div class="tree ${specOf(state)?.tree === t.id ? 'spec' : ''}"><div class="tt">${t.icon} ${t.name}</div>${TALENT_STATS[t.id].map((stat, i) => {
          const r = ranks[i] || 0, open = talentRowOpen(state, t.id, i);
          return `<div class="tal ${r ? 'on' : ''} ${open ? '' : 'lock'}" data-act="talent" data-tree="${t.id}" data-i="${i}"><span>${STAT_NAMES[stat] || stat}${stat === 'treeDmg' ? ` (${t.name})` : ''}</span><b>${r}/${max}</b><div class="small muted">${PCT_STATS.has(stat) ? '+' + TALENT_VAL[stat] + '%' : '+' + TALENT_VAL[stat]} / rank</div></div>`;
        }).join('')}</div>`;
      }).join('')}</div>
      <div class="row2"><button class="btn small" data-act="autoTalents">Auto-spend</button><button class="btn small" data-act="resetTalents">Reset (${sys.respecCost(state) ? '🪙' + fmt(sys.respecCost(state)) : 'free'})</button></div>
      <div class="muted small">Your spec's tree goes to rank 5, others to rank 3. Each pair of rows needs 3 more points in that tree.</div></div>`;
  } else if (sub.character === 'attrs') {
    const free = attrPointsTotal(state) - attrPointsSpent(state);
    body = `<div class="panel"><h3>Attributes <span class="muted small">${free} unspent · ${attrPointsTotal(state)} total</span></h3>
      ${ATTR_KEYS.map((k) => `<div class="attr"><span>${ATTRS[k].icon} <b>${ATTRS[k].name}</b> <span class="muted small">${ATTRS[k].desc}</span></span><span><b>${Math.round(s.attrs[k])}</b> <span class="muted small">(${state.attrs[k]} pts)</span> <button class="btn small" data-act="attr" data-k="${k}" ${free <= 0 ? 'disabled' : ''}>+</button></span></div>`).join('')}
      <div class="row2"><button class="btn small" data-act="autoAttrs">Auto-allocate</button><button class="btn small" data-act="resetAttrs">Reset (free)</button></div>
      <div class="muted small">You gain 5 points per level. New points are auto-allocated for your class; reset any time for free.</div></div>`;
  } else if (sub.character === 'comp') {
    const c = state.companions;
    const ps = sys.passiveSlots(state);
    body = `<div class="panel"><h3>Companions</h3><div class="muted small">1 active (fights and gives its full bonus) + ${ps} passive (half bonus). Passive slots unlock at levels 20 and 45.</div></div>
      ${COMP_KEYS.map((id) => {
        const d = COMPANIONS[id], own = c.owned[id], lvl = c.levels[id] || 1, evo = evoOf(lvl);
        const where = c.active === id ? 'Active' : c.passive.includes(id) ? 'Passive' : '';
        const nextEvo = EVOLUTIONS.find((e) => e.lvl > lvl);
        const val = (d.base + d.per * (lvl - 1)) * evo.mult;
        return `<div class="panel comp ${own ? '' : 'locked'}"><img src="assets/${d.art[0]}/${d.art[1]}.webp" class="${d.art[0] === 'monsters' ? 'flip' : ''}" alt="">
          <div class="grow"><b>${evo.name} ${d.name}</b> ${where ? `<span class="tag">${where}</span>` : ''}<div class="small">${own ? `Lvl ${lvl} · ${d.text}: +${val.toFixed(1)}${d.stat === 'healEvery' ? '% life / 5s' : '%'}` : '🔒 ' + d.unlock}</div>
          ${own && nextEvo ? `<div class="small muted">Evolves to ${nextEvo.name} at level ${nextEvo.lvl} (x${nextEvo.mult})</div>` : ''}
          ${own ? `<div class="row2"><button class="btn small" data-act="compLvl" data-id="${id}">Level up ${costHtml(sys.companionCost(state, id))}</button>
            ${c.active !== id ? `<button class="btn small" data-act="compSet" data-id="${id}" data-w="active">Make active</button>` : ''}
            ${ps > 0 && !c.passive.includes(id) && c.active !== id ? `<button class="btn small" data-act="compSet" data-id="${id}" data-w="${c.passive[0] && ps > 1 ? 1 : 0}">Passive</button>` : ''}</div>` : ''}</div></div>`;
      }).join('')}`;
  } else if (sub.character === 'asc') {
    const can = sys.canAscend(state);
    body = `<div class="panel"><h3>Mastery</h3>${state.level >= LEVEL_CAP ? `<div>Mastery level <b>${state.mastery}</b> — each level gives +0.5% damage and +0.5% life; every 5 levels a talent point.</div>
        <div class="bar xp" style="margin-top:6px"><div class="fill" style="width:${(state.masteryXp / masteryXp(state.mastery)) * 100}%"></div></div>` : `<div class="muted">Unlocks at level ${LEVEL_CAP}. Experience past the cap becomes Mastery.</div>`}</div>
      <div class="panel"><h3>World Tier</h3><div class="tiers">${WORLD_TIERS.map((w, i) => `<button class="btn small ${state.worldTier === i ? 'primary' : ''}" data-act="tier" data-i="${i}" ${i > state.maxWorldTier ? 'disabled' : ''} style="color:${w.color}">${w.name}</button>`).join('')}</div>
        <div class="muted small">Beat The Eternal One on your highest tier to unlock the next. Higher tiers: monsters x${WORLD_TIERS[Math.min(4, state.worldTier + 1)].mult}, +${WORLD_TIERS[Math.min(4, state.worldTier + 1)].ilvl} item level, more rarity. Ancient items drop from Hell.</div></div>
      <div class="panel"><h3>Ascension ${state.ascensions ? `<span class="tag">${state.ascensions}</span>` : ''}</h3>
        <div class="small">Reset to level 1 and stage 1-1 (you keep gear, gems, runes, companions and materials) for permanent Ascension points. Monsters get 2x stronger per Ascension.</div>
        <div class="small muted">Needs level ${LEVEL_CAP} and The Eternal One defeated. Now worth <b>${sys.ascensionPoints(state)}</b> points (3 + 2 per world tier + tower/10 + mastery/10).</div>
        <button class="btn ${can ? 'primary' : ''}" data-act="ascend" ${can ? '' : 'disabled'}>Ascend</button></div>
      <div class="panel"><h3>Ascension perks <span class="muted small">${state.ascPoints} points</span></h3>${Object.entries(ASC_PERKS).map(([k, p]) => `<div class="attr"><span>${p.icon} <b>${p.name}</b> <span class="muted small">${p.text}</span></span><span><b>${state.ascPerks[k] || 0}</b> <button class="btn small" data-act="perk" data-k="${k}" ${state.ascPoints > 0 ? '' : 'disabled'}>+</button></span></div>`).join('')}</div>`;
  }
  view.innerHTML = subtabs('character', tabs) + body;
}
function subtabs(t, list) { return `<div class="subtabs">${list.map(([k, n]) => `<button class="${sub[t] === k ? 'on' : ''}" data-act="sub" data-t="${t}" data-k="${k}">${n}</button>`).join('')}</div>`; }

// ---------------- Equipment ----------------
function itemCard(it, opts = {}) {
  const d = opts.delta;
  return `<div class="item" data-act="item" data-id="${it.id}" style="border-color:${rc(it.rarity)}">
    <div class="ii">${SLOT_INFO[it.slot].icon}${it.enhance ? `<i>+${it.enhance}</i>` : ''}</div>
    <div class="grow"><div style="color:${rc(it.rarity)}">${it.locked ? '🔒 ' : ''}${esc(it.name)}${it.awakened ? ' ✦' : ''}</div>
    <div class="small muted">${RARITIES[it.rarity].name} · ilvl ${it.ilvl}${it.unique ? ' · ★' : ''}${it.isNew ? ' · <b class="good">new</b>' : ''}</div></div>
    ${d !== undefined ? `<div class="delta ${d > 0 ? 'good' : d < 0 ? 'bad' : 'muted'}">${d > 0 ? '▲' : d < 0 ? '▼' : ''}${fmt(Math.abs(d))}</div>` : ''}</div>`;
}
function renderEquipment() {
  const tabs = [['gear', 'Gear'], ['bag', `Bag (${state.bag.length}/${sys.BAG_CAP})`], ['gems', 'Gems & Runes'], ['ins', 'Inscriptions'], ['craft', 'Crafting']];
  let body = '';
  if (sub.equipment === 'gear') {
    body = `<div class="gear-grid">${SLOTS.map((slot) => {
      const it = state.gear[slot];
      return `<div class="gslot" data-act="${it ? 'item' : 'filterSlot'}" data-id="${it ? it.id : ''}" data-slot="${slot}" style="${it ? `border-color:${rc(it.rarity)}` : ''}">
        <div class="gi">${SLOT_INFO[slot].icon}</div><div class="gn" style="color:${it ? rc(it.rarity) : ''}">${it ? esc(it.name) : SLOT_INFO[slot].name}</div>
        ${it ? `<div class="small muted">ilvl ${it.ilvl}${it.enhance ? ` · +${it.enhance}` : ''}${it.sockets.length ? ` · ${it.sockets.map((g) => (g ? GEMS[g.slice(0, -1)].icon : '◇')).join('')}` : ''}</div>` : '<div class="small muted">empty</div>'}</div>`;
    }).join('')}</div>
    <div class="row2"><button class="btn primary grow" data-act="optimise">⚡ Optimise everything</button></div>
    <div class="muted small">Optimise equips your best gear, picks skills, sockets gems, sets runes, inscriptions and companions, then spends gold and materials where they raise Power most.</div>`;
  } else if (sub.equipment === 'bag') {
    const f = bagFilter;
    let items = state.bag.filter((it) => (f.slot === 'all' || it.slot === f.slot) && (f.rarity < 0 || it.rarity === f.rarity));
    const deltas = new Map(items.slice(0, 80).map((it) => [it.id, sys.itemPowerDelta(state, it)]));
    items = items.slice(0, 80).sort((a, b) => deltas.get(b.id) - deltas.get(a.id));
    const sf = state.filters;
    body = `<div class="filters"><select data-act="bagSlot"><option value="all">All slots</option>${SLOTS.filter((s) => s !== 'ring2').map((s) => `<option value="${s}" ${f.slot === s ? 'selected' : ''}>${SLOT_INFO[s].name}</option>`).join('')}</select>
      <select data-act="bagRar"><option value="-1">All rarities</option>${RARITIES.map((r, i) => `<option value="${i}" ${f.rarity === i ? 'selected' : ''}>${r.name}</option>`).join('')}</select></div>
      <div class="list">${items.length ? items.map((it) => itemCard(it, { delta: deltas.get(it.id) })).join('') : '<div class="muted">Bag is empty.</div>'}</div>
      <div class="panel"><h3>Auto-salvage</h3>
        <div class="attr"><span>Salvage new drops below</span><select data-act="salvBelow">${RARITIES.slice(0, 5).map((r, i) => `<option value="${i}" ${sf.salvageBelow === i ? 'selected' : ''}>${i === 0 ? 'Nothing' : r.name}</option>`).join('')}</select></div>
        <div class="attr"><span>Always keep items with a unique affix</span><button class="btn small toggle ${sf.keepUniques ? 'on' : ''}" data-act="keepUniq">${sf.keepUniques ? 'On' : 'Off'}</button></div>
        <div class="attr"><span>Auto-equip upgrades</span><button class="btn small toggle ${sf.autoEquip ? 'on' : ''}" data-act="autoEquip">${sf.autoEquip ? 'On' : 'Off'}</button></div>
        <div class="small muted">Keep items with these affixes:</div>
        <div class="chips">${AFFIXES.map((a) => `<button class="chip ${sf.keepAffixes.includes(a.key) ? 'on' : ''}" data-act="keepAff" data-k="${a.key}">${STAT_NAMES[a.key]}</button>`).join('')}</div>
        <div class="row2">${[1, 2, 3].map((r) => `<button class="btn small" data-act="salvAll" data-r="${r}">Salvage ≤ ${RARITIES[r].name}</button>`).join('')}</div>
        <div class="small muted">Locked items and protected items are never salvaged.</div></div>`;
  } else if (sub.equipment === 'gems') {
    if (!unlocked(state, 'gems')) body = `<div class="panel muted">Gems, sockets and runes unlock at level 15.</div>`;
    else body = `<div class="panel"><h3>Gems <span class="muted small">combine 3 into the next tier</span></h3>
      <div class="gemgrid"><div></div>${GEM_TIERS.map((t, i) => `<div class="small muted">T${i + 1}</div>`).join('')}
      ${GEM_KEYS.map((g) => `<div>${GEMS[g].icon} <span class="small">${GEMS[g].name}</span></div>${GEM_TIERS.map((_, t) => { const n = state.gems[g + t] || 0; return `<button class="gem ${n ? '' : 'zero'}" data-act="gemCombine" data-g="${g}" data-t="${t}" title="+${gemValue(g, t)}% ${STAT_NAMES[GEMS[g].stat]}">${n}</button>`; }).join('')}`).join('')}</div>
      <div class="small muted">Ruby attack · Sapphire crit damage · Emerald crit chance · Topaz attack speed · Amethyst magic · Diamond life + armour. Tap a stack of 3+ to combine. Socket gems from an item's details.</div>
      <button class="btn small" data-act="gemAll">Combine all</button></div>
      <div class="panel"><h3>Runes <span class="muted small">${runeSlots(state)} slots</span></h3>
        <div class="runeslots">${[0, 1, 2].map((i) => { const k = state.runesEquipped[i]; return `<div class="rslot ${i >= runeSlots(state) ? 'lock' : ''}">${i >= runeSlots(state) ? '🔒 L60' : k ? `${RUNES[k].icon} ${RUNES[k].name.replace('Rune of ', '')} ${state.runes[k]}` : 'empty'}</div>`; }).join('')}</div>
        ${RUNE_KEYS.map((k) => { const r = state.runes[k] || 0; return `<div class="attr"><span>${RUNES[k].icon} <b>${RUNES[k].name}</b> ${r ? `<span class="tag">R${r}</span>` : ''}<div class="small muted">${RUNES[k].text(Math.max(1, r))}</div></span>
          <span class="col">${r < RUNE_MAX ? `<button class="btn small" data-act="rune" data-k="${k}">${r ? 'Rank up' : 'Craft'} ${costHtml(runeCraftCost(r + 1))}</button>` : '<b>Max</b>'}
          ${r ? `<button class="btn small" data-act="runeEq" data-k="${k}">Equip</button>` : ''}</span></div>`; }).join('')}</div>`;
  } else if (sub.equipment === 'ins') {
    if (!unlocked(state, 'inscriptions')) body = `<div class="panel muted">Inscriptions unlock at level 35. They drop from bosses, Boss Rush and Rifts, and can be carved in Crafting.</div>`;
    else {
      const sets = inscriptionSets(state);
      body = `<div class="panel"><h3>Inscription slots</h3><div class="ins-slots">${state.inscribed.map((ins, i) => `<div class="ins ${ins ? '' : 'empty'}" data-act="uninscribe" data-i="${i}" style="${ins ? `border-color:${INSCR_TAGS[ins.tag].color}` : ''}">${ins ? `${INSCR_TAGS[ins.tag].icon}<div class="small">${statLine(ins.stat, ins.v)}</div>` : '◇'}</div>`).join('')}</div>
        <div class="small">${Object.entries(INSCR_TAGS).map(([k, t]) => { const n = sets[k] || 0; return `<div class="${n >= 2 ? '' : 'muted'}">${t.icon} ${t.name} (${n}/6): ${[2, 4, 6].map((need, j) => `<span class="${n >= need ? 'good' : ''}">${need}: ${t.txt[j]}</span>`).join(' · ')}</div>`; }).join('')}</div></div>
        <div class="panel"><h3>Owned (${state.inscriptions.length})</h3><div class="ins-list">${state.inscriptions.sort((a, b) => a.tag.localeCompare(b.tag) || b.v - a.v).map((ins) => `<div class="ins" data-act="inscribe" data-id="${ins.id}" style="border-color:${INSCR_TAGS[ins.tag].color}">${INSCR_TAGS[ins.tag].icon}<div class="small">${statLine(ins.stat, ins.v)}</div></div>`).join('') || '<div class="muted">None yet.</div>'}</div>
        <div class="small muted">Tap to place in the first empty slot (or replace the weakest). Tap a slotted one to remove it.</div></div>`;
    }
  } else if (sub.equipment === 'craft') {
    body = `<div class="panel"><h3>Materials</h3>${MAT_KEYS.map((k) => `<div class="attr"><span>${MATERIALS[k].icon} <b>${MATERIALS[k].name}</b><div class="small muted">${MATERIALS[k].src}</div></span><b>${fmt(state.mats[k] || 0)}</b></div>`).join('')}</div>
      <div class="panel"><h3>Recipes</h3>${RECIPES.map((r) => {
        const ok = state.level >= r.lvl || state.ascensions;
        return `<div class="recipe ${ok ? '' : 'locked'}"><div><b>${r.name}</b> <span class="muted small">L${r.lvl}</span><div class="small">${r.text}</div><div class="small">${costHtml(r.cost)}</div></div>
          ${r.pick ? `<select data-recipe-slot="${r.id}">${SLOTS.filter((s) => s !== 'ring2').map((s) => `<option value="${s}">${SLOT_INFO[s].name}</option>`).join('')}</select>` : ''}
          <button class="btn small" data-act="craft" data-id="${r.id}" ${ok && sys.canAfford(state, r.cost) ? '' : 'disabled'}>Craft</button></div>`;
      }).join('')}</div>`;
  }
  view.innerHTML = subtabs('equipment', tabs) + body;
}

function itemModal(id) {
  const it = state.bag.find((x) => x.id === id) || SLOTS.map((s) => state.gear[s]).find((x) => x && x.id === id);
  if (!it) return closeModal();
  it.isNew = false;
  const equippedSlot = SLOTS.find((s) => state.gear[s] === it);
  const stats = itemStats(it);
  const delta = equippedSlot ? null : sys.itemPowerDelta(state, it);
  const cmp = equippedSlot ? null : state.gear[sys.bestSlot(state, it)];
  const gemsOwned = Object.keys(state.gems).filter((g) => state.gems[g] > 0);
  modal(`<div class="mhead" style="color:${rc(it.rarity)}">${esc(it.name)}${it.awakened ? ' ✦' : ''}</div>
    <div class="muted small">${RARITIES[it.rarity].name} ${SLOT_INFO[it.slot].name} · item level ${it.ilvl}${it.enhance ? ` · +${it.enhance}` : ''}${it.refine ? ` · refined ${it.refine}` : ''}</div>
    <div class="istats">${Object.entries(stats).map(([k, v]) => `<div>${statLine(k, v)}</div>`).join('')}</div>
    ${it.unique ? `<div class="uniq">★ ${UNIQUES[it.unique].text}</div>` : ''}
    ${it.enchant ? `<div class="small" style="color:#c08bff">Enchant: ${STAT_NAMES[it.enchant.key]} rank ${it.enchant.rank}</div>` : ''}
    ${delta !== null ? `<div class="cmp ${delta > 0 ? 'good' : 'bad'}">Power ${delta > 0 ? '+' : ''}${fmt(delta)} vs ${cmp ? esc(cmp.name) : 'empty slot'}</div>` : ''}
    ${it.sockets.length ? `<div class="sockets">${it.sockets.map((g, i) => `<div class="sock">${g ? `${GEMS[g.slice(0, -1)].icon} ${GEM_TIERS[+g.slice(-1)]} <button class="btn tiny" data-act="unsock" data-id="${it.id}" data-i="${i}">x</button>` : unlocked(state, 'gems') ? `<select data-act="sock" data-id="${it.id}" data-i="${i}"><option value="">◇ socket…</option>${gemsOwned.map((gk) => `<option value="${gk}">${GEMS[gk.slice(0, -1)].name} ${GEM_TIERS[+gk.slice(-1)]} (${state.gems[gk]})</option>`).join('')}</select>` : '◇ (L15)'}</div>`).join('')}</div>` : ''}
    <div class="upg">
      <button class="btn small" data-act="enh" data-id="${it.id}" ${it.enhance >= ENHANCE_MAX ? 'disabled' : ''}>Enhance +${it.enhance + 1}<br>${it.enhance < ENHANCE_MAX ? costHtml(enhanceCost(it)) : 'max'}</button>
      <button class="btn small" data-act="ref" data-id="${it.id}" ${it.refine >= REFINE_MAX ? 'disabled' : ''}>Refine ${it.refine}/${REFINE_MAX}<br>${it.refine < REFINE_MAX ? costHtml(refineCost(it)) : 'max'}</button>
      <button class="btn small" data-act="ench" data-id="${it.id}" ${it.enchant?.rank >= ENCHANT_MAX ? 'disabled' : ''}>${it.enchant ? 'Empower enchant' : 'Enchant'}<br>${costHtml(enchantCost(it))}</button>
      ${it.rarity >= 4 ? `<button class="btn small" data-act="awk" data-id="${it.id}" ${canAwaken(it) && unlocked(state, 'awakening') ? '' : 'disabled'}>Awaken${it.awakened ? 'ed' : ''}<br>${it.awakened ? '✦' : canAwaken(it) ? costHtml(awakenItemCost(it)) : 'needs +15, L70'}</button>` : ''}
    </div>
    <div class="small muted">Upgrades never destroy or downgrade items.</div>
    <div class="row2">
      ${equippedSlot ? `<button class="btn" data-act="unequip" data-slot="${equippedSlot}">Unequip</button>` : `<button class="btn primary" data-act="equip" data-id="${it.id}">Equip</button>${it.slot === 'ring1' ? `<button class="btn" data-act="equip" data-id="${it.id}" data-slot="ring2">Equip ring 2</button>` : ''}`}
      <button class="btn" data-act="lock" data-id="${it.id}">${it.locked ? 'Unlock' : 'Lock'}</button>
      ${equippedSlot ? '' : `<button class="btn danger" data-act="salvage" data-id="${it.id}" ${it.locked ? 'disabled' : ''}>Salvage</button>`}
      <button class="btn" data-act="close">Close</button></div>
    ${equippedSlot ? '' : `<div class="small muted">Salvage gives ${Object.entries(salvageValue(it)).map(([k, v]) => `${k === 'gold' ? '🪙' : MATERIALS[k].icon}${fmt(v)}`).join(' ')}</div>`}`);
}

// ---------------- Skills ----------------
function renderSkills() {
  const tabs = [['slots', 'Skill slots'], ['rules', 'Automation rules']];
  let body = '';
  const open = unlockedSlots(state);
  if (sub.skills === 'slots') {
    body = SLOT_ROLES.map((ro) => {
      const id = state.skills[ro.id];
      const isOpen = open.includes(ro.id);
      const opts = skillsForRole(state.cls, ro.id);
      return `<div class="panel skslot ${isOpen ? '' : 'locked'}"><div class="skh"><b>${ro.icon} ${ro.name}</b> <span class="muted small">${ro.desc}${isOpen ? '' : ` · unlocks at level ${ro.lvl}`}</span></div>
        ${opts.map((sk) => {
          const r = state.skillRanks[sk.id] || 1, aw = !!state.awakenedSkills[sk.id], on = id === sk.id;
          const tree = CLASSES[state.cls].trees.find((t) => t.id === sk.tree);
          return `<div class="skopt ${on ? 'on' : ''}" ${isOpen && !on ? `data-act="setSkill" data-role="${ro.id}" data-id="${sk.id}"` : ''}>
            <div class="skic">${sk.icon}</div><div class="grow"><b>${sk.name}</b> <span class="small muted">${tree.icon} ${tree.name} · ${ELEM_ICONS[sk.elem] || ''} ${sk.elem}</span>${on ? ` <span class="tag">R${r}${aw ? ' ✦' : ''}</span>` : ''}
            <div class="small">${skillText(sk, on ? r : 1, on && aw)}</div>
            ${on ? `<div class="row2"><button class="btn small" data-act="skUp" data-id="${sk.id}" ${r >= SKILL_MAX ? 'disabled' : ''}>${r >= SKILL_MAX ? 'Max rank' : `Rank ${r + 1} ${costHtml(skillUpgradeCost(r))}`}</button>
              ${unlocked(state, 'awakening') ? `<button class="btn small" data-act="skAwk" data-id="${sk.id}" ${aw || r < 10 ? 'disabled' : ''}>${aw ? 'Awakened ✦' : `Awaken (R10) ${costHtml(awakenCost())}`}</button>` : ''}</div>` : ''}</div></div>`;
        }).join('')}</div>`;
    }).join('') + `<div class="muted small">Skills cast automatically on cooldown using your automation rules. Awakening (level 70) evolves a rank 10 skill: +50% power, -20% cooldown and extra hits/stacks.</div>`;
  } else {
    const R = state.rules;
    body = `<div class="panel"><h3>Automation rules</h3>
      <div class="rule"><span>Use heals when life is below</span><span><input type="range" min="20" max="90" step="5" value="${R.heal}" data-act="ruleHeal"> <b id="ruleHealV">${R.heal}%</b></span></div>
      <div class="rule"><span>Use ultimate on</span><select data-act="rule" data-k="ult">${[['boss', 'Bosses only'], ['elite', 'Bosses and elites'], ['always', 'Whenever ready']].map(([v, n]) => `<option value="${v}" ${R.ult === v ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      <div class="rule"><span>Target priority</span><select data-act="rule" data-k="target">${[['lowest', 'Lowest life'], ['highest', 'Highest life'], ['elite', 'Bosses/elites first'], ['first', 'Nearest']].map(([v, n]) => `<option value="${v}" ${R.target === v ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      <div class="rule"><span>Use AoE skills when at least</span><select data-act="rule" data-k="aoeMin">${[1, 2, 3].map((v) => `<option value="${v}" ${R.aoeMin === v ? 'selected' : ''}>${v} enem${v > 1 ? 'ies' : 'y'}</option>`).join('')}</select></div>
      <div class="rule"><span>Auto-step out of red danger zones</span><button class="btn small toggle ${R.autoDodge !== false ? 'on' : ''}" data-act="ruleDodge">${R.autoDodge !== false ? 'On' : 'Off'}</button></div>
      <div class="rule"><span>Save shields/dodges for boss telegraphs</span><button class="btn small toggle ${R.saveDef ? 'on' : ''}" data-act="ruleDef">${R.saveDef ? 'On' : 'Off'}</button></div>
      <div class="small muted">Defensive skills that heal fire under the life threshold. Shields, damage reduction and dodges are held for the next ⚠ telegraph when "save" is on (or used at half the threshold in an emergency).</div></div>`;
  }
  view.innerHTML = subtabs('skills', tabs) + body;
}

// ---------------- Activities ----------------
function renderActivities() {
  const L = state.level;
  const has = (k) => state.ascensions || L >= ACTIVITIES[k].lvl;
  const card = (k, inner) => `<div class="panel act ${has(k) ? '' : 'locked'}"><div class="acth"><b>${ACTIVITIES[k].icon} ${ACTIVITIES[k].name}</b>${has(k) ? '' : ` <span class="muted small">unlocks at level ${ACTIVITIES[k].lvl}</span>`}</div><div class="small muted">${ACTIVITIES[k].text}</div>${has(k) ? inner : ''}</div>`;
  const busy = !!state.run;
  const dis = busy ? 'disabled' : '';
  const regions = REGIONS.map((r, i) => {
    const first = i * 10 + 1, cleared = state.bossesBeaten[i], reached = state.maxStage >= first;
    return `<button class="region ${cleared ? 'done' : ''} ${reached ? '' : 'lock'} ${regionOf(state.stage) === i && !state.run ? 'here' : ''}" data-act="goRegion" data-i="${i}" ${reached ? '' : 'disabled'}><b>${i + 1}. ${r.name}</b><span class="small">${cleared ? '✓ ' : ''}${r.boss.name} · lvl ${stageLevel(first)}-${stageLevel(first + 9)}</span></button>`;
  }).join('');
  view.innerHTML = `${busy ? `<div class="panel warn">You're in ${runTitle(state.run)}. <button class="btn small danger" data-act="leave">Leave</button></div>` : ''}
    <div class="panel"><h3>World map <span class="muted small">${WORLD_TIERS[state.worldTier].name}</span></h3><div class="regions">${regions}</div>
      <div class="tiers">${WORLD_TIERS.map((w, i) => `<button class="btn small ${state.worldTier === i ? 'primary' : ''}" data-act="tier" data-i="${i}" ${i > state.maxWorldTier ? 'disabled' : ''} style="color:${w.color}">${w.name}</button>`).join('')}</div></div>
    ${card('dungeon', `<div class="dungeons">${DUNGEON_KEYS.map((k) => { const d = DUNGEONS[k], t = state.dungeonTier[k] || 1; return `<div class="dun"><div><b>${d.icon} ${d.name}</b><div class="small muted">${d.text} · ${d.slots ? d.slots.map((s) => SLOT_INFO[s].name).join(', ') : 'any slot'}</div></div>
      <div class="col"><select data-dtier="${k}">${Array.from({ length: t }, (_, i) => t - i).map((n) => `<option value="${n}">Tier ${n} (lvl ${runLevel(state, 'dungeon', k, n)})</option>`).join('')}</select><button class="btn small" data-act="runDungeon" data-k="${k}" ${dis}>Enter</button></div></div>`; }).join('')}</div>`)}
    ${card('caverns', `<button class="btn small" data-act="run" data-k="caverns" ${dis}>Enter (lvl ${runLevel(state, 'caverns')})</button>`)}
    ${card('vault', `<button class="btn small" data-act="run" data-k="vault" ${dis}>Enter</button>`)}
    ${card('tower', `<div class="small">Best floor <b>${state.towerBest}</b> · next milestone floor ${state.towerClaimed + 10}</div><div class="row2"><button class="btn small" data-act="tower" data-f="1" ${dis}>Start at floor 1</button>${state.towerBest > 10 ? `<button class="btn small" data-act="tower" data-f="${Math.floor(state.towerBest / 10) * 10 - 9}" ${dis}>Start at floor ${Math.floor(state.towerBest / 10) * 10 - 9}</button>` : ''}</div>`)}
    ${card('bossrush', `<div class="small">${Object.keys(state.bossesBeaten).length} bosses unlocked · best streak ${state.rushBest}</div><button class="btn small" data-act="run" data-k="bossrush" ${dis || (Object.keys(state.bossesBeaten).length ? '' : 'disabled')}>Start</button>`)}
    ${card('rift', `<div class="small">Highest rift ${state.riftBest} · each rift rolls 2-3 random modifiers (some help you, harder ones give more loot)</div><div class="row2"><select data-rtier>${Array.from({ length: state.riftLevel }, (_, i) => state.riftLevel - i).map((n) => `<option value="${n}">Rift ${n} (lvl ${runLevel(state, 'rift', null, n)})</option>`).join('')}</select><button class="btn small" data-act="runRift" ${dis}>Open rift</button></div>`)}
    <div class="panel"><div class="attr"><span>Auto-repeat activities after a win</span><button class="btn small toggle ${state.autoRepeat ? 'on' : ''}" data-act="autoRepeat">${state.autoRepeat ? 'On' : 'Off'}</button></div><div class="small muted">No energy, no timers: run anything as often as you like.</div></div>`;
}

// ---------------- run report ----------------
function runReport(r) {
  const s = st();
  const c = state.combat;
  const hpLeft = c ? c.hero.hp / c.st.hp : 0;
  let verdict, advice;
  if (!r.win && r.kind !== 'tower') { verdict = 'Defeated.'; advice = r.kind === 'dungeon' || r.kind === 'rift' ? 'Try a lower tier, Optimise, or farm the campaign for gear and levels.' : 'Optimise and level up, then try again.'; }
  else if (r.kind === 'tower') { verdict = `Reached floor ${r.floor}.`; advice = state.towerBest >= r.floor - 1 ? 'Milestones pay out every 10 floors.' : ''; }
  else if (hpLeft > 0.85 && r.t < r.waves * 4) { verdict = 'Too easy.'; advice = 'You barely got scratched. Go up a tier for better loot.'; }
  else if (hpLeft < 0.3) { verdict = 'Close call!'; advice = 'Farm this tier a little more before pushing.'; }
  else { verdict = 'Solid clear.'; advice = 'This tier is a good fit. Push one higher when your Power grows.'; }
  const loot = r.loot.map(({ it, res }) => `<div style="color:${rc(it.rarity)}">${esc(it.name)} <span class="muted small">${res === 'equipped' ? '✓ equipped' : res === 'salvaged' ? 'salvaged' : 'to bag'}</span></div>`).join('');
  const mats = Object.entries(r.mats).filter(([, v]) => v).map(([k, v]) => `${MATERIALS[k].icon} ${MATERIALS[k].name} x${fmt(v)}`).join('<br>');
  const next = (r.kind === 'dungeon' || r.kind === 'rift') && r.win;
  modal(`<div class="mhead">${r.win || r.kind === 'tower' ? '🏆' : '💀'} ${runTitle(r)}</div><div class="verdict ${r.win ? 'good' : 'bad'}">${verdict}</div><div class="small">${advice}</div>
    <div class="small muted">Time ${Math.round(r.t)}s · gold ${fmt(r.gold)}</div>
    ${loot ? `<h3>Loot</h3>${loot}` : ''}${mats ? `<h3>Materials</h3><div class="small">${mats}</div>` : ''}
    ${r.gems.length ? `<h3>Gems</h3><div>${r.gems.map((g) => GEMS[g.slice(0, -1)].icon).join(' ')}</div>` : ''}
    ${r.ins.length ? `<h3>Inscriptions</h3>${r.ins.map((i) => `<div class="small">${INSCR_TAGS[i.tag].icon} ${statLine(i.stat, i.v)}</div>`).join('')}` : ''}
    <div class="row2">${next ? `<button class="btn primary" data-act="again" data-up="1">Next tier</button>` : ''}<button class="btn" data-act="again">Again</button><button class="btn" data-act="optimise">Optimise</button><button class="btn" data-act="close">Back to campaign</button></div>`);
}
let lastRun = null;
function repeatRun(up) {
  const r = lastRun; if (!r) return;
  closeModal();
  if (state.run) leaveRun(state);
  const tier = r.kind === 'tower' ? 1 : up ? r.tier + 1 : r.tier;
  startRun(state, r.kind, r.key, r.kind === 'dungeon' ? Math.min(tier, state.dungeonTier[r.key]) : r.kind === 'rift' ? Math.min(tier, state.riftLevel) : tier);
  switchTab('battle');
}

// ---------------- events from the engine ----------------
function drainEvents() {
  const c = state.combat; if (!c || !c.events.length) return;
  const evs = c.events.splice(0);
  for (const e of evs) {
    if (tab === 'battle') { if (use3D()) scene3d.onEvent(e, state); else arena.onEvent(e, state); }
    switch (e.t) {
      case 'loot':
        lootLog.unshift(e); if (lootLog.length > 6) lootLog.pop(); refreshLootLog();
        if (e.rarity >= 4) { toast(`<b style="color:${rc(e.rarity)}">${RARITIES[e.rarity].name}!</b> ${esc(e.name)}`, 'big'); sfx('loot'); }
        break;
      case 'level':
        for (const u of e.ups) {
          if (typeof u === 'number') { toast(`⬆ Level ${u}`); sfx('level'); }
          else if (u === 'mastery') toast('✦ Mastery up');
          else toast(`🔓 ${u.text}`, 'big');
        }
        if (state.settings.autoOptimise) optimiseAll(state);
        refreshGoals();
        break;
      case 'companion': toast(`🐾 New companion: ${COMPANIONS[e.id].name}!`, 'big'); break;
      case 'worldTier': toast(`🌍 World Tier ${WORLD_TIERS[e.tier].name} unlocked!`, 'big'); break;
      case 'stageClear': refreshGoals(); break;
      case 'kill': if (e.boss) sfx('boss'); break;
      case 'hit': if (e.crit && Math.random() < 0.1) sfx('crit'); break;
      case 'death': sfx('hurt'); break;
      case 'runEnd':
        lastRun = { ...e.run };
        if (state.autoRepeat && e.win && e.run.kind !== 'tower') { const r = e.run; setTimeout(() => { if (state.run === r) { leaveRun(state); startRun(state, r.kind, r.key, r.tier); if (tab === 'battle') renderBattle(); } }, 1200); toast(`🏆 ${runTitle(r)} cleared — repeating`); }
        else setTimeout(() => { const r = state.run; runReport(e.run); if (r === e.run) leaveRun(state); if (tab === 'battle') renderBattle(); }, 900);
        break;
    }
  }
}

// ---------------- tabs & actions ----------------
function switchTab(t) {
  tab = t;
  if (state) state.input = null;
  for (const b of document.querySelectorAll('#tabs button')) b.classList.toggle('active', b.dataset.tab === t);
  render();
  view.scrollTop = 0;
}
function render() {
  if (tab === 'battle') renderBattle();
  else if (tab === 'character') renderCharacter();
  else if (tab === 'equipment') renderEquipment();
  else if (tab === 'skills') renderSkills();
  else if (tab === 'activities') renderActivities();
  hud();
}
function rerender() { const y = view.scrollTop; render(); view.scrollTop = y; }

function doOptimise() {
  const r = optimiseAll(state);
  refreshStats(state);
  toast(`⚡ Power ${fmt(r.before)} → <b>${fmt(r.after)}</b>${r.spent ? ` · ${r.spent} upgrades` : ''}`);
}

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el || el.tagName === 'SELECT' || el.tagName === 'INPUT') return;
  const a = el.dataset.act, d = el.dataset;
  const findItem = (id) => state.bag.find((x) => x.id === id) || SLOTS.map((s) => state.gear[s]).find((x) => x && x.id === id);
  let keepModal = false;
  switch (a) {
    case 'tab': closeModal(); switchTab(d.tab); return;
    case 'sub': sub[d.t] = d.k; rerender(); return;
    case 'close': closeModal(); return;
    case 'stage': setStage(state, state.stage + +d.d); state.retryIn = 0; if (+d.d < 0) state.autoAdvance = false; renderBattle(); return;
    case 'auto': state.autoAdvance = !state.autoAdvance; state.retryIn = 0; renderBattle(); return;
    case 'leave': leaveRun(state); closeModal(); switchTab('battle'); return;
    case 'optimise': doOptimise(); closeModal(); rerender(); return;
    case 'gotoSkills': switchTab('skills'); return;
    case 'spec': if (!sys.chooseSpec(state, d.id)) toast(state.level < 10 ? 'Specs unlock at level 10' : 'Not enough gold to respec'); break;
    case 'talent': if (!sys.addTalent(state, d.tree, +d.i)) toast('Can\'t add a point there'); state.manualTalents = true; break;
    case 'autoTalents': sys.autoTalents(state, true); break;
    case 'resetTalents': if (!sys.resetTalents(state)) toast('Not enough gold'); break;
    case 'attr': state.attrs[d.k]++; sys.dirty(state); break;
    case 'autoAttrs': sys.autoAttrs(state); break;
    case 'resetAttrs': sys.resetAttrs(state); break;
    case 'compLvl': if (!sys.levelCompanion(state, d.id)) toast('Not enough resources'); break;
    case 'compSet': sys.setCompanion(state, d.id, d.w === 'active' ? 'active' : +d.w); break;
    case 'tier': state.worldTier = +d.i; sys.dirty(state); if (!state.run) setStage(state, state.stage); toast(`World Tier: ${WORLD_TIERS[state.worldTier].name}`); break;
    case 'ascend': if (confirm('Ascend? You return to level 1 and stage 1-1 but keep your gear, gems, runes, companions and materials.')) { sys.ascend(state); if (state.combat) { state.combat.enemies = []; state.combat.wave = 0; } refreshStats(state); toast('✦ Ascended!', 'big'); } break;
    case 'perk': sys.buyPerk(state, d.k); break;
    case 'item': itemModal(d.id); return;
    case 'filterSlot': bagFilter.slot = d.slot === 'ring2' ? 'ring1' : d.slot; sub.equipment = 'bag'; rerender(); return;
    case 'equip': { const it = findItem(d.id); if (it) sys.equip(state, it, d.slot); closeModal(); break; }
    case 'unequip': sys.unequip(state, d.slot); closeModal(); break;
    case 'lock': { const it = findItem(d.id); if (it) it.locked = !it.locked; itemModal(d.id); keepModal = true; break; }
    case 'salvage': { const it = findItem(d.id); if (it) { const v = sys.salvage(state, it); if (v) toast('Salvaged: ' + Object.entries(v).map(([k, n]) => `${k === 'gold' ? '🪙' : MATERIALS[k].icon}${fmt(n)}`).join(' ')); } closeModal(); break; }
    case 'enh': case 'ref': case 'ench': case 'awk': {
      const it = findItem(d.id); if (!it) return;
      const fn = { enh: sys.enhance, ref: sys.refine, ench: sys.enchant, awk: sys.awakenItem }[a];
      if (!fn(state, it)) toast('Not enough resources'); itemModal(d.id); keepModal = true; break;
    }
    case 'unsock': { const it = findItem(d.id); if (it) sys.unsocket(state, it, +d.i); itemModal(d.id); keepModal = true; break; }
    case 'keepUniq': state.filters.keepUniques = !state.filters.keepUniques; break;
    case 'autoEquip': state.filters.autoEquip = !state.filters.autoEquip; break;
    case 'keepAff': { const k = state.filters.keepAffixes; const i = k.indexOf(d.k); if (i >= 0) k.splice(i, 1); else k.push(d.k); break; }
    case 'salvAll': { const n = sys.salvageAll(state, +d.r); toast(`Salvaged ${n} items`); break; }
    case 'gemCombine': if (!sys.combineGems(state, d.g, +d.t)) toast('Need 3 of that gem (and gold)'); break;
    case 'gemAll': toast(`Combined ${sys.combineAllGems(state)} times`); break;
    case 'rune': if (!sys.upgradeRune(state, d.k)) toast('Not enough resources'); break;
    case 'runeEq': { const free = state.runesEquipped.findIndex((x, i) => !x && i < runeSlots(state)); sys.equipRune(state, free >= 0 ? free : 0, d.k); break; }
    case 'inscribe': {
      const ins = state.inscriptions.find((x) => x.id === d.id); if (!ins) return;
      let idx = state.inscribed.findIndex((x) => !x);
      if (idx < 0) { let lo = 1e18; state.inscribed.forEach((x, i) => { if (x.v < lo) { lo = x.v; idx = i; } }); }
      sys.inscribe(state, idx, ins); break;
    }
    case 'uninscribe': sys.uninscribe(state, +d.i); break;
    case 'craft': {
      const sel = document.querySelector(`[data-recipe-slot="${d.id}"]`);
      const res = sys.craft(state, d.id, sel ? sel.value : undefined);
      if (!res) toast('Missing materials');
      else if (res.item) { toast(`Crafted <b style="color:${rc(res.item.rarity)}">${esc(res.item.name)}</b>`, 'big'); itemModal(res.item.id); keepModal = true; }
      else if (res.gem) toast(`Cut a ${GEMS[res.gem.slice(0, -1)].name}`);
      else if (res.ins) toast(`Carved a ${INSCR_TAGS[res.ins.tag].name} inscription`);
      break;
    }
    case 'setSkill': sys.setSkill(state, d.role, d.id); break;
    case 'skUp': if (!sys.upgradeSkill(state, d.id)) toast('Not enough resources'); break;
    case 'skAwk': if (!sys.awakenSkill(state, d.id)) toast('Needs rank 10, level 70 and materials'); break;
    case 'ruleDef': state.rules.saveDef = !state.rules.saveDef; break;
    case 'ruleDodge': state.rules.autoDodge = state.rules.autoDodge === false; break;
    case 'goRegion': { if (state.run) leaveRun(state); const first = +d.i * 10 + 1; setStage(state, Math.min(state.maxStage, first + 9)); state.autoAdvance = state.maxStage <= first + 9; switchTab('battle'); return; }
    case 'runDungeon': { const t = +document.querySelector(`[data-dtier="${d.k}"]`).value; if (startRun(state, 'dungeon', d.k, t)) switchTab('battle'); return; }
    case 'run': if (startRun(state, d.k)) switchTab('battle'); else toast('Beat a region boss first'); return;
    case 'tower': if (startRun(state, 'tower', null, +d.f)) switchTab('battle'); return;
    case 'runRift': { const t = +document.querySelector('[data-rtier]').value; if (startRun(state, 'rift', null, t)) switchTab('battle'); return; }
    case 'autoRepeat': state.autoRepeat = !state.autoRepeat; break;
    case 'again': repeatRun(!!d.up); return;
    case 'settings': settingsModal(); return;
    case 'set': { const k = d.k; const v = d.v; state.settings[k] = v === 'true' ? true : v === 'false' ? false : isNaN(+v) ? v : +v; applySettings(); settingsModal(); if (k === 'view' && tab === 'battle') renderBattle(); return; }
    case 'export': { const txt = btoa(unescape(encodeURIComponent(JSON.stringify({ ...state, combat: null, _st: null })))); navigator.clipboard?.writeText(txt); prompt('Your save (copied):', txt); return; }
    case 'import': { const txt = prompt('Paste a save:'); if (txt) { try { const s = JSON.parse(decodeURIComponent(escape(atob(txt.trim())))); localStorage.setItem(sys.SAVE_KEY, JSON.stringify(s)); location.reload(); } catch (e) { alert('That save could not be read.'); } } return; }
    case 'newGame': if (confirm('Start a new hero? This erases your current save.')) { resetting = true; localStorage.removeItem(sys.SAVE_KEY); location.reload(); } return;
    case 'pickClass': state = sys.newState(d.cls); state.picked = true; window.__state = state; ensureCombat(state); applySettings(); sys.save(state); closeModal(); switchTab('battle'); return;
  }
  sys.dirty(state);
  if (!keepModal && a !== 'item') { /* keep modal closed */ }
  rerender();
});
document.addEventListener('change', (ev) => {
  const el = ev.target, a = el.dataset.act;
  if (a === 'bagSlot') { bagFilter.slot = el.value; rerender(); }
  else if (a === 'bagRar') { bagFilter.rarity = +el.value; rerender(); }
  else if (a === 'salvBelow') { state.filters.salvageBelow = +el.value; }
  else if (a === 'rule') { state.rules[el.dataset.k] = el.dataset.k === 'aoeMin' ? +el.value : el.value; }
  else if (a === 'ruleHeal') { state.rules.heal = +el.value; }
  else if (a === 'sock') { const it = state.bag.find((x) => x.id === el.dataset.id) || SLOTS.map((s) => state.gear[s]).find((x) => x && x.id === el.dataset.id); if (it && el.value) sys.socketGem(state, it, +el.dataset.i, el.value); itemModal(el.dataset.id); }
});
document.addEventListener('input', (ev) => { if (ev.target.dataset.act === 'ruleHeal') { const v = $('#ruleHealV'); if (v) v.textContent = ev.target.value + '%'; state.rules.heal = +ev.target.value; } });
$('#modal').addEventListener('click', (ev) => { if (ev.target.id === 'modal' && state?.picked) closeModal(); });
for (const b of document.querySelectorAll('#tabs button')) b.addEventListener('click', () => switchTab(b.dataset.tab));

function settingsModal() {
  const S = state.settings;
  const opt = (k, list) => `<div class="seg">${list.map(([v, n]) => `<button class="${String(S[k]) === String(v) ? 'on' : ''}" data-act="set" data-k="${k}" data-v="${v}">${n}</button>`).join('')}</div>`;
  modal(`<div class="mhead">Settings</div>
    <div class="rule"><span>Battle view</span>${opt('view', [['3d', '3D isometric'], ['2d', 'Classic 2D']])}</div>
    <div class="rule"><span>Camera zoom</span>${opt('zoom', [['near', 'Close'], ['mid', 'Medium'], ['far', 'Far']])}</div>
    <div class="rule"><span>Combat speed</span>${opt('speed', [[1, '1x'], [1.5, '1.5x'], [2, '2x']])}</div>
    <div class="rule"><span>Damage numbers</span>${opt('dmgNums', [['all', 'All'], ['crits', 'Big only'], ['off', 'Off']])}</div>
    <div class="rule"><span>Screen shake</span>${opt('shake', [[true, 'On'], [false, 'Off']])}</div>
    <div class="rule"><span>Effects</span>${opt('effects', [['full', 'Full'], ['reduced', 'Reduced']])}</div>
    <div class="rule"><span>Sound</span>${opt('sound', [[true, 'On'], [false, 'Off']])}</div>
    <div class="rule"><span>Text size</span>${opt('text', [['s', 'S'], ['m', 'M'], ['l', 'L']])}</div>
    <div class="rule"><span>Colour-safe statuses</span>${opt('colorSafe', [[true, 'On'], [false, 'Off']])}</div>
    <div class="rule"><span>Auto-optimise on level up</span>${opt('autoOptimise', [[true, 'On'], [false, 'Off']])}</div>
    <div class="row2"><button class="btn small" data-act="export">Export save</button><button class="btn small" data-act="import">Import save</button><button class="btn small danger" data-act="newGame">New hero</button></div>
    <div class="small muted">Eternal Ascent ${VERSION}. No energy, no loot boxes, no paid power. Offline progress caps at 12 hours.</div>
    <button class="btn" data-act="close">Close</button>`);
}
function classPicker() {
  modal(`<div class="mhead">Choose your hero</div><div class="small muted">One hero, three specialisations each. You can start a new hero later from Settings.</div>
    <div class="classes">${CLASS_KEYS.map((k) => { const c = CLASSES[k]; return `<button class="cls" data-act="pickClass" data-cls="${k}" style="border-color:${c.color}"><img src="assets/heroes/${c.art}.webp" alt=""><div><b>${c.icon} ${c.name}</b><div class="small">${c.specs.map((s) => s.name).join(' · ')}</div><div class="small muted">${c.dmg === 'phys' ? 'Physical' : 'Magic'} · ${c.res}</div></div></button>`; }).join('')}</div>`, 'wide');
}
function offlineModal(rep) {
  const h = Math.floor(rep.secs / 3600), m = Math.floor((rep.secs % 3600) / 60);
  const mats = Object.entries(rep.mats).filter(([, v]) => v).map(([k, v]) => `${MATERIALS[k].icon}${fmt(v)}`).join(' ');
  modal(`<div class="mhead">While you were away</div>
    <div class="small">${h}h ${m}m simulated${rep.capped ? ' <b>(capped at 12h)</b>' : ''} at stage <b>${stageName(rep.stage)}</b> in ${rep.region}.</div>
    <div class="kv"><div>Monsters killed</div><b>${fmt(rep.kills)}</b><div>Gold</div><b>🪙${fmt(rep.gold)}</b><div>Experience</div><b>${fmt(rep.xp)}</b><div>Levels gained</div><b>${rep.levels}</b>
    <div>Items</div><b>${rep.equipped} equipped · ${rep.kept} kept · ${rep.salvaged} salvaged</b>${mats ? `<div>Materials</div><b>${mats}</b>` : ''}</div>
    <div class="small muted">Measured from a real 90-second sample of your current stage, then scaled up. Items are capped at 40 per absence.</div>
    <button class="btn primary" data-act="close">Continue</button>`);
}

// ---------------- main loop ----------------
let last = performance.now(), acc = 0, saveT = 0, uiT = 0;
function loop(now) {
  const dt = Math.min(0.25, (now - last) / 1000); last = now;
  if (state) {
    acc += dt * (state.settings.speed || 1);
    let steps = 0;
    while (acc >= 0.05 && steps < 20) { tick(state, 0.05); acc -= 0.05; steps++; }
    if (steps >= 20) acc = 0;
    drainEvents();
    if (tab === 'battle') {
      const reg = state.run ? (state.run.kind === 'dungeon' ? DUNGEONS[state.run.key].bg : { caverns: 'caverns', vault: 'pyramid', bossrush: 'raid', tower: 'tower', rift: 'rift' }[state.run.kind]) : REGIONS[regionOf(state.stage)].bg;
      if (use3D()) { scene3d.resize(); scene3d.frame(dt, state, reg); }
      else { arena.setScene(reg, state.run ? (state.run.kind === 'rift' ? 'sparkles' : 'embers') : REGIONS[regionOf(state.stage)].weather); arena.resize(); arena.frame(dt, state); }
      battleTick();
    }
    uiT += dt; if (uiT > 1) { uiT = 0; hud(); if (tab === 'battle') refreshGoals(); }
    saveT += dt; if (saveT > 10) { saveT = 0; saveNow(); }
  }
  requestAnimationFrame(loop);
}
window.addEventListener('visibilitychange', () => {
  if (!state) return;
  if (document.hidden) saveNow();
  else {
    const away = (Date.now() - state.lastSeen) / 1000;
    if (away > 120 && !state.run) { const rep = simulateOffline(state, away); state.lastSeen = Date.now(); if (rep) { refreshStats(state); offlineModal(rep); } }
  }
});
window.addEventListener('beforeunload', saveNow);
window.addEventListener('resize', () => arena.resize());
$('#hud-settings').addEventListener('click', settingsModal);

// boot (a save without a chosen class, from the first build's bug, goes back to the class picker)
if (state && !state.picked) state = null;
if (state) {
  window.__state = state;
  applySettings();
  ensureCombat(state);
  const away = (Date.now() - (state.lastSeen || Date.now())) / 1000;
  const rep = away > 120 ? simulateOffline(state, away) : null;
  refreshStats(state);
  switchTab('battle');
  if (rep) offlineModal(rep);
} else {
  state = sys.newState('warrior'); window.__state = state; ensureCombat(state); applySettings();
  switchTab('battle');
  classPicker();
}
requestAnimationFrame(loop);
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((r) => r.update()).catch(() => {});
  let reloaded = false;
  const hadController = !!navigator.serviceWorker.controller;   // first install: don't reload (it would skip the class picker)
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloaded) { reloaded = true; location.reload(); } });
}

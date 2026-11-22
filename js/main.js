import { RARITIES, SLOTS, TYPE_ICONS, PASSIVES, zoneFor, zoneIndex, ZONES, isBossStage, MONSTERS_PER_STAGE, resistPenalty, S } from './data.js';
import {
  fmt, describeAffix, describeImplicit, salvageValue, upgradeCost, canUpgrade, rerollCost, rerollItem,
  canPromote, promoteCost, promoteItem,
} from './items.js';
import { computeStats, xpToNext, passivePointsTotal, passivePointsSpent, targetSlot, powerWith } from './stats.js';
import {
  newState, load, save, tick, ensureCombat, refreshStats, simulate, salvage, equipFromBag, unequip, BAG_SIZE, SAVE_KEY,
} from './game.js';

let state = load() || newState();
ensureCombat(state);
let tab = 'battle';
let bagFilter = -1;
const $ = (s) => document.querySelector(s);
const view = $('#view');

// ---------- helpers ----------
const rc = (r) => 'r' + r;
const icon = (item) => item.type === 'weapon' ? { Dagger: '🗡️', Sword: '⚔️', Axe: '🪓', Mace: '🔨' }[item.kind] || '🗡️' : TYPE_ICONS[item.type];
const costOk = (c) => state.gold >= c.gold && state.shards >= c.shards;
const costText = (c) => `🪙${fmt(c.gold)} 💠${fmt(c.shards)}`;
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

// ---------- HUD ----------
function renderHud() {
  const need = xpToNext(state.level);
  $('#hud-level').textContent = state.level;
  $('#hud-xp').style.width = (100 * state.xp / need) + '%';
  $('#hud-xp-text').textContent = `${fmt(state.xp)} / ${fmt(need)} XP`;
  $('#hud-gold').textContent = fmt(state.gold);
  $('#hud-shards').textContent = fmt(state.shards);
  $('#hud-power').textContent = fmt(state.combat.stats.power);
  const newCount = state.bag.filter((b) => b.isNew).length;
  $('#bag-badge').textContent = newCount ? (newCount > 99 ? '99+' : newCount) : '';
  const pts = passivePointsTotal(state.level) - passivePointsSpent(state);
  $('#tree-badge').textContent = pts > 0 ? pts : '';
}

// ---------- Battle ----------
function renderBattle() {
  const st = state.combat.stats;
  const boss = isBossStage(state.stage);
  view.innerHTML = `
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
    </div>
    <div id="blocked" class="blocked-note ${state.pushBlocked && state.settings.autoAdvance ? '' : 'hidden'}">
      <span>☠️ Too strong here. Farming stage ${state.stage} until you get stronger.</span>
      <button class="btn small primary" data-act="push">Push</button>
    </div>
    <div class="arena" id="arena">
      <div class="fighter p" id="fp">
        <div class="sprite" id="p-sprite">🧙</div>
        <div class="bar hp"><div class="fill" id="p-hp"></div><span id="p-hp-t"></span></div>
        <div class="label">Exile · Lv ${state.level}</div>
      </div>
      <div class="fighter m" id="fm">
        <div class="sprite" id="m-sprite"></div>
        <div class="bar mhp"><div class="fill" id="m-hp"></div><span id="m-hp-t"></span></div>
        <div class="label" id="m-name"></div>
      </div>
    </div>
    <div class="kv panel">
      <div><b id="b-dps">${fmt(st.dps)}</b><small>DPS</small></div>
      <div><b id="b-life">${fmt(st.maxLife)}</b><small>Life</small></div>
      <div><b id="b-ehp">${fmt(st.ehp)}</b><small>Eff. HP</small></div>
    </div>
    <div class="panel">
      <h2>Loot</h2>
      <div class="feed" id="feed"></div>
    </div>`;
  renderFeed();
  updateBattle();
}
function renderFeed() {
  const f = $('#feed');
  if (!f) return;
  f.innerHTML = state.lootLog.slice(0, 12).map((l) =>
    `<div><span class="${rc(l.rarity)}">${TYPE_ICONS[l.type]} ${l.name} <span class="muted">i${l.ilvl}</span></span><span class="act ${l.action}">${l.action}</span></div>`
  ).join('') || '<div class="muted">Kill monsters to find loot.</div>';
}
let lastMonster = null;
function updateBattle() {
  if (tab !== 'battle' || !$('#arena')) return;
  const c = state.combat, st = c.stats, m = c.monster;
  const needed = isBossStage(state.stage) ? 1 : MONSTERS_PER_STAGE;
  $('#stage-fill').style.width = (100 * state.kills / needed) + '%';
  $('#stage-text').textContent = `${state.kills} / ${needed}`;
  $('#p-hp').style.width = Math.max(0, 100 * c.hp / st.maxLife) + '%';
  $('#p-hp-t').textContent = `${fmt(Math.max(0, c.hp))}`;
  $('#fp').classList.toggle('dead', c.respawn > 0);
  if (m !== lastMonster) {
    lastMonster = m;
    const sp = $('#m-sprite');
    sp.textContent = m.icon;
    sp.classList.toggle('boss', m.boss);
    $('#m-name').textContent = m.boss ? `👑 ${m.name}` : m.elite ? 'Elite' : 'Monster';
    $('#fm').classList.toggle('elite', m.elite);
    $('#fm').classList.toggle('bossname', m.boss);
  }
  $('#m-hp').style.width = Math.max(0, 100 * m.hp / m.maxHp) + '%';
  $('#m-hp-t').textContent = fmt(Math.max(0, m.hp));
  $('#b-dps').textContent = fmt(st.dps); $('#b-life').textContent = fmt(st.maxLife); $('#b-ehp').textContent = fmt(st.ehp);
  const prev = document.querySelector('[data-act="stage-prev"]'), next = document.querySelector('[data-act="stage-next"]');
  prev.disabled = state.stage <= 1; next.disabled = state.stage >= state.maxStage;
  $('#blocked').classList.toggle('hidden', !(state.pushBlocked && state.settings.autoAdvance));
}
let floatsThisFrame = 0;
function floatText(text, cls, side) {
  const a = $('#arena');
  if (!a || floatsThisFrame > 3) return;
  floatsThisFrame++;
  const el = document.createElement('div');
  el.className = 'float ' + cls;
  el.textContent = text;
  const x = side === 'm' ? 62 + Math.random() * 20 : 8 + Math.random() * 20;
  el.style.left = x + '%';
  el.style.top = (30 + Math.random() * 25) + '%';
  a.appendChild(el);
  setTimeout(() => el.remove(), 900);
}
function bump(id, cls) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
}

// ---------- Gear ----------
function renderGear() {
  const st = state.combat.stats;
  view.innerHTML = `
    <h2>Equipment</h2>
    <div class="slots">${SLOTS.map((s) => {
      const it = state.gear[s.id];
      if (!it) return `<div class="slot empty"><div class="ic">${TYPE_ICONS[s.type]}</div><div><div class="nm muted">${s.name}</div><div class="sub">Empty</div></div></div>`;
      return `<div class="slot bc${it.rarity}" data-act="open-eq" data-slot="${s.id}">
        <div class="ic">${icon(it)}</div>
        <div><div class="nm ${rc(it.rarity)}">${it.name}${it.upgrade ? ` +${it.upgrade}` : ''}</div>
        <div class="sub">${RARITIES[it.rarity].name} · ilvl ${it.ilvl}</div></div></div>`;
    }).join('')}</div>
    <div class="panel" style="margin-top:10px">
      <div class="kv">
        <div><b>${fmt(st.dps)}</b><small>DPS</small></div>
        <div><b>${fmt(st.ehp)}</b><small>Eff. HP</small></div>
        <div><b>${fmt(st.power)}</b><small>Power</small></div>
      </div>
      <p class="muted" style="font-size:12px;margin:8px 0 0">Better drops are equipped automatically. Tap a slot to upgrade, reroll or promote it.</p>
    </div>`;
}

// ---------- Bag ----------
function renderBag() {
  const base = state.combat.stats.power;
  let items = state.bag;
  if (bagFilter >= 0) items = items.filter((i) => i.type === ['weapon', 'offhand', 'helm', 'chest', 'gloves', 'boots', 'belt', 'amulet', 'ring'][bagFilter]);
  const types = ['🗡️', '🛡️', '⛑️', '🥋', '🧤', '🥾', '🎗️', '📿', '💍'];
  view.innerHTML = `
    <div class="toolbar">
      <b>${state.bag.length}/${BAG_SIZE}</b>
      <span style="flex:1"></span>
      <button class="btn small" data-act="sort">Sort</button>
      <button class="btn small danger" data-act="salvage-menu">Salvage…</button>
    </div>
    <div class="toolbar">
      <span class="chip ${bagFilter < 0 ? 'on' : ''}" data-act="filter" data-f="-1">All</span>
      ${types.map((t, i) => `<span class="chip ${bagFilter === i ? 'on' : ''}" data-act="filter" data-f="${i}">${t}</span>`).join('')}
    </div>
    <div class="grid">${items.map((it) => {
      const slot = targetSlot(state, it);
      const better = powerWith(state, slot, it) > base * 1.001;
      return `<div class="cell bc${it.rarity}" data-act="open-bag" data-uid="${it.uid}">
        ${icon(it)}
        ${it.upgrade ? `<span class="up">+${it.upgrade}</span>` : ''}
        ${it.locked ? '<span class="lk">🔒</span>' : it.isNew ? '<span class="new"></span>' : ''}
        ${better ? '<span class="arrow">▲</span>' : ''}
        <span class="il">${it.ilvl}</span></div>`;
    }).join('') || '<p class="muted" style="grid-column:span 5">Your bag is empty.</p>'}</div>`;
  state.bag.forEach((b) => { b.isNew = false; });
}

// ---------- Item modal ----------
function openItem(item, where, slot) {
  const card = $('#modal-card');
  const r = RARITIES[item.rarity];
  const imp = describeImplicit(item);
  const affs = item.affixes.map((a) => describeAffix(a, item));
  affs.sort((a, b) => (a.type === b.type ? 0 : a.type === 'prefix' ? -1 : 1));
  let cmp = '';
  if (where === 'bag') {
    const ts = targetSlot(state, item);
    const cur = computeStats(state);
    const nxt = computeStats(state, { ...state.gear, [ts]: item });
    const pct = (a, b) => { const v = (b / a - 1) * 100; return `<span class="${v >= 0 ? 'good' : 'bad'}">${v >= 0 ? '+' : ''}${v.toFixed(1)}%</span>`; };
    const eq = state.gear[ts];
    cmp = `<div class="muted" style="font-size:12px;text-align:center">vs equipped: ${eq ? `<span class="${rc(eq.rarity)}">${eq.name}${eq.upgrade ? ' +' + eq.upgrade : ''}</span>` : 'nothing'}</div>
      <div class="cmp"><div><b>${pct(cur.dps, nxt.dps)}</b>DPS</div><div><b>${pct(cur.ehp, nxt.ehp)}</b>Eff. HP</div><div><b>${pct(cur.power, nxt.power)}</b>Power</div></div>`;
  }
  const up = upgradeCost(item), rr = rerollCost(item), pr = promoteCost(item), sv = salvageValue(item);
  const maxT = Math.max(...item.affixes.map((a) => a.tier), -1);
  card.innerHTML = `
    <div class="item-head bc${item.rarity}">
      <div class="nm ${rc(item.rarity)}">${icon(item)} ${item.name}${item.upgrade ? ` +${item.upgrade}` : ''}</div>
      <div class="meta">${r.name} ${item.kind || SLOTS.find((s) => s.type === item.type).name} · Item Level ${item.ilvl} · Upgrade ${item.upgrade}/${r.maxUpgrade}</div>
    </div>
    <div class="lines">
      ${imp.map((l) => `<div class="imp">${l}</div>`).join('')}
      ${affs.length ? '<hr>' : ''}
      ${affs.map((a) => `<div class="aff"><span>${a.text}</span><span class="t ${a.tier === 'T1' ? 'top' : ''}">${a.type === 'prefix' ? 'P' : 'S'} ${a.tier}</span></div>`).join('')}
      ${!affs.length ? '<div class="muted" style="text-align:center">No modifiers</div>' : ''}
    </div>
    ${cmp}
    <div class="actions">
      ${where === 'bag' ? `<button class="btn primary full" data-act="equip" data-uid="${item.uid}">Equip</button>` : ''}
      <button class="btn" data-act="upgrade" ${canUpgrade(item) && costOk(up) ? '' : 'disabled'}>⬆️ Upgrade<small>${canUpgrade(item) ? costText(up) : 'Max level'}</small></button>
      <button class="btn" data-act="reroll" ${item.rarity > 0 && costOk(rr) ? '' : 'disabled'}>🎲 Reroll mods<small>${item.rarity > 0 ? costText(rr) : 'Needs Magic+'}</small></button>
      <button class="btn" data-act="promote" ${canPromote(item) && costOk(pr) ? '' : 'disabled'}>✨ Promote<small>${canPromote(item) ? `→ ${RARITIES[item.rarity + 1].name} · ${costText(pr)}` : 'Max rarity'}</small></button>
      ${where === 'bag'
        ? `<button class="btn" data-act="lock">${item.locked ? '🔓 Unlock' : '🔒 Lock'}<small>Protect from salvage</small></button>
           <button class="btn danger full" data-act="salvage-one" ${item.locked ? 'disabled' : ''}>♻️ Salvage <small>+💠${sv.shards} +🪙${fmt(sv.gold)}</small></button>`
        : `<button class="btn" data-act="unequip">Unequip<small>Move to bag</small></button>`}
      <button class="btn full" data-act="close">Close</button>
    </div>`;
  modalCtx = { item, where, slot };
  $('#modal').classList.remove('hidden');
}
let modalCtx = null;
function closeModal() { $('#modal').classList.add('hidden'); modalCtx = null; }
function reopen() { if (modalCtx) openItem(modalCtx.item, modalCtx.where, modalCtx.slot); }

function openSalvageMenu() {
  const card = $('#modal-card');
  const counts = RARITIES.map((r) => state.bag.filter((b) => !b.locked && b.rarity === r.id).length);
  card.innerHTML = `<h2>Salvage</h2><p class="muted" style="font-size:12px">Turns unlocked items into 💠 shards and gold. Locked items are kept.</p>
    <div class="actions">${RARITIES.slice(0, 5).map((r, i) =>
      `<button class="btn" data-act="salvage-upto" data-r="${i}">All ≤ <span class="${rc(i)}">${r.name}</span><small>${counts.slice(0, i + 1).reduce((a, b) => a + b, 0)} items</small></button>`).join('')}
      <button class="btn danger" data-act="salvage-upto" data-r="5">Everything<small>${counts.reduce((a, b) => a + b, 0)} items</small></button>
      <button class="btn full" data-act="close">Cancel</button></div>`;
  modalCtx = null;
  $('#modal').classList.remove('hidden');
}

// ---------- Passives ----------
function renderTree() {
  const free = passivePointsTotal(state.level) - passivePointsSpent(state);
  const respec = Math.ceil(50 * S(state.level));
  view.innerHTML = `
    <div class="toolbar"><h2 style="margin:0;flex:1">Passive Skills</h2><b class="${free ? 'good' : 'muted'}">${free} point${free === 1 ? '' : 's'}</b></div>
    <p class="muted" style="font-size:12px;margin-top:0">One point per level. Hold the + to spend several.</p>
    ${PASSIVES.map((p) => {
      const rk = state.passives[p.id] || 0;
      return `<div class="node"><div class="ic">${p.icon}</div>
        <div class="info"><b>${p.name}</b><div>${p.desc}${rk ? ` · <span class="good">total ${+(rk * p.per).toFixed(1)}</span>` : ""}</div></div>
        <div class="pips">${rk}/${p.max}</div>
        <button class="btn primary" data-act="passive" data-id="${p.id}" ${free && rk < p.max ? '' : 'disabled'}>+</button></div>`;
    }).join('')}
    <button class="btn danger" style="width:100%;margin-top:8px" data-act="respec" ${passivePointsSpent(state) && state.gold >= respec ? '' : 'disabled'}>Reset passives · 🪙${fmt(respec)}</button>`;
}

// ---------- Stats & settings ----------
function renderMore() {
  const st = state.combat.stats;
  const s = state.settings;
  const row = (k, v) => `<span>${k}</span><b>${v}</b>`;
  view.innerHTML = `
    <div class="panel"><h2>Settings</h2>
      <div class="row"><span>Auto-equip upgrades</span><button class="btn small toggle ${s.autoEquip ? 'on' : ''}" data-act="set-autoequip">${s.autoEquip ? 'ON' : 'OFF'}</button></div>
      <div class="row"><span>Auto-salvage drops up to</span>
        <select id="sel-salvage">${['Off', ...RARITIES.slice(0, 4).map((r) => r.name)].map((n, i) => `<option value="${i}" ${s.autoSalvage === i ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
    </div>
    <div class="panel"><h2>Character</h2><div class="sheet">
      <div class="h">Offence</div>
      ${row('Physical damage', `${fmt(st.physMin)}–${fmt(st.physMax)}`)}
      ${row('Elemental damage', `${fmt(st.eleMin)}–${fmt(st.eleMax)}`)}
      ${row('Attacks / sec', st.aps.toFixed(2))}
      ${row('Crit chance', st.crit.toFixed(1) + '%')}
      ${row('Crit multiplier', Math.round(st.critMulti) + '%')}
      ${row('DPS', fmt(st.dps))}
      <div class="h">Defence</div>
      ${row('Life', fmt(st.maxLife))}
      ${row('Armour', `${fmt(st.armour)} <span class="muted">(${(st.armourRed * 100).toFixed(0)}%)</span>`)}
      ${row('Evasion', `${fmt(st.evasion)} <span class="muted">(${(st.evadeChance * 100).toFixed(0)}%)</span>`)}
      ${row('Elemental resist', `<span class="${st.resist < 0 ? 'bad' : ''}">${st.resist.toFixed(0)}%</span> <span class="muted">(−${resistPenalty(state.stage)} zone)</span>`)}
      ${row('Block', st.block.toFixed(0) + '%')}
      ${row('Regen / sec', fmt(st.regen))}
      ${row('Life on hit', fmt(st.lifeOnHit))}
      ${row('Leech', st.leech.toFixed(1) + '%')}
      ${row('Effective HP', fmt(st.ehp))}
      <div class="h">Utility</div>
      ${row('Gold found', '+' + st.goldFind.toFixed(0) + '%')}
      ${row('Item rarity', '+' + st.rarity.toFixed(0) + '%')}
      ${row('Experience', '+' + st.xpGain.toFixed(0) + '%')}
      <div class="h">Record</div>
      ${row('Best stage', state.maxStage)}
      ${row('Monsters slain', fmt(state.totalKills))}
      ${row('Deaths', state.deaths)}
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
  ({ battle: renderBattle, gear: renderGear, bag: renderBag, tree: renderTree, more: renderMore })[tab]();
}

// ---------- Input ----------
document.querySelector('#tabs').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-tab]');
  if (!b) return;
  tab = b.dataset.tab;
  document.querySelectorAll('#tabs button').forEach((x) => x.classList.toggle('active', x === b));
  view.scrollTop = 0;
  render();
});

function doAction(el) {
  const a = el.dataset.act;
  const m = modalCtx;
  switch (a) {
    case 'stage-prev': state.stage = Math.max(1, state.stage - 1); state.kills = 0; state.settings.autoAdvance = false; state.combat = null; ensureCombat(state); break;
    case 'stage-next': state.stage = Math.min(state.maxStage, state.stage + 1); state.kills = 0; state.combat = null; ensureCombat(state); break;
    case 'auto-adv': state.settings.autoAdvance = !state.settings.autoAdvance; state.pushBlocked = false; break;
    case 'push': state.pushBlocked = false; break;
    case 'open-eq': openItem(state.gear[el.dataset.slot], 'eq', el.dataset.slot); return;
    case 'open-bag': openItem(state.bag.find((b) => b.uid === el.dataset.uid), 'bag'); return;
    case 'close': closeModal(); return;
    case 'equip': equipFromBag(state, el.dataset.uid); closeModal(); toast('Equipped'); break;
    case 'unequip': unequip(state, m.slot); closeModal(); break;
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
      state.bag = state.bag.filter((b) => { if (!b.locked && b.rarity <= r) { sh += salvage(state, b).shards; n++; return false; } return true; });
      closeModal(); toast(`♻️ Salvaged ${n} items · +💠${sh}`); break;
    }
    case 'sort': state.bag.sort((x, y) => y.rarity - x.rarity || y.ilvl - x.ilvl || y.upgrade - x.upgrade); break;
    case 'filter': bagFilter = +el.dataset.f; break;
    case 'passive': {
      const p = PASSIVES.find((x) => x.id === el.dataset.id);
      const free = passivePointsTotal(state.level) - passivePointsSpent(state);
      if (free <= 0 || (state.passives[p.id] || 0) >= p.max) return;
      state.passives[p.id] = (state.passives[p.id] || 0) + 1; state.pushBlocked = false;
      break;
    }
    case 'respec': {
      const c = Math.ceil(50 * S(state.level));
      if (state.gold < c || !confirm('Reset all passive points?')) return;
      state.gold -= c; state.passives = {}; break;
    }
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
      localStorage.removeItem(SAVE_KEY); state = newState(); ensureCombat(state); break;
    default: return;
  }
  afterChange();
}
document.body.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (el && !el.disabled) doAction(el);
});
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });

// Hold-to-repeat for passive + buttons
let holdTimer = null;
view.addEventListener('pointerdown', (e) => {
  const el = e.target.closest('[data-act="passive"]');
  if (!el) return;
  const id = el.dataset.id;
  let n = 0;
  holdTimer = setInterval(() => {
    if (++n < 4) return; // initial delay
    const btn = view.querySelector(`[data-act="passive"][data-id="${id}"]`);
    if (btn && !btn.disabled) doAction(btn); else clearInterval(holdTimer);
  }, 90);
});
['pointerup', 'pointercancel', 'pointerleave'].forEach((t) => view.addEventListener(t, () => clearInterval(holdTimer)));

// ---------- Main loop ----------
const ev = [];
let battleDirty = false;
let last = performance.now(), acc = 0, lastSave = Date.now(), dirtyAt = 0, lastRender = 0;
const STEP = 0.05;
function frame(now) {
  const dt = Math.min(1, (now - last) / 1000);
  last = now;
  acc += dt * state.settings.speed;
  floatsThisFrame = 0;
  while (acc >= STEP) { tick(state, STEP, ev); acc -= STEP; }
  let structural = false, battleFull = false;
  for (const e of ev) {
    switch (e.t) {
      case 'hit':
        if (e.who === 'm') { floatText(fmt(e.dmg), e.crit ? 'crit' : '', 'm'); bump('m-sprite', 'hitme'); bump('p-sprite', 'atk'); }
        else { floatText('-' + fmt(e.dmg), 'ptaken', 'p'); bump('p-sprite', 'hitme'); }
        break;
      case 'evade': floatText('Evade', 'info', 'p'); break;
      case 'block': floatText('Block', 'info', 'p'); break;
      case 'level': toast(`⭐ Level ${e.level}! +1 passive point`); structural = true; battleFull = true; break;
      case 'stage': structural = true; battleFull = true; if (isBossStage(e.stage)) toast(`👑 Boss: ${zoneFor(e.stage).bossName}`); break;
      case 'death': toast('☠️ You died. Falling back a stage.'); structural = true; battleFull = true; break;
      case 'equip': toast(`▲ <span class="${rc(e.item.rarity)}">${e.item.name}</span> <span class="good">+${(e.gain * 100).toFixed(1)}%</span>`); structural = true; break;
      case 'loot': if (e.item.rarity >= 3) toast(`<span class="${rc(e.item.rarity)}">${RARITIES[e.item.rarity].name}: ${e.item.name}</span>`); structural = true; break;
      case 'kill': if (tab === 'battle') renderFeed(); break;
    }
  }
  ev.length = 0;
  if (structural) dirtyAt = now;
  if (battleFull) battleDirty = true;
  // Re-render structural changes at most every 600ms, never while a modal is open on that tab
  if (dirtyAt > lastRender && now - lastRender > 600 && $('#modal').classList.contains('hidden')) {
    lastRender = now;
    if (tab === 'battle') { if (battleDirty) { battleDirty = false; renderBattle(); } else renderFeed(); } else if (tab !== 'more') render(); else renderHud();
  }
  renderHud();
  updateBattle();
  if (Date.now() - lastSave > 10000) { save(state); lastSave = Date.now(); }
  requestAnimationFrame(frame);
}

// ---------- Offline progress ----------
function offlineCatchUp() {
  const away = (Date.now() - (state.lastSave || Date.now())) / 1000;
  if (away < 30) return;
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

render();
offlineCatchUp();
requestAnimationFrame(frame);

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

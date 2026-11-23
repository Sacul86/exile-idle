// Delve & Loot UI: Dungeon (full-screen 3D), Town, Forge, Hero, Map.
import { LOOKS, SLOTS, SLOT_INFO, BASES, RARITIES, AFFIXES, SPELLS, SPELL_KEYS, spellSlots, spellPower, spellUpCost, TRAINING, TRAIN_KEYS, trainCost, DUNGEONS, FLOORS_PER_DUNGEON, PACKS_PER_FLOOR, dungeonOf } from './data.js';
import { itemStats, itemName, itemValue, upgradeCost, itemPower, mergeKey, UPGRADE_MAX } from './items.js';
import * as G from './game.js';
import { Scene3D } from './scene3d.js';

const VERSION = '2026.11.23-dl1';
const $ = (s, r = document) => r.querySelector(s);
const view = $('#view');
let state = G.load();
let tab = 'dungeon';
let scene = null;
const feed = [];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const rc = (r) => RARITIES[r].color;
function fmt(n) { if (n === undefined || isNaN(n)) return '0'; if (Math.abs(n) < 1000) return (Math.abs(n) < 10 && n % 1 ? n.toFixed(1) : Math.round(n)).toString(); const u = ['K', 'M', 'B', 'T', 'Qa']; let i = -1; while (Math.abs(n) >= 1000 && i < u.length - 1) { n /= 1000; i++; } return (Math.abs(n) < 100 ? n.toFixed(1) : Math.round(n)) + u[i]; }
const st = () => G.stats(state);
const gold = (n) => `<span class="${state.gold >= n ? '' : 'bad'}">🪙${fmt(n)}</span>`;
function toast(html, cls = '') {
  const t = document.createElement('div'); t.className = 'toast ' + cls; t.innerHTML = html; $('#toasts').appendChild(t);
  setTimeout(() => t.classList.add('out'), 2600); setTimeout(() => t.remove(), 3100);
  while ($('#toasts').children.length > 3) $('#toasts').firstChild.remove();
}
function modal(html) { $('#modal-card').innerHTML = html; $('#modal').classList.remove('hidden'); }
function closeModal() { $('#modal').classList.add('hidden'); }
const statLine = (k, v) => ({ attack: `+${fmt(v)} damage`, hp: `+${fmt(v)} life`, armor: `+${fmt(v)} armour` }[k] || `${v >= 0 ? '+' : ''}${v.toFixed(1)}% ${AFFIXES[k]?.name || { crit: 'crit chance', speed: 'attack speed', lifesteal: 'life steal', gold: 'gold found', find: 'item find' }[k] || k}`);
const dName = (f) => DUNGEONS[dungeonOf(f)].name;

// ---------------- Dungeon tab (full-screen) ----------------
function renderDungeon() {
  scene = scene || new Scene3D();
  document.body.classList.add('battle-full');
  if (!scene.ok) { view.innerHTML = `<div class="panel" style="margin:20px">Your browser can't run the 3D view (WebGL is unavailable).</div>`; return; }
  view.innerHTML = `<div class="bf">
    <div class="arena iso full" id="arena"></div>
    <div class="bf-top">
      <div class="mini-hud"><span class="lvl">${LOOKS[state.look].icon} Lv <b id="m-lvl"></b></span><div class="bar xp"><div class="fill" id="m-xp"></div></div><span>🪙<b id="m-gold"></b></span><span>⚡<b id="m-pow"></b></span><button class="ic-btn" data-act="settings">⚙️</button></div>
      <div id="dz"></div>
      <div class="bossbar hidden" id="bossbar"><div class="bb-name" id="bb-name"></div><div class="bar boss"><div class="fill" id="bb-fill"></div><span id="bb-text"></span></div><div class="tele hidden" id="tele"><div class="fill" id="tele-fill"></div><span id="tele-text"></span></div></div>
    </div>
    <div class="bf-loot lootlog" id="feed"></div>
    <div class="bf-bottom">
      <div class="herobars"><div class="bar hp"><div class="fill" id="h-hp"></div><div class="shield" id="h-sh"></div><span id="h-hp-t"></span></div></div>
      <div class="skillbar" id="skillbar"></div>
      <div class="bf-btns" id="dbtns"></div>
    </div></div>`;
  scene.opt(state.settings); scene.mount($('#arena'));
  dungeonHud(true);
}
let lastHudKey = '';
function dungeonHud(force) {
  if (tab !== 'dungeon' || !$('#h-hp')) return;
  const c = G.combatOf(state), h = c.hero, S2 = c.st, r = state.run;
  $('#m-lvl').textContent = state.level;
  $('#m-xp').style.width = Math.min(100, state.xp / G.xpToNext(state.level) * 100) + '%';
  $('#m-gold').textContent = fmt(state.gold); $('#m-pow').textContent = fmt(S2.power);
  $('#h-hp').style.width = Math.max(0, h.hp / S2.hp) * 100 + '%';
  $('#h-sh').style.width = Math.min(100, h.shield / S2.hp * 100) + '%';
  $('#h-hp-t').textContent = h.dead > 0 ? 'Down!' : `${fmt(h.hp)} / ${fmt(S2.hp)}`;
  // zone line + buttons only rebuild when something structural changes
  const key = r ? `run${r.floor}|${r.pack}|${r.bag.length}|${Math.floor(r.bagGold)}|${state.potions}` : `town${Math.ceil(c.townT)}|${state.rules.autoDive}|${G.bestCheckpoint(state)}|${state.potions}`;
  if (force || key !== lastHudKey) {
    lastHudKey = key;
    if (r) {
      const full = r.bag.length >= S2.bag;
      $('#dz').innerHTML = `<div class="zone"><div><div class="name">${dName(r.floor)}</div><div class="small muted">Floor <b>${r.floor}</b> · deepest ${state.deepest}</div></div>
        <div class="bagbox ${full ? 'full' : ''}"><div>🎒 <b>${r.bag.length}/${S2.bag}</b></div><div>🪙 <b>${fmt(r.bagGold)}</b></div></div></div>
        <div class="waves">${Array.from({ length: PACKS_PER_FLOOR }, (_, i) => `<i class="${i < r.pack ? 'done' : i === r.pack ? 'cur' : ''} ${i === PACKS_PER_FLOOR - 1 && r.floor % FLOORS_PER_DUNGEON === 0 ? 'boss' : ''}"></i>`).join('')}</div>`;
      $('#dbtns').innerHTML = `<button class="btn primary" data-act="retreat">🏃 Return to town</button><button class="btn" data-act="tab" data-tab="town">🏘️ Town</button>`;
    } else {
      const cp = G.bestCheckpoint(state);
      $('#dz').innerHTML = `<div class="zone"><div><div class="name">Town</div><div class="small muted">${state.rules.autoDive ? `Next dive from floor ${cp} in ${Math.max(0, Math.ceil(c.townT))}s` : 'Auto-dive is off'} · deepest ${state.deepest}</div></div></div>`;
      $('#dbtns').innerHTML = `<button class="btn primary" data-act="dive">⚔️ Dive from floor ${cp}</button><button class="btn ${state.rules.autoDive ? 'toggle on' : ''}" data-act="autoDive">Auto-dive ${state.rules.autoDive ? 'on' : 'off'}</button>`;
    }
    $('#skillbar').innerHTML = `<div class="sk pot" data-act="tab" data-tab="town"><div class="ic">🧪</div><div class="lbl">${state.potions}/${S2.belt}</div></div>` +
      Array.from({ length: spellSlots(state.level) }, (_, i) => { const k = state.slots[i]; return `<div class="sk" data-k="${k || ''}" data-act="tab" data-tab="town"><div class="ic">${k ? SPELLS[k].icon : '＋'}</div><div class="cd"></div><div class="lbl">${k ? 'L' + state.spells[k] : 'empty'}</div></div>`; }).join('');
  }
  for (const el of document.querySelectorAll('#skillbar .sk[data-k]')) { const k = el.dataset.k; if (!k) continue; el.querySelector('.cd').style.height = ((h.cds[k] || 0) / SPELLS[k].cd * 100) + '%'; }
  const boss = c.enemies.find((e) => e.boss && e.hp > 0), bb = $('#bossbar');
  if (boss) {
    bb.classList.remove('hidden');
    $('#bb-name').innerHTML = `${esc(boss.name)}${boss.enraged ? ' <b class="bad">Enraged</b>' : ''}`;
    $('#bb-fill').style.width = boss.hp / boss.maxHp * 100 + '%';
    $('#bb-text').textContent = `${fmt(boss.hp)} (${Math.ceil(boss.hp / boss.maxHp * 100)}%)`;
    const te = $('#tele');
    if (boss.tele) { te.classList.remove('hidden'); $('#tele-fill').style.width = (1 - boss.tele.t / boss.tele.total) * 100 + '%'; $('#tele-text').textContent = '⚠ ' + boss.tele.name; } else te.classList.add('hidden');
  } else bb.classList.add('hidden');
}
function refreshFeed() { const el = $('#feed'); if (el) el.innerHTML = feed.slice(0, 4).map((f) => `<div style="color:${f.c || '#e8dcc8'}">${f.t}</div>`).join(''); }
function pushFeed(t, c) { feed.unshift({ t, c }); if (feed.length > 6) feed.pop(); refreshFeed(); }

// ---------------- Town ----------------
function renderTown() {
  const S2 = st(), ld = state.lastDive;
  const p = G.potionPrice(state);
  const slotsN = spellSlots(state.level);
  view.innerHTML = `
    ${ld ? `<div class="panel"><h3>Last dive</h3><div class="small">${ld.why === 'death' ? '💀 Died' : ld.why === 'full' ? '🎒 Bag full' : ld.why === 'low' ? '🩸 Retreated at low life' : ld.why === 'stop' ? '🛑 Reached your stop floor' : '🏃 Returned'} · floors ${ld.from}–${ld.to} · ${ld.kills} kills · ${Math.round(ld.t)}s</div>
      <div class="small">Banked 🪙<b>${fmt(ld.gold)}</b> + ${ld.items.length} items (${ld.equipped} equipped, ${ld.sold} auto-sold for 🪙${fmt(ld.soldGold)})${ld.potions ? ` · bought ${ld.potions} potion${ld.potions > 1 ? 's' : ''}` : ''}</div>
      ${ld.lost ? `<div class="small bad">Lost on death: ${ld.lost.items} items and 🪙${fmt(ld.lost.gold)}</div>` : ''}</div>` : ''}
    <div class="row2"><button class="btn primary grow" data-act="smart">⚡ Smart spend</button><button class="btn grow" data-act="tab" data-tab="dungeon">⚔️ Back to the dungeon</button></div>
    <div class="small muted" style="margin:-4px 0 10px">Smart spend merges, equips upgrades, fills your potion belt, then puts gold into gear upgrades and training where it raises Power most.</div>
    <div class="panel"><h3>🧪 Potions <span class="muted small">${state.potions}/${S2.belt} · heal ${S2.potionHeal}% · used below ${state.rules.potionAt}% life</span></h3>
      <div class="row2"><button class="btn small" data-act="buyPot" data-n="1">Buy 1 · ${gold(p)}</button><button class="btn small" data-act="buyPot" data-n="99">Fill belt · ${gold(p * Math.max(0, S2.belt - state.potions))}</button></div></div>
    <div class="panel"><h3>📖 Spells <span class="muted small">${state.slots.length}/${slotsN} equipped${slotsN < 4 ? ` · next slot at level ${state.level < 15 ? 15 : 35}` : ''}</span></h3>
      ${SPELL_KEYS.map((k) => { const sp = SPELLS[k], l = state.spells[k], on = state.slots.includes(k); return `<div class="attr"><span>${sp.icon} <b>${sp.name}</b>${l ? ` <span class="tag">L${l}</span>` : ''}<div class="small muted">${sp.text}${l ? ` · power x${spellPower(l).toFixed(2)}` : ''}</div></span>
        <span class="col">${l ? `<button class="btn small" data-act="spellUp" data-k="${k}">Level up ${gold(spellUpCost(k, l))}</button><button class="btn small ${on ? 'toggle on' : ''}" data-act="slot" data-k="${k}">${on ? 'Equipped' : 'Equip'}</button>` : `<button class="btn small" data-act="learn" data-k="${k}">Learn ${gold(sp.learn)}</button>`}</span></div>`; }).join('')}</div>
    <div class="panel"><h3>🏋️ Training</h3>${TRAIN_KEYS.map((k) => { const tr = TRAINING[k], l = state.training[k]; return `<div class="attr"><span>${tr.icon} <b>${tr.name}</b> <span class="tag">${l}</span><div class="small muted">${l ? tr.text(l) : tr.text(1).replace(/^\+/, 'Each level: +')}</div></span><button class="btn small" data-act="train" data-k="${k}">Train ${gold(trainCost(k, l))}</button></div>`; }).join('')}</div>
    ${stashPanel(true)}`;
}
function stashPanel(sellMode) {
  const items = [...state.stash].sort((a, b) => b.rarity - a.rarity || itemValue(b) - itemValue(a));
  const h = state.training.haggle;
  return `<div class="panel"><h3>📦 Stash <span class="muted small">${state.stash.length}/${G.STASH_CAP}</span></h3>
    ${sellMode ? `<div class="row2">${[1, 2, 3].map((r) => `<button class="btn small" data-act="sellBelow" data-r="${r}">Sell all below ${RARITIES[r].name}</button>`).join('')}</div>` : ''}
    <div class="list">${items.length ? items.map((it) => itemRow(it, sellMode ? `<button class="btn small" data-act="sell" data-id="${it.id}" ${it.locked ? 'disabled' : ''}>🪙${fmt(itemValue(it, h))}</button>` : '')).join('') : '<div class="muted">Empty. Loot you bring back lands here.</div>'}</div></div>`;
}
function itemRow(it, right = '') {
  const d = state.gear[it.slot] === it ? null : itemPower(state, it);
  return `<div class="item" style="border-color:${rc(it.rarity)}" data-act="item" data-id="${it.id}"><div class="ii">${BASES[it.base].icon}</div>
    <div class="grow"><div style="color:${rc(it.rarity)}">${it.locked ? '🔒 ' : ''}${esc(itemName(it))}</div><div class="small muted">${RARITIES[it.rarity].name} · lvl ${it.ilvl}${it.isNew ? ' · <b class="good">new</b>' : ''}</div></div>
    ${d !== null ? `<div class="delta ${d > 0 ? 'good' : 'muted'}">${d > 0 ? '▲' + fmt(d) : ''}</div>` : ''}${right}</div>`;
}

// ---------------- Forge ----------------
function renderForge() {
  const groups = G.mergeGroups(state);
  view.innerHTML = `<div class="panel"><h3>⚒️ Merge <span class="muted small">3 of the same item and rarity → 1 of the next rarity</span></h3>
    ${groups.length ? groups.map((g) => { const it = g[0]; return `<div class="attr"><span>${BASES[it.base].icon} <b style="color:${rc(it.rarity)}">${g.length}× ${RARITIES[it.rarity].name} ${BASES[it.base].name}</b><div class="small muted">→ ${RARITIES[it.rarity + 1].name} ${BASES[it.base].name}</div></span><button class="btn small" data-act="merge" data-k="${mergeKey(it)}">Merge</button></div>`; }).join('') + `<button class="btn small" data-act="mergeAll">Merge everything</button>`
      : '<div class="muted small">Nothing to merge yet. Keep 3 of the same item and rarity in your stash.</div>'}
    <div class="small muted" style="margin-top:6px">Locked items are never merged. Legendary is the top rarity.</div></div>
    <div class="panel"><h3>🔨 Upgrade gear</h3>${SLOTS.map((sl) => { const it = state.gear[sl]; if (!it) return `<div class="attr muted"><span>${SLOT_INFO[sl].icon} ${SLOT_INFO[sl].name}: empty</span></div>`;
      return `<div class="attr"><span style="color:${rc(it.rarity)}">${BASES[it.base].icon} ${esc(itemName(it))}<div class="small muted">lvl ${it.ilvl} · +10% per upgrade</div></span>${it.up < UPGRADE_MAX ? `<button class="btn small" data-act="up" data-id="${it.id}">+${it.up + 1} ${gold(upgradeCost(it))}</button>` : '<b>Max</b>'}</div>`; }).join('')}</div>`;
}

// ---------------- Hero ----------------
function renderHero() {
  const S2 = st();
  view.innerHTML = `<div class="panel"><div class="hero-card"><div class="bigicon">${LOOKS[state.look].icon}</div><div><h2>${LOOKS[state.look].name} · Level ${state.level}</h2><div class="small muted">${LOOKS[state.look].desc}</div>
      <div class="small muted">Dives ${state.totals.dives} · Deaths ${state.totals.deaths} · Kills ${fmt(state.totals.kills)} · Best haul 🪙${fmt(state.totals.bestHaul)}</div></div></div></div>
    <div class="panel"><div class="kv"><div>Power</div><b>${fmt(S2.power)}</b><div>Damage</div><b>${fmt(S2.attack)}</b><div>Life</div><b>${fmt(S2.hp)}</b><div>Armour</div><b>${fmt(S2.armor)}</b>
      <div>Attack speed</div><b>${S2.speed.toFixed(2)}/s</b><div>Crit</div><b>${S2.crit.toFixed(1)}%</b><div>Life steal</div><b>${S2.lifesteal.toFixed(1)}%</b><div>Bag size</div><b>${S2.bag}</b>
      <div>Gold found</div><b>+${Math.round(S2.gold)}%</b><div>Item find</div><b>+${Math.round(S2.find)}%</b></div></div>
    <div class="panel"><h3>Equipped</h3><div class="list">${SLOTS.map((sl) => state.gear[sl] ? itemRow(state.gear[sl]) : `<div class="item muted"><div class="ii">${SLOT_INFO[sl].icon}</div><div class="grow">${SLOT_INFO[sl].name}: empty</div></div>`).join('')}</div></div>
    ${stashPanel(false)}`;
}
function itemModal(id) {
  const it = state.stash.find((x) => x.id === id) || SLOTS.map((s) => state.gear[s]).find((x) => x && x.id === id);
  if (!it) return closeModal();
  it.isNew = false;
  const worn = state.gear[it.slot] === it, d = worn ? 0 : itemPower(state, it);
  modal(`<div class="mhead" style="color:${rc(it.rarity)}">${esc(itemName(it))}</div><div class="small muted">${RARITIES[it.rarity].name} ${SLOT_INFO[it.slot].name} · item level ${it.ilvl}</div>
    <div class="istats">${Object.entries(itemStats(it)).map(([k, v]) => `<div>${statLine(k, v)}</div>`).join('')}</div>
    ${worn ? '' : `<div class="cmp ${d > 0 ? 'good' : 'bad'}">Power ${d > 0 ? '+' : ''}${fmt(d)} vs ${state.gear[it.slot] ? esc(itemName(state.gear[it.slot])) : 'empty'}</div>`}
    <div class="row2">${worn ? '' : `<button class="btn primary" data-act="equip" data-id="${it.id}">Equip</button>`}
      ${it.up < UPGRADE_MAX ? `<button class="btn" data-act="up" data-id="${it.id}">Upgrade +${it.up + 1} ${gold(upgradeCost(it))}</button>` : ''}
      <button class="btn" data-act="lock" data-id="${it.id}">${it.locked ? 'Unlock' : 'Lock'}</button>
      ${worn ? '' : `<button class="btn danger" data-act="sell" data-id="${it.id}" ${it.locked ? 'disabled' : ''}>Sell 🪙${fmt(itemValue(it, state.training.haggle))}</button>`}
      <button class="btn" data-act="close">Close</button></div>`);
}

// ---------------- Map & rules ----------------
function renderMap() {
  const R = state.rules, cps = G.checkpoints(state);
  view.innerHTML = `<div class="panel"><h3>🗺️ The descent <span class="muted small">deepest floor ${state.deepest}</span></h3>
    ${DUNGEONS.map((d, i) => { const f0 = i * FLOORS_PER_DUNGEON + 1, f1 = i === DUNGEONS.length - 1 ? '∞' : f0 + FLOORS_PER_DUNGEON - 1, reached = state.deepest + 1 >= f0;
      const mine = cps.filter((f) => f >= f0 && (f1 === '∞' || f <= f1));
      return `<div class="dun ${reached ? '' : 'lock'}"><div><b>${i + 1}. ${d.name}</b><div class="small muted">Floors ${f0}–${f1} · boss: ${d.boss}${state.deepest >= f0 + 9 && f1 !== '∞' ? ' ✓' : ''}</div></div>
        <div class="col">${reached ? mine.map((f) => `<button class="btn small" data-act="diveFrom" data-f="${f}">Dive from ${f}</button>`).join('') || '' : '🔒'}</div></div>`; }).join('')}
    <div class="small muted">Checkpoints unlock every 5 floors you reach. Deeper floors drop better loot, but if you die you drop half of what you're carrying.</div></div>
    <div class="panel"><h3>🤖 Dive rules</h3>
      <div class="rule"><span>Auto-dive (start a new dive after banking)</span><button class="btn small toggle ${R.autoDive ? 'on' : ''}" data-act="rule" data-k="autoDive">${R.autoDive ? 'On' : 'Off'}</button></div>
      <div class="rule"><span>Start dives from</span><select data-rule="start"><option value="best" ${R.start === 'best' ? 'selected' : ''}>Deepest checkpoint</option><option value="1" ${R.start === '1' ? 'selected' : ''}>Floor 1</option></select></div>
      <div class="rule"><span>Return to town at floor (0 = never)</span><input type="number" min="0" max="999" value="${R.stopFloor}" data-rule="stopFloor" class="num"></div>
      <div class="rule"><span>Return when the bag is full</span><button class="btn small toggle ${R.retreatFull ? 'on' : ''}" data-act="rule" data-k="retreatFull">${R.retreatFull ? 'On' : 'Off'}</button></div>
      <div class="rule"><span>Return when out of potions and life below</span><span><select data-rule="retreatHp">${[0, 20, 30, 40, 50].map((v) => `<option value="${v}" ${R.retreatHp === v ? 'selected' : ''}>${v ? v + '%' : 'never'}</option>`).join('')}</select></span></div>
      <div class="rule"><span>Drink a potion below</span><select data-rule="potionAt">${[30, 40, 45, 50, 60, 70].map((v) => `<option value="${v}" ${R.potionAt === v ? 'selected' : ''}>${v}% life</option>`).join('')}</select></div>
      <div class="rule"><span>Auto-sell loot below</span><select data-rule="autoSell">${RARITIES.slice(0, 4).map((r, i) => `<option value="${i}" ${R.autoSell === i ? 'selected' : ''}>${i ? r.name : 'Nothing'}</option>`).join('')}</select></div>
      <div class="rule"><span>Auto-equip upgrades when you get back</span><button class="btn small toggle ${R.autoEquip ? 'on' : ''}" data-act="rule" data-k="autoEquip">${R.autoEquip ? 'On' : 'Off'}</button></div>
      <div class="rule"><span>Auto-refill potions in town</span><button class="btn small toggle ${R.autoBuy ? 'on' : ''}" data-act="rule" data-k="autoBuy">${R.autoBuy ? 'On' : 'Off'}</button></div>
      <div class="rule"><span>Step out of red danger zones</span><button class="btn small toggle ${R.autoDodge ? 'on' : ''}" data-act="rule" data-k="autoDodge">${R.autoDodge ? 'On' : 'Off'}</button></div>
    </div>`;
}

// ---------------- events ----------------
function drain() {
  const c = state.combat; if (!c || !c.events.length) return;
  for (const e of c.events.splice(0)) {
    if (tab === 'dungeon' && scene?.ok) scene.onEvent(e, state);
    switch (e.t) {
      case 'loot': pushFeed(`${e.swap ? '⇄ ' : '+ '}${RARITIES[e.rarity].name} ${BASES[e.name].name}`, rc(e.rarity)); if (e.rarity >= 3) toast(`<b style="color:${rc(e.rarity)}">${RARITIES[e.rarity].name}!</b> ${BASES[e.name].name}`, 'big'); break;
      case 'level': toast(`⬆ Level ${e.ups[e.ups.length - 1]}${e.ups.some((l) => l === 15 || l === 35) ? ' — new spell slot!' : ''}`); break;
      case 'floor': if (e.newDungeon) toast(`🗺️ ${dName(e.floor)}`, 'big'); break;
      case 'death': pushFeed(`💀 Dropped ${e.lost.items} items, 🪙${fmt(e.lost.gold)}`, '#ff6b5e'); break;
      case 'town': { const r = e.res; toast(`${r.why === 'death' ? '💀' : '🏘️'} Banked 🪙${fmt(r.gold + r.soldGold)} + ${r.items.length} item${r.items.length === 1 ? '' : 's'}${r.equipped ? ` (${r.equipped} equipped)` : ''}`, r.why === 'death' ? '' : 'big'); if (tab === 'town') rerender(); break; }
    }
  }
}

// ---------------- tabs, actions ----------------
function switchTab(t) {
  tab = t; state.input = null;
  for (const b of document.querySelectorAll('#tabs button')) b.classList.toggle('active', b.dataset.tab === t);
  document.body.classList.toggle('battle-full', t === 'dungeon');
  render(); view.scrollTop = 0;
}
function render() { ({ dungeon: renderDungeon, town: renderTown, forge: renderForge, hero: renderHero, map: renderMap })[tab](); hud(); }
function rerender() { if (tab === 'dungeon') return; const y = view.scrollTop; render(); view.scrollTop = y; }
function hud() {
  $('#hud-level').textContent = state.level;
  $('#hud-xp').style.width = Math.min(100, state.xp / G.xpToNext(state.level) * 100) + '%';
  $('#hud-xp-text').textContent = `${fmt(state.xp)} / ${fmt(G.xpToNext(state.level))} xp`;
  $('#hud-gold').textContent = fmt(state.gold); $('#hud-power').textContent = fmt(st().power);
  $('#hud-floor').textContent = state.run ? `Floor ${state.run.floor}` : 'In town';
  $('#hud-cls').textContent = LOOKS[state.look].icon;
  const m = G.mergeGroups(state).length; $('#badge-forge').textContent = m || '';
  const n = state.stash.filter((i) => i.isNew).length; $('#badge-hero').textContent = n ? (n > 9 ? '9+' : n) : '';
}
document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]'); if (!el || el.tagName === 'SELECT' || el.tagName === 'INPUT') return;
  const a = el.dataset.act, d = el.dataset;
  const find = (id) => state.stash.find((x) => x.id === id) || SLOTS.map((s) => state.gear[s]).find((x) => x && x.id === id);
  switch (a) {
    case 'tab': closeModal(); switchTab(d.tab); return;
    case 'close': closeModal(); return;
    case 'settings': settingsModal(); return;
    case 'retreat': G.retreat(state, 'retreat'); dungeonHud(true); return;
    case 'dive': G.startDive(state); dungeonHud(true); return;
    case 'diveFrom': if (state.run) G.retreat(state, 'retreat'); G.startDive(state, +d.f); switchTab('dungeon'); return;
    case 'autoDive': state.rules.autoDive = !state.rules.autoDive; dungeonHud(true); return;
    case 'smart': { const p0 = st().power; const n = G.smartSpend(state); toast(`⚡ Power ${fmt(p0)} → <b>${fmt(G.stats(state).power)}</b>${n ? ` · ${n} upgrades` : ''}`); break; }
    case 'buyPot': { const n = G.buyPotions(state, +d.n); if (!n) toast('No room or not enough gold'); break; }
    case 'learn': if (!G.learnSpell(state, d.k)) toast('Not enough gold'); break;
    case 'spellUp': if (!G.levelSpell(state, d.k)) toast('Not enough gold'); break;
    case 'slot': G.toggleSlot(state, d.k); if (!state.slots.includes(d.k) && state.spells[d.k] && state.slots.length >= spellSlots(state.level)) toast('All spell slots are full — unequip one first'); break;
    case 'train': if (!G.train(state, d.k)) toast('Not enough gold'); break;
    case 'sellBelow': { const r = G.sellBelow(state, +d.r); toast(`Sold ${r.n} items for 🪙${fmt(r.g)}`); break; }
    case 'sell': { const it = find(d.id); if (it) { const g = G.sell(state, it); if (g) toast(`Sold for 🪙${fmt(g)}`); } closeModal(); break; }
    case 'item': itemModal(d.id); return;
    case 'equip': { const it = find(d.id); if (it) G.equip(state, it); closeModal(); break; }
    case 'up': { const it = find(d.id); if (it && !G.upgrade(state, it)) toast('Not enough gold'); if (!$('#modal').classList.contains('hidden')) itemModal(d.id); break; }
    case 'lock': { const it = find(d.id); if (it) it.locked = !it.locked; itemModal(d.id); break; }
    case 'merge': { const it = G.merge(state, d.k); if (it) toast(`⚒️ Made <b style="color:${rc(it.rarity)}">${esc(itemName(it))}</b>`, 'big'); break; }
    case 'mergeAll': { const out = G.mergeAll(state); toast(`⚒️ ${out.length} merges`); break; }
    case 'rule': state.rules[d.k] = !state.rules[d.k]; break;
    case 'set': { const v = d.v; state.settings[d.k] = v === 'true' ? true : v === 'false' ? false : isNaN(+v) ? v : +v; applySettings(); settingsModal(); return; }
    case 'pickLook': { const fresh = !state.picked; if (fresh) { state = G.newState(d.k); window.__state = state; G.combatOf(state); } state.look = d.k; state.picked = true; G.dirty(state); closeModal(); G.save(state); switchTab('dungeon'); return; }
    case 'changeLook': lookPicker(true); return;
    case 'export': { const txt = btoa(unescape(encodeURIComponent(JSON.stringify({ ...state, combat: null, _st: null })))); navigator.clipboard?.writeText(txt); prompt('Your save (copied):', txt); return; }
    case 'import': { const txt = prompt('Paste a save:'); if (txt) { try { localStorage.setItem(G.SAVE_KEY, JSON.stringify(JSON.parse(decodeURIComponent(escape(atob(txt.trim())))))); resetting = true; location.reload(); } catch (e) { alert('That save could not be read.'); } } return; }
    case 'newGame': if (confirm('Start over? This erases your hero.')) { resetting = true; localStorage.removeItem(G.SAVE_KEY); location.reload(); } return;
  }
  rerender(); hud();
});
document.addEventListener('change', (ev) => {
  const k = ev.target.dataset.rule; if (!k) return;
  state.rules[k] = k === 'start' ? ev.target.value : +ev.target.value;
  if (k === 'retreatHp') state.rules.retreatLow = +ev.target.value > 0;
});
$('#modal').addEventListener('click', (ev) => { if (ev.target.id === 'modal' && state.picked) closeModal(); });
for (const b of document.querySelectorAll('#tabs button')) b.addEventListener('click', () => switchTab(b.dataset.tab));
$('#hud-settings').addEventListener('click', settingsModal);

function applySettings() { document.documentElement.dataset.text = state.settings.text; scene?.opt(state.settings); }
function settingsModal() {
  const S = state.settings;
  const opt = (k, list) => `<div class="seg">${list.map(([v, n]) => `<button class="${String(S[k]) === String(v) ? 'on' : ''}" data-act="set" data-k="${k}" data-v="${v}">${n}</button>`).join('')}</div>`;
  modal(`<div class="mhead">Settings</div>
    <div class="rule"><span>Camera zoom</span>${opt('zoom', [['near', 'Close'], ['mid', 'Medium'], ['far', 'Far']])}</div>
    <div class="rule"><span>Game speed</span>${opt('speed', [[1, '1x'], [1.5, '1.5x'], [2, '2x']])}</div>
    <div class="rule"><span>Damage numbers</span>${opt('dmgNums', [['all', 'All'], ['crits', 'Big only'], ['off', 'Off']])}</div>
    <div class="rule"><span>Screen shake</span>${opt('shake', [[true, 'On'], [false, 'Off']])}</div>
    <div class="rule"><span>Effects</span>${opt('effects', [['full', 'Full'], ['reduced', 'Reduced']])}</div>
    <div class="rule"><span>Text size</span>${opt('text', [['s', 'S'], ['m', 'M'], ['l', 'L']])}</div>
    <div class="row2"><button class="btn small" data-act="changeLook">Change hero look</button><button class="btn small" data-act="export">Export save</button><button class="btn small" data-act="import">Import save</button><button class="btn small danger" data-act="newGame">Start over</button></div>
    <div class="small muted">Delve & Loot ${VERSION}. Offline progress caps at 12 hours. 3D models: KayKit (CC0).</div>
    <button class="btn" data-act="close">Close</button>`);
}
function lookPicker(change) {
  const img = { paladin: 'paladin', warrior: 'marauder', ranger: 'ranger', mage: 'witch' };
  modal(`<div class="mhead">${change ? 'Change your look' : 'Choose your hero'}</div><div class="small muted">${change ? 'Free to change any time. It also changes your fighting style.' : 'One hero. Dive, loot, bank it in town, get stronger, dive deeper.'}</div>
    <div class="classes">${Object.entries(LOOKS).map(([k, l]) => `<button class="cls" data-act="pickLook" data-k="${k}"><img src="assets/heroes/${img[k]}.webp" alt=""><div><b>${l.icon} ${l.name}</b><div class="small">${l.desc}</div><div class="small muted">${l.range > 3 ? 'Ranged' : 'Melee'}</div></div></button>`).join('')}</div>`);
}
function offlineModal(rep) {
  const h = Math.floor(rep.secs / 3600), m = Math.floor((rep.secs % 3600) / 60);
  modal(`<div class="mhead">While you were away</div>
    <div class="small">${h}h ${m}m of dives from floor ${rep.from}${rep.capped ? ' <b>(capped at 12h)</b>' : ''}.</div>
    <div class="kv"><div>Monsters killed</div><b>${fmt(rep.kills)}</b><div>Gold banked</div><b>🪙${fmt(rep.gold)}</b><div>Levels gained</div><b>${rep.levels}</b><div>Deepest floor</div><b>${rep.deepest}</b>
      <div>Items</div><b>${rep.items} (${rep.equipped} equipped, ${rep.sold} sold)</b><div>Deaths</div><b>${rep.deaths}</b></div>
    <div class="small muted">Measured from 4 real minutes of diving with your current gear and rules, then scaled up. Items capped at 40.</div>
    <button class="btn primary" data-act="close">Continue</button>`);
}

// ---------------- loop ----------------
let resetting = false;
const saveNow = () => { if (state && state.picked && !resetting) G.save(state); };
let last = performance.now(), acc = 0, saveT = 0, uiT = 0;
function loop(now) {
  const dt = Math.min(0.25, (now - last) / 1000); last = now;
  acc += dt * (state.settings.speed || 1);
  let n = 0; while (acc >= 0.05 && n < 20) { G.tick(state, 0.05); acc -= 0.05; n++; } if (n >= 20) acc = 0;
  drain();
  if (tab === 'dungeon' && scene?.ok) { scene.resize(); scene.frame(dt, state, state.run ? DUNGEONS[dungeonOf(state.run.floor)].theme : 'town'); dungeonHud(); }
  uiT += dt; if (uiT > 1) { uiT = 0; hud(); }
  saveT += dt; if (saveT > 10) { saveT = 0; saveNow(); }
  requestAnimationFrame(loop);
}
window.addEventListener('visibilitychange', () => {
  if (document.hidden) { saveNow(); return; }
  const away = (Date.now() - state.lastSeen) / 1000;
  if (away > 120 && state.picked) { if (state.run) G.retreat(state, 'retreat'); const rep = G.simulateOffline(state, away); state.lastSeen = Date.now(); if (rep) offlineModal(rep); }
});
window.addEventListener('beforeunload', saveNow);
window.addEventListener('resize', () => scene?.resize());

// boot
if (state && !state.picked) state = null;
if (state) {
  window.__state = state; applySettings(); G.combatOf(state);
  const away = (Date.now() - (state.lastSeen || Date.now())) / 1000;
  const rep = away > 120 ? G.simulateOffline(state, away) : null;
  switchTab('dungeon');
  if (rep) offlineModal(rep);
} else {
  state = G.newState('paladin'); window.__state = state; G.combatOf(state); applySettings();
  switchTab('dungeon'); lookPicker(false);
}
requestAnimationFrame(loop);
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((r) => r.update()).catch(() => {});
  const had = !!navigator.serviceWorker.controller; let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (had && !reloaded) { reloaded = true; location.reload(); } });
}

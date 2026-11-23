import { useEffect, useRef, useState } from 'preact/hooks';
import { store, subscribe, act, toast, notify, resetGame, persist } from '../core/store';
import * as E from '../core/engine';
import {
  HEROES, HERO, HeroId, MAX_FIGHTERS, GATHER, GATHER_KEYS, GatherSkill, RES_KEY, SKILL_NAMES, SKILL_ICONS, FOODS, POTIONS, PETS, ACHIEVEMENTS, QUESTS,
  SOUL_TREE, ASCEND_STAGE, RARITIES, TIER_NAMES, Slot, SLOT_NAMES, biomeOf, XP_TABLE, SkillId,
} from '../data/content';
import atlas from '../../public/sprites/atlas.json';
import { startGame } from '../game/BattleScene';
import { sfx, unlockAudio, applyVolumes } from '../audio';

const F: Record<string, any> = (atlas as any).frames;
export function Spr({ k, s = 2, cls = '', title }: { k: string; s?: number; cls?: string; title?: string }) {
  const f = F[k]?.frame; if (!f) return <span class={`spr ${cls}`} style={{ width: 32 * s, height: 32 * s }} />;
  return <span class={`spr ${cls}`} title={title} style={{ width: f.w * s, height: f.h * s, backgroundPosition: `-${f.x * s}px -${f.y * s}px`, backgroundSize: `${1024 * s}px auto` }} />;
}
function useStore() { const [, set] = useState(0); useEffect(() => subscribe(() => set((v) => v + 1)), []); return store.s; }
const fmt = E.fmt;
const Gold = ({ n, ok = true }: { n: number; ok?: boolean }) => <span class={`gold ${ok ? '' : 'bad'}`}><Spr k="gold2" s={0.6} />{fmt(n)}</span>;
const MAT_NAMES: Record<string, string[]> = { ore: GATHER.mining.nodes.map((n) => n.name), log: GATHER.woodcutting.nodes.map((n) => n.name), fish: GATHER.fishing.nodes.map((n) => n.name), herb: GATHER.foraging.nodes.map((n) => n.name), food: FOODS.map((f) => f.name), pot: POTIONS.map((p) => p.name) };
const matName = (k: string) => MAT_NAMES[k.slice(0, -1)][+k.slice(-1)];
const matIcon = (k: string) => (k.startsWith('food') ? FOODS[+k.slice(-1)].icon : k.startsWith('pot') ? POTIONS[+k.slice(-1)].icon : k);

type Tab = 'party' | 'gear' | 'skills' | 'craft' | 'collection' | 'ascend';
const TABS: [Tab, string, string][] = [['party', 'Party', 'hero_knight'], ['gear', 'Gear', 'wk1'], ['skills', 'Skills', 'sk_mining'], ['craft', 'Craft', 'sk_smithing'], ['collection', 'Collect', 'pet_cat'], ['ascend', 'Ascend', 'ui_soul']];

export function App() {
  const s = useStore();
  const [tab, setTab] = useState<Tab>('party');
  const [modal, setModal] = useState<any>(null);
  const [panel, setPanelRaw] = useState<number>(() => { const v = +(localStorage.getItem('pr-panel') ?? 1); return v >= 0 && v <= 2 ? v : 1; });
  const setPanel = (v: number) => { v = Math.max(0, Math.min(2, v)); setPanelRaw(v); localStorage.setItem('pr-panel', String(v)); sfx('blip'); setTimeout(() => window.dispatchEvent(new Event('resize')), 30); setTimeout(() => window.dispatchEvent(new Event('resize')), 260); };
  const battleRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  useEffect(() => {
    if (!battleRef.current || started.current) return;
    started.current = true;
    startGame(battleRef.current, onGameEvent);
  }, []);
  useEffect(() => { const iv = setInterval(() => notify(), 300); const sv = setInterval(persist, 8000); return () => { clearInterval(iv); clearInterval(sv); }; }, []);
  useEffect(() => { if (store.offlineReport) setModal({ kind: 'offline' }); }, [store.offlineReport]);
  const go = (t: Tab) => { setTab(t); sfx('blip'); if (panel === 0) setPanel(1); };
  const q = QUESTS[s.quest];
  const bagNew = s.inventory.filter((i) => i.isNew).length;
  return (
    <div class={`root panel-${['min', 'mid', 'max'][panel]}`}>
      <div class="topbar">
        <div class="tb-item"><Spr k="gold3" s={0.9} /><b>{fmt(Math.floor(s.gold))}</b></div>
        {s.souls > 0 || s.ascensions > 0 ? <div class="tb-item souls"><Spr k="ui_soul" s={0.7} /><b>{fmt(s.souls)}</b></div> : null}
        <div class="tb-item"><Spr k="sk_fighting" s={0.7} /><b>{fmt(E.partyDps(s))}</b><span class="muted">/s</span></div>
        <button class="icon-btn" onClick={() => { setModal({ kind: 'settings' }); sfx('blip'); }} aria-label="Settings">⚙</button>
      </div>
      <div class="battle" ref={battleRef} />
      {q ? <button class="quest" onClick={() => { if (TABS.some((t) => t[0] === q.tab)) go(q.tab as Tab); }}><Spr k="ui_scroll0" s={0.9} /><span class="q-text"><span class="muted">Quest {s.quest + 1}/{QUESTS.length}</span> {q.text}</span>{q.gold(s) ? <Gold n={q.gold(s)} /> : null}</button> : null}
      <div class="grip">
        <button aria-label="Shrink menu" disabled={panel === 0} onClick={() => setPanel(panel - 1)}>▼</button>
        <span class="grip-bar" onClick={() => setPanel(panel === 0 ? 1 : panel === 1 ? 2 : 0)} />
        <button aria-label="Expand menu" disabled={panel === 2} onClick={() => setPanel(panel + 1)}>▲</button>
      </div>
      <div class="panel-area">
        {tab === 'party' && <Party open={setModal} />}
        {tab === 'gear' && <Gear open={setModal} />}
        {tab === 'skills' && <Skills open={setModal} />}
        {tab === 'craft' && <Craft />}
        {tab === 'collection' && <Collection />}
        {tab === 'ascend' && <Ascend open={setModal} />}
      </div>
      <nav class="tabs">
        {TABS.map(([id, name, icon]) => (
          <button class={tab === id ? 'on' : ''} onClick={() => go(id)}>
            <Spr k={icon} s={1} /><span>{name}</span>
            {id === 'gear' && bagNew ? <i class="badge">{bagNew > 9 ? '9+' : bagNew}</i> : null}
            {id === 'ascend' && E.canAscend(s) ? <i class="badge glow">!</i> : null}
          </button>
        ))}
      </nav>
      <div class="toasts">{store.toasts.map((t) => <div key={t.id} class={`toast ${t.kind}`} dangerouslySetInnerHTML={{ __html: t.html }} />)}</div>
      {modal && <Modal m={modal} close={() => setModal(null)} open={setModal} />}
      {!s.started && <Title />}
    </div>
  );
}

function onGameEvent(e: any) {
  switch (e.t) {
    case 'quest': toast(`📜 Quest complete: ${e.text}${e.gold ? ` <b>+${fmt(e.gold)} gold</b>` : ''}`, 'good'); sfx('level'); break;
    case 'ach': { const a = ACHIEVEMENTS.find((x) => x.id === e.id)!; toast(`🏆 <b>${a.name}</b> — ${a.reward}`, 'gold'); sfx('rare'); break; }
    case 'pet': { const p = PETS.find((x) => x.id === e.id)!; toast(`🐾 New pet: <b>${p.name}</b>! ${p.bonus}`, 'gold'); sfx('rare'); break; }
    case 'skillLevel': toast(`⬆ ${SKILL_NAMES[e.skill as SkillId]} level <b>${e.level}</b>`, ''); sfx('level', 0.3); break;
    case 'drop': if (e.rarity >= 3) toast(`<b style="color:${RARITIES[e.rarity].color}">${RARITIES[e.rarity].name} ${e.name}</b>${e.res === 'equipped' ? ` equipped on ${HERO[e.hero as HeroId].name}` : ''}`, 'gold'); break;
    case 'gather': break;
  }
}

// ---------------- title ----------------
function Title() {
  return (
    <div class="title-screen" onClick={() => { unlockAudio(); act((s) => { s.started = true; }); applyVolumes(); sfx('level'); }}>
      <div class="logo">Pocket Realm</div>
      <div class="sub">an idle pixel RPG</div>
      <div class="lineup">{HEROES.map((h) => <Spr k={h.sprite} s={2.4} />)}</div>
      <div class="hint blink">Tap to begin your adventure</div>
      <div class="credits">Pixel art: Dungeon Crawl Stone Soup tiles (CC0) · Music: Ninja Adventure (CC0)</div>
    </div>
  );
}

// ---------------- party ----------------
const BUY = [1, 10, 100, 0];
function Party({ open }: { open: (m: any) => void }) {
  const s = useStore();
  const mult = s.settings.buy;
  const total = E.partyDps(s) || 1;
  // best damage-per-gold among fighters (looks ahead to the next x3 milestone)
  const eff = (id: HeroId) => { const h = s.heroes[id]!; const toM = 25 - (h.level % 25); return Math.max(E.dpsGain(s, id, 1) / E.levelCostN(id, h.level, 1), E.dpsGain(s, id, toM) / E.levelCostN(id, h.level, toM)); };
  const fightIds = (Object.keys(s.heroes) as HeroId[]).filter((id) => s.heroes[id]!.job === 'fight');
  const bestId = fightIds.length > 1 ? fightIds.reduce((a, b) => (eff(b) > eff(a) ? b : a)) : null;
  return (
    <div>
      <div class="row between">
        <h2>Your party <span class="muted small">{E.fighters(s).length}/{MAX_FIGHTERS} fighting</span></h2>
        <div class="seg">{BUY.map((b) => <button class={mult === b ? 'on' : ''} onClick={() => act((st) => { st.settings.buy = b; })}>{b ? `x${b}` : 'Max'}</button>)}</div>
      </div>
      {HEROES.map((d) => {
        const h = s.heroes[d.id];
        if (!h) {
          const can = s.maxStage >= d.recruitStage, cost = E.recruitCost(d.id);
          return (
            <div class={`card hero locked ${can ? '' : 'dim'}`}>
              <Spr k={d.sprite} s={2} cls="sil" />
              <div class="grow"><b>{d.name}</b> <span class="muted">the {d.title}</span><div class="small muted">{d.role}</div>{!can && <div class="small">Reach stage {d.recruitStage} to meet them</div>}</div>
              {can && <button class="btn primary" disabled={s.gold < cost} onClick={() => { if (act((st) => E.recruit(st, d.id))) { sfx('level'); toast(`🎉 ${d.name} joined the party!`, 'good'); } }}>Recruit<br /><Gold n={cost} ok={s.gold >= cost} /></button>}
            </div>
          );
        }
        const n = mult || Math.max(1, E.maxAffordable(d.id, h.level, s.gold));
        const cost = E.levelCostN(d.id, h.level, n);
        const dps = E.heroDps(s, d.id);
        const next = (Math.floor(h.level / 25) + 1) * 25;
        const job = h.job === 'fight' ? 'Fighting' : h.job === 'idle' ? 'Resting' : `${GATHER[h.job as GatherSkill].verb}`;
        const gain = h.job === 'fight' ? E.dpsGain(s, d.id, n) : 0;
        return (
          <div class={`card hero ${bestId === d.id ? 'best' : ''}`}>
            <div class="portrait"><Spr k={d.sprite} s={2} /><span class="lvl">{h.level}</span></div>
            <div class="grow">
              <div><b>{d.name}</b> <span class="muted small">{d.title}</span></div>
              <div class="small">{h.job === 'fight' ? <>⚔ {fmt(dps)}/s <span class="muted">({Math.round(dps / total * 100)}%)</span> · ❤ {fmt(E.heroMaxHp(s, d.id))}</> : <span class="muted">Not fighting</span>}</div>
              <div class="small muted">{d.ability.name}: {d.ability.desc} · x3 power at Lv {next}</div>
              <button class={`chip ${h.job === 'fight' ? 'fight' : 'job'}`} onClick={() => open({ kind: 'job', id: d.id })}>{job} ▾</button>
            </div>
            <button class="btn buy" disabled={cost > s.gold} onClick={() => { const k = act((st) => E.levelUp(st, d.id, mult ? n : 0)); if (k) { sfx('coin'); if (Math.floor((h.level - k) / 25) !== Math.floor(h.level / 25)) { sfx('level'); toast(`✨ ${d.name} reached Lv ${h.level}: power x3!`, 'good'); } } }}>
              {bestId === d.id ? <span class="best-tag">Best value</span> : null}
              Lv +{n}<br /><Gold n={cost} ok={cost <= s.gold} />
              {gain > 0 ? <span class="gain">+{fmt(gain)}/s</span> : null}
            </button>
          </div>
        );
      })}
      <p class="small muted center">Heroes not fighting can gather resources in the Skills tab. The Knight draws attacks; the Cleric heals.</p>
    </div>
  );
}

// ---------------- gear ----------------
function ItemIcon({ it, s = 1.4, onClick }: { it: E.Item; s?: number; onClick?: () => void }) {
  return <button class={`item r${it.rarity}`} onClick={onClick}><Spr k={E.itemIcon(it)} s={s} />{it.isNew ? <i class="new" /> : null}{it.locked ? <i class="lock">🔒</i> : null}</button>;
}
function Gear({ open }: { open: (m: any) => void }) {
  const s = useStore();
  const ids = Object.keys(s.heroes) as HeroId[];
  const inv = [...s.inventory].sort((a, b) => b.rarity - a.rarity || b.stat - a.stat);
  return (
    <div>
      <h2>Equipment</h2>
      <div class="gear-heroes">
        {ids.map((id) => (
          <div class="card gh">
            <Spr k={HERO[id].sprite} s={1.4} />
            <div class="slots">{(['weapon', 'armor', 'trinket'] as Slot[]).map((sl) => { const it = s.heroes[id]!.gear[sl]; return it ? <ItemIcon it={it} s={1.1} onClick={() => open({ kind: 'item', it, hero: id })} /> : <span class="item empty">{SLOT_NAMES[sl][0]}</span>; })}</div>
          </div>
        ))}
      </div>
      <div class="row between"><h2>Bag <span class="muted small">{s.inventory.length}/{E.BAG_CAP}</span></h2>
        <div class="row gap"><button class="btn small" onClick={() => { const n = act((st) => E.equipBest(st)); toast(n ? `Equipped ${n} upgrade${n > 1 ? 's' : ''}` : 'Nothing better in the bag'); sfx('blip'); }}>Equip best</button>
          <button class="btn small" onClick={() => { const r = act((st) => E.salvageBelow(st, 2)); toast(`Salvaged ${r.n} for ${fmt(r.g)} gold`); sfx('coin'); }}>Salvage below Rare</button></div></div>
      <div class="bag">{inv.map((it) => <ItemIcon it={it} onClick={() => { act(() => { it.isNew = false; }); open({ kind: 'item', it }); }} />)}{inv.length === 0 && <p class="muted small" style={{ gridColumn: "1 / -1" }}>Monsters drop gear. Bosses always drop something.</p>}</div>
      <div class="card col">
        <label class="row between"><span>Auto-equip upgrades</span><Toggle on={s.settings.autoEquip} set={(v) => act((st) => { st.settings.autoEquip = v; })} /></label>
        <label class="row between"><span>Auto-salvage drops below</span>
          <select value={s.settings.autoSalvage} onChange={(e: any) => act((st) => { st.settings.autoSalvage = +e.target.value; })}>{RARITIES.slice(0, 4).map((r, i) => <option value={i}>{i ? r.name : 'Nothing'}</option>)}</select></label>
      </div>
    </div>
  );
}
const Toggle = ({ on, set }: { on: boolean; set: (v: boolean) => void }) => <button class={`toggle ${on ? 'on' : ''}`} onClick={() => { set(!on); sfx('blip'); }}><span /></button>;

// ---------------- skills ----------------
function XpBar({ sk }: { sk: SkillId }) { const s = store.s; return <div class="xpbar"><div style={{ width: `${E.xpProgress(s, sk) * 100}%` }} /><span>Lv {s.skillLv[sk]}{s.skillLv[sk] < 99 ? ` · ${fmt(s.skillXp[sk] - XP_TABLE[s.skillLv[sk]])}/${fmt(XP_TABLE[s.skillLv[sk] + 1] - XP_TABLE[s.skillLv[sk]])}` : ' · max'}</span></div>; }
function Skills({ open }: { open: (m: any) => void }) {
  const s = useStore();
  return (
    <div>
      <h2>Gathering</h2>
      <p class="small muted">Assign heroes who aren't fighting. They keep working while you're away.</p>
      {GATHER_KEYS.map((sk) => {
        const g = GATHER[sk];
        const workers = (Object.keys(s.heroes) as HeroId[]).filter((id) => s.heroes[id]!.job === sk);
        return (
          <div class="card col skill">
            <div class="row gap"><Spr k={g.icon} s={1.2} /><b class="grow">{g.name}</b></div>
            <XpBar sk={sk} />
            <div class="nodes">{g.nodes.map((nd, i) => {
              const locked = s.skillLv[sk] < nd.level;
              const here = workers.filter((id) => s.heroes[id]!.node === i);
              return (
                <button class={`node ${locked ? 'locked' : ''} ${here.length ? 'active' : ''}`} disabled={locked} onClick={() => open({ kind: 'assign', skill: sk, node: i })}>
                  <Spr k={nd.icon} s={1} /><span class="nm">{nd.name}</span>
                  <span class="small muted">{locked ? `Lv ${nd.level}` : `x${fmt(s.mats[RES_KEY[sk] + i])}`}</span>
                  {here.map((id) => <span class="worker"><Spr k={HERO[id].sprite} s={0.6} /><i style={{ width: `${s.heroes[id]!.prog * 100}%` }} /></span>)}
                </button>
              );
            })}</div>
            {workers.length ? <div class="small muted">{workers.map((id) => `${HERO[id].name}: ${(E.gatherRate(s, id) * 3600).toFixed(0)}/h`).join(' · ')}</div> : <div class="small muted">Tap a resource to send a hero.</div>}
          </div>
        );
      })}
    </div>
  );
}

// ---------------- craft ----------------
function Cost({ c }: { c: Record<string, number> }) { const s = store.s; return <span class="cost">{Object.entries(c).map(([k, v]) => <span class={(s.mats[k] || 0) >= v ? '' : 'bad'}><Spr k={matIcon(k)} s={0.6} />{fmt(s.mats[k] || 0)}/{v}</span>)}</span>; }
function Craft() {
  const s = useStore();
  const [sub, setSub] = useState<'smith' | 'cook' | 'brew'>('smith');
  const [slot, setSlot] = useState<string>('weapon:' + (Object.keys(s.heroes)[0] || 'knight'));
  const ids = Object.keys(s.heroes) as HeroId[];
  return (
    <div>
      <div class="seg wide">{([['smith', 'Smithing', 'sk_smithing'], ['cook', 'Cooking', 'sk_cooking'], ['brew', 'Alchemy', 'sk_alchemy']] as const).map(([k, n, ic]) => <button class={sub === k ? 'on' : ''} onClick={() => setSub(k)}><Spr k={ic} s={0.7} /> {n}</button>)}</div>
      {sub === 'smith' && <div>
        <XpBar sk="smithing" />
        <p class="small muted">Forge gear from ore and logs. Crafted gear is at least Uncommon, at your best stage's level, and higher Smithing levels roll better rarities.</p>
        <label class="row between card"><span>Make</span><select value={slot} onChange={(e: any) => setSlot(e.target.value)}>
          {ids.map((id) => <option value={'weapon:' + id}>{HERO[id].name}'s weapon</option>)}<option value="armor:">Armour (anyone)</option><option value="trinket:">Trinket (anyone)</option></select></label>
        {TIER_NAMES.map((tn, t) => { const ok = E.canCraft(s, 'smith', t); const lock = s.skillLv.smithing < E.craftLevel(t); return (
          <div class={`card recipe ${lock ? 'dim' : ''}`}><Spr k={(slot.startsWith('weapon') ? HERO[slot.split(':')[1] as HeroId].weapon : slot.startsWith('armor') ? 'ar' : 'tr') + t} s={1.2} />
            <div class="grow"><b>{tn}</b> <span class="small muted">{lock ? `Smithing ${E.craftLevel(t)}` : ''}</span><div><Cost c={E.smithCost(t)} /></div></div>
            <button class="btn primary" disabled={!ok} onClick={() => { const [sl, h] = slot.split(':'); const it = act((st) => E.smith(st, null, t, sl as Slot, (h || undefined) as HeroId)); if (it) { sfx(it.rarity >= 2 ? 'rare' : 'loot'); toast(`⚒ Forged <b style="color:${RARITIES[it.rarity].color}">${RARITIES[it.rarity].name} ${E.itemName(it)}</b> (${E.itemStatText(it)})`, it.rarity >= 3 ? 'gold' : ''); } }}>Forge</button></div>); })}
      </div>}
      {sub === 'cook' && <div>
        <XpBar sk="cooking" />
        <p class="small muted">Food is eaten automatically when a fighter drops below half life. The party eats your best food first.</p>
        {FOODS.map((f, t) => { const lock = s.skillLv.cooking < f.level; return (
          <div class={`card recipe ${lock ? 'dim' : ''} ${s.food === t ? 'sel' : ''}`}><Spr k={f.icon} s={1.2} />
            <div class="grow"><b>{f.name}</b> <span class="small muted">heals {Math.round(f.heal * 100)}% · have {fmt(s.mats['food' + t])}{lock ? ` · Cooking ${f.level}` : ''}</span><div><Cost c={E.cookCost(t)} /></div></div>
            <div class="col gap"><button class="btn small" disabled={!E.canCraft(s, 'cook', t)} onClick={() => { act((st) => E.cook(st, null, t, 1)); sfx('heal'); }}>Cook</button>
              <button class="btn small" disabled={!E.canCraft(s, 'cook', t)} onClick={() => { const n = act((st) => E.cook(st, null, t, 999)); toast(`🍳 Cooked ${n} ${f.name}`); sfx('heal'); }}>All</button>
              {s.mats['food' + t] > 0 && s.food !== t ? <button class="btn small" onClick={() => act((st) => { st.food = t; })}>Use</button> : null}</div></div>); })}
      </div>}
      {sub === 'brew' && <div>
        <XpBar sk="alchemy" />
        <div class="buffs">{Object.entries(s.buffs).map(([k, v]) => { const p = POTIONS.find((x) => x.id === k)!; return <span class="buff"><Spr k={p.icon} s={0.8} />{p.desc} · {E.fmtTime(v as number)}</span>; })}</div>
        {POTIONS.map((p, t) => { const lock = s.skillLv.alchemy < p.level; return (
          <div class={`card recipe ${lock ? 'dim' : ''}`}><Spr k={p.icon} s={1.2} />
            <div class="grow"><b>{p.name}</b> <span class="small muted">{p.desc} for {p.mins}m · have {fmt(s.mats['pot' + t])}{lock ? ` · Alchemy ${p.level}` : ''}</span><div><Cost c={E.brewCost(t)} /></div></div>
            <div class="col gap"><button class="btn small" disabled={!E.canCraft(s, 'brew', t)} onClick={() => { act((st) => E.brew(st, null, t, 1)); sfx('loot'); }}>Brew</button>
              <button class="btn small primary" disabled={s.mats['pot' + t] <= 0} onClick={() => { if (act((st) => E.drink(st, t))) { sfx('frenzy'); toast(`🧪 ${p.desc}!`, 'good'); } }}>Drink</button></div></div>); })}
      </div>}
      <h2>Materials</h2>
      <div class="mats">{Object.keys(s.mats).filter((k) => s.mats[k] > 0).map((k) => <span class="mat"><Spr k={matIcon(k)} s={0.9} /><span>{fmt(s.mats[k])}</span><span class="small muted">{matName(k)}</span></span>)}{!Object.values(s.mats).some((v) => v > 0) && <span class="muted small">Gather in the Skills tab to fill this up.</span>}</div>
    </div>
  );
}

// ---------------- collection ----------------
function Collection() {
  const s = useStore();
  const done = ACHIEVEMENTS.filter((a) => s.ach[a.id]).length;
  return (
    <div>
      <h2>Pets <span class="muted small">{Object.keys(s.pets).length}/{PETS.length}</span></h2>
      <div class="pets">{PETS.map((p) => (
        <div class={`card pet ${s.pets[p.id] ? '' : 'unknown'}`}><Spr k={p.sprite} s={1.6} cls={s.pets[p.id] ? '' : 'sil'} /><b class="small">{s.pets[p.id] ? p.name : '???'}</b><span class="small muted">{s.pets[p.id] ? p.bonus : hint(p.from)}</span></div>
      ))}</div>
      <h2>Achievements <span class="muted small">{done}/{ACHIEVEMENTS.length}</span></h2>
      {ACHIEVEMENTS.map((a) => <div class={`card ach ${s.ach[a.id] ? 'done' : ''}`}><span class="trophy">{s.ach[a.id] ? '🏆' : '·'}</span><div class="grow"><b>{a.name}</b><div class="small muted">{a.desc}</div></div><span class="small reward">{a.reward}</span></div>)}
      <h2>Stats</h2>
      <div class="card kv">
        <span>Best stage</span><b>{s.maxStage}</b><span>Monsters defeated</span><b>{fmt(s.stats.kills)}</b><span>Bosses defeated</span><b>{fmt(s.stats.bosses)}</b>
        <span>Strikes</span><b>{fmt(s.stats.taps)}</b><span>Gold earned</span><b>{fmt(s.stats.goldEarned)}</b><span>Ascensions</span><b>{s.ascensions}</b><span>Time played</span><b>{E.fmtTime(s.stats.time)}</b>
      </div>
    </div>
  );
}
const hint = (from: string) => ({ mining: 'Rare find while mining', woodcutting: 'Rare find while chopping', fishing: 'Rare find while fishing', foraging: 'Rare find while foraging', smithing: 'Rare find while smithing', cooking: 'Rare find while cooking', alchemy: 'Rare find while brewing', boss: 'Dropped by bosses', kills: 'Very rare from any monster', taps: 'Very rare from striking', ascend: 'Ascend once' } as any)[from];

// ---------------- ascend ----------------
function Ascend({ open }: { open: (m: any) => void }) {
  const s = useStore();
  const gain = E.soulGain(s);
  return (
    <div>
      <div class="card col ascend-card">
        <div class="row gap"><Spr k="ui_soul" s={2} /><div class="grow"><h2>Ascension</h2><div class="small">Souls: <b>{fmt(s.souls)}</b> · Ascended {s.ascensions}×</div></div></div>
        <p class="small">Reset your stage, gold and hero levels to earn Souls for permanent upgrades. You keep heroes, gear, skills, materials, pets and achievements.</p>
        {E.canAscend(s) ? <button class="btn primary big" onClick={() => open({ kind: 'ascend' })}>Ascend for {fmt(gain)} Souls</button>
          : <div class="small muted">Reach stage {ASCEND_STAGE} in this run to ascend (current best this run: {s.runMax}).</div>}
        {E.canAscend(s) && <div class="small muted">Souls grow fast with depth: pushing a few stages further before ascending can be worth a lot.</div>}
      </div>
      <h2>Soul upgrades</h2>
      {SOUL_TREE.map((u) => { const r = s.soul[u.id] || 0, c = u.cost(r), max = r >= u.max; return (
        <div class="card recipe"><Spr k={u.icon} s={1.2} /><div class="grow"><b>{u.name}</b> <span class="tag">{r}{u.max < 999 ? `/${u.max}` : ''}</span><div class="small muted">{r ? u.desc(r) : 'Not learned'} {max ? '' : `→ ${u.desc(r + 1)}`}</div></div>
          <button class="btn primary" disabled={max || s.souls < c} onClick={() => { if (act((st) => E.buySoul(st, u.id))) sfx('level'); }}>{max ? 'Max' : <><Spr k="ui_soul" s={0.5} /> {c}</>}</button></div>); })}
    </div>
  );
}

// ---------------- modals ----------------
function Modal({ m, close, open }: { m: any; close: () => void; open: (m: any) => void }) {
  const s = useStore();
  let body: any = null;
  if (m.kind === 'job') {
    const h = s.heroes[m.id as HeroId]!;
    const opts: [E.Job, string, string][] = [['fight', 'Fight', 'sk_fighting'], ...GATHER_KEYS.map((k) => [k, GATHER[k].name, GATHER[k].icon] as [E.Job, string, string]), ['idle', 'Rest', 'ui_book']];
    body = <><h2>{HERO[m.id as HeroId].name}'s job</h2><div class="jobs">{opts.map(([j, n, ic]) => {
      const full = j === 'fight' && h.job !== 'fight' && E.fighters(s).length >= MAX_FIGHTERS;
      return <button class={`card job ${h.job === j ? 'sel' : ''}`} disabled={full} onClick={() => { const best = j !== 'fight' && j !== 'idle' ? Math.max(0, GATHER[j as GatherSkill].nodes.filter((nd) => s.skillLv[j as SkillId] >= nd.level).length - 1) : 0; act((st) => E.setJob(st, m.id, j, best)); sfx('blip'); close(); }}><Spr k={ic} s={1.2} /><b>{n}</b>{full && <span class="small muted">party full</span>}{j !== 'fight' && j !== 'idle' ? <span class="small muted">Lv {s.skillLv[j as SkillId]}</span> : null}</button>;
    })}</div></>;
  }
  if (m.kind === 'assign') {
    const nd = GATHER[m.skill as GatherSkill].nodes[m.node];
    body = <><h2><Spr k={nd.icon} s={1} /> {nd.name}</h2><p class="small muted">Choose a hero to send. Fighters leave the battle (keep at least one fighting!).</p><div class="jobs">
      {(Object.keys(s.heroes) as HeroId[]).map((id) => { const h = s.heroes[id]!; const here = h.job === m.skill && h.node === m.node; return (
        <button class={`card job ${here ? 'sel' : ''}`} onClick={() => { act((st) => E.setJob(st, id, here ? 'idle' : m.skill, m.node)); sfx('blip'); close(); }}><Spr k={HERO[id].sprite} s={1.2} /><b>{HERO[id].name}</b><span class="small muted">{here ? 'Tap to stop' : h.job === 'fight' ? 'Fighting' : h.job === 'idle' ? 'Resting' : GATHER[h.job as GatherSkill].verb}</span></button>); })}
    </div></>;
  }
  if (m.kind === 'item') {
    const it: E.Item = s.inventory.find((x) => x.id === m.it.id) || m.it;
    const worn = (Object.keys(s.heroes) as HeroId[]).find((id) => s.heroes[id]!.gear[it.slot]?.id === it.id);
    body = <><div class="row gap"><ItemIcon it={it} s={2} /><div><h2 style={{ color: RARITIES[it.rarity].color }}>{E.itemName(it)}</h2><div class="small muted">{RARITIES[it.rarity].name} {SLOT_NAMES[it.slot]}{it.hero ? ` · ${HERO[it.hero].name} only` : ''} · item level {it.ilvl}{it.crafted ? ' · crafted' : ''}</div></div></div>
      <p class="stat">{E.itemStatText(it)}</p>
      {worn ? <p class="small">Equipped on {HERO[worn].name}.</p> : <div class="col gap">{(Object.keys(s.heroes) as HeroId[]).filter((id) => it.slot !== 'weapon' || it.hero === id).map((id) => { const cur = s.heroes[id]!.gear[it.slot]; const d = cur ? it.stat - cur.stat : it.stat; return (
        <button class="btn" onClick={() => { act((st) => E.equip(st, id, it)); sfx('loot'); close(); }}><Spr k={HERO[id].sprite} s={0.8} /> Equip on {HERO[id].name} <span class={d > 0 ? 'good' : 'bad'}>{cur ? `${d > 0 ? '+' : ''}${fmt(d)}` : 'empty slot'}</span></button>); })}</div>}
      <div class="row gap wrap">{worn ? <button class="btn" onClick={() => { act((st) => E.unequip(st, worn, it.slot)); close(); }}>Unequip</button> : null}
        <button class="btn" onClick={() => { act(() => { it.locked = !it.locked; }); }}>{it.locked ? 'Unlock' : 'Lock'}</button>
        {!worn && <button class="btn danger" disabled={it.locked} onClick={() => { const g = act((st) => E.salvage(st, it)); toast(`Salvaged for ${fmt(g)} gold`); sfx('coin'); close(); }}>Salvage <Gold n={E.salvageValue(s, it)} /></button>}</div></>;
  }
  if (m.kind === 'ascend') {
    body = <><h2>Ascend?</h2><p>You will gain <b>{fmt(E.soulGain(s))} Souls</b>. Stage, gold and hero levels reset{s.soul.headstart ? ` (you'll start at stage ${1 + 5 * s.soul.headstart})` : ''}. Heroes, gear, skills, materials, pets and achievements are kept.</p>
      <div class="row gap"><button class="btn primary big" onClick={() => { act((st) => E.ascend(st, store.rt)); sfx('frenzy'); close(); }}>Ascend</button><button class="btn" onClick={close}>Not yet</button></div></>;
  }
  if (m.kind === 'offline') {
    const r = store.offlineReport!;
    body = <div class="offline"><h2>Welcome back!</h2><p class="small muted">You were away {E.fmtTime(r.secs)}{r.capped ? ` (capped at ${E.fmtTime(E.offlineCap(s))})` : ''}. Your party kept going:</p>
      <div class="loot-list">
        {r.kills ? <div class="lrow"><Spr k="sk_fighting" s={1} /><span>Defeated <b>{fmt(r.kills)}</b> monsters on stage {r.stage}</span></div> : null}
        {r.gold ? <div class="lrow"><Spr k="gold4" s={1} /><span>Earned <b>{fmt(r.gold)}</b> gold</span></div> : null}
        {r.items ? <div class="lrow"><Spr k="ui_chest" s={1} /><span>Found <b>{r.items}</b> items ({r.equipped} equipped)</span></div> : null}
        {Object.entries(r.mats).map(([k, v]) => <div class="lrow"><Spr k={matIcon(k)} s={1} /><span>+<b>{fmt(v)}</b> {matName(k)}</span></div>)}
        {Object.entries(r.levels).map(([k, v]) => <div class="lrow"><Spr k={SKILL_ICONS[k as SkillId]} s={1} /><span>{SKILL_NAMES[k as SkillId]} +{v} level{v > 1 ? 's' : ''}</span></div>)}
        {r.pets.map((p) => <div class="lrow gold"><Spr k={PETS.find((x) => x.id === p)!.sprite} s={1} /><span>New pet: <b>{PETS.find((x) => x.id === p)!.name}</b>!</span></div>)}
      </div>
      <button class="btn primary big" onClick={() => { store.offlineReport = null; sfx('coin'); close(); }}>Collect</button></div>;
  }
  if (m.kind === 'settings') {
    const st = s.settings;
    const set = (k: string, v: any) => { act((x) => { (x.settings as any)[k] = v; }); applyVolumes(); };
    body = <><h2>Settings</h2>
      <label class="row between"><span>Music</span><Toggle on={st.music} set={(v) => set('music', v)} /></label>
      <label class="row between"><span>Music volume</span><input type="range" min="0" max="1" step="0.05" value={st.musicVol} onInput={(e: any) => set('musicVol', +e.target.value)} /></label>
      <label class="row between"><span>Sound effects</span><Toggle on={st.sfx} set={(v) => set('sfx', v)} /></label>
      <label class="row between"><span>Effects volume</span><input type="range" min="0" max="1" step="0.05" value={st.sfxVol} onInput={(e: any) => set('sfxVol', +e.target.value)} /></label>
      <label class="row between"><span>Damage numbers</span><Toggle on={st.dmgNums} set={(v) => set('dmgNums', v)} /></label>
      <label class="row between"><span>Screen shake</span><Toggle on={st.shake} set={(v) => set('shake', v)} /></label>
      <div class="row gap wrap" style={{ marginTop: '10px' }}>
        <button class="btn small" onClick={() => { const txt = btoa(unescape(encodeURIComponent(JSON.stringify(s)))); navigator.clipboard?.writeText(txt); prompt('Your save (copied):', txt); }}>Export save</button>
        <button class="btn small" onClick={() => { const txt = prompt('Paste a save:'); if (txt) { try { localStorage.setItem(E.SAVE_KEY, decodeURIComponent(escape(atob(txt.trim())))); location.reload(); } catch (e) { alert('That save could not be read.'); } } }}>Import save</button>
        <button class="btn small danger" onClick={() => { if (confirm('Erase your save and start over?')) { resetGame(); location.reload(); } }}>Reset</button>
      </div>
      <p class="small muted">Pocket Realm. Art: Dungeon Crawl Stone Soup / RLTiles (CC0). Music: Ninja Adventure by Pixel-boy & AAA (CC0).</p></>;
  }
  return (
    <div class="modal" onClick={(e: any) => { if (e.target.classList.contains('modal') && m.kind !== 'offline') close(); }}>
      <div class="sheet">{body}{m.kind !== 'offline' && m.kind !== 'ascend' && <button class="btn close" onClick={close}>Close</button>}</div>
    </div>
  );
}

import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent, type PointerEvent } from 'react'
import GameBackButton from '../../components/GameBackButton'
import GamePlaySurface from '../../components/GamePlaySurface'
import { useGameIntroPlaying } from '../../components/gameIntroState'
import { primeAudio } from '../../audio/sound'
import { vibrate } from '../../utils/haptics'
import {
  SNACKS, SPECIES, STAT_KEYS, STAT_LABEL, RARE_VARIANT, createMonster, monsterFromWord, stoneVariant,
  type Monster, type SnackId, type Species, type StatKey,
} from './monsters'
import {
  CHEER_MAX, DRILLS, RANKS, ROUND_NAMES, TIRED, TOP_RANK, addDex, calendar, finishTournament, giveSnack, loadFarm,
  newFarm, pet, rankName, readDex, readMusic, readiness, rest, saveFarm, speciesOf, tournamentFoes, train, writeMusic,
  type DrillId, type Farm, type TrainResult,
} from './farm'
import {
  ARENA_W, BATTLE_SECONDS, command, createBattle, drainBattleEvents, setAuto, stepBattle, type Battle,
} from './battle'
import {
  Buffer, SUMMON_SECONDS, TRAIN_DOING, TRAIN_RESULT, actorGround, addFx, arenaGround, arenaLeft, burst, createActor, createFx,
  drawBattle, drawRanch, drawShrine, drawTraining, hitActor, hopActor, iconFor, shrineGround, trainGround, updateActor, updateFx, viewSize,
  type RanchActor, type View,
} from './render'
import { monsterColor } from './sprites'
import {
  playBorn, playCheer, playCry, playFail, playGo, playGood, playGreat, playHit, playKo, playLose, playMiss, playMorning,
  playPet, playRankUp, playRest, playSelect, playShot, playSnack, playSummon, playTrainBeat, playWeek, playWin, playWindup,
  startBgm, type SongId,
} from './sounds'
import styles from './DotMonsterFarmPlay.module.css'

const TITLE = 'ドットの モンスターぼくじょう'
const SEASON_NAME = { spring: 'はる', summer: 'なつ', autumn: 'あき', winter: 'ふゆ' } as const
const DRILL_ICON: Record<DrillId, string> = { rock: 'rock', study: 'book', run: 'shoe', fall: 'water', pull: 'log' }

/** らんすうの たね（よびだし・たいかいの あいて・たたかいに つかう）。 */
function randomSeed() {
  return Math.floor(Math.random() * 2 ** 31)
}

let toastCount = 0

// ---------------- canvas の ループ ----------------

/** canvas を 画面の 大きさに あわせる。 */
function fitCanvas(canvas: HTMLCanvasElement, minW?: number, minH?: number): View {
  const box = canvas.getBoundingClientRect()
  const dpr = Math.min(3, window.devicePixelRatio || 1)
  const view = viewSize(box.width || 360, box.height || 270, dpr, minW, minH)
  if (canvas.width !== view.dw) canvas.width = view.dw
  if (canvas.height !== view.dh) canvas.height = view.dh
  return view
}

type Frame = (dt: number, g: CanvasRenderingContext2D | null, view: View) => void

/**
 * まいフレーム frame を よび、ちいさな ドットの え を canvas いっぱいに うつす。
 * canvas が つかえない ところ（テスト）でも frame は よばれるので、すすみかたは かわらない。
 */
function startLoop(canvas: HTMLCanvasElement | null, frame: Frame, minW?: number, minH?: number) {
  const ctx = canvas?.getContext('2d') ?? null
  const buffer = new Buffer()
  let view: View = canvas ? fitCanvas(canvas, minW, minH) : viewSize(360, 270, 1, minW, minH)
  const measure = () => { if (canvas) view = fitCanvas(canvas, minW, minH) }
  const observer = typeof ResizeObserver === 'function' && canvas ? new ResizeObserver(measure) : null
  if (canvas) observer?.observe(canvas)
  window.addEventListener('resize', measure)
  let raf = 0, previous = 0
  const tick = (now: number) => {
    raf = requestAnimationFrame(tick)
    const dt = previous ? Math.min(.1, (now - previous) / 1000) : 0
    previous = now
    if (document.hidden) return
    const g = ctx ? buffer.ensure(view.w, view.h) : null
    frame(dt, g, view)
    if (ctx && buffer.canvas) {
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(buffer.canvas, 0, 0, view.w * view.scale, view.h * view.scale)
    }
  }
  raf = requestAnimationFrame(tick)
  return () => {
    cancelAnimationFrame(raf)
    observer?.disconnect()
    window.removeEventListener('resize', measure)
  }
}

/** タップした ところを ドットの ざひょうに する。 */
function toPixel(event: PointerEvent<HTMLElement>, view: View) {
  const box = event.currentTarget.getBoundingClientRect()
  return {
    x: (event.clientX - box.left) / (box.width || 1) * (view.dw / view.scale),
    y: (event.clientY - box.top) / (box.height || 1) * (view.dh / view.scale),
  }
}

function useBgm(song: SongId | null, music: boolean) {
  useEffect(() => {
    if (!music || !song) return undefined
    return startBgm(song)
  }, [song, music])
}

/** ドット絵の ちいさな アイコン。 */
function PixelIcon({ kind, id, variant = 0, className }: { kind: 'snack' | 'icon' | 'stone' | 'monster'; id: string; variant?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    const img = iconFor(kind, id, variant)
    const ctx = canvas?.getContext('2d')
    if (!canvas || !img || !ctx) return
    canvas.width = img.width
    canvas.height = img.height
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(img, 0, 0)
  }, [kind, id, variant])
  return <canvas ref={ref} className={`${styles.pixel} ${className ?? ''}`} aria-hidden="true" />
}

function MusicButton({ music, onMusic, className }: { music: boolean; onMusic: () => void; className?: string }) {
  return <button type="button" className={`${styles.window} ${styles.musicButton} ${className ?? ''}`} onClick={onMusic} aria-pressed={music}
    aria-label={music ? 'おんがくを けす' : 'おんがくを ながす'}>{music ? '♪' : '×'}</button>
}

function StatBars({ monster, scale }: { monster: Monster; scale?: number }) {
  const max = scale ?? Math.max(100, Math.ceil(Math.max(...STAT_KEYS.map(k => monster.stats[k])) / 100) * 100)
  return <ul className={styles.stats} aria-label="のうりょく">
    {STAT_KEYS.map(key => <li key={key} className={styles.stat} data-stat={key} aria-label={`${STAT_LABEL[key]} ${monster.stats[key]}`}>
      <span className={styles.statName} aria-hidden="true">{STAT_LABEL[key]}</span>
      <span className={styles.statBar} aria-hidden="true"><span style={{ width: `${Math.min(100, monster.stats[key] / max * 100)}%` }} /></span>
      <span className={styles.statValue} aria-hidden="true">{monster.stats[key]}</span>
    </li>)}
  </ul>
}

function speciesLine(monster: Monster) {
  const species = speciesOf(monster)
  return `${species.kind}${monster.variant === RARE_VARIANT ? '・いろちがい' : ''}`
}

// ---------------- タイトル ----------------

function TitleScreen({ farm, dex, music, onMusic, onContinue, onNew }: {
  farm: Farm | null; dex: Set<string>; music: boolean; onMusic: () => void; onContinue: () => void; onNew: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [confirm, setConfirm] = useState(false)
  useBgm('ranch', music)

  // うしろで モンスターたちが あそんで いる。
  useEffect(() => {
    const random = Math.random
    const fx = createFx()
    let actors: RanchActor[] | null = null
    let time = 0
    return startLoop(canvasRef.current, (dt, g, view) => {
      time += dt
      if (!actors) actors = SPECIES.map((s, i) => createActor({ species: s.id, variant: 0 }, 20 + (i + .5) * (view.w - 40) / SPECIES.length, .2 + (i % 3) * .3))
      for (const a of actors) updateActor(a, dt, view.w, random, false)
      updateFx(fx, dt)
      if (g) drawRanch(g, view.w, view.h, { season: 'spring', time, rank: 'E', actors, fx })
    })
  }, [])

  const met = SPECIES.filter(s => [0, 1, 2, RARE_VARIANT].some(v => dex.has(`${s.id}:${v}`)))
  const rare = SPECIES.filter(s => dex.has(`${s.id}:${RARE_VARIANT}`)).length
  const cal = farm ? calendar(farm.week) : null
  return <main className={styles.title}>
    <canvas ref={canvasRef} className={styles.titleCanvas} aria-hidden="true" />
    <GameBackButton to="/" />
    <MusicButton music={music} onMusic={onMusic} className={styles.titleMusic} />
    <div className={styles.titleInner}>
      <header className={styles.logo}>
        <p className={styles.logoSub}>〜 そだてて たたかう モンスターの ぼくじょう 〜</p>
        <h1>{TITLE}</h1>
      </header>
      <div className={styles.titleMenu}>
        {farm && cal && <button type="button" className={`${styles.window} ${styles.bigButton} ${styles.primary}`} onClick={() => { primeAudio(); playSelect(); onContinue() }}>
          <PixelIcon kind="monster" id={farm.monster.species} variant={farm.monster.variant} className={styles.continueIcon} />
          <span>つづきから<small>{farm.monster.name}・{rankName(farm.rank)}・{cal.year}ねんめ {cal.month}がつ</small></span>
        </button>}
        <button type="button" className={`${styles.window} ${styles.bigButton} ${farm ? '' : styles.primary}`}
          onClick={() => { primeAudio(); playSelect(); if (farm) setConfirm(true); else onNew() }}>
          <PixelIcon kind="stone" id="#f8d040" className={styles.continueIcon} />
          <span>{farm ? 'あたらしく よぶ' : 'モンスターを よぶ'}<small>ふしぎな いしから うまれるよ</small></span>
        </button>
      </div>
      <section className={`${styles.window} ${styles.dex}`} aria-label={`ずかん ${met.length} / ${SPECIES.length}`}>
        <h2>ずかん <span>{met.length} / {SPECIES.length}</span>{rare > 0 && <em>いろちがい {rare}</em>}</h2>
        <ul>
          {SPECIES.map(s => {
            const variant = [RARE_VARIANT, 0, 1, 2].find(v => dex.has(`${s.id}:${v}`))
            return <li key={s.id} aria-label={variant === undefined ? 'まだ みていない' : s.name}>
              {variant === undefined ? <span className={styles.unknown} aria-hidden="true">?</span> : <PixelIcon kind="monster" id={s.id} variant={variant} />}
            </li>
          })}
        </ul>
      </section>
    </div>
    {confirm && farm && <div className={styles.overlay}>
      <div className={`${styles.window} ${styles.card}`} role="dialog" aria-label="あたらしく よぶ">
        <h2>あたらしく よぶ？</h2>
        <p>いまの {farm.monster.name}の きろくは きえるよ。いい？</p>
        <div className={styles.cardButtons}>
          <button type="button" autoFocus onClick={() => setConfirm(false)}>やめる</button>
          <button type="button" className={styles.danger} onClick={() => { setConfirm(false); onNew() }}>あたらしく よぶ</button>
        </div>
      </div>
    </div>}
  </main>
}

// ---------------- よびだし ----------------

function SummonScreen({ music, onMusic, onBack, onBorn }: { music: boolean; onMusic: () => void; onBack: () => void; onBorn: (monster: Monster) => void }) {
  useGameIntroPlaying(true)
  useBgm('shrine', music)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [phase, setPhase] = useState<'pick' | 'calling' | 'born'>('pick')
  const [stone, setStone] = useState('#c8a8ff')
  const [baby, setBaby] = useState<Monster | null>(null)
  const [word, setWord] = useState('')
  // ループと やりとりする じょうたい（baby は うまれる まえ、shown は え に のこす モンスター）。
  const live = useRef<{ start: boolean; t: number | null; stone: string; baby: Monster | null; shown: Monster | null }>({ start: false, t: null, stone: '#c8a8ff', baby: null, shown: null })

  useEffect(() => {
    const fx = createFx()
    let time = 0
    let bornAt = -1
    return startLoop(canvasRef.current, (dt, g, view) => {
      time += dt
      const s = live.current
      if (s.start) { s.start = false; s.t = 0; bornAt = -1; fx.list.length = 0; playSummon() }
      if (s.t !== null) {
        s.t += dt
        const cx = view.w / 2, ground = shrineGround(view.h)
        if (s.t < SUMMON_SECONDS && Math.random() < dt * 14) addFx(fx, { kind: 'spark', x: cx + (Math.random() - .5) * 40, y: ground - 4, vx: 0, vy: -30 - Math.random() * 30, life: .8, color: Math.random() > .5 ? '#fff4b0' : '#c8a8ff' })
        if (s.t >= SUMMON_SECONDS && bornAt < 0) {
          bornAt = time
          burst(fx, 'star', cx, ground - 22, 22, ['#fff4b0', '#ffffff', s.stone], 70, 1)
          burst(fx, 'confetti', cx, ground - 30, 26, ['#ff6a6a', '#ffe060', '#6ad070', '#5aa8f0', '#e080ff'], 80, 1.6)
          playBorn()
          if (s.baby) playCry(speciesOf(s.baby).voice)
          vibrate('celebrate')
        }
        if (bornAt >= 0 && time - bornAt > 1.3 && s.baby) {
          const born = s.baby
          s.baby = null
          setPhase('born')
          setBaby(born)
        }
      }
      updateFx(fx, dt)
      if (g) drawShrine(g, view.w, view.h, { t: s.t, stoneColor: s.stone, monster: s.t !== null && s.t >= SUMMON_SECONDS ? s.shown : null, time, fx })
    })
  }, [])

  const call = (monster: Monster, color: string) => {
    primeAudio()
    playSelect()
    setStone(color)
    setPhase('calling')
    live.current = { start: true, t: null, stone: color, baby: monster, shown: monster }
  }
  const pickStone = (species: Species) => call(createMonster(species, stoneVariant(Math.random), randomSeed()), species.stoneColor)
  const submitWord = (event: FormEvent) => {
    event.preventDefault()
    const monster = monsterFromWord(word)
    if (monster) call(monster, '#ffffff')
  }
  const again = () => {
    playSelect()
    live.current = { start: false, t: null, stone, baby: null, shown: null }
    setBaby(null)
    setPhase('pick')
  }

  return <GamePlaySurface><main className={styles.summon}>
    <h1 className={styles.srOnly}>モンスターを よぶ</h1>
    <div className={styles.summonStage}>
      <canvas ref={canvasRef} className={styles.fullCanvas} aria-label="ふしぎな いしの まつり" />
      {phase === 'calling' && <p className={`${styles.window} ${styles.callingText}`} role="status">なにが うまれるかな…？</p>}
    </div>
    <GameBackButton onBack={onBack} />
    <MusicButton music={music} onMusic={onMusic} className={styles.cornerMusic} />
    {phase === 'pick' && <div className={styles.summonPanel}>
      <p className={`${styles.window} ${styles.lead}`}>ふしぎな いしを えらんでね</p>
      <ul className={styles.stones} aria-label="いしを えらぶ">
        {SPECIES.map(s => <li key={s.id}>
          <button type="button" className={`${styles.window} ${styles.stoneButton}`} onClick={() => pickStone(s)} aria-label={s.stone}>
            <PixelIcon kind="stone" id={s.stoneColor} className={styles.stoneIcon} />
            <span>{s.stone}</span>
          </button>
        </li>)}
      </ul>
      <form className={`${styles.window} ${styles.wordForm}`} onSubmit={submitWord}>
        <label htmlFor="monster-word">ことばで よぶ</label>
        <input id="monster-word" value={word} maxLength={12} onChange={e => setWord(e.target.value)} placeholder="なまえや すきな もの" autoComplete="off" />
        <button type="submit" disabled={!word.trim()}>よぶ</button>
      </form>
    </div>}
    {phase === 'born' && baby && <div className={styles.overlay}>
      <div className={`${styles.window} ${styles.card}`} role="dialog" aria-label="うまれた">
        <h2>{baby.name}が うまれた！</h2>
        <p className={styles.bornHero}><PixelIcon kind="monster" id={baby.species} variant={baby.variant} className={styles.bigMonster} /></p>
        <p className={styles.kind}>{speciesLine(baby)}{baby.variant === RARE_VARIANT && <em className={styles.rare}>★ めずらしい いろ！</em>}</p>
        <p className={styles.tip}>{speciesOf(baby).lead}</p>
        <StatBars monster={baby} scale={60} />
        <div className={styles.cardButtons}>
          <button type="button" onClick={again}>べつの こに する</button>
          <button type="button" className={styles.primary} autoFocus onClick={() => { playSelect(); onBorn(baby) }}>この こを そだてる！</button>
        </div>
      </div>
    </div>}
  </main></GamePlaySurface>
}

// ---------------- ぼくじょう ----------------

type RanchCmd = { type: 'pet' } | { type: 'snack'; snack: SnackId; liked: boolean } | { type: 'rest' }

function hintFor(farm: Farm) {
  const cal = calendar(farm.week)
  if (farm.monster.fatigue >= TIRED) return 'つかれてるよ。「やすむ」で げんきに しよう'
  if (cal.tournament) return 'たいかいに でるか、とっくんを つづけるか えらぼう'
  if (!farm.petted) return 'モンスターを タッチして なでて あげよう'
  if (!farm.snacked) return 'おやつを あげると なかよしに なれるよ'
  return 'とっくんで のうりょくを のばそう'
}

const READY_TEXT = { strong: 'じゅんび ばっちり！', even: 'いい しょうぶに なりそう', weak: 'もうすこし とっくん しよう' } as const

function RanchScreen({ farm, music, onMusic, onFarm, onTrain, onTournament, onExit }: {
  farm: Farm; music: boolean; onMusic: () => void; onFarm: (farm: Farm) => void; onTrain: (drill: DrillId) => void; onTournament: () => void; onExit: () => void
}) {
  useGameIntroPlaying(true)
  useBgm('ranch', music)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewRef = useRef<View>(viewSize(360, 270, 1))
  const actorRef = useRef<RanchActor | null>(null)
  const cmds = useRef<RanchCmd[]>([])
  const live = useRef({ farm })
  const [menu, setMenu] = useState<'main' | 'train' | 'snack'>('main')
  const [busy, setBusy] = useState<null | 'rest' | 'snack'>(null)
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null)
  const species = speciesOf(farm.monster)
  const cal = calendar(farm.week)
  const tired = farm.monster.fatigue >= TIRED

  // ループの なかから さいしんの ぼくじょうと onFarm を つかう ため。
  const onFarmRef = useRef(onFarm)
  useEffect(() => { live.current.farm = farm }, [farm])
  useEffect(() => { onFarmRef.current = onFarm }, [onFarm])

  useEffect(() => {
    const fx = createFx()
    const random = Math.random
    let time = 0
    let night = 0
    let anim: { type: 'rest' | 'snack'; t: number; snack?: SnackId; liked?: boolean; done?: boolean } | null = null
    return startLoop(canvasRef.current, (dt, g, view) => {
      viewRef.current = view
      time += dt
      const f = live.current.farm
      let actor = actorRef.current
      if (!actor || actor.monster.species !== f.monster.species || actor.monster.variant !== f.monster.variant) {
        actor = createActor(f.monster, view.w * .55, .55)
        actorRef.current = actor
      }
      const ground = actorGround(actor, view.h)
      for (const cmd of cmds.current.splice(0)) {
        if (cmd.type === 'pet') {
          hopActor(actor, 2)
          for (let i = 0; i < 3; i++) addFx(fx, { kind: 'heart', x: actor.x - 6 + i * 6, y: ground - 24, vx: (i - 1) * 8, vy: -22 - i * 4, life: 1.1, color: '#ff4a78' })
        } else if (cmd.type === 'snack') {
          anim = { type: 'snack', t: 0, snack: cmd.snack, liked: cmd.liked }
          actor.mode = 'eat'
          actor.t = 0
        } else {
          anim = { type: 'rest', t: 0 }
          actor.mode = 'sleep'
          actor.tx = actor.x
        }
      }
      if (anim) {
        anim.t += dt
        if (anim.type === 'snack') {
          if (Math.random() < dt * 10) addFx(fx, { kind: 'crumb', x: actor.x + 9, y: ground - 8, vx: (Math.random() - .5) * 30, vy: -20, life: .5, color: '#e0aa58', gravity: 120 })
          if (anim.t > 1.6 && !anim.done) {
            anim.done = true
            actor.mode = 'idle'
            if (anim.liked) { hopActor(actor, 3); burst(fx, 'heart', actor.x, ground - 22, 5, ['#ff4a78'], 30, 1.2) }
            else addFx(fx, { kind: 'note', x: actor.x + 8, y: ground - 26, vx: 4, vy: -14, life: 1, color: '#ffffff' })
          }
          if (anim.t > 2.2) { anim = null; setBusy(null) }
        } else {
          night = anim.t < .8 ? anim.t / .8 : anim.t < 2.6 ? 1 : Math.max(0, 1 - (anim.t - 2.6) / .7)
          if (anim.t > 2.6 && !anim.done) {
            anim.done = true
            actor.mode = 'hop'
            actor.hops = 2
            actor.t = 0
            playMorning()
          }
          if (anim.t > 3.3) {
            anim = null
            night = 0
            onFarmRef.current(rest(live.current.farm))
            setBusy(null)
          }
        }
      }
      updateActor(actor, dt, view.w, random, f.monster.fatigue >= TIRED)
      if (f.monster.fatigue >= TIRED && actor.mode !== 'sleep' && Math.random() < dt * 1.2) {
        addFx(fx, { kind: 'sweat', x: actor.x + 9, y: ground - 22, vx: 10, vy: -10, life: .6, color: '#a8e0ff', gravity: 60 })
      }
      updateFx(fx, dt)
      if (g) drawRanch(g, view.w, view.h, {
        season: calendar(f.week).season, time, rank: RANKS[f.rank], night, actors: [actor], tired: f.monster.fatigue >= TIRED, fx,
        snack: anim?.type === 'snack' && !anim.done ? anim.snack : null,
      })
    })
  }, [])

  const showToast = (text: string) => setToast({ id: ++toastCount, text })

  function tapStage(event: PointerEvent<HTMLElement>) {
    if (event.button !== 0 && event.pointerType === 'mouse') return
    const actor = actorRef.current
    if (!actor || busy) return
    primeAudio()
    const p = toPixel(event, viewRef.current)
    if (!hitActor(actor, viewRef.current.h, p.x, p.y)) {
      // さわった ところへ あるいて くる。
      actor.mode = 'walk'
      actor.t = 0
      actor.tx = p.x
      return
    }
    petMonster()
  }

  function petMonster() {
    if (busy) return
    cmds.current.push({ type: 'pet' })
    playPet()
    playCry(species.voice)
    vibrate('tap')
    if (!farm.petted) {
      onFarm(pet(farm))
      showToast(`${farm.monster.name}は うれしそう！ なかよし アップ`)
    }
  }

  function feed(snack: SnackId) {
    const { farm: next, liked } = giveSnack(farm, snack)
    if (next === farm) return
    playSnack(liked)
    if (liked) playCry(species.voice)
    cmds.current.push({ type: 'snack', snack, liked })
    setBusy('snack')
    setMenu('main')
    onFarm(next)
    showToast(liked ? 'だいすきな おやつ！ なかよし アップ' : 'もぐもぐ。おいしかったね')
  }

  function sleep() {
    playRest()
    cmds.current.push({ type: 'rest' })
    setBusy('rest')
    setMenu('main')
    showToast('おやすみなさい…')
  }

  const ready = readiness(farm)
  const fatigueLabel = farm.monster.fatigue >= 80 ? 'へとへと' : farm.monster.fatigue >= TIRED ? 'つかれぎみ' : farm.monster.fatigue >= 30 ? 'ふつう' : 'げんき いっぱい'
  const color = monsterColor(farm.monster.species, farm.monster.variant)
  return <GamePlaySurface><main className={styles.ranch} data-season={cal.season}>
    <h1 className={styles.srOnly}>{TITLE} ぼくじょう</h1>
    <div className={styles.stage}>
      <canvas ref={canvasRef} className={styles.stageCanvas} tabIndex={0}
        aria-label={`ぼくじょう。${farm.monster.name}が いるよ。タッチで なでられるよ`}
        onPointerDown={tapStage}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); petMonster() } }} />
      <GameBackButton onBack={onExit} />
      <MusicButton music={music} onMusic={onMusic} className={styles.cornerMusic} />
      <p key={farm.week} className={`${styles.window} ${styles.weekBanner}`} aria-hidden="true">
        <small>{cal.year}ねんめ {SEASON_NAME[cal.season]}</small>{cal.month}がつ {cal.week}しゅうめ
      </p>
      {toast && <p key={toast.id} className={styles.toast} role="status">{toast.text}</p>}
    </div>
    <section className={styles.panel} aria-label="モンスターの ようす">
      <div className={styles.calendarRow}>
        <span className={styles.calendar}>{cal.month}がつ {cal.week}しゅうめ</span>
        <span className={cal.tournament ? styles.tourNow : styles.tourSoon}>
          {cal.tournament ? `こんしゅうは ${rankName(farm.rank)} たいかい！` : `たいかいまで あと ${cal.weeksToTournament}しゅう`}
        </span>
      </div>
      <p className={styles.hint} role="status">{hintFor(farm)}</p>
      {menu === 'main' && <div className={styles.actions}>
        {cal.tournament && <button type="button" className={`${styles.window} ${styles.action} ${styles.tourButton}`} disabled={!!busy}
          onClick={() => { primeAudio(); playSelect(); onTournament() }}>
          <PixelIcon kind="icon" id="trophy" className={styles.actionIcon} />
          <span>たいかいに でる<small>{rankName(farm.rank)}・{READY_TEXT[ready]}</small></span>
        </button>}
        <button type="button" className={`${styles.window} ${styles.action}`} disabled={!!busy} onClick={() => { primeAudio(); playSelect(); setMenu('train') }}>
          <PixelIcon kind="icon" id="star" className={styles.actionIcon} />
          <span>とっくん<small>のうりょくを のばす</small></span>
        </button>
        <button type="button" className={`${styles.window} ${styles.action}`} disabled={!!busy} onClick={() => { primeAudio(); sleep() }}>
          <PixelIcon kind="icon" id="moon" className={styles.actionIcon} />
          <span>やすむ<small>げんきが もどる</small></span>
        </button>
        <button type="button" className={`${styles.window} ${styles.action}`} disabled={!!busy || farm.snacked} onClick={() => { primeAudio(); playSelect(); setMenu('snack') }}>
          <PixelIcon kind="snack" id={species.likes} className={styles.actionIcon} />
          <span>おやつ<small>{farm.snacked ? 'こんしゅうは もう たべたよ' : '1しゅうに 1かい'}</small></span>
        </button>
      </div>}
      {menu === 'train' && <div className={styles.subMenu}>
        <h3>どの とっくんに する？{tired && <em>（つかれてると しっぱい しやすいよ）</em>}</h3>
        <ul className={styles.drills}>
          {DRILLS.map(d => <li key={d.id}>
            <button type="button" className={`${styles.window} ${styles.drill}`} onClick={() => { playSelect(); onTrain(d.id) }}
              aria-label={`${d.name}。${STAT_LABEL[d.main]}が のびる`}>
              <PixelIcon kind="icon" id={DRILL_ICON[d.id]} className={styles.actionIcon} />
              <span>{d.name}<small>{STAT_LABEL[d.main]}↑ {STAT_LABEL[d.sub]}↑</small></span>
              {species.growth[d.main] >= 1.4 && <em className={styles.knack}>とくい</em>}
            </button>
          </li>)}
        </ul>
        <button type="button" className={styles.cancel} onClick={() => setMenu('main')}>やめる</button>
      </div>}
      {menu === 'snack' && <div className={styles.subMenu}>
        <h3>どの おやつを あげる？</h3>
        <ul className={styles.snacks}>
          {SNACKS.map(s => <li key={s.id}>
            <button type="button" className={`${styles.window} ${styles.drill}`} onClick={() => feed(s.id)}>
              <PixelIcon kind="snack" id={s.id} className={styles.actionIcon} />
              <span>{s.name}</span>
            </button>
          </li>)}
        </ul>
        <button type="button" className={styles.cancel} onClick={() => setMenu('main')}>やめる</button>
      </div>}
      <div className={`${styles.window} ${styles.monsterCard}`} style={{ '--mon': color.main, '--mon-dark': color.dark } as CSSProperties}>
        <div className={styles.nameRow}>
          <PixelIcon kind="monster" id={farm.monster.species} variant={farm.monster.variant} className={styles.nameIcon} />
          <div>
            <h2>{farm.monster.name}</h2>
            <p>{speciesLine(farm.monster)}</p>
          </div>
          <span className={styles.rankBadge} aria-label={rankName(farm.rank)}>{farm.champion > 0 ? '👑' : RANKS[farm.rank]}</span>
        </div>
        <StatBars monster={farm.monster} />
        <div className={styles.meters}>
          <p aria-label={`げんき ${100 - farm.monster.fatigue}。${fatigueLabel}`}>
            <span aria-hidden="true">げんき</span>
            <span className={`${styles.meter} ${styles.energy}`} data-low={tired} aria-hidden="true"><span style={{ width: `${100 - farm.monster.fatigue}%` }} /></span>
            <em aria-hidden="true">{fatigueLabel}</em>
          </p>
          <p aria-label={`なかよし ${farm.monster.bond}`}>
            <span aria-hidden="true">なかよし</span>
            <span className={`${styles.meter} ${styles.bond}`} aria-hidden="true"><span style={{ width: `${farm.monster.bond}%` }} /></span>
            <em aria-hidden="true">{'♥'.repeat(1 + Math.floor(farm.monster.bond / 25))}</em>
          </p>
        </div>
      </div>
      <p className={styles.record}>たいかい {farm.wins}しょう・{rankName(farm.rank)}{farm.champion > 0 ? `・チャンピオン ${farm.champion}かい` : ''}</p>
    </section>
  </main></GamePlaySurface>
}

// ---------------- とっくん ----------------

const GRADE_TEXT = { great: 'だいせいこう！', good: 'せいこう！', fail: 'しっぱい…' } as const

function TrainScreen({ farm, drill, music, onMusic, onDone, onBack }: {
  farm: Farm; drill: DrillId; music: boolean; onMusic: () => void; onDone: (next: Farm) => void; onBack: () => void
}) {
  useGameIntroPlaying(true)
  useBgm('ranch', music)
  // とっくんは はじめた ときの ぼくじょうで きまる（とちゅうで かわらない）。
  const [start] = useState(farm)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cheerRef = useRef(0)
  const tapRef = useRef<{ x: number; y: number } | null>(null)
  const viewRef = useRef<View>(viewSize(360, 270, 1))
  const [cheer, setCheer] = useState(0)
  const [outcome, setOutcome] = useState<{ farm: Farm; result: TrainResult } | null>(null)
  const [card, setCard] = useState(false)
  const info = DRILLS.find(d => d.id === drill) ?? DRILLS[0]

  useEffect(() => {
    const fx = createFx()
    let t = 0
    let beat = -1
    let decided: TrainResult | null = null
    return startLoop(canvasRef.current, (dt, g, view) => {
      viewRef.current = view
      t += dt
      const strength = cheerRef.current / CHEER_MAX
      const ground = trainGround(view.h)
      const tap = tapRef.current
      if (tap) {
        tapRef.current = null
        addFx(fx, { kind: 'note', x: tap.x, y: tap.y, vx: (Math.random() - .5) * 20, vy: -30, life: .8, color: ['#ffe060', '#ff8ab0', '#8ad8ff'][cheerRef.current % 3] })
        burst(fx, 'spark', tap.x, tap.y, 4, ['#ffffff', '#ffe060'], 30, .4)
      }
      if (t < TRAIN_DOING) {
        const b = Math.floor(t * (1.6 + strength * 1.4))
        if (b !== beat) {
          beat = b
          playTrainBeat(drill)
          if (drill === 'rock') burst(fx, 'dust', view.w / 2 - 2, ground - 10, 4, ['#c8a070', '#e0bc88'], 25, .4)
          if (drill === 'run') burst(fx, 'dust', view.w / 2 - 10, ground, 3, ['#f0a080', '#ffffff'], 18, .4)
          if (drill === 'study') addFx(fx, { kind: 'q', x: view.w / 2 + 6, y: ground - 34, vx: 4, vy: -12, life: .9, color: '#ffffff' })
          if (drill === 'pull') addFx(fx, { kind: 'sweat', x: view.w / 2 + 18, y: ground - 20, vx: 8, vy: -12, life: .6, color: '#a8e0ff', gravity: 80 })
        }
      } else if (!decided) {
        const done = train(start, drill, cheerRef.current, Math.random())
        decided = done.result
        setOutcome(done)
        if (decided.grade === 'great') {
          playGreat()
          vibrate('success')
          burst(fx, 'star', view.w / 2, ground - 20, 16, ['#fff4b0', '#ffffff', '#ffe060'], 60, 1)
          if (drill === 'study') addFx(fx, { kind: 'bang', x: view.w / 2 + 6, y: ground - 36, vx: 0, vy: -6, life: 1.2, color: '#ffe060' })
        } else if (decided.grade === 'good') {
          playGood()
          burst(fx, 'spark', view.w / 2, ground - 20, 8, ['#ffffff', '#ffe060'], 40, .8)
        } else {
          playFail()
          if (drill === 'study') addFx(fx, { kind: 'zzz', x: view.w / 2 + 8, y: ground - 30, vx: 6, vy: -10, life: 1.4, color: '#ffffff' })
          else burst(fx, 'star', view.w / 2, ground - 26, 5, ['#ffe060'], 20, 1)
        }
      } else if (t >= TRAIN_DOING + TRAIN_RESULT) {
        setCard(true)
      }
      updateFx(fx, dt)
      if (g) drawTraining(g, view.w, view.h, { drill, monster: start.monster, t, grade: decided?.grade ?? null, cheer: strength, fx })
    })
  }, [drill, start])

  function cheerUp(point: { x: number; y: number } | null) {
    if (outcome) return
    primeAudio()
    const next = Math.min(CHEER_MAX, cheerRef.current + 1)
    cheerRef.current = next
    setCheer(next)
    playCheer(next)
    vibrate('tap')
    tapRef.current = point ?? { x: viewRef.current.w / 2, y: viewRef.current.h / 2 }
  }

  const result = outcome?.result
  return <GamePlaySurface><main className={styles.train} data-drill={drill}>
    <h1 className={styles.srOnly}>{info.name}</h1>
    <canvas ref={canvasRef} className={styles.fullCanvas} tabIndex={0}
      aria-label={`${info.name}の とっくん。タップで おうえん！`}
      onPointerDown={e => { if (e.button === 0 || e.pointerType !== 'mouse') cheerUp(toPixel(e, viewRef.current)) }}
      onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); cheerUp(null) } }} />
    <GameBackButton onBack={onBack} />
    <MusicButton music={music} onMusic={onMusic} className={styles.cornerMusic} />
    <div className={`${styles.window} ${styles.trainTitle}`}>
      <strong>{info.name}</strong>
      <small>{STAT_LABEL[info.main]}が のびる</small>
    </div>
    {!outcome && <div className={styles.cheerBox}>
      <p className={styles.cheerText}>タップで おうえん！</p>
      <div className={styles.cheerMeter} role="meter" aria-label="おうえん" aria-valuemin={0} aria-valuemax={CHEER_MAX} aria-valuenow={cheer}>
        <span style={{ width: `${cheer / CHEER_MAX * 100}%` }} />
      </div>
    </div>}
    {result && !card && <p className={`${styles.gradeBanner} ${styles[result.grade]}`} aria-hidden="true">{GRADE_TEXT[result.grade]}</p>}
    {result && outcome && card && <div className={styles.overlay}>
      <div className={`${styles.window} ${styles.card}`} role="dialog" aria-label="とっくんの けっか">
        <h2 className={styles[result.grade]}>{GRADE_TEXT[result.grade]}</h2>
        <ul className={styles.gains}>
          {(Object.entries(result.gains) as [StatKey, number][]).filter(([, v]) => v > 0).map(([key, v]) => <li key={key}>
            {STAT_LABEL[key]} <strong>+{v}</strong>
          </li>)}
        </ul>
        {result.grade === 'fail' && <p className={styles.tip}>つかれて いると しっぱい しやすいよ。やすませて あげよう</p>}
        {result.grade === 'great' && <p className={styles.tip}>おうえんが とどいたね！</p>}
        <div className={styles.cardButtons}>
          <button type="button" className={styles.primary} autoFocus onClick={() => { playWeek(); onDone(outcome.farm) }}>ぼくじょうへ もどる</button>
        </div>
      </div>
    </div>}
  </main></GamePlaySurface>
}

// ---------------- たいかい ----------------

type Hud = { hp: [number, number]; max: [number, number]; guts: [number, number]; left: number; plan: string | null }
type RoundEnd = { won: boolean; timeUp: boolean }

function BattleScreen({ farm, music, onMusic, onDone, onQuit }: {
  farm: Farm; music: boolean; onMusic: () => void; onDone: (next: Farm, rankUp: boolean, champion: boolean) => void; onQuit: () => void
}) {
  useGameIntroPlaying(true)
  const [foes] = useState(() => tournamentFoes(farm, randomSeed()))
  const [round, setRound] = useState(0)
  const [end, setEnd] = useState<RoundEnd | null>(null)
  const [final, setFinal] = useState<{ farm: Farm; rankUp: boolean; champion: boolean; roundsWon: number } | null>(null)
  const [banner, setBanner] = useState<'vs' | 'go' | 'win' | 'lose' | 'timeup' | null>('vs')
  const [message, setMessage] = useState('')
  const [auto, setAutoState] = useState(false)
  const battleRef = useRef<Battle | null>(null)
  const [hud, setHud] = useState<Hud>({ hp: [1, 1], max: [1, 1], guts: [0, 0], left: BATTLE_SECONDS, plan: null })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const me = farm.monster
  const foe = foes[round]
  const mySpecies = speciesOf(me)
  const autoRef = useRef(auto)
  useBgm(final ? null : 'battle', music)
  useEffect(() => { autoRef.current = auto }, [auto])

  useEffect(() => {
    const battle = createBattle(me, foe, randomSeed(), Math.max(.75, 1.4 - farm.rank * .12))
    battle.auto = autoRef.current
    battleRef.current = battle
    if (import.meta.env.DEV) (window as unknown as { __monsterBattle?: Battle }).__monsterBattle = battle
    const fx = createFx()
    const timers: ReturnType<typeof setTimeout>[] = [setTimeout(() => playGo(false), 300)]
    let time = 0, acc = 0, cheer = 0, ended = false
    const name = (side: 0 | 1) => (side === 0 ? me : foe).name
    const stop = startLoop(canvasRef.current, (dt, g, view) => {
      time += dt
      acc += dt
      const left = arenaLeft(view.w), ground = arenaGround(view.h)
      let steps = 0
      while (acc >= 1 / 60 && steps < 6) {
        stepBattle(battle)
        acc -= 1 / 60
        steps++
      }
      if (steps === 6) acc = 0
      cheer = Math.max(0, cheer - dt)
      for (const e of drainBattleEvents(battle)) {
        switch (e.type) {
          case 'go': playGo(true); setBanner('go'); timers.push(setTimeout(() => setBanner(b => (b === 'go' ? null : b)), 800)); break
          case 'windup':
            playWindup(!!e.tech.big)
            setMessage(`${name(e.side)}の ${e.tech.name}！`)
            if (e.tech.big) burst(fx, 'spark', left + battle.f[e.side].x, ground - 12, 10, ['#fff4b0', '#ffffff'], 30, .5)
            break
          case 'shot': playShot(e.tech.fx); break
          case 'hit': {
            playHit(!!e.tech.big, e.crit)
            vibrate(e.side === 1 ? 'impact' : 'tap')
            const x = left + e.x
            burst(fx, 'star', x, ground - 12, e.tech.big ? 12 : 6, ['#ffffff', '#ffe060', '#ff9a60'], e.tech.big ? 60 : 40, .5)
            addFx(fx, { kind: 'num', x, y: ground - 30, vx: 0, vy: -18, life: .9, color: e.crit ? '#ffe060' : '#ffffff', text: `${e.damage}${e.crit ? '!' : ''}`, size: e.crit || e.tech.big ? 2 : 1 })
            if (e.crit) setMessage('かいしんの いちげき！')
            cheer = 1
            break
          }
          case 'miss':
            playMiss()
            setMessage(e.side === 0 ? `${name(1)}に よけられた！` : `${name(0)}は ひらりと よけた！`)
            break
          case 'auto': setMessage(`${name(0)}は じぶんで かんがえて うごいた！`); break
          case 'ko': playKo(); vibrate('impact'); setMessage(`${name(e.side)}は たおれた！`); break
          case 'timeup': playGo(true); setMessage('じかんぎれ！ のこりの たいりょくで しょうぶ'); break
        }
      }
      if (battle.state === 'over' && !ended) {
        ended = true
        const won = battle.winner === 0
        const timeUp = battle.f[0].hp > 0 && battle.f[1].hp > 0
        timers.push(setTimeout(() => {
          setBanner(timeUp ? 'timeup' : won ? 'win' : 'lose')
          if (won) { playWin(); playCry(mySpecies.voice) } else playLose()
          if (won) burst(fx, 'confetti', view.w / 2, 10, 40, ['#ff6a6a', '#ffe060', '#6ad070', '#5aa8f0', '#e080ff'], 90, 2)
        }, 700))
        timers.push(setTimeout(() => setEnd({ won, timeUp }), 2200))
      }
      setHud(prev => {
        const [a, b] = battle.f
        const next: Hud = {
          hp: [Math.ceil(a.hp), Math.ceil(b.hp)], max: [a.maxHp, b.maxHp], guts: [Math.floor(a.guts), Math.floor(b.guts)],
          left: Math.max(0, Math.ceil(BATTLE_SECONDS - battle.time)), plan: a.plan?.name ?? null,
        }
        return prev.hp[0] === next.hp[0] && prev.hp[1] === next.hp[1] && prev.guts[0] === next.guts[0] && prev.guts[1] === next.guts[1]
          && prev.left === next.left && prev.plan === next.plan && prev.max[0] === next.max[0] && prev.max[1] === next.max[1] ? prev : next
      })
      updateFx(fx, dt)
      if (g) drawBattle(g, view.w, view.h, battle, time, fx, cheer)
    }, ARENA_W + 16, 80)
    return () => { stop(); timers.forEach(clearTimeout); battleRef.current = null }
  }, [me, foe, farm.rank, mySpecies])

  function use(index: number) {
    const battle = battleRef.current
    if (!battle || battle.state === 'over') return
    primeAudio()
    command(battle, index)
    playSelect()
  }

  function toggleAuto() {
    const next = !auto
    setAutoState(next)
    if (battleRef.current) setAuto(battleRef.current, next)
    playSelect()
  }

  function nextRound() {
    playSelect()
    setEnd(null)
    setBanner('vs')
    setMessage('')
    setRound(r => r + 1)
  }

  function finish(roundsWon: number) {
    const result = finishTournament(farm, roundsWon)
    if (result.rankUp || result.champion) { playRankUp(); vibrate('celebrate') }
    setEnd(null)
    setFinal({ ...result, roundsWon })
  }

  const rankUpTo = final?.rankUp ? rankName(final.farm.rank) : null
  return <GamePlaySurface><main className={styles.battle}>
    <h1 className={styles.srOnly}>{rankName(farm.rank)} たいかい</h1>
    <GameBackButton onBack={onQuit} />
    <MusicButton music={music} onMusic={onMusic} className={styles.cornerMusic} />
    <div className={styles.battleHud}>
      <p className={styles.roundName}><span>{rankName(farm.rank)} たいかい</span><strong>{ROUND_NAMES[round]}</strong></p>
      <div className={styles.plates}>
        <FighterPlate monster={me} hp={hud.hp[0]} max={hud.max[0]} guts={hud.guts[0]} side="me" />
        <div className={styles.center}>
          <p className={styles.timer} aria-label={`のこり ${hud.left}びょう`}>{hud.left}</p>
          <p className={styles.roundMini} aria-hidden="true">{ROUND_NAMES[round]}</p>
        </div>
        <FighterPlate monster={foe} hp={hud.hp[1]} max={hud.max[1]} guts={hud.guts[1]} side="foe" />
      </div>
    </div>
    <div className={styles.arena}>
      <canvas ref={canvasRef} className={styles.arenaCanvas} aria-label={`${me.name} たい ${foe.name}`} />
      {banner === 'vs' && <div className={`${styles.window} ${styles.vs}`} aria-hidden="true">
        <span>{me.name}</span><strong>VS</strong><span>{foe.name}</span>
      </div>}
      {banner && banner !== 'vs' && <p className={`${styles.battleBanner} ${styles[banner]}`} aria-hidden="true">
        {banner === 'go' ? 'ファイト！' : banner === 'win' ? 'かち！' : banner === 'lose' ? 'まけ…' : end?.won ? 'はんていで かち！' : 'じかんぎれ'}
      </p>}
    </div>
    <p className={styles.message} role="status" aria-live="polite">{message || 'わざを えらんでね（えらばないと じぶんで うごくよ）'}</p>
    <div className={styles.techs}>
      {mySpecies.techs.map((tech, i) => {
        const ready = hud.guts[0] >= tech.guts
        const planned = hud.plan === tech.name
        return <button key={tech.name} type="button" className={`${styles.window} ${styles.tech}`} data-ready={ready} data-big={!!tech.big}
          aria-pressed={planned} onClick={() => use(i)}
          aria-label={`${tech.name}。${tech.range === 'near' ? 'ちかい' : 'とおい'} わざ。やるき ${tech.guts}`}>
          <span className={styles.techName}>{tech.name}</span>
          <small>{tech.range === 'near' ? 'ちかい' : 'とおい'}・やるき {tech.guts}{planned ? '・じゅんび' : ''}</small>
        </button>
      })}
      <button type="button" className={`${styles.window} ${styles.autoButton}`} aria-pressed={auto} onClick={toggleAuto}>
        おまかせ<small>{auto ? 'オン' : 'オフ'}</small>
      </button>
    </div>
    {end && !final && <div className={styles.overlay}>
      <div className={`${styles.window} ${styles.card}`} role="dialog" aria-label={end.won ? 'かち' : 'まけ'}>
        <h2>{ROUND_NAMES[round]} {end.won ? 'かち！' : 'まけ…'}</h2>
        <p className={styles.bornHero}><PixelIcon kind="monster" id={(end.won ? me : foe).species} variant={(end.won ? me : foe).variant} className={styles.bigMonster} /></p>
        {end.won && round < ROUND_NAMES.length - 1 && <p className={styles.tip}>つぎは {ROUND_NAMES[round + 1]}！</p>}
        {!end.won && <p className={styles.tip}>とっくんして また ちょうせん しよう</p>}
        <div className={styles.cardButtons}>
          {end.won && round < ROUND_NAMES.length - 1
            ? <button type="button" className={styles.primary} autoFocus onClick={nextRound}>つぎの しあいへ</button>
            : <button type="button" className={styles.primary} autoFocus onClick={() => finish(end.won ? round + 1 : round)}>けっかを みる</button>}
        </div>
      </div>
    </div>}
    {final && <div className={styles.overlay}>
      <div className={`${styles.window} ${styles.card} ${styles.finalCard}`} role="dialog" aria-label="たいかいの けっか">
        <h2>{final.roundsWon >= ROUND_NAMES.length ? 'ゆうしょう！' : 'たいかい おしまい'}</h2>
        <p className={styles.bornHero}>
          {final.roundsWon >= ROUND_NAMES.length && <PixelIcon kind="icon" id="trophy" className={styles.trophy} />}
          <PixelIcon kind="monster" id={me.species} variant={me.variant} className={styles.bigMonster} />
        </p>
        <p className={styles.kind}>{final.roundsWon}しょう</p>
        {rankUpTo && <p className={styles.rankUp}>{rankUpTo}に あがった！</p>}
        {final.champion && <p className={styles.rankUp}>でんせつの チャンピオン！</p>}
        {final.rankUp && final.farm.rank === TOP_RANK && <p className={styles.tip}>つぎは さいごの Sランク たいかいだよ</p>}
        {!final.rankUp && !final.champion && <p className={styles.tip}>ぜんぶ かつと ランクが あがるよ</p>}
        <div className={styles.cardButtons}>
          <button type="button" className={styles.primary} autoFocus onClick={() => { playSelect(); onDone(final.farm, final.rankUp, final.champion) }}>ぼくじょうへ もどる</button>
        </div>
      </div>
    </div>}
  </main></GamePlaySurface>
}

function FighterPlate({ monster, hp, max, guts, side }: { monster: Monster; hp: number; max: number; guts: number; side: 'me' | 'foe' }) {
  const ratio = Math.max(0, hp / Math.max(1, max))
  return <div className={`${styles.window} ${styles.plate}`} data-side={side}>
    <p className={styles.plateName}><PixelIcon kind="monster" id={monster.species} variant={monster.variant} className={styles.plateIcon} />{monster.name}</p>
    <div className={styles.hpBar} role="meter" aria-label={`${monster.name}の たいりょく`} aria-valuemin={0} aria-valuemax={max} aria-valuenow={hp}
      data-level={ratio > .5 ? 'high' : ratio > .25 ? 'mid' : 'low'}>
      <span style={{ width: `${ratio * 100}%` }} />
    </div>
    <div className={styles.gutsBar} role="meter" aria-label={`${monster.name}の やるき`} aria-valuemin={0} aria-valuemax={99} aria-valuenow={guts}>
      <span style={{ width: `${guts / 99 * 100}%` }} />
    </div>
  </div>
}

// ---------------- ぜんたい ----------------

type Screen = 'title' | 'summon' | 'ranch' | 'battle' | { train: DrillId }

export default function DotMonsterFarmPlay() {
  const [farm, setFarm] = useState<Farm | null>(() => loadFarm())
  const [dex, setDex] = useState(() => readDex())
  const [screen, setScreen] = useState<Screen>('title')
  const [music, setMusic] = useState(() => readMusic())
  const toggleMusic = useCallback(() => setMusic(m => { writeMusic(!m); if (!m) primeAudio(); return !m }), [])
  const update = useCallback((next: Farm) => { setFarm(next); saveFarm(next) }, [])

  if (screen === 'summon') {
    return <SummonScreen music={music} onMusic={toggleMusic} onBack={() => setScreen('title')}
      onBorn={monster => { update(newFarm(monster)); setDex(addDex(monster)); setScreen('ranch') }} />
  }
  if (farm && screen === 'ranch') {
    return <RanchScreen farm={farm} music={music} onMusic={toggleMusic} onFarm={update}
      onTrain={drill => setScreen({ train: drill })} onTournament={() => setScreen('battle')} onExit={() => setScreen('title')} />
  }
  if (farm && typeof screen === 'object') {
    return <TrainScreen key={`${farm.week}-${screen.train}`} farm={farm} drill={screen.train} music={music} onMusic={toggleMusic}
      onDone={next => { update(next); setScreen('ranch') }} onBack={() => setScreen('ranch')} />
  }
  if (farm && screen === 'battle') {
    return <BattleScreen key={farm.week} farm={farm} music={music} onMusic={toggleMusic}
      onDone={next => { update(next); setScreen('ranch') }} onQuit={() => setScreen('ranch')} />
  }
  return <TitleScreen farm={farm} dex={dex} music={music} onMusic={toggleMusic}
    onContinue={() => setScreen('ranch')} onNew={() => setScreen('summon')} />
}

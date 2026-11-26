import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import GameBackButton from '../../components/GameBackButton'
import GamePlaySurface from '../../components/GamePlaySurface'
import { primeAudio } from '../../audio/sound'
import { useSoundToggle } from '../../audio/useSoundToggle'
import { vibrate } from '../../utils/haptics'
import type { Activity } from './behavior'
import { playZooSound } from './sounds'
import { SPECIES, type Species, type SpeciesId } from './species'
import { useZooEngine, type ViewMode, type ZooHint, type ZooStatus } from './useZooEngine'
import { MiniMap, WalkPad, type MiniMapHandle } from './WalkControls'
import { AreaMapDialog, CelebrationDialog, MissionDialog, ZukanDialog, type Celebration } from './ZooDialogs'
import { allDone, applyObservation, createMissions, isWanted, missionText, type MissionSet } from './missions'
import { addStamp, countStamps, hasStamp, loadSave, stampInfo, writeSave, type StampKind, type Zukan } from './zukan'
import { areaById, speciesOfArea, type AreaId } from './zooMap'
import styles from './Zoo3dPlay.module.css'

type Member = { id: string; label: string; species: Species }

function membersOf(species: SpeciesId): Member[] {
  return SPECIES[species].members.map(m => ({ id: m.id, label: m.label, species: SPECIES[species] }))
}
const MEMBER_BY_ID = new Map(Object.keys(SPECIES).flatMap(id => membersOf(id as SpeciesId)).map(m => [m.id, m]))

const ACTIVITY: Record<Activity, { emoji: string; label: string }> = {
  walk: { emoji: '🐾', label: 'おさんぽ ちゅう' },
  run: { emoji: '💨', label: 'はしってる！' },
  eat: { emoji: '😋', label: 'もぐもぐ' },
  sleep: { emoji: '💤', label: 'ねてるよ' },
  special: { emoji: '✨', label: 'とくいわざ！' },
  happy: { emoji: '💕', label: 'うれしそう' },
  rest: { emoji: '☁️', label: 'のんびり' },
}

type Toast = { key: number; species: SpeciesId; kind: StampKind }

export default function Zoo3dPlay() {
  const navigate = useNavigate()
  const [sound, toggleSound] = useSoundToggle()
  const [initial] = useState(loadSave)
  const [zukan, setZukan] = useState<Zukan>(initial.zukan)
  const zukanRef = useRef(zukan)
  const [area, setAreaState] = useState<AreaId>(initial.area)
  const [status, setStatus] = useState<ZooStatus>('loading')
  const [progress, setProgress] = useState(0)
  const [mode, setModeState] = useState<ViewMode>('overview')
  const [selected, setSelected] = useState<string | null>(null)
  const [following, setFollowing] = useState(false)
  const [nearby, setNearby] = useState<string | null>(null)
  const [activity, setActivity] = useState<Activity | null>(null)
  const [hint, setHint] = useState<ZooHint | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  const [dialog, setDialog] = useState<'map' | 'zukan' | 'missions' | null>(null)
  const [zukanFocus, setZukanFocus] = useState<SpeciesId | null>(null)
  const [reducedMotion] = useState(() => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const miniMap = useRef<MiniMapHandle | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const areaRef = useRef(area)

  const [medals, setMedals] = useState(initial.medals)
  const medalsRef = useRef(medals)
  // おねがいは エリアごとに覚えておき、行ったり来たりしても続きから できる（保存はメダルの数だけ）
  const [missions] = useState(() => new Map<AreaId, MissionSet>([[initial.area, createMissions(initial.area, speciesOfArea(areaById(initial.area)), initial.zukan)]]))
  const missionsOf = useCallback((id: AreaId): MissionSet => {
    let set = missions.get(id)
    if (!set) {
      set = createMissions(id, speciesOfArea(areaById(id)), zukanRef.current)
      missions.set(id, set)
    }
    return set
  }, [missions])
  const [missionSet, setMissionSet] = useState<MissionSet>(() => missions.get(initial.area)!)
  const [missionToast, setMissionToast] = useState<{ key: number; index: number } | null>(null)
  const [celebration, setCelebration] = useState<Celebration | null>(null)
  const missionTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => { clearTimeout(toastTimer.current); clearTimeout(missionTimer.current) }, [])

  const persist = useCallback(() => {
    writeSave({ zukan: zukanRef.current, area: areaRef.current, medals: medalsRef.current })
  }, [])

  const progressMission = useCallback((species: SpeciesId, kind: StampKind) => {
    const id = areaRef.current
    const { set, completed } = applyObservation(missionsOf(id), species, kind)
    if (!completed.length) return
    missions.set(id, set)
    setMissionSet(set)
    playZooSound('medal')
    clearTimeout(missionTimer.current)
    if (allDone(set)) {
      medalsRef.current += 1
      setMedals(medalsRef.current)
      persist()
      vibrate('celebrate')
      setMissionToast(null)
      setCelebration({ kind: 'medal', medals: medalsRef.current })
      return
    }
    vibrate('success')
    setMissionToast(t => ({ key: (t?.key ?? 0) + 1, index: completed[0] }))
    missionTimer.current = setTimeout(() => setMissionToast(null), 2800)
  }, [missions, missionsOf, persist])

  const onObserve = useCallback((species: SpeciesId, kind: StampKind) => {
    const next = addStamp(zukanRef.current, species, kind)
    if (next) {
      const here = speciesOfArea(areaById(areaRef.current))
      const before = countStamps(zukanRef.current, here)
      zukanRef.current = next
      setZukan(next)
      persist()
      playZooSound('stamp')
      vibrate('success')
      clearTimeout(toastTimer.current)
      setToast(t => ({ key: (t?.key ?? 0) + 1, species, kind }))
      toastTimer.current = setTimeout(() => setToast(null), 2600)
      // このエリアの動物のスタンプが ぜんぶ そろったら、お祝い
      const after = countStamps(next, here)
      if (before.got < before.total && after.got === after.total) setCelebration({ kind: 'area', area: areaRef.current })
    }
    // おねがいは、スタンプを持っていても もう一度 できる
    progressMission(species, kind)
  }, [persist, progressMission])
  const onArea = useCallback((id: AreaId) => {
    if (areaRef.current !== id) playZooSound('gate')
    areaRef.current = id
    setAreaState(id)
    setMissionSet(missionsOf(id))
    setMissionToast(null)
    persist()
  }, [missionsOf, persist])
  const onSelect = useCallback((id: string | null) => setSelected(id), [])
  const hasStampCb = useCallback((species: SpeciesId, kind: StampKind) => hasStamp(zukanRef.current, species, kind), [])
  const wantedCb = useCallback((species: SpeciesId, kind: StampKind) => isWanted(missions.get(areaRef.current), species, kind), [missions])
  const closeCelebration = () => {
    // メダルのあとは、つぎの おねがいを出す
    if (celebration?.kind === 'medal') {
      const id = areaRef.current
      const set = createMissions(id, speciesOfArea(areaById(id)), zukanRef.current)
      missions.set(id, set)
      setMissionSet(set)
    }
    setCelebration(null)
  }
  const onVisitor = useCallback((x: number, z: number, yaw: number) => miniMap.current?.update(x, z, yaw), [])

  const { registerContainer, retry, select, feed: feedFood, setFollow, overview, setMode, setArea, walkInput, goTo, walkToEnclosure } = useZooEngine({
    reducedMotion,
    initialArea: initial.area,
    onStatus: setStatus,
    onProgress: setProgress,
    onArea,
    onSelect,
    onFollow: setFollowing,
    onMode: setModeState,
    onNearby: setNearby,
    onVisitor,
    onActivity: setActivity,
    onObserve,
    onHint: setHint,
    hasStamp: hasStampCb,
    wanted: wantedCb,
  })
  const ready = status === 'ready'
  const member = selected ? MEMBER_BY_ID.get(selected) : undefined
  const areaInfo = areaById(area)
  const areaSpecies = useMemo(() => speciesOfArea(areaInfo), [areaInfo])
  const nearbyEnclosure = nearby ? areaInfo.enclosures.find(e => e.id === nearby) : undefined
  const total = useMemo(() => countStamps(zukan, Object.keys(SPECIES) as SpeciesId[]), [zukan])
  const missionDone = missionSet.done.filter(Boolean).length

  const choose = (id: SpeciesId) => {
    primeAudio()
    goTo(membersOf(id)[0].id)
  }
  const feed = (species?: SpeciesId) => {
    primeAudio()
    if (!feedFood(species)) playZooSound('select')
  }
  const toggleMode = () => {
    primeAudio()
    setMode(mode === 'walk' ? 'overview' : 'walk')
  }
  const openZukan = (species: SpeciesId | null) => {
    primeAudio()
    playZooSound('info')
    setZukanFocus(species)
    setDialog('zukan')
  }
  const goArea = (id: AreaId) => {
    primeAudio()
    setDialog(null)
    if (id !== area) setArea(id)
  }

  const hintText = hint ? (() => {
    const s = SPECIES[hint.species]
    if (hint.kind === 'sleep') return `${s.name}が ねているよ`
    return `${s.name}が「${stampInfo(hint.species, hint.kind).label}」してるよ！`
  })() : ''

  const selectedCard = member && (
    <div className={styles.selectedCard}>
      <div className={styles.who} style={{ '--accent': member.species.color } as CSSProperties}>
        <span className={styles.whoEmoji} aria-hidden="true">{member.species.emoji}</span>
        <strong>{member.species.name}</strong>
        <small>{member.label}</small>
        {activity && <span className={styles.activity} aria-live="polite">
          <span aria-hidden="true">{ACTIVITY[activity].emoji}</span>{ACTIVITY[activity].label}
        </span>}
        <button type="button" className={styles.close} aria-label="えらぶのを やめる" onClick={() => select(null)}>✕</button>
      </div>
      {member.species.members.length > 1 && <div className={styles.members} role="group" aria-label="どの こと あそぶ？">
        {/* 親子を切り替える。画面をタップしなくても（キーボードでも）子どもを選べる */}
        {member.species.members.map(m => (
          <button type="button" key={m.id} aria-pressed={m.id === member.id} onClick={() => { primeAudio(); select(m.id) }}
            aria-label={`${member.species.name}の ${m.label}`}>
            <span aria-hidden="true" style={{ fontSize: `${0.9 + 0.5 * m.scale}rem` }}>{member.species.emoji}</span>{m.label}
          </button>
        ))}
      </div>}
      <div className={styles.actions}>
        <button type="button" className={styles.action} disabled={!ready} onClick={() => feed(mode === 'walk' ? member.species.id : undefined)}
          aria-label={`${member.species.food.label}を あげる`}>
          <span aria-hidden="true">{member.species.food.emoji}</span><b>えさ</b>
        </button>
        {mode === 'overview'
          ? <button type="button" className={styles.action} disabled={!ready} aria-pressed={following} onClick={() => { primeAudio(); setFollow(!following) }} aria-label="おいかける">
            <span aria-hidden="true">🎥</span><b>おいかける</b>
          </button>
          : <button type="button" className={styles.action} disabled={!ready} onClick={() => { primeAudio(); goTo(member.id) }} aria-label="ちかくへ いく">
            <span aria-hidden="true">🚶</span><b>ちかくへ</b>
          </button>}
        <button type="button" className={styles.action} disabled={!ready} onClick={() => openZukan(member.species.id)} aria-label="ずかんを みる">
          <span aria-hidden="true">📖</span><b>ずかん</b>
        </button>
      </div>
    </div>
  )

  return (
    <GamePlaySurface>
      <main className={styles.page} data-mode={mode}>
        <header className={styles.header}>
          <GameBackButton to="/" />
          <h1>3Dどうぶつえん</h1>
          <button type="button" className={styles.soundButton} aria-label="おと" aria-pressed={sound} onClick={toggleSound}>
            <span aria-hidden="true">{sound ? '🔊' : '🔇'}</span>
          </button>
        </header>
        <div className={styles.scene} ref={registerContainer} role="application"
          aria-label={mode === 'walk'
            ? `${areaInfo.name}を あるいて いるよ。じめんを タップすると そこへ いくよ`
            : `${areaInfo.name}を うえから みているよ。どうぶつを タップすると えらべるよ`}
          data-testid="zoo-scene">
          {status !== 'ready' && <div className={styles.status} role={status === 'error' ? 'alert' : 'status'}>
            <span className={styles.statusIcon} aria-hidden="true">{status === 'error' ? '🚧' : areaInfo.emoji}</span>
            <strong>{status === 'error' ? 'どうぶつえんを ひらけなかったよ' : `${areaInfo.name}へ いくよ…`}</strong>
            {status === 'error'
              ? <button type="button" onClick={retry}>もういちど</button>
              : <progress className={styles.progress} aria-label="よみこみ" value={Math.round(progress * 100)} max={100} />}
          </div>}
          <div className={styles.topBar}>
            <button type="button" className={styles.chip} disabled={!ready} onClick={() => { primeAudio(); setDialog('map') }} aria-label={`いまは ${areaInfo.name}。ちずを ひらく`}>
              <span aria-hidden="true">{areaInfo.emoji}</span><b>{areaInfo.name}</b><span aria-hidden="true" className={styles.caret}>▾</span>
            </button>
            <button type="button" className={`${styles.chip} ${styles.modeChip}`} disabled={!ready} onClick={toggleMode}
              aria-label={mode === 'walk' ? 'うえから みる' : 'あるいて みる'}>
              <span aria-hidden="true">{mode === 'walk' ? '🦅' : '🚶'}</span><b>{mode === 'walk' ? 'うえから' : 'あるく'}</b>
            </button>
            <button type="button" className={styles.chip} onClick={() => openZukan(null)} aria-label={`ずかん（スタンプ ${total.got}こ）`}>
              <span aria-hidden="true">📖</span><b>{total.got}</b>
            </button>
          </div>
          <button type="button" className={`${styles.chip} ${styles.missionChip}`} disabled={!ready} onClick={() => { primeAudio(); playZooSound('info'); setDialog('missions') }}
            aria-label={`おねがい（${missionDone}こ できた / ${missionSet.missions.length}こ）`} data-done={missionDone === missionSet.missions.length || undefined}>
            <span aria-hidden="true">📋</span><b>おねがい {missionDone}/{missionSet.missions.length}</b>
          </button>
          {toast && <div key={toast.key} className={styles.toast} role="status">
            <span aria-hidden="true">{SPECIES[toast.species].emoji}</span>
            <span>{SPECIES[toast.species].name}の「{stampInfo(toast.species, toast.kind).label}」</span>
            <b><span aria-hidden="true">{stampInfo(toast.species, toast.kind).emoji}</span> スタンプ！</b>
          </div>}
          {missionToast && <div key={`m${missionToast.key}`} className={`${styles.toast} ${styles.missionToast}`} role="status">
            <span aria-hidden="true">✅</span>
            <span>{missionText(missionSet.missions[missionToast.index]).text}</span>
            <b>おねがい できた！</b>
          </div>}
          {ready && hint && <div className={styles.hint} role="status">
            <span aria-hidden="true">{SPECIES[hint.species].emoji}</span>
            <span>{hintText}</span>
            <button type="button" onClick={() => { primeAudio(); goTo(hint.id) }}>
              <span aria-hidden="true">👀</span> みにいく
            </button>
          </div>}
          {ready && !hint && mode === 'overview' && !member && <p className={styles.tip}><span aria-hidden="true">👆</span> どうぶつを タップしてね</p>}
          {ready && !hint && mode === 'walk' && !member && !nearbyEnclosure && <p className={styles.tip}><span aria-hidden="true">👆</span> いきたい ところを タップしてね</p>}
          {ready && mode === 'overview' && member && following && <button type="button" className={styles.overview} onClick={overview}>
            <span aria-hidden="true">🗺️</span> ぜんたい
          </button>}
          {ready && mode === 'walk' && <MiniMap ref={miniMap} area={areaInfo} onPick={id => { primeAudio(); walkToEnclosure(id) }} />}
        </div>
        <section className={styles.panel} aria-label={member ? `${member.species.name}と あそぶ` : mode === 'walk' ? 'あるく' : 'どうぶつを えらぶ'}>
          {mode === 'walk'
            ? <div className={styles.walkPanel}>
              <WalkPad disabled={!ready} onInput={walkInput} />
              <div className={styles.walkSide}>
                {member ? selectedCard : nearbyEnclosure
                  ? <div className={styles.feedBox} role="group" aria-label="えさを なげいれる">
                    <p className={styles.feedTitle}>えさを あげよう</p>
                    <div className={styles.feedButtons}>
                      {nearbyEnclosure.species.map(id => (
                        <button type="button" key={id} className={styles.action} disabled={!ready} onClick={() => feed(id)}
                          aria-label={`${SPECIES[id].name}に ${SPECIES[id].food.label}を あげる`}>
                          <span aria-hidden="true">{SPECIES[id].food.emoji}</span><b data-long={SPECIES[id].name.length > 5 || undefined}>{SPECIES[id].name}</b>
                        </button>
                      ))}
                    </div>
                  </div>
                  : <div className={styles.walkHelp}>
                    <span aria-hidden="true">🗺️</span>
                    <p>ちずの どうぶつを タップすると、そこまで あるくよ</p>
                  </div>}
              </div>
            </div>
            : member ? selectedCard
              : <div className={styles.picker} role="group" aria-label="どうぶつを えらぶ">
                {/* このエリアの動物の種類ごとに1つ（親を選ぶ）。子どもは画面の中でタップして選べる */}
                {areaSpecies.map(id => {
                  const s = SPECIES[id]
                  return (
                    <button type="button" key={id} disabled={!ready} onClick={() => choose(id)} aria-label={`${s.name}を みる`}>
                      <span aria-hidden="true">{s.emoji}</span>
                      <b data-long={s.name.length > 5 || undefined}>{s.name}</b>
                    </button>
                  )
                })}
              </div>}
        </section>
        {dialog === 'map' && <AreaMapDialog current={area} zukan={zukan} onGo={goArea}
          onRace={() => { primeAudio(); playZooSound('gate'); navigate('/games/zoo-3d/race') }} onClose={() => setDialog(null)} />}
        {dialog === 'missions' && <MissionDialog set={missionSet} medals={medals} onClose={() => setDialog(null)} />}
        {celebration && <CelebrationDialog celebration={celebration} onClose={closeCelebration} />}
        {dialog === 'zukan' && <ZukanDialog zukan={zukan} focus={zukanFocus} area={area} onFocus={setZukanFocus} onClose={() => setDialog(null)} />}
      </main>
    </GamePlaySurface>
  )
}

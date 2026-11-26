// 3Dどうぶつえんの「どうぶつレースじょう」。
// うけつけ → レースを えらぶ（生き物の なかまごと）→ 出走表（きょうの ちょうし・おうえん）→ よーい どん → 観戦 → 表彰式。
// レースは操作せずに見るだけ。勝ち負けは乱数で決まるが、動物の運動の力とコースの地面で勝ちやすさが変わる（raceSim.ts）。

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import GameBackButton from '../../../components/GameBackButton'
import GamePlaySurface from '../../../components/GamePlaySurface'
import { primeAudio } from '../../../audio/sound'
import { useSoundToggle } from '../../../audio/useSoundToggle'
import { vibrate } from '../../../utils/haptics'
import { playZooSound } from '../sounds'
import { SPECIES } from '../species'
import { ATHLETES } from './athletes'
import { commentary, MOOD, PLACE_MEDAL } from './commentary'
import { addWin, loadRecord, saveRecord } from './raceRecord'
import { LANE_COLORS, RACES, raceById, type RaceId } from './races'
import { narrate, planRace, type RaceEvent, type RacePlan } from './raceSim'
import { useRaceEngine, type RaceStatus } from './useRaceEngine'
import styles from './ZooRacePlay.module.css'

type Phase = 'reception' | 'select' | 'paddock' | 'countdown' | 'race' | 'result'
type Toast = { key: number; emoji: string; text: string }

const COUNT_STEP = 800

export default function ZooRacePlay() {
  const [sound, toggleSound] = useSoundToggle()
  const [reducedMotion] = useState(() => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [phase, setPhaseState] = useState<Phase>('reception')
  const phaseRef = useRef<Phase>('reception')
  const setPhase = useCallback((next: Phase) => {
    phaseRef.current = next
    setPhaseState(next)
  }, [])
  const [status, setStatus] = useState<RaceStatus>('loading')
  const [progress, setProgress] = useState(0)
  const [plan, setPlan] = useState<RacePlan | null>(null)
  const planRef = useRef<RacePlan | null>(null)
  const [cheer, setCheerState] = useState<number | null>(null)
  const cheerRef = useRef<number | null>(null)
  const [count, setCount] = useState(3)
  const [ranking, setRanking] = useState<number[]>([])
  const [lead, setLead] = useState(0)
  const [toast, setToast] = useState<Toast | null>(null)
  const [winnerIn, setWinnerIn] = useState(false)
  /** おうえんしている動物が ゴールした着順（まだなら 0）。 */
  const [cheerGoal, setCheerGoal] = useState(0)
  const [record, setRecord] = useState(loadRecord)
  const recordRef = useRef(record)
  const [firstWin, setFirstWin] = useState(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(toastTimer.current), [])

  /** けっかを出す（エンジンの「みんな ゴール」からも呼ぶので、いちばん新しい関数を覚えておく）。 */
  const resultRef = useRef<() => void>(() => {})

  const onEvent = useCallback((e: RaceEvent) => {
    const p = planRef.current
    if (!p) return
    const line = commentary(p, e, cheerRef.current)
    clearTimeout(toastTimer.current)
    setToast(t => ({ key: (t?.key ?? 0) + 1, ...line }))
    toastTimer.current = setTimeout(() => setToast(null), 2600)
    if (e.type === 'finish') {
      if (e.runner === cheerRef.current) setCheerGoal(e.place)
      if (e.place === 1) {
        setWinnerIn(true)
        playZooSound('goal')
        playZooSound('cheer')
        vibrate(cheerRef.current === e.runner ? 'celebrate' : 'success')
      } else if (e.runner === cheerRef.current) {
        vibrate('success')
      }
    }
  }, [])
  const onRanking = useCallback((order: number[], ratio: number) => {
    setRanking(order)
    setLead(ratio)
  }, [])
  const onFinish = useCallback(() => resultRef.current(), [])

  const engine = useRaceEngine({ reducedMotion, onStatus: setStatus, onProgress: setProgress, onEvent, onRanking, onFinish })
  const { registerContainer, retry, showReception, prepare, start, showPodium, setCheer } = engine
  const ready = status === 'ready'
  const race = plan ? raceById(plan.race) : null

  const showResult = useCallback(() => {
    const p = planRef.current
    if (!p || phaseRef.current === 'result') return
    showPodium()
    setPhase('result')
    setToast(null)
    const winner = p.runners[p.order[0]].species
    const { record: next, first } = addWin(recordRef.current, p.race, winner)
    setFirstWin(first)
    if (first) {
      recordRef.current = next
      setRecord(next)
      saveRecord(next)
    }
    playZooSound('medal')
  }, [showPodium, setPhase])
  useEffect(() => { resultRef.current = showResult }, [showResult])

  // よーい どん
  useEffect(() => {
    if (phase !== 'countdown') return
    const p = planRef.current
    if (!p) return
    const timers: ReturnType<typeof setTimeout>[] = []
    setCount(3)
    playZooSound('countdown')
    timers.push(setTimeout(() => { setCount(2); playZooSound('countdown') }, COUNT_STEP))
    timers.push(setTimeout(() => { setCount(1); playZooSound('countdown') }, COUNT_STEP * 2))
    timers.push(setTimeout(() => {
      setCount(0)
      playZooSound('go')
      playZooSound('cheer')
      vibrate('impact')
      start(narrate(p, cheerRef.current ?? undefined))
      setPhase('race')
    }, COUNT_STEP * 3))
    return () => timers.forEach(clearTimeout)
  }, [phase, start, setPhase])

  const chooseCheer = (index: number | null) => {
    cheerRef.current = index
    setCheerState(index)
    setCheer(index)
  }

  const enterRace = (id: RaceId) => {
    primeAudio()
    playZooSound('select')
    const next = planRace(raceById(id), Math.random)
    planRef.current = next
    setPlan(next)
    chooseCheer(null)
    setRanking([])
    setLead(0)
    setWinnerIn(false)
    setCheerGoal(0)
    setToast(null)
    prepare(next)
    setPhase('paddock')
  }
  const toSelect = () => {
    primeAudio()
    playZooSound('info')
    setToast(null)
    if (phase === 'reception') {
      setPhase('select')
      return
    }
    // レース場から戻るときは、受付の景色で えらぶ
    planRef.current = null
    setPlan(null)
    chooseCheer(null)
    showReception()
    setPhase('select')
  }
  const toReception = () => {
    primeAudio()
    planRef.current = null
    setPlan(null)
    chooseCheer(null)
    setToast(null)
    if (phase !== 'reception' && phase !== 'select') showReception()
    setPhase('reception')
  }
  const startCountdown = () => {
    primeAudio()
    setPhase('countdown')
  }
  const onRetry = () => {
    // 読み直したら、レースは出走表から やりなおす
    if (phase === 'countdown' || phase === 'race' || phase === 'result') setPhase('paddock')
    retry()
  }

  const ordered = useMemo(() => {
    if (!plan) return []
    return plan.runners.map((r, i) => ({ ...r, index: i })).sort((a, b) => a.lane - b.lane)
  }, [plan])
  const cheerPlace = plan && cheer !== null ? plan.order.indexOf(cheer) + 1 : 0

  const runnerLabel = (index: number) => {
    if (!plan) return ''
    const r = plan.runners[index]
    return `${r.lane + 1}ばん ${SPECIES[r.species].name}`
  }

  return (
    <GamePlaySurface>
      <main className={styles.page} data-phase={phase}>
        <header className={styles.header}>
          {phase === 'reception'
            ? <GameBackButton to="/games/zoo-3d" ariaLabel="どうぶつえんへ もどる" />
            : <GameBackButton onBack={phase === 'select' ? toReception : toSelect} />}
          <h1>どうぶつレースじょう</h1>
          <button type="button" className={styles.soundButton} aria-label="おと" aria-pressed={sound} onClick={toggleSound}>
            <span aria-hidden="true">{sound ? '🔊' : '🔇'}</span>
          </button>
        </header>
        <div className={styles.scene} ref={registerContainer} role="region" data-testid="race-scene"
          aria-label={race ? `${race.course.name}` : 'どうぶつレースじょうの うけつけ'}>
          {status !== 'ready' && <div className={styles.status} role={status === 'error' ? 'alert' : 'status'}>
            <span className={styles.statusIcon} aria-hidden="true">{status === 'error' ? '🚧' : race?.emoji ?? '🏁'}</span>
            <strong>{status === 'error' ? 'レースじょうを ひらけなかったよ' : race ? `${race.course.name}へ いくよ…` : 'うけつけへ いくよ…'}</strong>
            {status === 'error'
              ? <button type="button" onClick={onRetry}>もういちど</button>
              : <progress className={styles.progress} aria-label="よみこみ" value={Math.round(progress * 100)} max={100} />}
          </div>}
          {race && (phase === 'paddock' || phase === 'countdown') && <p className={styles.courseChip}>
            <span aria-hidden="true">{race.emoji}</span> {race.course.name}
          </p>}
          {phase === 'countdown' && <div className={styles.countdown} role="status" aria-live="assertive" key={count}>
            {count > 0 ? count : 'どん！'}
          </div>}
          {plan && (phase === 'race' || phase === 'result') && <ol className={styles.rankStrip} aria-label="いまの じゅんい">
            {(phase === 'result' ? plan.order : ranking.length ? ranking : ordered.map(r => r.index)).map((i, place) => {
              const r = plan.runners[i]
              return (
                <li key={r.species} style={{ '--lane': LANE_COLORS[r.lane] } as CSSProperties} data-cheer={i === cheer || undefined}
                  aria-label={`${place + 1}い ${runnerLabel(i)}`}>
                  {/* 丸の数字は 3Dの名札と同じ ゼッケン（レーン）。じゅんいは ならびで、1いには かんむり */}
                  {place === 0 && <i aria-hidden="true">👑</i>}
                  <b aria-hidden="true">{r.lane + 1}</b><span aria-hidden="true">{SPECIES[r.species].emoji}</span>
                </li>
              )
            })}
          </ol>}
          {phase === 'race' && <div className={styles.goalBar} aria-hidden="true">
            <span style={{ width: `${Math.round(lead * 100)}%` }} />
            <i>🏁</i>
          </div>}
          {toast && phase === 'race' && <p key={toast.key} className={styles.toast} role="status">
            <span aria-hidden="true">{toast.emoji}</span>{toast.text}
          </p>}
        </div>

        <section className={styles.panel} aria-label={
          phase === 'reception' ? 'うけつけ' : phase === 'select' ? 'レースを えらぶ' : phase === 'result' ? 'けっか' : 'しゅっそうひょう'}>
          {phase === 'reception' && <div className={styles.reception}>
            <p className={styles.bubble}>
              <span className={styles.clerk} aria-hidden="true">🐒</span>
              <span>ようこそ、どうぶつレースじょうへ！ どうぶつたちの かけっこを みていってね</span>
            </p>
            <button type="button" className={styles.bigButton} disabled={!ready} onClick={toSelect}>
              <span aria-hidden="true">🎫</span> レースを えらぶ
            </button>
          </div>}

          {phase === 'select' && <div className={styles.raceList} role="group" aria-label="どの レースを みる？">
            <p className={styles.panelTitle}>どの レースを みる？</p>
            {RACES.map(r => {
              const wins = record[r.id] ?? []
              return (
                <button type="button" key={r.id} className={styles.raceCard} style={{ '--card': r.color } as CSSProperties}
                  disabled={!ready} onClick={() => enterRace(r.id)}
                  aria-label={`${r.name}。${r.group}の レース。1ちゃくに なった どうぶつ ${wins.length}/${r.runners.length}`}>
                  <span className={styles.raceEmoji} aria-hidden="true">{r.emoji}</span>
                  <b>{r.name}</b>
                  <small>{r.group}</small>
                  <span className={styles.raceRunners} aria-hidden="true">
                    {r.runners.map(id => <span key={id} data-won={wins.includes(id) || undefined}>{SPECIES[id].emoji}</span>)}
                  </span>
                  <span className={styles.raceWins} aria-hidden="true">🏆 {wins.length}/{r.runners.length}</span>
                </button>
              )
            })}
          </div>}

          {(phase === 'paddock' || phase === 'countdown') && race && plan && <div className={styles.paddock}>
            <p className={styles.panelTitle}><span aria-hidden="true">{race.emoji}</span> {race.name}</p>
            <p className={styles.description}>{race.description}</p>
            <div className={styles.runnerList} role="group" aria-label="おうえんする どうぶつを えらぶ">
              {ordered.map(r => {
                const s = SPECIES[r.species]
                const mood = MOOD[r.mood]
                const pressed = cheer === r.index
                return (
                  <button type="button" key={r.species} className={styles.runner} aria-pressed={pressed}
                    disabled={phase === 'countdown'} style={{ '--lane': LANE_COLORS[r.lane] } as CSSProperties}
                    onClick={() => { primeAudio(); playZooSound('select'); chooseCheer(pressed ? null : r.index) }}
                    aria-label={`${r.lane + 1}ばん ${s.name}。きょうは ${mood.label}。${ATHLETES[r.species].note}`}>
                    <b className={styles.bib} aria-hidden="true">{r.lane + 1}</b>
                    <span className={styles.runnerEmoji} aria-hidden="true">{s.emoji}</span>
                    <span className={styles.runnerText} aria-hidden="true">
                      <strong>{s.name}</strong>
                      <small>{ATHLETES[r.species].note}</small>
                    </span>
                    <span className={styles.mood} aria-hidden="true" title={mood.label}>{mood.emoji}</span>
                    <span className={styles.cheerMark} aria-hidden="true">{pressed ? '📣' : ''}</span>
                  </button>
                )
              })}
            </div>
            <p className={styles.hintText}>{cheer === null ? 'おうえんする どうぶつを タップしてね（えらばなくても いいよ）' : `${SPECIES[plan.runners[cheer].species].name}を おうえん するよ！`}</p>
            <div className={styles.buttons}>
              <button type="button" className={styles.subButton} disabled={phase === 'countdown'} onClick={toSelect}>ほかの レース</button>
              <button type="button" className={styles.bigButton} disabled={!ready || phase === 'countdown'} onClick={startCountdown}>
                <span aria-hidden="true">🏁</span> スタート！
              </button>
            </div>
          </div>}

          {phase === 'race' && plan && <div className={styles.watch}>
            {cheer !== null
              ? <p className={styles.cheerNow} style={{ '--lane': LANE_COLORS[plan.runners[cheer].lane] } as CSSProperties}>
                <span aria-hidden="true">📣 {SPECIES[plan.runners[cheer].species].emoji}</span>
                {SPECIES[plan.runners[cheer].species].name}{cheerGoal
                  ? `は ${cheerGoal}ちゃくで ゴール！`
                  : <>{ranking.length ? `は いま ${ranking.indexOf(cheer) + 1}い！` : ''} <span className={styles.go}>がんばれー！</span></>}
              </p>
              : <p className={styles.cheerNow}><span aria-hidden="true">👀</span> みんな <span className={styles.go}>がんばれー！</span></p>}
            {winnerIn && <button type="button" className={styles.bigButton} onClick={showResult}>
              <span aria-hidden="true">🏆</span> けっかを みる
            </button>}
          </div>}

          {phase === 'result' && plan && race && <div className={styles.result}>
            <p className={styles.panelTitle}><span aria-hidden="true">🏆</span> {race.name} けっか</p>
            <ol className={styles.resultList} aria-label="ちゃくじゅん">
              {plan.order.map((i, place) => {
                const r = plan.runners[i]
                const s = SPECIES[r.species]
                return (
                  <li key={r.species} data-cheer={i === cheer || undefined} style={{ '--lane': LANE_COLORS[r.lane] } as CSSProperties}>
                    <span className={styles.place} aria-hidden="true">{PLACE_MEDAL[place] ?? `${place + 1}`}</span>
                    <span aria-hidden="true">{s.emoji}</span>
                    <b>{place + 1}ちゃく {s.name}</b>
                    {i === cheer && <span className={styles.cheerTag}>おうえん</span>}
                  </li>
                )
              })}
            </ol>
            <p className={styles.message} role="status">
              {cheer === null
                ? `${SPECIES[plan.runners[plan.order[0]].species].name}が 1ちゃく！`
                : cheerPlace === 1 ? `やったね！ おうえんした ${SPECIES[plan.runners[cheer].species].name}が 1ちゃく！`
                  : `おうえんした ${SPECIES[plan.runners[cheer].species].name}は ${cheerPlace}ちゃく。よく がんばったね！`}
              {firstWin && ` ${SPECIES[plan.runners[plan.order[0]].species].name}は はじめての 1ちゃく！`}
            </p>
            <div className={styles.buttons}>
              <button type="button" className={styles.subButton} onClick={toSelect}>ほかの レース</button>
              <button type="button" className={styles.bigButton} disabled={!ready} onClick={() => enterRace(plan.race)}>
                <span aria-hidden="true">🔁</span> もういちど
              </button>
            </div>
          </div>}
        </section>
      </main>
    </GamePlaySurface>
  )
}

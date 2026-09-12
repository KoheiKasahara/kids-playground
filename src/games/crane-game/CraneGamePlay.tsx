import { useCallback, useMemo, useState, type CSSProperties } from 'react'
import GameBackButton from '../../components/GameBackButton'
import GamePlaySurface from '../../components/GamePlaySurface'
import { primeAudio } from '../../audio/sound'
import { BIN, CHUTE, CRANE_MACHINES, findMachine } from './craneMachines'
import { craneSound, type CraneSoundKind } from './craneSound'
import type { CraneView } from './craneScene'
import type { CraneEvent } from './craneWorld'
import { useCraneGameEngine, type CraneAction, type CraneFeedback, type CraneStatus } from './useCraneGameEngine'
import styles from './CraneGamePlay.module.css'

const EMPTY: CraneFeedback = { phase: 'idle', axis: null, holding: false, ready: false, remaining: 0, collected: 0 }
/** 取れた景品の表示はこの数まで。増えすぎても画面がくずれないようにする。 */
const TRAY_LIMIT = 10

function caption(feedback: CraneFeedback, message: string | null, selecting: boolean): string {
  if (!feedback.ready) return 'けいひんを ならべているよ…'
  if (selecting) return 'すきな きかいを えらんでね'
  if (message) return message
  switch (feedback.phase) {
    case 'descend': return 'アームが おりていく…'
    case 'close': return 'つかめるかな…？'
    case 'lift': return feedback.holding ? 'もちあげた！ そのまま そのまま！' : 'うーん、つかめなかった…'
    case 'carry': return feedback.holding ? 'あなまで はこんでいるよ！' : 'つぎは もうすこし まんなかを ねらおう'
    case 'open':
    case 'settle': return 'それっ！'
    default: return feedback.axis ? 'いいところで とめてね！' : 'ボタンか ケースを タップして アームを うごかそう'
  }
}

export default function CraneGamePlay() {
  const [machineId, setMachineId] = useState(CRANE_MACHINES[0]!.id)
  const machine = useMemo(() => findMachine(machineId) ?? CRANE_MACHINES[0]!, [machineId])
  const [phase, setPhase] = useState<'select' | 'play'>('select')
  const [view, setView] = useState<CraneView>('front')
  const [round, setRound] = useState(0)
  const [sound, setSound] = useState(true)
  const [status, setStatus] = useState<CraneStatus>('loading')
  const [feedback, setFeedback] = useState<CraneFeedback>(EMPTY)
  const [tray, setTray] = useState<{ id: string; emoji: string }[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [reducedMotion] = useState(() => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)

  const play = useCallback((kind: CraneSoundKind, strength = 1) => { if (sound) craneSound(kind, strength) }, [sound])
  const onEvent = useCallback((event: CraneEvent) => {
    if (event.kind === 'caught') {
      setTray(list => [...list, { id: event.prize, emoji: event.emoji }])
      setMessage(`ゲット！ ${event.label}が とれたよ！`)
      play('get')
    }
    if (event.kind === 'slip') { setMessage('ああっ すべっちゃった！ もういちど！'); play('slip') }
    if (event.kind === 'miss') { setMessage('つかめなかった… ねらいを かえてみよう'); play('miss') }
    if (event.kind === 'grip') { setMessage(null); play('grab') }
    if (event.kind === 'bump') play('bump', event.strength)
  }, [play])
  const onAction = useCallback((action: CraneAction) => {
    if (action === 'motor') play('motor')
    if (action === 'stop') play('stop')
    if (action === 'bottom' || action === 'release') play('clack')
  }, [play])

  const { registerContainer, registerMapMarker, retry, move, grab } = useCraneGameEngine({
    machine, round, view, reducedMotion, onStatus: setStatus, onFeedback: setFeedback, onEvent, onAction,
  })

  const busy = feedback.phase !== 'idle'
  const playable = status === 'ready' && feedback.ready
  const begin = () => {
    if (sound) primeAudio()
    setMessage(null)
    setPhase('play')
    setView('front')
    play('clack')
  }
  const refill = () => {
    setRound(value => value + 1)
    setMessage('けいひんを ならべなおしたよ！')
    play('clack')
  }

  return (
    <GamePlaySurface>
      <main className={styles.page} style={{ '--machine-color': machine.color } as CSSProperties}>
        <header className={styles.header}>
          {phase === 'select'
            ? <GameBackButton to="/" />
            : <GameBackButton onBack={() => { setPhase('select'); setMessage(null) }} />}
          <h1>クレーンゲーム</h1>
          <button type="button" className={styles.soundButton} aria-label="おと" aria-pressed={sound} onClick={() => { if (!sound) primeAudio(); setSound(value => !value) }}>
            <span aria-hidden="true">{sound ? '🔊' : '🔇'}</span>
          </button>
        </header>

        <div className={styles.scene} ref={registerContainer} role="application" aria-label="クレーンゲームの 3Dきかい" data-testid="crane-scene">
          {status !== 'ready' && <div className={styles.sceneStatus} role={status === 'error' ? 'alert' : 'status'}>
            <span aria-hidden="true">{status === 'error' ? '🚧' : '🧸'}</span>
            <strong>{status === 'error' ? 'きかいを よみこめなかったよ' : 'きかいの じゅんびちゅう…'}</strong>
            {status === 'error'
              ? <button type="button" onClick={retry}>もういちど</button>
              : <span className={styles.loadingDots} aria-hidden="true">● ● ●</span>}
          </div>}
          {status === 'ready' && <>
            <p className={styles.sceneCaption} role="status">{caption(feedback, message, phase === 'select')}</p>
            <aside className={styles.map} aria-label={`うえから みた アームの ばしょ。のこり ${feedback.remaining}こ`}>
              <svg viewBox="-24 -18 48 36" aria-hidden="true">
                <rect x="-20" y="-14" width="40" height="28" rx="2.5" fill="#fff6e4" stroke="#d9c6a8" strokeWidth="1.2" />
                <rect x={(CHUTE.minX / BIN.x) * 20} y={(CHUTE.minZ / BIN.z) * 14} width={((CHUTE.maxX - CHUTE.minX) / BIN.x) * 20} height={((CHUTE.maxZ - CHUTE.minZ) / BIN.z) * 14} rx="1.5" fill="#ffd89a" stroke="#e0a348" strokeWidth="1" />
                <circle ref={registerMapMarker} cx="-20" cy="14" r="3.4" fill="var(--machine-color)" stroke="white" strokeWidth="1.4" />
              </svg>
              <span>のこり {feedback.remaining}こ</span>
            </aside>
            {tray.length > 0 && <div className={styles.tray} aria-label={`とれた けいひん ${tray.length}こ`}>
              <strong>{tray.length}こ</strong>
              <span aria-hidden="true">{tray.slice(-TRAY_LIMIT).map(item => item.emoji).join('')}</span>
            </div>}
          </>}
        </div>

        {phase === 'select' ? <section className={styles.selection} aria-label="きかいを えらぶ">
          <h2>どの きかいで あそぶ？</h2>
          <div className={styles.machines}>
            {CRANE_MACHINES.map(item => <button
              key={item.id}
              type="button"
              className={styles.machineButton}
              style={{ '--card-color': item.color } as CSSProperties}
              aria-label={`${item.label}の きかいを えらぶ`}
              aria-pressed={machineId === item.id}
              onClick={() => { setMachineId(item.id); setMessage(null); play('clack') }}
            >
              <span className={styles.check} aria-hidden="true">{machineId === item.id ? '✓' : ''}</span>
              <span className={styles.machineEmoji} aria-hidden="true">{item.emoji}</span>
              <strong>{item.label}</strong>
              <small>{item.description}</small>
            </button>)}
          </div>
          <button type="button" className={styles.beginButton} disabled={status !== 'ready'} onClick={begin}>
            <span aria-hidden="true">▶</span> あそぶ！
          </button>
        </section> : <section className={styles.controls} aria-label="クレーンの そうさ">
          <div className={styles.axisRow}>
            <button
              type="button"
              className={styles.axisButton}
              disabled={!playable || busy}
              data-active={feedback.axis === 'x'}
              aria-pressed={feedback.axis === 'x'}
              aria-label={feedback.axis === 'x' ? 'よこに うごくのを とめる' : 'よこに うごかす'}
              onClick={() => move('x')}
            >
              <span aria-hidden="true">↔</span>
              <strong>よこ</strong>
              <small>{feedback.axis === 'x' ? 'とめる' : 'うごかす'}</small>
            </button>
            <button
              type="button"
              className={styles.axisButton}
              disabled={!playable || busy}
              data-active={feedback.axis === 'z'}
              aria-pressed={feedback.axis === 'z'}
              aria-label={feedback.axis === 'z' ? 'おくに うごくのを とめる' : 'おくに うごかす'}
              onClick={() => move('z')}
            >
              <span aria-hidden="true">↕</span>
              <strong>おく</strong>
              <small>{feedback.axis === 'z' ? 'とめる' : 'うごかす'}</small>
            </button>
          </div>
          <button type="button" className={styles.grabButton} disabled={!playable || busy} aria-label="つかむ" onClick={grab}>
            <span aria-hidden="true">🕹️</span>
            <strong>つかむ！</strong>
            <small>{busy ? 'アームが うごいているよ' : 'ここで おとすよ'}</small>
          </button>
          <div className={styles.tools}>
            <button type="button" aria-pressed={view === 'front'} aria-label="まえから みる" onClick={() => setView('front')}><span aria-hidden="true">🔭</span>まえ</button>
            <button type="button" aria-pressed={view === 'side'} aria-label="よこから みる" onClick={() => setView('side')}><span aria-hidden="true">↗️</span>よこ</button>
            <button type="button" aria-label="けいひんを ならべなおす" disabled={!playable || busy} onClick={refill}><span aria-hidden="true">🎁</span>ならべる</button>
            <button type="button" aria-label="きかいを えらびなおす" onClick={() => { setPhase('select'); setMessage(null) }}><span aria-hidden="true">🎰</span>きかい</button>
          </div>
          <p className={styles.hint}>
            {feedback.remaining === 0 ? 'ぜんぶ とれた！ ならべるを おしてね' : machine.hint}
            <span>{machine.emoji} {machine.label}</span>
          </p>
        </section>}
      </main>
    </GamePlaySurface>
  )
}

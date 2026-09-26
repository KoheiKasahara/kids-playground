import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import GameBackButton from '../../components/GameBackButton'
import GamePlaySurface from '../../components/GamePlaySurface'
import { useGameIntroPlaying } from '../../components/gameIntroState'
import { isSoundEnabled, primeAudio, setSoundEnabled } from '../../audio/sound'
import { AUTO_COLOR, BLOCK_COLORS, BLOCK_SHAPES, findColor, resolveColor, type BlockShapeId, type ColorChoice } from './blocks'
import { HEIGHT_GOALS, heightInCm, MAX_BLOCKS, nextGoal, type HeightGoal } from './placement'
import { readBestHeight, saveBestHeight } from './record'
import { playRotateSound, playSelectSound } from './sounds'
import { INITIAL_SNAPSHOT, useTsumikiEngine, type TsumikiCallbacks, type TsumikiSelection, type TsumikiSnapshot } from './useTsumikiEngine'
import BlockIcon from './BlockIcon'
import styles from './Tsumiki3dPlay.module.css'

const TITLE = '3Dつみき'

type Toast = { id: number; emoji: string; text: string }

function Game({ onExit }: { onExit: () => void }) {
  useGameIntroPlaying(true)
  const [shape, setShape] = useState<BlockShapeId>('cube')
  const [color, setColor] = useState<ColorChoice>(AUTO_COLOR)
  const [turns, setTurns] = useState(0)
  const [snapshot, setSnapshot] = useState<TsumikiSnapshot>(INITIAL_SNAPSHOT)
  const [toast, setToast] = useState<Toast | null>(null)
  const [sound, setSound] = useState(isSoundEnabled)
  const [best, setBest] = useState(readBestHeight)
  const [placedOnce, setPlacedOnce] = useState(false)

  const selectionRef = useRef<TsumikiSelection>({ shape, color, turns })
  useEffect(() => { selectionRef.current = { shape, color, turns } }, [shape, color, turns])

  const showToast = useCallback((emoji: string, text: string) => {
    setToast({ id: Date.now(), emoji, text })
  }, [])
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 2600)
    return () => window.clearTimeout(timer)
  }, [toast])

  const callbacksRef = useRef<TsumikiCallbacks>({
    onSnapshot: next => {
      setSnapshot(next)
      if (next.count > 0) setPlacedOnce(true)
      if (next.height > 0) {
        saveBestHeight(next.height)
        setBest(current => Math.max(current, next.height))
      }
    },
    onGoal: (goal: HeightGoal) => showToast(goal.emoji, `${goal.label} くらい たかい！`),
    onFull: () => showToast('🧺', 'つみきが いっぱい！ かたづけて つもう'),
  })

  const { registerContainer, status, controls, retry } = useTsumikiEngine(selectionRef, callbacksRef)

  const selectShape = (id: BlockShapeId, index: number) => {
    primeAudio()
    playSelectSound(index)
    if (id !== shape) setTurns(0)
    setShape(id)
  }
  const selectColor = (id: ColorChoice, index: number) => {
    primeAudio()
    playSelectSound(index)
    setColor(id)
  }
  const rotate = () => {
    primeAudio()
    playRotateSound()
    setTurns(value => (value + 1) % 4)
  }
  const act = (action: () => void) => () => {
    primeAudio()
    action()
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const c = controls.current
    const keys: Record<string, () => void> = {
      ArrowLeft: () => c.moveCursor(-1, 0),
      ArrowRight: () => c.moveCursor(1, 0),
      ArrowUp: () => c.moveCursor(0, 1),
      ArrowDown: () => c.moveCursor(0, -1),
      Enter: () => c.placeAtCursor(),
      ' ': () => c.placeAtCursor(),
      q: () => c.orbit(-0.3, 0),
      e: () => c.orbit(0.3, 0),
      r: rotate,
      '+': () => c.zoom(0.9),
      '-': () => c.zoom(1.1),
    }
    const handler = keys[event.key.length === 1 ? event.key.toLowerCase() : event.key]
    if (!handler) return
    event.preventDefault()
    primeAudio()
    handler()
  }

  const next = nextGoal(snapshot.height)
  const shownColor = (id: BlockShapeId) => findColor(resolveColor(id, color)).hex
  const goalProgress = useMemo(() => HEIGHT_GOALS.map((goal, index) => ({ goal, done: index < snapshot.goals })), [snapshot.goals])

  return (
    <GamePlaySurface>
      <main className={styles.game}>
        <header className={styles.header}>
          <GameBackButton onBack={onExit} ariaLabel="タイトルへ もどる" />
          <h1>{TITLE}</h1>
          <button
            type="button"
            className={styles.iconButton}
            aria-label="こうかおん"
            aria-pressed={sound}
            onClick={() => { setSoundEnabled(!sound); setSound(!sound) }}
          >
            {sound ? '🔊' : '🔇'}
          </button>
        </header>

        <div className={styles.stage}>
          <div
            ref={registerContainer}
            className={styles.scene}
            tabIndex={0}
            role="application"
            aria-label="つみきの マット。さわった ところに つみきが おちるよ。ゆびで ずらすと まわして みられるよ。やじるしキーで えらんで エンターで おけるよ"
            onKeyDown={onKeyDown}
            onBlur={() => controls.current.hideCursor()}
          />

          <div className={styles.hud} aria-live="polite">
            <div className={styles.heightCard}>
              <span className={styles.heightLabel}>たかさ</span>
              <strong>{heightInCm(snapshot.height)}<small>cm</small></strong>
              <span className={styles.goals} aria-label={`めあて ${snapshot.goals}こ クリア`}>
                {goalProgress.map(({ goal, done }) => (
                  <span key={goal.label} className={done ? styles.goalDone : styles.goalTodo} aria-hidden="true">{goal.emoji}</span>
                ))}
              </span>
            </div>
            <div className={styles.countCard} aria-label={`つみき ${snapshot.count}こ`}>
              <span aria-hidden="true">🧱</span> {snapshot.count}<small>/{MAX_BLOCKS}</small>
            </div>
          </div>

          {next && status === 'ready' && (
            <p className={styles.nextGoal}>
              つぎは <span aria-hidden="true">{next.emoji}</span> {next.label}（{heightInCm(next.height)}cm）
            </p>
          )}
          {best > 0 && status === 'ready' && <p className={styles.best}>👑 さいこう {heightInCm(best)}cm</p>}

          {!placedOnce && status === 'ready' && (
            <div className={styles.hint} aria-hidden="true">
              <span className={styles.hintHand}>👆</span>
              <span>さわった ところに ぽとん！<br /><small>ゆびで ずらすと まわるよ</small></span>
            </div>
          )}

          {toast && (
            <div key={toast.id} className={styles.toast} role="status">
              <span className={styles.toastEmoji} aria-hidden="true">{toast.emoji}</span>
              <span>{toast.text}</span>
            </div>
          )}

          {status !== 'ready' && (
            <div className={styles.overlay} role={status === 'error' ? 'alert' : 'status'}>
              {status === 'loading' ? (
                <>
                  <div className={styles.loader} aria-hidden="true"><i /><i /><i /></div>
                  <p>つみきを ならべて いるよ…</p>
                </>
              ) : (
                <>
                  <p>3Dを ひょうじ できなかったよ</p>
                  <button type="button" className={styles.primary} onClick={retry}>もういちど</button>
                </>
              )}
            </div>
          )}
        </div>

        <section className={styles.tray} aria-label="つみき えらび">
          <div className={styles.shapes} role="radiogroup" aria-label="かたち">
            {BLOCK_SHAPES.map((entry, index) => (
              <button
                key={entry.id}
                type="button"
                role="radio"
                aria-checked={shape === entry.id}
                aria-label={entry.label}
                className={styles.shapeButton}
                onClick={() => selectShape(entry.id, index)}
              >
                <span className={styles.shapeIcon} style={{ transform: shape === entry.id && turns % 2 === 1 ? 'scaleX(-1)' : undefined }}>
                  <BlockIcon shape={entry.id} color={shownColor(entry.id)} />
                </span>
              </button>
            ))}
          </div>
          <div className={styles.colors} role="radiogroup" aria-label="いろ">
            <button
              type="button"
              role="radio"
              aria-checked={color === AUTO_COLOR}
              aria-label="おまかせ"
              className={`${styles.swatch} ${styles.autoSwatch}`}
              onClick={() => selectColor(AUTO_COLOR, 0)}
            />
            {BLOCK_COLORS.map((entry, index) => (
              <button
                key={entry.id}
                type="button"
                role="radio"
                aria-checked={color === entry.id}
                aria-label={entry.label}
                className={styles.swatch}
                style={{ '--swatch': entry.hex } as CSSProperties}
                onClick={() => selectColor(entry.id, index + 1)}
              />
            ))}
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.action} onClick={rotate}>
              <span aria-hidden="true">🔄</span>まわす
            </button>
            <button type="button" className={styles.action} onClick={act(() => controls.current.undo())} disabled={!snapshot.count}>
              <span aria-hidden="true">↩️</span>もどす
            </button>
            <button type="button" className={styles.action} onClick={act(() => controls.current.shake())} disabled={!snapshot.count}>
              <span aria-hidden="true">🌋</span>ゆらす
            </button>
            <button type="button" className={styles.action} onClick={act(() => controls.current.clear())} disabled={!snapshot.count}>
              <span aria-hidden="true">🧹</span>かたづけ
            </button>
          </div>
        </section>
      </main>
    </GamePlaySurface>
  )
}

/** タイトルの つみき（CSSで つくった たてもの）。 */
const HERO_BLOCKS: { shape: BlockShapeId; color: string; x: number; y: number; delay: number }[] = [
  { shape: 'plank', color: '#f5c535', x: 0, y: 0, delay: 0 },
  { shape: 'cube', color: '#e2483d', x: -26, y: -40, delay: 0.12 },
  { shape: 'cube', color: '#3a7fd8', x: 26, y: -40, delay: 0.24 },
  { shape: 'plank', color: '#43b36a', x: 0, y: -74, delay: 0.36 },
  { shape: 'pillar', color: '#f07fae', x: 0, y: -118, delay: 0.48 },
  { shape: 'cone', color: '#8a5ccf', x: 0, y: -166, delay: 0.6 },
]

export default function Tsumiki3dPlay() {
  const [playing, setPlaying] = useState(false)
  const [best, setBest] = useState(readBestHeight)
  if (playing) return <Game onExit={() => { setBest(readBestHeight()); setPlaying(false) }} />
  return (
    <main className={styles.start}>
      <header className={styles.startHeader}><GameBackButton to="/" /></header>
      <div className={styles.hero} aria-hidden="true">
        <div className={styles.heroMat} />
        {HERO_BLOCKS.map((block, index) => (
          <span
            key={index}
            className={styles.heroBlock}
            style={{ '--x': `${block.x}px`, '--y': `${block.y}px`, '--delay': `${block.delay}s` } as CSSProperties}
          >
            <BlockIcon shape={block.shape} color={block.color} size={block.shape === 'plank' ? 96 : 64} />
          </span>
        ))}
      </div>
      <h1 className={styles.title}>{TITLE}</h1>
      <p className={styles.lead}>ぽとん、ぽとん。<br />どこまで たかく つめるかな？</p>
      <button
        type="button"
        className={styles.startButton}
        onClick={() => { primeAudio(); window.scrollTo(0, 0); setPlaying(true) }}
      >
        ▶ あそぶ
      </button>
      {best > 0 && <p className={styles.startBest}>👑 さいこう {heightInCm(best)}cm</p>}
    </main>
  )
}

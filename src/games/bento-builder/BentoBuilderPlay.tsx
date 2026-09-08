import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import GameBackButton from '../../components/GameBackButton'
import { useGameIntroPlaying } from '../../components/gameIntroState'
import { isSoundEnabled, setSoundEnabled } from '../../audio/sound'
import { bentoReducer, BOXES, COLORS, CUPS, FOODS, foodDefinition, initialBentoState, type BentoState, type BoxKind, type Point } from './bentoState'
import { createBentoScene, type SceneCallbacks } from './bentoScene'
import { playBentoSound } from './sounds'
import styles from './BentoBuilderPlay.module.css'

function BoxPreview({ kind, color }: { kind: BoxKind; color: string }) {
  return <svg viewBox="0 0 100 70" aria-hidden="true" className={styles.boxPreview}>
    {kind === 'round'
      ? <ellipse cx="50" cy="35" rx="37" ry="28" fill="#fff7e1" stroke={color} strokeWidth="10" />
      : <rect x="8" y="10" width="84" height="50" rx="12" fill="#fff7e1" stroke={color} strokeWidth="10" />}
    {kind === 'divided' && <path d="M50 12v46" stroke={color} strokeWidth="7" />}
  </svg>
}

function BentoCanvas({ state, callbacks }: { state: BentoState; callbacks: SceneCallbacks }) {
  const host = useRef<HTMLDivElement>(null)
  const scene = useRef<ReturnType<typeof createBentoScene> | null>(null)
  const initial = useRef({ state, callbacks })
  useEffect(() => {
    if (!host.current) return
    const handle = createBentoScene(host.current, initial.current.state, initial.current.callbacks)
    scene.current = handle
    return () => { scene.current = null; handle.dispose() }
  }, [])
  useEffect(() => { scene.current?.sync(state) }, [state])
  return <div ref={host} className={styles.canvas} role="group" aria-label="おべんとうの なか。おかずを ドラッグで うごかせるよ"
    tabIndex={state.mode === 'edit' ? 0 : -1}
    onKeyDown={event => {
      const food = state.foods.find(food => food.id === state.selected)
      if (state.mode !== 'edit' || !food) return
      const directions: Record<string, Point> = { ArrowLeft: { x: -0.25, z: 0 }, ArrowRight: { x: 0.25, z: 0 }, ArrowUp: { x: 0, z: -0.25 }, ArrowDown: { x: 0, z: 0.25 } }
      const direction = directions[event.key]
      if (direction) {
        event.preventDefault()
        callbacks.move(food.id, { x: food.x + direction.x, z: food.z + direction.z })
      }
    }} />
}

export default function BentoBuilderPlay() {
  const [state, dispatch] = useReducer(bentoReducer, initialBentoState)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [generation, setGeneration] = useState(0)
  const [sound, setSound] = useState(isSoundEnabled)
  const choose = state.mode === 'choose'
  const editing = state.mode === 'edit'
  const finished = state.mode === 'done'
  useGameIntroPlaying(!choose)
  const select = useCallback((id: number | null) => dispatch({ type: 'select', id }), [])
  const move = useCallback((id: number, point: Point) => {
    dispatch({ type: 'move', id, point })
    playBentoSound('place')
  }, [])
  const selected = state.foods.find(food => food.id === state.selected)
  return <main className={styles.page}>
    <header className={styles.header}>
      {choose ? <GameBackButton to="/" /> : <GameBackButton onBack={() => dispatch({ type: 'back' })} />}
      <h1>3Dおべんとうづくり</h1>
      <button type="button" className={styles.sound} aria-label="おと" aria-pressed={sound} onClick={() => {
        setSoundEnabled(!sound)
        setSound(!sound)
      }}>{sound ? '🔊' : '🔇'}</button>
    </header>
    <section className={styles.stage} aria-label="おべんとう">
      <BentoCanvas key={generation} state={state} callbacks={{ select, move, status: setStatus }} />
      {status === 'loading' && <p className={styles.overlay} role="status">🍱 じゅんびちゅう…</p>}
      {status === 'error' && <div className={styles.overlay} role="alert">
        <p>うまく よみこめなかったよ</p>
        <button type="button" onClick={() => { setStatus('loading'); setGeneration(value => value + 1) }}>もういちど よみこむ</button>
      </div>}
      {finished && status === 'ready' && <div className={styles.celebration}>
        <span className={styles.sparkles} aria-hidden="true">✦ ✧ ✦ ✧</span>
        <h2>おべんとう できた！</h2>
      </div>}
    </section>
    <section className={styles.panel} aria-label={choose ? 'おべんとうばこを えらぶ' : finished ? 'できあがり' : 'おかずを えらぶ'}>
      {choose ? <>
        <h2>どの はこに する？</h2>
        <div className={styles.boxes}>
          {BOXES.map(box => <button key={box.id} type="button" aria-pressed={state.box === box.id} onClick={() => dispatch({ type: 'box', box: box.id })}>
            <BoxPreview kind={box.id} color={state.color} /><span>{box.name}</span>
          </button>)}
        </div>
        <div className={styles.colors} role="group" aria-label="はこの いろ">
          {COLORS.map(color => <button key={color.hex} type="button" aria-label={color.name} aria-pressed={color.hex === state.color} onClick={() => dispatch({ type: 'color', color: color.hex })}>
            <span style={{ background: color.hex }} aria-hidden="true">{state.color === color.hex ? '✓' : ''}</span>
            {color.name}
          </button>)}
        </div>
        <button type="button" className={styles.primary} onClick={() => dispatch({ type: 'start' })}>つくる！</button>
      </> : finished ? <div className={styles.finishActions}>
        <button type="button" onClick={() => dispatch({ type: 'edit' })}>✎ なおす</button>
        <button type="button" className={styles.primary} onClick={() => dispatch({ type: 'restart' })}>🍱 もういちど</button>
      </div> : <>
        <div className={styles.actions}>
          <button type="button" disabled={!selected || status !== 'ready'} onClick={() => { dispatch({ type: 'rotate' }); playBentoSound('place') }}>↻ まわす</button>
          <button type="button" disabled={!selected || status !== 'ready'} onClick={() => { dispatch({ type: 'remove' }); playBentoSound('remove') }}>− けす</button>
          <button type="button" className={styles.clearAction} disabled={!state.foods.length || status !== 'ready'} onClick={() => { dispatch({ type: 'clear' }); playBentoSound('remove') }}>↺ やりなおし</button>
          <button type="button" className={styles.primary} disabled={!state.foods.length || status !== 'ready'} onClick={() => { dispatch({ type: 'finish' }); playBentoSound('finish') }}>✓ できた！</button>
        </div>
        <p className={styles.message} role="status">{state.message || (selected ? `${foodDefinition(selected.kind).name}を うごかしてね` : 'おかずを タップして いれよう')}</p>
        <div className={styles.foods}>
          {FOODS.map(food => <button key={food.id} type="button" disabled={status !== 'ready'} aria-label={`${food.name}を いれる`} onClick={() => {
            dispatch({ type: 'add', kind: food.id }); playBentoSound('add')
          }}><span aria-hidden="true">{food.emoji}</span><span>{food.name}</span></button>)}
        </div>
        <div className={styles.cups} role="group" aria-label="おかずカップ">
          <span>カップ</span>
          {CUPS.map(cup => <button key={cup.id} type="button" disabled={!selected || status !== 'ready'}
            aria-label={`${cup.name}の カップ`} aria-pressed={selected?.cup === cup.id}
            onClick={() => { dispatch({ type: 'cup', cup: cup.id }); playBentoSound('place') }}>
            <svg viewBox="0 0 40 30" aria-hidden="true"><path d="M3 5h34l-5 22H8z" fill={cup.color} stroke="#638a78" strokeWidth="1.5" /><path d="M10 7l3 17M20 7v17M30 7l-3 17" fill="none" stroke="#ffffff" strokeWidth="2" /><ellipse cx="20" cy="5" rx="17" ry="4" fill={cup.color} stroke="#638a78" strokeWidth="1.5" /></svg>
            <span>{cup.name}</span>
          </button>)}
          <button type="button" disabled={!selected?.cup || status !== 'ready'} aria-label="カップを はずす"
            onClick={() => dispatch({ type: 'cup', cup: null })}>なし</button>
        </div>
        <div className={styles.placed} role="group" aria-label="いれた おかず">
          {state.foods.map((food, index) => <button key={food.id} type="button" aria-label={`${index + 1}こめの ${foodDefinition(food.kind).name}`} aria-pressed={state.selected === food.id} disabled={status !== 'ready'} onClick={() => select(food.id)}>
            <span aria-hidden="true">{foodDefinition(food.kind).emoji}</span>
          </button>)}
          {!state.foods.length && <span>すきな おかずを いれてね</span>}
        </div>
      </>}
    </section>
    {editing && <span className={styles.srOnly}>いれた おかずを えらんで、ばんめんで やじるしキーを おすと うごかせるよ</span>}
  </main>
}

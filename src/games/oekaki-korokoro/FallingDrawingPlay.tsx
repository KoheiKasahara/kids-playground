import { useState, type CSSProperties } from 'react'
import { COLORS, PAPER_HEIGHT, PAPER_WIDTH } from './rollerData'
import { useFallingDrawing } from './useFallingDrawing'
import styles from './OekakiKorokoroPlay.module.css'

export default function FallingDrawingPlay({ active }: { active: boolean }) {
  const [color, setColor] = useState<string>(COLORS[0].value)
  const [ball, setBall] = useState(false)
  const { canvas: canvasRef, status, begin, move, finish, undo, drain } = useFallingDrawing(active, color, ball)
  return <div className={styles.workspace} hidden={!active}>
    <section className={styles.studio} aria-label="かいて ころがす">
      <div className={styles.caption}>
        <span>{ball ? 'すきな ところに ボールを おこう' : 'かいて はなすと おちるよ！'}</span>
        <span role="status">{status.draining ? 'ばいばーい！' : status.goals ? `🎉 はいった！ ${status.goals}` : '⚽ → 🧺'}</span>
      </div>
      <div className={styles.mat}>
        <div className={styles.paper}>
          <canvas ref={canvasRef} className={styles.canvas} width={PAPER_WIDTH} height={PAPER_HEIGHT}
            aria-label="かいて ころがす。せんを かいて はなしてね。ボールを かごに いれてみよう"
            onPointerDown={begin} onPointerMove={move} onPointerUp={e => finish(e)}
            onPointerCancel={e => finish(e, true)} onLostPointerCapture={e => finish(e, true)}>
            せんを かいて はなすと おちるよ。ボールを かごに いれてみよう。
          </canvas>
        </div>
      </div>
    </section>
    <aside className={`${styles.tools} ${styles.fallingTools}`} aria-label="ころがす どうぐ">
      <div className={styles.drawingTools} role="group" aria-label="あそびの どうぐ">
        <button aria-pressed={!ball} onClick={() => setBall(false)}><span aria-hidden="true">✏️</span>せんを かく</button>
        <button aria-pressed={ball} onClick={() => setBall(true)}><span aria-hidden="true">⚽</span>ボールを おく</button>
      </div>
      <div className={styles.toolGroup} role="group" aria-label="いろを えらぶ">
        <h2>いろ</h2><div className={styles.colors}>{COLORS.map(c => <button key={c.value} aria-label={c.name} aria-pressed={color === c.value} style={{ '--swatch': c.value } as CSSProperties} onClick={() => setColor(c.value)}><span>{color === c.value ? '✓' : ''}</span></button>)}</div>
      </div>
      <div className={`${styles.actions} ${styles.fallingActions}`}>
        <button disabled={!status.canUndo} onClick={undo}><span aria-hidden="true">↶</span>1かい もどす</button>
        <button disabled={status.draining} onClick={drain}><span aria-hidden="true">🗑️</span>ぜんぶ おとす</button>
      </div>
    </aside>
  </div>
}

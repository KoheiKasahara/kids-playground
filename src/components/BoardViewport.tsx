import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import styles from './BoardViewport.module.css'

/** Enlarge the measured board area, rather than scaling its DOM after pointer coordinates are calculated. */
export default function BoardViewport({ children, className = '' }: { children: ReactNode; className?: string }) {
  const [enlarged, setEnlarged] = useState(false)
  const viewport = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const node = viewport.current
    if (!node) return
    node.scrollTop = 0
    node.scrollLeft = enlarged ? Math.max(0, (node.scrollWidth - node.clientWidth) / 2) : 0
  }, [enlarged])
  const pan = (x: number, y: number) => {
    const node = viewport.current
    if (node) node.scrollBy({ left: x * node.clientWidth * .6, top: y * node.clientHeight * .6, behavior: 'instant' })
  }
  return <div className={`${styles.root} ${className}`} data-board-viewport data-enlarged={enlarged}>
    <div className={styles.viewport} ref={viewport} tabIndex={0} aria-label="ばんめんの ひょうじ">
      <div className={styles.content}>{children}</div>
    </div>
    <div className={styles.tools} role="group" aria-label="ばんめんの みかた">
      <button type="button" aria-label={enlarged ? 'ばんめんを ぜんたいひょうじ' : 'ばんめんを おおきく'} aria-pressed={enlarged}
        onClick={() => setEnlarged(value => !value)}>
        {enlarged ? '⊡' : '＋'}<small>{enlarged ? 'ぜんたい' : 'おおきく'}</small>
      </button>
      {enlarged && <>
        <button type="button" aria-label="ばんめんを うえへ" onClick={() => pan(0, -1)}>↑</button>
        <button type="button" aria-label="ばんめんを したへ" onClick={() => pan(0, 1)}>↓</button>
        <button type="button" aria-label="ばんめんを ひだりへ" onClick={() => pan(-1, 0)}>←</button>
        <button type="button" aria-label="ばんめんを みぎへ" onClick={() => pan(1, 0)}>→</button>
      </>}
    </div>
  </div>
}

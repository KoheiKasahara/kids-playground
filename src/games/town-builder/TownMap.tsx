import { useEffect, useRef, type MouseEvent } from 'react'
import { drawTownMap } from './mapColors'
import { COLS, ROWS, type Town } from './town'
import type { TileRange } from './zoom'
import styles from './TownBuilderPlay.module.css'

const SCALE = 4

type Props = {
  town: Town
  /** いま みえて いる はんい。 */
  range: TileRange
  /** タッチした マスへ とぶ。 */
  onJump: (index: number) => void
}

/** まち ぜんたいの ちず。タッチした ばしょへ とべる。 */
export default function TownMap({ town, range, onJump }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const context = canvas.current?.getContext('2d')
    if (context) drawTownMap(context, town, COLS, SCALE)
  }, [town])

  function jump(event: MouseEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    // キーボードで おした ときや おおきさが わからない ときは まんなかへ。
    const inside = rect.width > 0 && rect.height > 0 && event.detail > 0
    const col = inside ? Math.floor(((event.clientX - rect.left) / rect.width) * COLS) : Math.floor(COLS / 2)
    const row = inside ? Math.floor(((event.clientY - rect.top) / rect.height) * ROWS) : Math.floor(ROWS / 2)
    onJump(Math.max(0, Math.min(ROWS - 1, row)) * COLS + Math.max(0, Math.min(COLS - 1, col)))
  }

  const percent = (value: number, total: number) => `${(value / total) * 100}%`
  return <button type="button" className={styles.townMap} onClick={jump} aria-label="ちずを タッチして いどう する">
    <canvas ref={canvas} width={COLS * SCALE} height={ROWS * SCALE} aria-hidden="true" />
    <span className={styles.townMapHere} aria-hidden="true" style={{
      left: percent(range.col0, COLS),
      top: percent(range.row0, ROWS),
      width: percent(range.col1 - range.col0 + 1, COLS),
      height: percent(range.row1 - range.row0 + 1, ROWS),
    }} />
  </button>
}

import type { Ref } from 'react'
import { BALL_RADIUS } from './boardLayout'
import type { PinballFlag } from './types'
import styles from './FlagBall.module.css'

type FlagBallProps = {
  flag: PinballFlag
  /** 直径(px)。省略時は論理座標の BALL_RADIUS*2 */
  size?: number
  className?: string
  /** 盤面上のボール（transform を外部から書き込む）用に ref を受ける */
  ref?: Ref<HTMLDivElement>
}

/** 国旗ボールの直径（論理座標）。BALL_RADIUS は半径なので2倍する */
const DEFAULT_SIZE = BALL_RADIUS * 2

/**
 * 国旗そのものに見える球。
 * 「丸の中に小さい四角い国旗」ではなく、丸自体が国旗である見た目にするため、
 * img を正方形いっぱいに object-fit: fill で引き伸ばしてから円形にクロップする。
 * 国旗SVGは 4:3 なので、cover だと左右が切れて縞・十字などの模様が消える国が出てしまう
 * （例: フランスは左右の青・赤が切れて白一色に近く見える）。fill で縦横比を崩してでも
 * 模様の特徴を丸の中に必ず残す方を優先する（ボールとしての「らしさ」より視認性を取る）。
 */
export default function FlagBall({ flag, size, className, ref }: FlagBallProps) {
  const diameter = size ?? DEFAULT_SIZE
  return (
    <div
      ref={ref}
      className={[styles.ball, className].filter(Boolean).join(' ')}
      style={{ width: diameter, height: diameter }}
    >
      <img
        className={styles.flagImage}
        src={import.meta.env.BASE_URL + flag.flag}
        alt=""
        draggable={false}
      />
      <span className={styles.highlight} aria-hidden="true" />
    </div>
  )
}

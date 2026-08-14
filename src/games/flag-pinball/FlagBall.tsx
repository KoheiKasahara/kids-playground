import type { CSSProperties, Ref } from 'react'
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

/** public/flags/*.svg の viewBox（640×480）から導出した表示補正値。 */
const FLAG_SVG_ASPECT_RATIO = 4 / 3
const FLAG_IMAGE_SCALE_STYLE = {
  '--flag-scale-x': Math.sqrt(FLAG_SVG_ASPECT_RATIO),
  '--flag-scale-y': FLAG_SVG_ASPECT_RATIO,
} as CSSProperties

/**
 * 国旗そのものに見える球。
 * 「丸の中に小さい四角い国旗」ではなく、丸自体が国旗である見た目にするため、
 * img のビューポートを正方形にしてから円形にクロップする。
 * ただし SVG の preserveAspectRatio の既定値は xMidYMid meet なので、object-fit: fill だけでは
 * 4:3 の絵が正方形ビューポート内で上下にレターボックス表示される。そこで、4:3 から
 * scale(sqrt(4/3), 4/3) を導出して画像だけを補正する。縦は正方形いっぱいにし、横は
 * 左右を最小限（約7.7%ずつ）クロップする折衷で、cover（左右25%クロップ）より模様を残す。
 * 国旗SVG自体を正方形へ完全に引き伸ばすより歪みを抑えつつ、上下の白い帯をなくす。
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
        style={FLAG_IMAGE_SCALE_STYLE}
      />
      <span className={styles.highlight} aria-hidden="true" />
    </div>
  )
}

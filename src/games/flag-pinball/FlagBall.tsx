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
 * img のビューポートを正方形にしてから円形にクロップする。
 * 4:3 の国旗を正方形へ収める方法は CSS 側（object-fit: cover）に任せている。
 * cover は等方の拡大＋クロップなので国旗の縦横比が変わらず、丸い意匠も真円のまま保たれる。
 */
export default function FlagBall({ flag, size, className, ref }: FlagBallProps) {
  const diameter = size ?? DEFAULT_SIZE
  // 端に意匠がある国旗だけ、左右のクロップ位置をずらす（既定はCSSの center）
  const objectPosition =
    flag.ballPositionX === undefined ? undefined : `${flag.ballPositionX * 100}% 50%`
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
        style={objectPosition ? { objectPosition } : undefined}
      />
      <span className={styles.highlight} aria-hidden="true" />
    </div>
  )
}

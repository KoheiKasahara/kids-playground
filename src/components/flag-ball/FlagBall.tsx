import type { Ref } from 'react'
import type { FlagBallData } from './flagBalls'
import styles from './FlagBall.module.css'

type FlagBallProps = {
  flag: FlagBallData
  /** 直径(px)。省略時は、選択画面などの単体表示に合わせた48px */
  size?: number
  className?: string
  /** 盤面上のボール（transform を外部から書き込む）用に ref を受ける */
  ref?: Ref<HTMLDivElement>
}

/**
 * 単体で使う国旗ボールの既定直径。
 * 物理盤面の座標や半径を共通部品が知ると、別ゲームの座標系を巻き込んでしまうため、
 * 選択画面でも十分に模様を見分けられる48pxを部品自身の値として持たせる。
 * ピンボール盤面のボールは、物理半径との一致を優先して呼び出し側から明示する。
 */
const DEFAULT_FLAG_BALL_SIZE = 48

/**
 * 国旗そのものに見える球。
 * 「丸の中に小さい四角い国旗」ではなく、丸自体が国旗である見た目にするため、
 * img のビューポートを正方形にしてから円形にクロップする。
 * 4:3 の国旗を正方形へ収める方法は CSS 側（object-fit: cover）に任せている。
 * cover は等方の拡大＋クロップなので国旗の縦横比が変わらず、丸い意匠も真円のまま保たれる。
 */
export default function FlagBall({ flag, size, className, ref }: FlagBallProps) {
  const diameter = size ?? DEFAULT_FLAG_BALL_SIZE
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

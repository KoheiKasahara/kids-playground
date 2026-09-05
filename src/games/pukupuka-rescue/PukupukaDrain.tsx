import type { DrainDefinition } from './types'
import styles from './PukupukaRescuePlay.module.css'

// せん/排水（#516）の見た目と入力だけを持つコンポーネント。じゃぐち（PukupukaFaucet）と同じ形で、
// 排水そのもの（水位が下がる処理）は pukupukaGame.ts 側の純粋な関数が持つ。
//
// じゃぐちが「押している間だけ」の入力なのに対し、せんは「タップで開閉」の単純なトグルにする。
// 幼児には「押しっぱなし」より「押したら開いた/閉じた」のほうが見た目の変化と操作の対応が
// 分かりやすいため。タップ領域はfaucetと同じく本物の<button>にし、見た目より広めに取る。

const HIT_WIDTH = 22
const HIT_HEIGHT = 22

type Props = {
  drain: DrainDefinition
  /** 開いている（＝排水中）かどうか。見た目（栓・渦・あわ）に反映する。 */
  open: boolean
  disabled: boolean
  onToggle: () => void
}

export default function PukupukaDrain({ drain, open, disabled, onToggle }: Props) {
  return (
    <g data-testid="pukupuka-drain" data-drain-open={open}>
      <g aria-hidden="true" transform={`translate(${drain.x} ${drain.y})`}>
        {/* 排水口のふち。閉じていても常にここが「排水口」だと分かるようにしておく。 */}
        <ellipse cx="0" cy="0" rx="6.4" ry="2.6" fill="#37546b" />
        <ellipse cx="0" cy="-0.4" rx="5.2" ry="2" fill={open ? '#0b3350' : '#6d8aa3'} />
        {open ? (
          <>
            {/* 渦を表す点線の輪。回転アニメーションで「吸い込まれている」感じを出す。 */}
            <ellipse
              className={styles.drainSwirl}
              cx="0"
              cy="-0.4"
              rx="3.1"
              ry="1.2"
              fill="none"
              stroke="#ffffff"
              strokeWidth="0.7"
              strokeDasharray="2.2 1.6"
              opacity="0.9"
            />
            <circle className={styles.drainBubbleA} cx="-2.8" cy="-2.6" r="0.7" fill="#ffffff" opacity="0.75" />
            <circle className={styles.drainBubbleB} cx="3" cy="-2.3" r="0.55" fill="#ffffff" opacity="0.7" />
          </>
        ) : (
          // 閉じているときは栓のふたで穴をふさいで見せる。オレンジはじゃぐちのハンドルOFFより
          // 目立たせつつ、じゃぐち(緑/グレー)とは色を変えて役割の違いを見た目でも分ける。
          <ellipse cx="0" cy="-0.6" rx="4" ry="1.5" fill="#ff922b" stroke="#e8590c" strokeWidth="0.6" />
        )}
      </g>
      <foreignObject
        x={drain.x - HIT_WIDTH / 2}
        y={drain.y - HIT_HEIGHT * 0.7}
        width={HIT_WIDTH}
        height={HIT_HEIGHT}
      >
        <button
          type="button"
          className={styles.drainHit}
          disabled={disabled}
          aria-label={open ? 'せん。あけています。みずが ぬけています' : 'せん。おすと みずが ぬけます'}
          aria-pressed={open}
          onClick={onToggle}
        />
      </foreignObject>
    </g>
  )
}

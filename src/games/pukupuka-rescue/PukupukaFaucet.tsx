import { useRef } from 'react'
import type { FaucetDefinition } from './types'
import styles from './PukupukaRescuePlay.module.css'

// じゃぐちの見た目と入力だけを持つコンポーネント。注水そのもの（水位が上がる処理）は
// pukupukaGame.ts側の純粋な関数が持つため、ここは「押している間だけ」の入力を
// そのまま親（PukupukaRescuePlay）へ伝え、状態に応じた見た目（ハンドルの色・水の線）を出すだけにする。
//
// タップ領域は本物の<button>にし、ステージ座標のままforeignObjectで置く。
// これによりビジュアルと当たり判定が同じ2D座標系のまま揃い、SVGの拡大縮小に追従する。
// 見た目より広めに取る（幼児のタップは正確な位置に当たりにくいため）。

const HIT_WIDTH = 18
const HIT_HEIGHT = 27

type Props = {
  faucet: FaucetDefinition
  /** 押されている（＝注水中）かどうか。見た目（ハンドル色・水の線）に反映する。 */
  active: boolean
  disabled: boolean
  /** 注ぐ先の水域の現在の水面Y。水の線をここで止める。 */
  surfaceY: number
  onHoldStart: () => void
  onHoldEnd: () => void
  onTap: () => void
}

export default function PukupukaFaucet({
  faucet,
  active,
  disabled,
  surfaceY,
  onHoldStart,
  onHoldEnd,
  onTap,
}: Props) {
  // WaterButtonと同じ理由: 指で押した直後に発火するclickと、tapによる1回ぶんの操作が
  // 二重に動かないよう、直前がポインタ操作だったかを覚えておく。
  const pointerActivatedRef = useRef(false)

  const handlePointerDown = () => {
    pointerActivatedRef.current = true
    onHoldStart()
  }

  const handleClick = () => {
    if (pointerActivatedRef.current) {
      pointerActivatedRef.current = false
      return
    }
    onTap()
  }

  // 吐水口（見た目上の取り付け根もとから少し下）から、現在の水面までを水の線にする。
  const spoutTipY = faucet.y + 15
  const streamBottom = Math.max(surfaceY, spoutTipY)
  const showStream = active && streamBottom - spoutTipY > 0.5

  return (
    <g data-testid="pukupuka-faucet" data-faucet-active={active}>
      <g aria-hidden="true" transform={`translate(${faucet.x} ${faucet.y})`}>
        {/* 壁の取り付け座と、L字のパイプ */}
        <ellipse cx="-8" cy="5" rx="2.6" ry="5.2" fill="url(#pukupuka-chrome)" stroke="#5f7d89" strokeWidth="0.7" />
        <path d="M-8 5 H-2 Q0 5 0 8 V12" fill="none" stroke="#5f7d89" strokeWidth="5.6" strokeLinecap="round" />
        <path d="M-8 5 H-2 Q0 5 0 8 V12" fill="none" stroke="url(#pukupuka-chrome)" strokeWidth="4.4" strokeLinecap="round" />
        <path d="M-7.6 3.6 H-2 Q0.9 3.6 0.9 7.6" fill="none" stroke="#ffffff" strokeWidth="1" strokeLinecap="round" opacity="0.9" />
        {/* 吐水口 */}
        <rect x="-3.6" y="10" width="7.2" height="4.6" rx="2" fill="url(#pukupuka-chrome)" stroke="#5f7d89" strokeWidth="0.6" />
        <ellipse cx="0" cy="14.4" rx="2.4" ry="0.7" fill="#3b5561" />
        <rect x="-1.2" y="0" width="2.4" height="6" rx="0.8" fill="#8fa9b4" />
        {/* ハンドル。ON/OFFで色を変え、押しているあいだだけ回る見た目にする。 */}
        <g className={active ? styles.faucetHandleOn : undefined}>
          <path d="M-5.6 -3 H5.6 M0 -8.6 V2.6" stroke="#5f7d89" strokeWidth="2.6" strokeLinecap="round" />
          <path d="M-5.6 -3 H5.6 M0 -8.6 V2.6" stroke={active ? '#69db7c' : '#4dc3e0'} strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="0" cy="-3" r="3.4" fill={active ? '#51cf66' : '#22b8cf'} stroke="#495057" strokeWidth="0.6" />
          <path d="M-1.6 -3 H1.6 M0 -4.6 V-1.4" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" />
          <circle cx="-1" cy="-4.2" r="0.7" fill="#ffffff" opacity="0.7" />
        </g>
        {!active && !disabled ? <circle className={styles.faucetHint} cx="0" cy="-3" r="6.6" fill="none" stroke="#22b8cf" strokeWidth="0.8" strokeDasharray="1.8 1.4" /> : null}
        {showStream ? (
          <>
            <line x1="0" y1="14.6" x2="0" y2={streamBottom - faucet.y} stroke="#a5d8ff" strokeWidth="3.4" strokeLinecap="round" opacity="0.7" />
            <line
              className={styles.faucetStream}
              x1="0"
              y1="15"
              x2="0"
              y2={streamBottom - faucet.y}
              stroke="#4dabf7"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <ellipse
              className={styles.faucetSplash}
              cx="0"
              cy={streamBottom - faucet.y}
              rx="4"
              ry="1.3"
              fill="#ffffff"
              opacity="0.75"
            />
          </>
        ) : null}
      </g>
      <foreignObject x={faucet.x - HIT_WIDTH / 2} y={faucet.y - 9} width={HIT_WIDTH} height={HIT_HEIGHT}>
        <button
          type="button"
          className={styles.faucetHit}
          disabled={disabled}
          aria-label={active ? 'じゃぐち。みずが でています' : 'じゃぐち。おしているあいだ みずが でます'}
          aria-pressed={active}
          onPointerDown={handlePointerDown}
          onPointerUp={onHoldEnd}
          onPointerLeave={onHoldEnd}
          onPointerCancel={onHoldEnd}
          onClick={handleClick}
        />
      </foreignObject>
    </g>
  )
}

import { useId } from 'react'
import type { CarVariant } from '../toyLayout'
import styles from './carTheme.module.css'

/**
 * 車toyの絵。120×120のtoyVisualボックスにそのまま重なるviewBox(0 0 120 120)で描く。
 *
 * carToy.tsの複合Collider（胴体: 中心y=68・幅100・高さ34 / 屋根: 中心(60,44)・半径22）と
 * ほぼ同じ輪郭になるよう、どの車種も「x=8〜112の胴体」「x=30〜96・上端y≈24のキャビン」に
 * 収めてある。絵は常に右向き（前が右）で描き、左向きはCSSのscaleX(-1)で反転する。
 */

type CarPalette = {
  readonly light: string
  readonly main: string
  readonly dark: string
  readonly outline: string
}

const PALETTES: Record<CarVariant, CarPalette> = {
  sedan: { light: '#ff9a7a', main: '#ef3b36', dark: '#b8201f', outline: '#7c1414' },
  bus: { light: '#ffe785', main: '#ffc21f', dark: '#e59a00', outline: '#8a5a00' },
  police: { light: '#6f86b8', main: '#2a3f73', dark: '#172649', outline: '#0d1733' },
}

function Wheel({ cx }: { cx: number }) {
  return (
    <g>
      <circle cx={cx} cy={88} r={13} fill="#20242c" />
      <circle cx={cx} cy={88} r={11} fill="#2f343e" />
      <g className={styles.carWheelSpin}>
        <circle cx={cx} cy={88} r={6.5} fill="#dfe6ef" stroke="#8b96a6" strokeWidth={1.2} />
        <path
          d={`M${cx - 5} ${88}H${cx + 5}M${cx} ${83}V${93}`}
          stroke="#8b96a6"
          strokeWidth={1.6}
          strokeLinecap="round"
        />
        <circle cx={cx} cy={88} r={2} fill="#5d6776" />
      </g>
    </g>
  )
}

function Headlight() {
  return (
    <g>
      <ellipse cx={108} cy={66} rx={6} ry={5} fill="#fff6b0" opacity={0.55} className={styles.carBeam} />
      <ellipse cx={108.5} cy={66} rx={3.2} ry={4.2} fill="#fff9d6" stroke="#e8b400" strokeWidth={1.2} />
    </g>
  )
}

function TailLight() {
  return <rect x={8} y={62} width={4.5} height={8} rx={2} fill="#ff4b4b" stroke="#a31717" strokeWidth={1} />
}

function Bumpers() {
  return (
    <g fill="#dfe5ec" stroke="#8791a0" strokeWidth={1}>
      <rect x={103} y={76} width={12} height={6} rx={3} />
      <rect x={5} y={76} width={11} height={6} rx={3} />
    </g>
  )
}

function Shadow() {
  return <ellipse cx={60} cy={101} rx={50} ry={5} fill="rgba(20, 24, 32, 0.28)" />
}

function Sedan({ gid, palette, police }: { gid: string; palette: CarPalette; police: boolean }) {
  return (
    <>
      {/* キャビン（屋根）。胴体より先に描き、胴体の上辺で下端を隠す。 */}
      <path
        d="M30 58 L42 32 Q45 26 52 26 L76 26 Q83 26 86 32 L98 58 Z"
        fill={`url(#${gid}-body)`}
        stroke={palette.outline}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {/* 胴体。前（右）を少し低く・丸くしてボンネットに見せる。 */}
      <path
        d="M8 70 Q8 56 22 55 L96 54 Q110 55 113 66 L114 78 Q114 86 106 86 L16 86 Q8 86 8 78 Z"
        fill={`url(#${gid}-body)`}
        stroke={palette.outline}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {police && (
        // パトカーの白いドア帯
        <path d="M24 64 L100 64 L100 84 L24 84 Z" fill="#f7f9fc" stroke="#c9d1dc" strokeWidth={1} />
      )}
      {/* 窓 */}
      <path d="M37 55 L46 35 Q48 31 52 31 L61 31 L61 55 Z" fill={`url(#${gid}-glass)`} stroke={palette.outline} strokeWidth={1.4} />
      <path d="M65 31 L76 31 Q80 31 82 35 L92 55 L65 55 Z" fill={`url(#${gid}-glass)`} stroke={palette.outline} strokeWidth={1.4} />
      <path d="M47 50 L53 36" stroke="#ffffff" strokeWidth={2.4} strokeLinecap="round" opacity={0.75} />
      <path d="M70 50 L74 38" stroke="#ffffff" strokeWidth={2} strokeLinecap="round" opacity={0.6} />
      {/* ドアの境目と取っ手 */}
      <path d="M63 58 L63 82" stroke={police ? '#aab4c2' : palette.outline} strokeWidth={1.4} opacity={0.6} />
      <rect x={52} y={63} width={7} height={2.6} rx={1.3} fill={police ? '#8a95a5' : palette.outline} opacity={0.7} />
      <rect x={70} y={63} width={7} height={2.6} rx={1.3} fill={police ? '#8a95a5' : palette.outline} opacity={0.7} />
      {/* 胴体のツヤ */}
      <path d="M18 60 Q40 57 60 57" stroke="#ffffff" strokeWidth={2.4} strokeLinecap="round" opacity={0.45} fill="none" />
      {police && (
        <>
          {/* 屋根の上の赤・青ランプ（交互に点滅） */}
          <rect x={52} y={20} width={24} height={6} rx={2} fill="#dfe5ec" stroke="#6b7482" strokeWidth={1} />
          <rect x={53} y={15} width={10} height={7} rx={3} fill="#ff3b3b" stroke="#9e1313" strokeWidth={1} className={styles.carSirenRed} />
          <rect x={65} y={15} width={10} height={7} rx={3} fill="#3b7bff" stroke="#123e9e" strokeWidth={1} className={styles.carSirenBlue} />
          {/* ドアの星マーク */}
          <path
            d="M44 68 L45.8 72.2 L50.2 72.4 L46.8 75.2 L48 79.4 L44 77 L40 79.4 L41.2 75.2 L37.8 72.4 L42.2 72.2 Z"
            fill="#ffc21f"
            stroke="#a07100"
            strokeWidth={0.8}
          />
        </>
      )}
    </>
  )
}

function Bus({ gid, palette }: { gid: string; palette: CarPalette }) {
  return (
    <>
      {/* 丸みのあるミニバス。屋根はColliderの円形キャビンに合わせて角を大きく丸める。 */}
      <path
        d="M8 78 L8 44 Q8 26 28 25 L88 24 Q102 24 108 40 L113 60 Q115 66 114 72 L114 80 Q114 86 107 86 L15 86 Q8 86 8 78 Z"
        fill={`url(#${gid}-body)`}
        stroke={palette.outline}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {/* 腰の黒いライン */}
      <rect x={9} y={62} width={104} height={4} fill="#3a3a3a" opacity={0.75} />
      {/* 横の窓3つ＋運転席の大きな窓 */}
      <g fill={`url(#${gid}-glass)`} stroke={palette.outline} strokeWidth={1.4}>
        <rect x={16} y={33} width={18} height={20} rx={4} />
        <rect x={39} y={33} width={18} height={20} rx={4} />
        <rect x={62} y={33} width={18} height={20} rx={4} />
        <path d="M86 32 L94 32 Q100 32 103 40 L108 55 L86 55 Z" />
      </g>
      <g stroke="#ffffff" strokeLinecap="round" opacity={0.7}>
        <path d="M21 49 L26 37" strokeWidth={2.2} />
        <path d="M44 49 L49 37" strokeWidth={2.2} />
        <path d="M67 49 L72 37" strokeWidth={2.2} />
        <path d="M91 51 L95 38" strokeWidth={2.2} />
      </g>
      {/* 屋根のツヤ */}
      <path d="M22 29 Q55 27 86 28" stroke="#ffffff" strokeWidth={2.4} strokeLinecap="round" opacity={0.55} fill="none" />
      {/* 行き先表示のかわりの小さな丸いマーク */}
      <circle cx={48} cy={74} r={5} fill="#ffffff" stroke={palette.outline} strokeWidth={1.2} />
      <path d="M45.5 74 L47.3 76 L50.8 72" stroke="#2fa84f" strokeWidth={1.6} fill="none" strokeLinecap="round" />
    </>
  )
}

export type CarToyArtProps = {
  readonly variant?: CarVariant
}

export default function CarToyArt({ variant = 'sedan' }: CarToyArtProps) {
  // 同じ盤面に複数の車が並ぶため、グラデーションidは車ごとに一意にする。
  const gid = `car${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const palette = PALETTES[variant]

  return (
    <svg
      className={styles.carArt}
      data-car-variant={variant}
      viewBox="0 0 120 120"
      width="100%"
      height="100%"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`${gid}-body`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={palette.light} />
          <stop offset="0.55" stopColor={palette.main} />
          <stop offset="1" stopColor={palette.dark} />
        </linearGradient>
        <linearGradient id={`${gid}-glass`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f4fbff" />
          <stop offset="0.6" stopColor="#a9d6f5" />
          <stop offset="1" stopColor="#6aa3d4" />
        </linearGradient>
      </defs>
      <Shadow />
      <g className={styles.carBodyGroup}>
        {variant === 'bus' ? <Bus gid={gid} palette={palette} /> : <Sedan gid={gid} palette={palette} police={variant === 'police'} />}
        <Bumpers />
        <TailLight />
        <Headlight />
      </g>
      <Wheel cx={variant === 'bus' ? 30 : 32} />
      <Wheel cx={variant === 'bus' ? 92 : 89} />
    </svg>
  )
}

import { useId } from 'react'
import { FAN_ANGLES, type PartTypeId } from './partTypes'
import styles from './AirToyShape.module.css'

type AirToyShapeProps = {
  typeId: PartTypeId
  variant: 'placed' | 'selected' | 'dragging' | 'ghost'
}

/** センサー型のおもちゃ。板用の背景・枠を使わず、形そのものに陰影を付ける。 */
export default function AirToyShape({ typeId, variant }: AirToyShapeProps) {
  // 盤面・トレー・ドラッグ見本が同時に存在してもグラデーションを共有しない。
  const id = useId()
  const shell = `${id}-shell`
  const inset = `${id}-inset`
  const bubble = `${id}-bubble`
  const isFan = typeId in FAN_ANGLES
  const isLift = typeId === 'bubbleLift'
  const isWarpIn = typeId === 'warpIn'
  const isWarm = typeId === 'warpOut'
  const edge = isWarm ? '#b96508' : isFan || isLift ? '#0c8595' : '#3154ac'
  const light = isWarm ? '#ffe08a' : isFan || isLift ? '#99e9f2' : '#a5c8ff'
  const mid = isWarm ? '#ffb703' : isFan || isLift ? '#22b8cf' : '#6694ef'
  const dark = isWarm ? '#e67700' : isFan || isLift ? '#1098aa' : '#4263c7'

  return (
    <svg aria-hidden="true" viewBox="-30 -30 60 60" className={styles.toy} data-variant={variant}>
      <defs>
        <linearGradient id={shell} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={light} />
          <stop offset=".52" stopColor={mid} />
          <stop offset="1" stopColor={dark} />
        </linearGradient>
        <linearGradient id={inset} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={edge} />
          <stop offset="1" stopColor={mid} />
        </linearGradient>
        <radialGradient id={bubble} cx=".32" cy=".25" r=".8">
          <stop offset="0" stopColor="#ffffff" stopOpacity=".95" />
          <stop offset=".6" stopColor="#d3f9ff" stopOpacity=".85" />
          <stop offset="1" stopColor="#66d9e8" />
        </radialGradient>
      </defs>
      {isFan ? (
        <g
          data-fan-direction={typeId === 'fanLeft' ? 'left' : 'right'}
          transform={typeId === 'fanLeft' ? 'scale(-1 1)' : undefined}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="-16" y="11" width="12" height="11" rx="4" fill={`url(#${shell})`} stroke={edge} strokeWidth="2" />
          <rect x="-23" y="19" width="26" height="7" rx="3.5" fill={`url(#${shell})`} stroke={edge} strokeWidth="2" />
          <circle cx="-10" cy="-3" r="17" fill={`url(#${shell})`} stroke={edge} strokeWidth="2" />
          <circle cx="-10" cy="-3" r="12.5" fill={`url(#${inset})`} stroke="#c5f6fa" strokeWidth="1.5" />
          {[0, 120, 240].map(angle => (
            <path key={angle} transform={`rotate(${angle} -10 -3)`} d="M-10 -3C-17 -5 -18 -12 -12 -14C-6 -15 -5 -8 -10 -3Z" fill="#e3fafc" stroke="#99e9f2" strokeWidth="1" />
          ))}
          <circle cx="-10" cy="-3" r="3.5" fill="#fff3bf" stroke={edge} strokeWidth="1.5" />
          <path d="M-23 -11Q-20 -17 -13 -18" fill="none" stroke="white" strokeOpacity=".7" strokeWidth="2" />
          <path d="M12 -14H23M13 -3H27L22 -8M27 -3L22 2M12 8H23" fill="none" stroke={edge} strokeWidth="2.5" />
        </g>
      ) : isLift ? (
        <g strokeLinecap="round" strokeLinejoin="round">
          <rect x="-14" y="19" width="28" height="7" rx="3.5" fill={`url(#${shell})`} stroke={edge} strokeWidth="2" />
          <ellipse cy="18" rx="8" ry="3" fill={`url(#${inset})`} stroke={edge} strokeWidth="1.5" />
          <circle cy="-5" r="19" fill={`url(#${bubble})`} stroke="#1098aa" strokeWidth="2" />
          <path d="M-14 -11Q-12 -19 -5 -20" fill="none" stroke="white" strokeWidth="3" />
          <path d="M0 6V-12M-7 -5L0 -12L7 -5" fill="none" stroke="#087f8f" strokeWidth="3.5" />
          <circle cx="-20" cy="16" r="4" fill={`url(#${bubble})`} stroke="#22b8cf" strokeWidth="1.5" />
          <circle cx="20" cy="10" r="3" fill={`url(#${bubble})`} stroke="#22b8cf" strokeWidth="1.5" />
        </g>
      ) : (
        <g data-warp-role={isWarpIn ? 'entrance' : 'exit'} strokeLinecap="round" strokeLinejoin="round">
          {isWarpIn ? (
            <>
              {/* 上が広い入口。ボールを受け止めて奥へ吸い込む漏斗の形。 */}
              <path d="M-25 -23Q-25 -27 -20 -27H20Q25 -27 25 -23L16 21Q15 26 10 26H-10Q-15 26 -16 21Z" fill={edge} />
              <path d="M-22 -22H22L14 21H-14Z" fill={`url(#${shell})`} stroke={edge} strokeWidth="2" />
              <path d="M-15 -16H15L9 14H-9Z" fill={`url(#${inset})`} stroke={light} strokeWidth="2" />
              <path d="M-17 -20H7" fill="none" stroke="white" strokeOpacity=".65" strokeWidth="2.5" />
              <path d="M-22 -25Q0 -30 22 -25" fill="none" stroke={light} strokeWidth="2" />
              <ellipse cy="-14" rx="13" ry="5" fill="#172554" fillOpacity=".34" stroke={light} strokeWidth="1.5" />
            </>
          ) : (
            <>
              {/* 下が広い出口。奥から手前へ広がって出てくるラッパの形。 */}
              <path d="M-10 -26Q-15 -26 -16 -21L-25 23Q-25 27 -20 27H20Q25 27 25 23L16 -21Q15 -26 10 -26Z" fill={edge} />
              <path d="M-14 -21H14L22 22H-22Z" fill={`url(#${shell})`} stroke={edge} strokeWidth="2" />
              <path d="M-9 -14H9L15 16H-15Z" fill={`url(#${inset})`} stroke={light} strokeWidth="2" />
              <path d="M-8 -19H8" fill="none" stroke="white" strokeOpacity=".65" strokeWidth="2.5" />
              <path d="M-22 25Q0 30 22 25" fill="none" stroke={light} strokeWidth="2" />
              <ellipse cy="14" rx="13" ry="5" fill="#7c2d12" fillOpacity=".3" stroke={light} strokeWidth="1.5" />
            </>
          )}
        </g>
      )}
    </svg>
  )
}

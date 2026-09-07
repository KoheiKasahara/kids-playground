import { FAN_ANGLES, isAirToy, partDefinition, type PartAppearance, type PartSegment, type PartTypeId } from './partTypes'
import styles from './PartShape.module.css'

/**
 * キャノンの太さは見た目だけを控えめに調整する。
 * 物理Bodyは partTypes の寸法をそのまま使うため、挙動・当たり判定は変わらない。
 */
const CANNON_CHAMBER_SCALE = 1.05
const CANNON_BARREL_THICKNESS_SCALE = 1.12
const CANNON_MUZZLE_THICKNESS_SCALE = 1.08

function visualTransform(segment: PartSegment, appearance: PartAppearance) {
  const visualScale =
    appearance !== 'cannon'
      ? ''
      : segment.role === 'barrel'
        ? ` scaleY(${CANNON_BARREL_THICKNESS_SCALE})`
        : segment.role === 'muzzle'
          ? ` scaleY(${CANNON_MUZZLE_THICKNESS_SCALE})`
          : segment.role === 'chamber'
            ? ` scale(${CANNON_CHAMBER_SCALE})`
            : ''

  return `translate(-50%, -50%) translate(${segment.offsetX}px, ${segment.offsetY}px) rotate(${segment.angleDeg}deg)${visualScale}`
}

type PartShapeProps = {
  typeId: PartTypeId
  /**
   * 見た目の状態。置いたパーツ・選んでいるパーツ・ドラッグ中の分身・
   * 置ける位置の下書き で色を変える。
   */
  variant?: 'placed' | 'selected' | 'dragging' | 'ghost'
  /** 実行中に物理Bodyの角度を書き込む対象。シーソーのデッキだけを回す。 */
  motionRef?: (element: HTMLSpanElement | null) => void
}

/**
 * パーツの見た目。パーツ定義のセグメント（長方形の並び）をそのまま描く。
 * 物理Body（usePuzzleEngine の partBodies）も同じセグメントから作るため、
 * 見た目と当たり判定がずれない。パーツ置き場・盤面・ドラッグ中の分身の
 * すべてがこの1つの部品を使うので、新しいパーツを足しても描画側の変更は要らない。
 *
 * 位置は「アンカーセルの中心」を原点とした相対配置。呼び出し側は、この部品を
 * 1マスぶんの大きさのボックスへ入れるだけでよい。
 */
export default function PartShape({ typeId, variant = 'placed', motionRef }: PartShapeProps) {
  const definition = partDefinition(typeId)
  if (isAirToy(typeId)) {
    const angle = FAN_ANGLES[typeId as keyof typeof FAN_ANGLES] ?? 0
    return <svg aria-hidden="true" viewBox="-30 -30 60 60" className={`${styles.airToy} ${styles[variant]}`}>
      {definition.appearance === 'fan' ? <g transform={`rotate(${angle})`}>
        <rect x="-26" y="-26" width="52" height="52" rx="12" fill="#d9faff" stroke="#199bb1" strokeDasharray="4 3" />
        <circle cx="-13" cy="0" r="12" fill="#43c4ce" stroke="#126e83" strokeWidth="3" />
        <path d="M-20 -7L-6 7M-20 7L-6 -7" stroke="white" strokeWidth="4" />
        <path d="M3 -14H23M3 0H25M3 14H23M18 -6L25 0L18 6" fill="none" stroke="#12889c" strokeWidth="3" />
      </g> : definition.appearance === 'bubbleLift' ? <>
        <circle r="23" fill="#e6faff" stroke="#38bdce" strokeWidth="3" />
        <path d="M-14 -9Q-13 -17 -5 -18" fill="none" stroke="white" strokeWidth="5" />
        <path d="M0 13V-8M-8 0L0 -8L8 0" fill="none" stroke="#2696bb" strokeWidth="4" />
        <circle cx="-16" cy="22" r="5" fill="#8ee8ef" /><circle cx="15" cy="23" r="4" fill="#8ee8ef" />
      </> : <>
        <ellipse rx="22" ry="25" fill={typeId === 'warpIn' ? '#dcedff' : '#fff0ce'} stroke={typeId === 'warpIn' ? '#3974e7' : '#e58918'} strokeWidth="5" />
        <ellipse rx="13" ry="17" fill={typeId === 'warpIn' ? '#497edb' : '#efa13b'} />
        <path d={typeId === 'warpIn' ? 'M0 -12V10M-7 3L0 10L7 3' : 'M0 -10V12M-7 5L0 12L7 5'} stroke="white" strokeWidth="4" fill="none" />
      </>}
    </svg>
  }
  if (definition.appearance === 'jumpRamp') {
    const [deck] = definition.segments
    const styleFor = (offsetX: number, offsetY: number, width: number, height: number) => ({
      width,
      height,
      transform: `translate(-50%, -50%) translate(${offsetX}px, ${offsetY}px) rotate(${deck.angleDeg}deg)`,
    })
    const directionClass = typeId === 'jumpRampRight' ? styles.jumpRampRight : styles.jumpRampLeft
    const direction = typeId === 'jumpRampRight' ? 1 : -1
    return (
      <>
        <span
          className={`${styles.segment} ${styles[variant]} ${styles.jumpRamp} ${styles.jumpRampDeck} ${directionClass}`}
          style={styleFor(deck.offsetX, deck.offsetY, deck.width, deck.height)}
        />
        <span
          className={`${styles.segment} ${styles[variant]} ${styles.jumpRampBase}`}
          style={styleFor(deck.offsetX - direction * 7, deck.offsetY + 17, 42, 10)}
        />
        <span
          className={`${styles.segment} ${styles[variant]} ${styles.jumpRampSpring}`}
          style={styleFor(deck.offsetX - direction * 12, deck.offsetY + 8, 14, 17)}
        />
      </>
    )
  }

  if (definition.appearance === 'seesaw') {
    const deck = definition.segments.find((segment) => segment.role === 'deck')
    if (!deck) return null
    const staticSegments = definition.segments.filter((segment) => segment !== deck)
    const styleFor = (segment: typeof deck) => ({
      width: segment.width,
      height: segment.height,
      transform: `translate(-50%, -50%) translate(${segment.offsetX}px, ${segment.offsetY}px) rotate(${segment.angleDeg}deg)`,
    })
    return (
      <>
        {staticSegments.map((segment, index) => (
          <span
            key={`seesaw-static-${index}`}
            className={`${styles.segment} ${styles[variant]} ${segment.role ? styles[segment.role] : ''}`}
            style={styleFor(segment)}
          />
        ))}
        <span ref={motionRef} className={styles.seesawDeckMotion}>
          <span
            className={`${styles.segment} ${styles[variant]} ${styles.seesawDeck}`}
            style={styleFor(deck)}
          />
        </span>
      </>
    )
  }

  return (
    <>
      {definition.segments.map((segment, index) => (
        <span
          key={index}
          className={`${styles.segment} ${styles[variant]} ${styles[definition.appearance]} ${segment.role ? styles[segment.role] : ''}`}
          style={{
            width: segment.width,
            height: segment.height,
            transform: visualTransform(segment, definition.appearance),
          }}
        />
      ))}
    </>
  )
}

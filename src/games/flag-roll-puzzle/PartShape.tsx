import { partDefinition, type PartAppearance, type PartSegment, type PartTypeId } from './partTypes'
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

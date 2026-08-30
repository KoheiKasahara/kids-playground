import { partDefinition, type PartTypeId } from './partTypes'
import styles from './PartShape.module.css'

type PartShapeProps = {
  typeId: PartTypeId
  /**
   * 見た目の状態。置いたパーツ・選んでいるパーツ・ドラッグ中の分身・
   * 置ける位置の下書き で色を変える。
   */
  variant?: 'placed' | 'selected' | 'dragging' | 'ghost'
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
export default function PartShape({ typeId, variant = 'placed' }: PartShapeProps) {
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
  return (
    <>
      {definition.segments.map((segment, index) => (
        <span
          key={index}
          className={`${styles.segment} ${styles[variant]} ${styles[definition.appearance]} ${segment.role ? styles[segment.role] : ''}`}
          style={{
            width: segment.width,
            height: segment.height,
            transform: `translate(-50%, -50%) translate(${segment.offsetX}px, ${segment.offsetY}px) rotate(${segment.angleDeg}deg)`,
          }}
        />
      ))}
    </>
  )
}

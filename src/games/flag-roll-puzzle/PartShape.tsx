import { partDefinition, type PartTypeId } from './partTypes'
import styles from './PartShape.module.css'

type PartShapeProps = {
  typeId: PartTypeId
  /** 見た目の状態。置いたパーツ・ドラッグ中の分身・置ける位置の下書き で色を変える */
  variant?: 'placed' | 'dragging' | 'ghost'
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
  return (
    <>
      {definition.segments.map((segment, index) => (
        <span
          key={index}
          className={`${styles.segment} ${styles[variant]}`}
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

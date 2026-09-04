import { Link } from 'react-router-dom'
import { BOWLING_STAGES, stagePreview, type BowlingStage } from './bowlingStage'
import styles from './TsumikiBowlingStageSelect.module.css'

type TsumikiBowlingStageSelectProps = {
  onSelect: (stageId: string) => void
}

/**
 * ステージ1枚ぶんの絵。stagePreview()が返す矩形をそのまま<rect>で並べるだけの、
 * 文字を読まなくても形で選べるプレビュー（座標はbowlingStage.ts側で一元管理）。
 */
function StagePreviewImage({ stage }: { stage: BowlingStage }) {
  const preview = stagePreview(stage)
  return (
    <svg
      className={styles.preview}
      viewBox={`0 0 ${preview.width} ${preview.height}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <line
        className={styles.previewGround}
        x1={0}
        y1={preview.groundY}
        x2={preview.width}
        y2={preview.groundY}
      />
      {preview.rects.map((rect, index) => (
        <rect
          key={index}
          x={rect.x}
          y={rect.y}
          width={rect.width}
          height={rect.height}
          rx={0.04}
          fill={`#${rect.color.toString(16).padStart(6, '0')}`}
          opacity={0.55 + rect.depth * 0.45}
        />
      ))}
    </svg>
  )
}

export default function TsumikiBowlingStageSelect({ onSelect }: TsumikiBowlingStageSelectProps) {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link to="/" className={styles.backLink}>
          もどる
        </Link>
        <h1 className={styles.title}>つみきボウリング</h1>
      </header>

      <p className={styles.lead}>どの つみきを たおす？</p>

      <ul className={styles.cards}>
        {BOWLING_STAGES.map((stage) => (
          <li key={stage.id}>
            <button type="button" className={styles.card} onClick={() => onSelect(stage.id)}>
              <StagePreviewImage stage={stage} />
              <span className={styles.cardName}>{stage.name}</span>
              <span className={styles.cardHint}>{stage.hint}</span>
            </button>
          </li>
        ))}
      </ul>
    </main>
  )
}

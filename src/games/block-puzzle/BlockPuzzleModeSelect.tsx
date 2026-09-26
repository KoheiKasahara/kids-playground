import GameBackButton from '../../components/GameBackButton'
import StageClearBadge from '../../components/StageClearBadge'
import { blockPuzzleProgress, readFallingBest } from './progress'
import BlockPiece from './BlockPiece'
import { blockShape } from './blockShapes'
import type { BlockPuzzleMode } from './blockPuzzleModes'
import styles from './BlockPuzzleModeSelect.module.css'

type Props = {
  onSelect: (mode: BlockPuzzleMode) => void
}

/** 選択肢の絵。文字が読めなくても、並んだ形の絵だけで違いが分かるようにする。 */
function FreePreview() {
  return (
    <span className={styles.preview} aria-hidden="true">
      <BlockPiece shape={blockShape('o')} cells={blockShape('o').cells} className={styles.previewPiece} />
      <BlockPiece shape={blockShape('t')} cells={blockShape('t').cells} className={styles.previewPiece} />
      <BlockPiece shape={blockShape('l')} cells={blockShape('l').cells} className={styles.previewPiece} />
    </span>
  )
}

function FallingPreview() {
  return (
    <span className={`${styles.preview} ${styles.previewFalling}`} aria-hidden="true">
      <BlockPiece shape={blockShape('i')} cells={blockShape('i').cells} className={styles.previewPiece} />
      <span className={styles.previewArrow}>⬇️</span>
      <span className={styles.previewStack}>
        <BlockPiece shape={blockShape('duo')} cells={blockShape('duo').cells} className={styles.previewPiece} />
        <BlockPiece shape={blockShape('single')} cells={blockShape('single').cells} className={styles.previewPiece} />
      </span>
    </span>
  )
}

/**
 * ブロックパズルのモードえらび（#711）。
 *
 * ここを入口にしても遊びの入り口がURLごと増えないよう、画面内の切り替えだけで済ませている
 * （選んだあとは BlockPuzzlePlay が対応する画面に差し替える）。
 * 文字を読めない子でも選べるように、ボタンごとに形の絵と大きな絵文字を添えている。
 */
export default function BlockPuzzleModeSelect({ onSelect }: Props) {
  const progress = blockPuzzleProgress.read()
  const fallingBest = readFallingBest()
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <GameBackButton to="/" />
        <h1 className={styles.title}>
          <span aria-hidden="true">🧩</span> ブロックパズル
        </h1>
      </header>

      <p className={styles.lead}>どっちで あそぶ？</p>

      <div className={styles.modes} role="group" aria-label="あそびかたを えらぶ">
        <button
          type="button"
          className={styles.modeButton}
          onClick={() => onSelect('free')}
          aria-label="じゆうに ならべる を えらぶ"
        >
          <span className={styles.modeIcon} aria-hidden="true">
            🧩
          </span>
          <span className={styles.modeName}>じゆうに ならべる</span>
          <FreePreview />
          <span className={styles.modeHint}>すきな かたちを すきな ばしょに おけるよ</span>
          <StageClearBadge stars={progress.free ?? 0} />
        </button>

        <button
          type="button"
          className={styles.modeButton}
          onClick={() => onSelect('falling')}
          aria-label="おちてくる ブロック を えらぶ"
        >
          <span className={styles.modeIcon} aria-hidden="true">
            ⬇️
          </span>
          <span className={styles.modeName}>おちてくる ブロック</span>
          <FallingPreview />
          <span className={styles.modeHint}>ばしょを えらんで つんで、よこ1れつを そろえよう</span>
          <StageClearBadge stars={progress.falling ?? 0} />
          {fallingBest > 0 ? <span className={styles.modeHint}>いちばん: {fallingBest}れつ</span> : null}
        </button>
      </div>
    </main>
  )
}

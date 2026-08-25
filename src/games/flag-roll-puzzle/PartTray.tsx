import type { PointerEvent } from 'react'
import PartShape from './PartShape'
import { TRAY_PART_DEFINITIONS, type PartTypeId } from './partTypes'
import styles from './PartTray.module.css'

type PartTrayProps = {
  /** 選んでいるパーツ（タップで選んで、盤面をタップして置く操作のとき） */
  selectedTypeId: PartTypeId | null
  /** 置ける状態か。実行中は操作させない */
  disabled: boolean
  onPartPointerDown: (typeId: PartTypeId, event: PointerEvent<HTMLButtonElement>) => void
  onPartPointerMove: (event: PointerEvent<HTMLButtonElement>) => void
  onPartPointerUp: (event: PointerEvent<HTMLButtonElement>) => void
  onPartClick: (typeId: PartTypeId) => void
}

/**
 * パーツ置き場。パーツ定義の一覧をそのまま並べるので、種類が増えても
 * ここを書き足す必要はない。
 *
 * 幼児がスマホの指で扱えるよう、1つ1つを大きく（88px以上）取り、
 * 見本は盤面に置いたときと同じ形（PartShape）で見せる。
 * Phase 1では使える数に制限を設けないので、何度でも同じパーツを取り出せる。
 */
export default function PartTray({
  selectedTypeId,
  disabled,
  onPartPointerDown,
  onPartPointerMove,
  onPartPointerUp,
  onPartClick,
}: PartTrayProps) {
  return (
    <section className={styles.tray} aria-label="パーツおきば">
      {TRAY_PART_DEFINITIONS.map((definition) => (
        <button
          key={definition.id}
          type="button"
          className={styles.part}
          data-part-type={definition.id}
          aria-pressed={selectedTypeId === definition.id}
          disabled={disabled}
          onPointerDown={(event) => onPartPointerDown(definition.id, event)}
          onPointerMove={onPartPointerMove}
          onPointerUp={onPartPointerUp}
          onClick={() => onPartClick(definition.id)}
        >
          <span className={styles.preview} aria-hidden="true">
            <PartShape typeId={definition.id} />
          </span>
          <span className={styles.label}>{definition.label}</span>
        </button>
      ))}
    </section>
  )
}

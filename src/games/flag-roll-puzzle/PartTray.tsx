import { useRef, type CSSProperties, type PointerEvent } from 'react'
import PartShape from './PartShape'
import { TRAY_PART_DEFINITIONS, type PartTypeId } from './partTypes'
import styles from './PartTray.module.css'

type PartTrayProps = {
  /** 選んでいるパーツ（タップで選んで、盤面をタップして置く操作のとき） */
  selectedTypeId: PartTypeId | null
  /** 置ける状態か。実行中は操作させない */
  disabled: boolean
  /** 横画面の右ペインでは縦スクロール、左向きドラッグで盤面へ出す */
  isLandscapeLayout: boolean
  availablePartTypeIds?: readonly PartTypeId[]
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
  isLandscapeLayout,
  availablePartTypeIds,
  onPartPointerDown,
  onPartPointerMove,
  onPartPointerUp,
  onPartClick,
}: PartTrayProps) {
  const gestureRef = useRef<{
    pointerId: number
    typeId: PartTypeId
    startX: number
    startY: number
    mode: 'pending' | 'scroll' | 'drag'
  } | null>(null)
  const suppressClickRef = useRef(false)

  const handlePointerDown = (typeId: PartTypeId, event: PointerEvent<HTMLButtonElement>) => {
    gestureRef.current = {
      pointerId: event.pointerId,
      typeId,
      startX: event.clientX,
      startY: event.clientY,
      mode: 'pending',
    }
  }

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return

    if (gesture.mode === 'pending') {
      const dx = event.clientX - gesture.startX
      const dy = event.clientY - gesture.startY
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return

      const scrolling = isLandscapeLayout ? Math.abs(dy) > Math.abs(dx) || dx >= 0 : Math.abs(dx) > Math.abs(dy)
      // 縦画面は横スワイプ、横画面の右ペインは縦スワイプをブラウザ標準の
      // スクロールへ渡す。横画面では左向きだけを「盤面へ持ち出す」と解釈するので、
      // 一覧をスクロールしながら誤ってパーツを置かない。
      if (scrolling) {
        gesture.mode = 'scroll'
        return
      }

      gesture.mode = 'drag'
      onPartPointerDown(gesture.typeId, event)
      return
    }

    if (gesture.mode === 'drag') onPartPointerMove(event)
  }

  const handlePointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    const gesture = gestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    if (gesture.mode === 'drag') onPartPointerUp(event)
    if (gesture.mode === 'scroll') suppressClickRef.current = true
    gestureRef.current = null
  }

  const handleClick = (typeId: PartTypeId) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }
    onPartClick(typeId)
  }

  return (
    <section
      className={styles.tray}
      aria-label="パーツおきば"
      data-testid="part-tray"
      data-layout={isLandscapeLayout ? 'landscape' : 'portrait'}
    >
      {TRAY_PART_DEFINITIONS.filter((definition) => availablePartTypeIds?.includes(definition.id) ?? true).map((definition) => (
        <button
          key={definition.id}
          type="button"
          className={styles.part}
          data-part-type={definition.id}
          aria-pressed={selectedTypeId === definition.id}
          disabled={disabled}
          onPointerDown={(event) => handlePointerDown(definition.id, event)}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => { gestureRef.current = null }}
          onClick={() => handleClick(definition.id)}
        >
          <span
            className={styles.preview}
            aria-hidden="true"
            data-preview-scale={definition.previewScale ?? 1.1}
            style={{
              '--preview-scale': definition.previewScale ?? 1.1,
              '--preview-offset-x': `${definition.previewOffsetX ?? 0}px`,
            } as CSSProperties}
          >
            <PartShape typeId={definition.id} />
          </span>
          <span className={styles.label}>{definition.label}</span>
        </button>
      ))}
    </section>
  )
}

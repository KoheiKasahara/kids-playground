import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { NEUTRAL_TILT, tiltFromStickOffset, type TiltInput } from './tiltInput'
import styles from './VirtualStick.module.css'

export type VirtualStickProps = {
  /** 傾き入力が変わるたびに呼ぶ。指を離したら NEUTRAL_TILT を1回渡す。 */
  onTiltChange: (tilt: TiltInput) => void
  /** ゴール後など、操作を受け付けない状態。 */
  disabled?: boolean
}

/**
 * jsdom（レイアウト計算をしない環境）や、まだレイアウトが確定していない
 * 一瞬でgetBoundingClientRectの幅が0になったときの半径フォールバック(px)。
 */
export const STICK_RADIUS_FALLBACK = 60

type Point = { x: number; y: number }

const CENTER_POINT: Point = { x: 0, y: 0 }

export default function VirtualStick({ onTiltChange, disabled = false }: VirtualStickProps) {
  const activePointerIdRef = useRef<number | null>(null)
  const stickCenterRef = useRef<Point>(CENTER_POINT)
  const stickRadiusRef = useRef<number>(STICK_RADIUS_FALLBACK)
  const onTiltChangeRef = useRef(onTiltChange)
  const [knobOffset, setKnobOffset] = useState<Point>(CENTER_POINT)
  const [isDragging, setIsDragging] = useState(false)

  // ポインタ用のハンドラは再生成したくないので、依存配列にonTiltChangeを
  // 入れず、常に最新の関数をrefから読むようにする。
  useEffect(() => {
    onTiltChangeRef.current = onTiltChange
  }, [onTiltChange])

  // 操作中にdisabledへ切り替わった場合、指を離したのと同じ結果にそろえる。
  // （ゴール直後などで、離す前の傾きが残ってボールが動き続けるのを防ぐ）
  useEffect(() => {
    if (!disabled) return
    if (activePointerIdRef.current === null) return
    activePointerIdRef.current = null
    setIsDragging(false)
    setKnobOffset(CENTER_POINT)
    onTiltChangeRef.current(NEUTRAL_TILT)
  }, [disabled])

  /** 操作終了の後始末。中立へ戻したことを必ず1回だけ通知する。 */
  const finishDrag = useCallback(
    (element: HTMLElement | null, pointerId: number | null) => {
      if (activePointerIdRef.current === null) return
      activePointerIdRef.current = null
      if (element !== null && pointerId !== null) {
        try {
          element.releasePointerCapture?.(pointerId)
        } catch {
          // すでに解放済みのポインタでは例外になるが、後始末は続ける。
        }
      }
      setIsDragging(false)
      setKnobOffset(CENTER_POINT)
      onTiltChangeRef.current(NEUTRAL_TILT)
    },
    [],
  )

  // Pointer Captureが効かない環境でスティックの外へ指が抜けると、
  // pointerupを受け取れず傾きが入りっぱなしになる。ボールが勝手に転がり続けて
  // 幼児が操作不能になるのを防ぐため、window側でも操作終了を必ず拾う。
  useEffect(() => {
    if (!isDragging) return
    const stopDrag = () => finishDrag(null, null)
    window.addEventListener('pointerup', stopDrag)
    window.addEventListener('pointercancel', stopDrag)
    return () => {
      window.removeEventListener('pointerup', stopDrag)
      window.removeEventListener('pointercancel', stopDrag)
    }
  }, [isDragging, finishDrag])

  function applyPointer(clientX: number, clientY: number) {
    const center = stickCenterRef.current
    const radius = stickRadiusRef.current
    const offsetX = clientX - center.x
    const offsetY = clientY - center.y

    // ノブの見た目は半径でクランプした「生」のオフセット。デッドゾーンの内側でも
    // 指に追従して見えることで、幼児にも「触れている」手応えが伝わる。
    const rawMagnitude = Math.hypot(offsetX, offsetY)
    const knobScale = rawMagnitude > radius && rawMagnitude > 0 ? radius / rawMagnitude : 1
    setKnobOffset({ x: offsetX * knobScale, y: offsetY * knobScale })

    onTiltChangeRef.current(tiltFromStickOffset(offsetX, offsetY, radius))
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (disabled) return
    if (activePointerIdRef.current !== null) return
    activePointerIdRef.current = event.pointerId

    // ページのスクロールやリサイズ後でも中心がずれないよう、押した瞬間に測り直す。
    const rect = event.currentTarget.getBoundingClientRect()
    stickCenterRef.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    stickRadiusRef.current = rect.width > 0 ? rect.width / 2 : STICK_RADIUS_FALLBACK

    // jsdomや一部の組み込みブラウザはPointer Captureを持たないため任意呼び出しにする。
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setIsDragging(true)
    applyPointer(event.clientX, event.clientY)
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (activePointerIdRef.current === null) return
    if (event.pointerId !== activePointerIdRef.current) return
    applyPointer(event.clientX, event.clientY)
  }

  function endDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (activePointerIdRef.current === null) return
    if (event.pointerId !== activePointerIdRef.current) return
    finishDrag(event.currentTarget, event.pointerId)
  }

  const knobClassName = isDragging ? styles.knob : `${styles.knob} ${styles.knobResting}`

  return (
    <div
      className={styles.base}
      // プレイ画面側で矢印キー操作を別に用意しているため、これは単なる
      // ポインタ用の見た目であり、スクリーンリーダーには操作可能な要素として
      // 読み上げさせない。
      aria-hidden="true"
      data-testid="virtual-stick"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}
    >
      <div
        className={knobClassName}
        data-testid="virtual-stick-knob"
        style={{ transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)` }}
      />
    </div>
  )
}

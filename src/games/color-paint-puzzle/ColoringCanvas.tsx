import type { KeyboardEvent, MouseEvent, ReactNode, SVGAttributes } from 'react'
import { buildMotionTree, type MotionTreeNode } from './motionTree'
import { areaFillColor } from './paintState'
import type { PaintedAreas } from './paintState'
import type { PaintPhase } from './paintPhase'
import type { PaintAreaId, PaintMotionRef, PaintPicture } from './paintPictures'
import type { PaintShape } from './shapeBounds'
import styles from './ColoringCanvas.module.css'

const OUTLINE_COLOR = '#2b2b2b'
const OUTLINE_WIDTH = 2.4

type ShapeNodeProps = SVGAttributes<SVGElement> & { shape: PaintShape }

// 塗り・輪郭・装飾のいずれからも同じshapeデータで図形を出し分けるための小さな内部ヘルパー。
function ShapeNode({ shape, ...rest }: ShapeNodeProps) {
  if (shape.kind === 'path') return <path d={shape.d} {...rest} />
  if (shape.kind === 'circle') return <circle cx={shape.cx} cy={shape.cy} r={shape.r} {...rest} />
  return <ellipse cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry} {...rest} />
}

/** buildMotionTree に渡す、描画済みJSXと所属グループの組。 */
type CanvasItem = { motion?: PaintMotionRef; element: ReactNode }

function renderMotionTree(nodes: readonly MotionTreeNode<CanvasItem>[]): ReactNode[] {
  return nodes.map((node, index) => {
    if (node.kind === 'item') return node.item.element
    const attributes =
      node.attr === 'group' ? { 'data-motion-group': node.name } : { 'data-motion-part': node.name }
    return (
      // 木は題材データから決まる静的な構造なので、名前とattrでkeyは一意になる。
      <g key={`${node.attr}-${node.name}-${index}`} {...attributes}>
        {renderMotionTree(node.children)}
      </g>
    )
  })
}

export type ColoringCanvasProps = {
  picture: PaintPicture
  painted: PaintedAreas
  onPaintArea: (areaId: PaintAreaId) => void
  /** 'celebrating' の間は塗れず、CSS側のアニメーションが有効になる。 */
  phase: PaintPhase
  /** 直近で塗ったエリア。短いポップ演出を表示するために使う。 */
  feedbackAreaId?: PaintAreaId | null
  /** 同じエリアを続けて塗ったときも演出を再起動するための連番。 */
  feedbackSequence?: number
  className?: string
}

/**
 * ぬりえのSVG描画。塗りが輪郭を崩さないよう、塗りと輪郭を別の要素に分けて描く。
 *
 * - 各エリアについて「塗り（fillだけ、タップ対象）」→「輪郭（同じshapeをfill=noneのstrokeで重ねる）」の
 *   順に、エリア1つずつ交互に描く。自分の塗りが自分の輪郭を覆うことは無く、かつ
 *   後ろのエリア（例: タイヤ）が手前に重なるときは、前のエリアの輪郭が正しく隠れる
 *   （輪郭を全エリア分まとめて最前面に描くと、タイヤの上をボディや地面の線が横切ってしまう）。
 * - 最後に details（目・まど・もよう等の塗れない飾り）を最前面に描く。
 * - 輪郭・装飾はどちらも pointer-events: none なので、タップは必ず塗りレイヤーに届く。
 *
 * 完成演出（phase='celebrating'）でも、この同じSVGとこの同じ `painted` をそのまま描く。
 * 動かすために別の絵へ差し替えたりはしないので、ユーザーが塗った色は必ずそのまま動く。
 * 動きは、題材データの `motion` に従って挿入する `<g data-motion-group>` /
 * `<g data-motion-part>` に対して、CSS（ColoringCanvas.module.css）が与える。
 * この<g>はフェーズによらず常に同じ構造で描くので、演出の開始・終了でSVGが
 * 作り直されず（＝塗りが一瞬消えたりせず）、CSSアニメーションだけが切り替わる。
 */
export default function ColoringCanvas({
  picture,
  painted,
  onPaintArea,
  phase,
  feedbackAreaId = null,
  feedbackSequence = 0,
  className,
}: ColoringCanvasProps) {
  const interactive = phase === 'coloring'

  const handleKeyDown = (event: KeyboardEvent<SVGElement>, areaId: PaintAreaId) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    onPaintArea(areaId)
  }

  // 指でタップした場合、Chromeはtabindex付きのSVG図形にもフォーカスリングを出すため、
  // 塗ったエリアの周りに枠が残って幼児には「なにか選ばれたまま」に見えてしまう。
  // ポインタ操作(detail > 0)のときだけフォーカスを外し、キーボード操作の
  // フォーカスリングは残す。
  const handleClick = (event: MouseEvent<SVGElement>, areaId: PaintAreaId) => {
    if (event.detail > 0) event.currentTarget.blur()
    onPaintArea(areaId)
  }

  const items: CanvasItem[] = []

  for (const area of picture.areas) {
    const showingFeedback = interactive && feedbackAreaId === area.id
    items.push({
      motion: area.motion,
      element: (
        <ShapeNode
          key={`${area.id}-fill-${showingFeedback ? feedbackSequence : 'steady'}`}
          shape={area.shape}
          className={`${interactive ? styles.area : styles.areaLocked} ${showingFeedback ? styles.areaPainted : ''}`}
          data-area-id={area.id}
          data-paint-feedback={showingFeedback ? feedbackSequence : undefined}
          fill={areaFillColor(painted, area.id)}
          // 完成演出中はエリアをボタンとして公開しない（絵ぜんたいが1枚の絵になる）。
          // SVGルート側の role="img" + aria-label は残るので、絵の名前は読み上げられる。
          role={interactive ? 'button' : undefined}
          tabIndex={interactive ? 0 : undefined}
          aria-label={interactive ? area.label : undefined}
          aria-hidden={interactive ? undefined : true}
          onClick={interactive ? (event) => handleClick(event, area.id) : undefined}
          onKeyDown={interactive ? (event) => handleKeyDown(event, area.id) : undefined}
        />
      ),
    })
    items.push({
      motion: area.motion,
      element: (
        <ShapeNode
          key={`${area.id}-outline`}
          shape={area.shape}
          fill="none"
          stroke={OUTLINE_COLOR}
          strokeWidth={OUTLINE_WIDTH}
          strokeLinejoin="round"
          strokeLinecap="round"
          pointerEvents="none"
          aria-hidden="true"
        />
      ),
    })
  }

  picture.details.forEach((detail, index) => {
    items.push({
      motion: detail.motion,
      element: (
        <ShapeNode
          // 装飾は固定順の静的配列で、id等の識別子を持たないためindexをkeyに使う。
          key={`detail-${index}`}
          shape={detail.shape}
          fill={detail.fill ?? 'none'}
          stroke={detail.stroke}
          strokeWidth={detail.strokeWidth}
          strokeLinejoin="round"
          strokeLinecap="round"
          pointerEvents="none"
          aria-hidden="true"
        />
      ),
    })
  })

  return (
    <svg
      className={`${styles.canvas} ${className ?? ''}`}
      role="img"
      aria-label={`${picture.label}の ぬりえ`}
      data-phase={phase}
      aria-describedby={phase === 'coloring' ? 'color-paint-instruction' : undefined}
      viewBox={picture.viewBox}
      preserveAspectRatio="xMidYMid meet"
      width="100%"
      height="100%"
    >
      {renderMotionTree(buildMotionTree(items))}
    </svg>
  )
}

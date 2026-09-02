import { Fragment, type KeyboardEvent, type MouseEvent, type SVGAttributes } from 'react'
import { areaFillColor } from './paintState'
import type { PaintedAreas } from './paintState'
import type { PaintArea, PaintAreaId, PaintPicture } from './paintPictures'
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

export type ColoringCanvasProps = {
  picture: PaintPicture
  painted: PaintedAreas
  onPaintArea: (areaId: PaintAreaId) => void
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
 */
export default function ColoringCanvas({ picture, painted, onPaintArea, className }: ColoringCanvasProps) {
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

  return (
    <svg
      className={className}
      role="img"
      aria-label={`${picture.label}の ぬりえ`}
      viewBox={picture.viewBox}
      preserveAspectRatio="xMidYMid meet"
      width="100%"
      height="100%"
    >
      {picture.areas.map((area: PaintArea) => (
        <Fragment key={area.id}>
          <ShapeNode
            shape={area.shape}
            className={styles.area}
            fill={areaFillColor(painted, area.id)}
            role="button"
            tabIndex={0}
            aria-label={area.label}
            onClick={(event) => handleClick(event, area.id)}
            onKeyDown={(event) => handleKeyDown(event, area.id)}
          />
          <ShapeNode
            shape={area.shape}
            fill="none"
            stroke={OUTLINE_COLOR}
            strokeWidth={OUTLINE_WIDTH}
            strokeLinejoin="round"
            strokeLinecap="round"
            pointerEvents="none"
            aria-hidden="true"
          />
        </Fragment>
      ))}
      {picture.details.map((detail, index) => (
        <ShapeNode
          // 装飾は固定順の静的配列で、id等の識別子を持たないためindexをkeyに使う。
          key={index}
          shape={detail.shape}
          fill={detail.fill ?? 'none'}
          stroke={detail.stroke}
          strokeWidth={detail.strokeWidth}
          pointerEvents="none"
          aria-hidden="true"
        />
      ))}
    </svg>
  )
}

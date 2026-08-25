import type { PointerEvent, RefObject } from 'react'
import FlagBall from '../../components/flag-ball/FlagBall'
import type { FlagBallData } from '../../components/flag-ball/flagBalls'
import {
  BALL_RADIUS,
  BOARD_HEIGHT,
  BOARD_WIDTH,
  CELL_SIZE,
  GOAL_AREA,
  GRID_BOTTOM,
  GRID_HEIGHT,
  GRID_LEFT,
  GRID_TOP,
  GRID_WIDTH,
} from './boardLayout'
import { cellCenter, type GridCell } from './grid'
import PartShape from './PartShape'
import type { PartTypeId } from './partTypes'
import { occupiedCells, type PlacedPart } from './placement'
import styles from './PuzzleBoard.module.css'

type PuzzleBoardProps = {
  parts: readonly PlacedPart[]
  /** 盤面で選んでいるパーツのid。選択枠を出す対象 */
  selectedPartId: string | null
  /** いま指でつまんで動かしているパーツのid。元の場所を薄く見せる */
  draggingPartId: string | null
  flag: FlagBallData
  /** いま置こうとしている場所の下書き。置けない位置のときは null */
  ghost: { readonly typeId: PartTypeId; readonly cell: GridCell } | null
  /** マス目の補助線を濃く出すか（パーツを持っているあいだだけ濃くする） */
  highlightGrid: boolean
  /** ゴール済みか。ゴールを光らせる */
  cleared: boolean
  /** 拡縮の計測対象（盤面を置く領域） */
  containerRef: RefObject<HTMLDivElement | null>
  /** 論理座標の盤面そのもの。ドラッグ位置の逆変換で矩形を測るのに使う */
  boardRef: RefObject<HTMLDivElement | null>
  scale: number
  width: number
  height: number
  registerBall: (el: HTMLElement | null) => void
  onPointerDown?: (event: PointerEvent<HTMLDivElement>) => void
  onPointerMove?: (event: PointerEvent<HTMLDivElement>) => void
  onPointerUp?: (event: PointerEvent<HTMLDivElement>) => void
}

/** 選択枠の位置と大きさ。パーツが占有する全マスをちょうど囲む */
function selectionRingStyle(part: PlacedPart) {
  const cells = occupiedCells(part.typeId, part.cell)
  const cols = cells.map((cell) => cell.col)
  const rows = cells.map((cell) => cell.row)
  return {
    left: GRID_LEFT + Math.min(...cols) * CELL_SIZE,
    top: GRID_TOP + Math.min(...rows) * CELL_SIZE,
    width: (Math.max(...cols) - Math.min(...cols) + 1) * CELL_SIZE,
    height: (Math.max(...rows) - Math.min(...rows) + 1) * CELL_SIZE,
  }
}

/**
 * 2Dゲームボードの見た目。
 * 盤面は論理座標（BOARD_WIDTH×BOARD_HEIGHT）で組み、実機サイズへは
 * 親の transform: scale() だけで合わせる。この部品は状態を持たず、
 * 受け取ったパーツ配置とボール要素の登録先を描くことに徹する。
 */
export default function PuzzleBoard({
  parts,
  selectedPartId,
  draggingPartId,
  flag,
  ghost,
  highlightGrid,
  cleared,
  containerRef,
  boardRef,
  scale,
  width,
  height,
  registerBall,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: PuzzleBoardProps) {
  const selectedPart = parts.find((part) => part.id === selectedPartId) ?? null
  return (
    <div ref={containerRef} className={styles.fit}>
      <div className={styles.stage} style={{ width, height }}>
        <div
          ref={boardRef}
          className={styles.logical}
          style={{ width: BOARD_WIDTH, height: BOARD_HEIGHT, transform: `scale(${scale})` }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          data-testid="puzzle-board"
        >
          <div className={styles.startZone} aria-hidden="true" />

          {/* マス目の補助線。ふだんは薄く、パーツを持っているあいだだけ濃くする */}
          <div
            className={styles.grid}
            data-highlight={highlightGrid ? 'true' : 'false'}
            aria-hidden="true"
            style={{
              left: GRID_LEFT,
              top: GRID_TOP,
              width: GRID_WIDTH,
              height: GRID_HEIGHT,
              backgroundSize: `${CELL_SIZE}px ${CELL_SIZE}px`,
            }}
          />

          {parts.map((part) => {
            const center = cellCenter(part.cell)
            const selected = part.id === selectedPartId
            return (
              <div
                key={part.id}
                className={styles.partSlot}
                style={{ left: center.x, top: center.y }}
                aria-hidden="true"
                data-testid="puzzle-part"
                data-part-type={part.typeId}
                data-cell={`${part.cell.col},${part.cell.row}`}
                data-selected={selected ? 'true' : 'false'}
                data-dragging={part.id === draggingPartId ? 'true' : 'false'}
              >
                <PartShape typeId={part.typeId} variant={selected ? 'selected' : 'placed'} />
              </div>
            )
          })}

          {/*
            選んでいるパーツを囲む枠。占有マス全体を囲むので、Phase 3で
            2〜3マスを使う長い板が増えても同じ描画で正しい範囲を示せる。
          */}
          {selectedPart && selectedPart.id !== draggingPartId ? (
            <div
              className={styles.selectionRing}
              aria-hidden="true"
              data-testid="puzzle-selection"
              style={selectionRingStyle(selectedPart)}
            />
          ) : null}

          {ghost ? (
            <div
              className={styles.partSlot}
              style={{ left: cellCenter(ghost.cell).x, top: cellCenter(ghost.cell).y }}
              aria-hidden="true"
              data-testid="puzzle-ghost"
            >
              <PartShape typeId={ghost.typeId} variant="ghost" />
            </div>
          ) : null}

          <div className={styles.goalBand} aria-hidden="true" style={{ top: GRID_BOTTOM }} />
          <div
            className={styles.goal}
            data-cleared={cleared ? 'true' : 'false'}
            aria-hidden="true"
            style={{ left: GOAL_AREA.x, top: GOAL_AREA.y, width: GOAL_AREA.width, height: GOAL_AREA.height }}
          >
            ゴール
          </div>
          {/*
            usePuzzleEngine は「盤面の原点(0,0)を基準にした transform: translate(x, y)」を
            この要素へ直接書き込む。FlagBall 自体は選択画面などの単体表示でも成立するよう
            position: relative を既定にしているため、絶対配置はこの盤面側のラッパーが持つ
            （こっきピンボールの PinballBoard と同じ分担）。
          */}
          <div ref={registerBall} className={styles.ballSlot} aria-hidden="true" data-testid="puzzle-ball" data-flag-id={flag.id}>
            <FlagBall flag={flag} size={BALL_RADIUS * 2} />
          </div>
        </div>
      </div>
    </div>
  )
}

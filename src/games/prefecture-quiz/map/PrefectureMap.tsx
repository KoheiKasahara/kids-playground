import { Fragment, type KeyboardEvent } from 'react'
import type { Prefecture, RegionId } from '../data/prefectures'
import { prefectures } from '../data/prefectures'
import { createProjection, mergeBounds, pathForGeometry, primaryProjectedBounds, projectedBoundsForGeometry } from './geometry'
import type { Position } from './geometry'
import { displayPiecesForPrefecture, featureForPrefecture } from './features'
import { REGION_INSET_IDS, prefectureNumberInRegion } from '../data/regions'
import { labelPositionsFor } from './labelPlacement'
import styles from './PrefectureMap.module.css'

const allBounds = mergeBounds(prefectures.map((prefecture) => projectedBoundsForGeometry(displayPiecesForPrefecture(prefecture).main)))
const project = createProjection(allBounds, 360, 280, 8)

// 沖縄専用inset（REGION_INSET_IDS）の表示枠。既存レイアウトの座標をそのまま踏襲する。
const OKINAWA_INSET_X = 250
const OKINAWA_INSET_Y = 216
const OKINAWA_INSET_WIDTH = 102
const OKINAWA_INSET_HEIGHT = 56
const OKINAWA_INSET_CENTER: Position = [OKINAWA_INSET_X + OKINAWA_INSET_WIDTH / 2, OKINAWA_INSET_Y + OKINAWA_INSET_HEIGHT / 2]

/**
 * 地方主図のfit高さ。viewBoxは常に360×280だが、沖縄専用inset（REGION_INSET_IDS、
 * 現状は九州・沖縄のみ）がある地方だけは、insetの枠(y=OKINAWA_INSET_Y〜272)と
 * 重ならないよう主図の高さを抑える。それ以外の地方はinsetが無い＝下部に何も
 * 置かないため、viewBoxの全高をそのまま主図に使う（以前あった補助タップ枠
 * レール用の余白は、その仕組みの廃止に伴い不要になった）。
 */
export const REGION_MAP_HEIGHT_WITH_INSET = OKINAWA_INSET_Y + 2 // insetの枠の少し上まで（216+2=218）
export const REGION_MAP_HEIGHT_FULL = 280 // viewBoxの全高

type PrefectureMapProps = {
  answer?: Prefecture
  items?: readonly Prefecture[]
  selectedId?: string | null
  onSelect?: (id: string) => void
  disabled?: boolean
  label?: string
  className?: string
  compact?: boolean
  revealed?: boolean
  /** 地方内の番号バッジを全県に表示するか。回答UIとして使う地方地図でだけtrueにする。 */
  numbered?: boolean
}

function activate(event: KeyboardEvent<SVGElement>, id: string, onSelect?: (id: string) => void) {
  if ((event.key === 'Enter' || event.key === ' ') && onSelect) {
    event.preventDefault()
    onSelect(id)
  }
}

/** 県pathの位置ベースの番号。itemsが単一地方なら地方内の固定番号、そうでなければ表示順。 */
function numberInItems(prefecture: Prefecture, items: readonly Prefecture[], region: RegionId | undefined): number {
  return region ? prefectureNumberInRegion(prefecture) : items.indexOf(prefecture) + 1
}

/** 番号バッジ（円+数字）。pointer-events: none で下の県pathのタップを妨げない。 */
function NumberBadge({ position, number, isCorrectAnswer, isWrongSelection }: { position: Position; number: number; isCorrectAnswer: boolean; isWrongSelection: boolean }) {
  const [x, y] = position
  const classes = [styles.badge, isCorrectAnswer ? styles.badgeCorrect : '', isWrongSelection ? styles.badgeWrong : ''].filter(Boolean).join(' ')
  return (
    <g className={classes} aria-hidden="true" pointerEvents="none">
      <circle cx={x} cy={y} r={10} />
      <text x={x} y={y} textAnchor="middle" dominantBaseline="central">{number}</text>
    </g>
  )
}

/** 日本全体を一つの SVG に描く。各県 path はキーボードでも選択できる。 */
export default function PrefectureMap({ answer, items = prefectures, selectedId, onSelect, disabled = false, label = 'にほんちず', className, compact = false, revealed = false, numbered = false }: PrefectureMapProps) {
  const region = items.length > 0 && items.every((prefecture) => prefecture.region === items[0].region) ? items[0].region : undefined
  const insetIds = region ? REGION_INSET_IDS[region] ?? [] : []
  const mainItems = items.filter((prefecture) => !insetIds.includes(prefecture.id))
  // 東京都・鹿児島県の main piece は伊豆諸島など近い離島を含むため、合計bboxでfitすると
  // 離島の緯度幅に引っ張られて本土側の各県が小さくなる。fit範囲は本土（最大polygon）基準にする。
  const localBounds = mergeBounds(mainItems.map((prefecture) => primaryProjectedBounds(displayPiecesForPrefecture(prefecture).main)))
  const hasDedicatedInset = insetIds.length > 0
  const regionMapHeight = hasDedicatedInset ? REGION_MAP_HEIGHT_WITH_INSET : REGION_MAP_HEIGHT_FULL
  const localProject = items.length === prefectures.length ? project : createProjection(localBounds, 360, regionMapHeight, 14)
  const selectable = Boolean(onSelect)
  const interactive = Boolean(onSelect) && !disabled
  const labelPositions = numbered ? labelPositionsFor(mainItems, localProject) : undefined
  return (
    <svg data-prefecture-map="true" className={[styles.map, compact ? styles.compact : '', className].filter(Boolean).join(' ')} viewBox="0 0 360 280" role="group" aria-label={label}>
      {mainItems.map((prefecture) => {
        const pieces = displayPiecesForPrefecture(prefecture)
        const isAnswer = answer?.id === prefecture.id
        const isSelected = selectedId === prefecture.id
        const classes = [styles.prefecture, isAnswer && selectedId ? styles.correct : '', isSelected && !isAnswer ? styles.wrong : ''].filter(Boolean).join(' ')
        const badgePosition = labelPositions?.get(prefecture.id)
        return (
          <Fragment key={prefecture.id}>
          <path
            d={pathForGeometry(pieces.main, localProject)}
            className={classes}
            fillRule="evenodd"
            role={interactive ? 'button' : undefined}
            tabIndex={interactive ? 0 : -1}
            aria-label={revealed ? prefecture.nameHiragana : interactive ? `${numberInItems(prefecture, items, region)}ばんめ の ばしょを えらぶ` : '都道府県の ばしょ'}
            aria-disabled={interactive ? false : undefined}
            onClick={interactive ? () => onSelect?.(prefecture.id) : undefined}
            onKeyDown={interactive ? (event) => activate(event, prefecture.id, onSelect) : undefined}
          />
          {pieces.insets.map((inset, insetIndex) => (
            <path key={`${prefecture.id}-inset-${insetIndex}`} d={pathForGeometry(inset.geometry, createProjection(projectedBoundsForGeometry(inset.geometry), inset.width, inset.height, 3))} transform={`translate(${inset.x} ${inset.y})`} className={classes} fillRule="evenodd" aria-hidden="true" pointerEvents="none" />
          ))}
          {numbered && badgePosition && (
            <NumberBadge position={badgePosition} number={numberInItems(prefecture, items, region)} isCorrectAnswer={Boolean(isAnswer && selectedId)} isWrongSelection={Boolean(isSelected && !isAnswer)} />
          )}
          </Fragment>
        )
      })}
      {items.filter((prefecture) => insetIds.includes(prefecture.id)).map((prefecture) => {
        const isAnswer = answer?.id === prefecture.id
        const isSelected = selectedId === prefecture.id
        const classes = [styles.prefecture, isAnswer && selectedId ? styles.correct : '', isSelected && !isAnswer ? styles.wrong : ''].filter(Boolean).join(' ')
        const geometry = featureForPrefecture(prefecture).geometry
        const number = numberInItems(prefecture, items, region)
        return <Fragment key={`${prefecture.id}-dedicated-inset`}>
          <rect x={OKINAWA_INSET_X} y={OKINAWA_INSET_Y} width={OKINAWA_INSET_WIDTH} height={OKINAWA_INSET_HEIGHT} rx="5" className={styles.insetFrame} aria-hidden="true" />
          <path d={pathForGeometry(geometry, createProjection(projectedBoundsForGeometry(geometry), 96, 48, 3))} transform={`translate(${OKINAWA_INSET_X + 3} ${OKINAWA_INSET_Y + 4})`} className={classes} fillRule="evenodd" aria-hidden="true" pointerEvents="none" />
          {selectable && <rect x={OKINAWA_INSET_X} y={OKINAWA_INSET_Y} width={OKINAWA_INSET_WIDTH} height={OKINAWA_INSET_HEIGHT} rx="5" className={[styles.hitTarget, isAnswer && selectedId ? styles.correct : '', isSelected && !isAnswer ? styles.wrong : ''].filter(Boolean).join(' ')} role="button" tabIndex={interactive ? 0 : -1} aria-disabled={!interactive} aria-label={revealed ? prefecture.nameHiragana : `${number}ばんめ の ばしょを えらぶ`} onClick={interactive ? () => onSelect?.(prefecture.id) : undefined} onKeyDown={interactive ? (event) => activate(event, prefecture.id, onSelect) : undefined} />}
          {numbered && (
            <NumberBadge position={OKINAWA_INSET_CENTER} number={number} isCorrectAnswer={Boolean(isAnswer && selectedId)} isWrongSelection={Boolean(isSelected && !isAnswer)} />
          )}
        </Fragment>
      })}
    </svg>
  )
}

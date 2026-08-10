import { Fragment, type KeyboardEvent } from 'react'
import type { Prefecture } from '../data/prefectures'
import { prefectures } from '../data/prefectures'
import { createProjection, mergeBounds, pathForGeometry, positionsForGeometry, projectedBoundsForGeometry } from './geometry'
import { displayPiecesForPrefecture, featureForPrefecture } from './features'
import { REGION_INSET_IDS, REGION_TOUCH_TARGET_IDS } from '../data/regions'
import styles from './PrefectureMap.module.css'

const allBounds = mergeBounds(prefectures.map((prefecture) => projectedBoundsForGeometry(displayPiecesForPrefecture(prefecture).main)))
const project = createProjection(allBounds, 360, 280, 8)

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
}

function activate(event: KeyboardEvent<SVGElement>, id: string, onSelect?: (id: string) => void) {
  if ((event.key === 'Enter' || event.key === ' ') && onSelect) {
    event.preventDefault()
    onSelect(id)
  }
}

/** 日本全体を一つの SVG に描く。各県 path はキーボードでも選択できる。 */
export default function PrefectureMap({ answer, items = prefectures, selectedId, onSelect, disabled = false, label = 'にほんちず', className, compact = false, revealed = false }: PrefectureMapProps) {
  const region = items.length > 0 && items.every((prefecture) => prefecture.region === items[0].region) ? items[0].region : undefined
  const insetIds = region ? REGION_INSET_IDS[region] ?? [] : []
  const mainItems = items.filter((prefecture) => !insetIds.includes(prefecture.id))
  const localBounds = mergeBounds(mainItems.map((prefecture) => projectedBoundsForGeometry(displayPiecesForPrefecture(prefecture).main)))
  const localProject = items.length === prefectures.length ? project : createProjection(localBounds, 360, 218, 14)
  const touchIds = region ? REGION_TOUCH_TARGET_IDS[region] ?? [] : []
  const selectable = Boolean(onSelect)
  const interactive = Boolean(onSelect) && !disabled
  return (
    <svg data-prefecture-map="true" className={[styles.map, compact ? styles.compact : '', className].filter(Boolean).join(' ')} viewBox="0 0 360 280" role="group" aria-label={label}>
      {mainItems.map((prefecture, index) => {
        const pieces = displayPiecesForPrefecture(prefecture)
        const isAnswer = answer?.id === prefecture.id
        const isSelected = selectedId === prefecture.id
        const classes = [styles.prefecture, isAnswer && selectedId ? styles.correct : '', isSelected && !isAnswer ? styles.wrong : ''].filter(Boolean).join(' ')
        return (
          <Fragment key={prefecture.id}>
          <path
            d={pathForGeometry(pieces.main, localProject)}
            className={classes}
            fillRule="evenodd"
            role={interactive ? 'button' : undefined}
            tabIndex={interactive ? 0 : -1}
            aria-label={revealed ? prefecture.nameHiragana : interactive ? `${index + 1}ばんめ の ばしょを えらぶ` : '都道府県の ばしょ'}
            aria-disabled={interactive ? false : undefined}
            onClick={interactive ? () => onSelect?.(prefecture.id) : undefined}
            onKeyDown={interactive ? (event) => activate(event, prefecture.id, onSelect) : undefined}
          />
          {pieces.insets.map((inset, insetIndex) => (
            <path key={`${prefecture.id}-inset-${insetIndex}`} d={pathForGeometry(inset.geometry, createProjection(projectedBoundsForGeometry(inset.geometry), inset.width, inset.height, 3))} transform={`translate(${inset.x} ${inset.y})`} className={classes} fillRule="evenodd" aria-hidden="true" pointerEvents="none" />
          ))}
          </Fragment>
        )
      })}
      {items.filter((prefecture) => insetIds.includes(prefecture.id)).map((prefecture) => {
        const isAnswer = answer?.id === prefecture.id
        const isSelected = selectedId === prefecture.id
        const classes = [styles.prefecture, isAnswer && selectedId ? styles.correct : '', isSelected && !isAnswer ? styles.wrong : ''].filter(Boolean).join(' ')
        const geometry = featureForPrefecture(prefecture).geometry
        const insetIndex = items.indexOf(prefecture)
        return <Fragment key={`${prefecture.id}-dedicated-inset`}>
          <rect x="250" y="216" width="102" height="56" rx="5" className={styles.insetFrame} aria-hidden="true" />
          <path d={pathForGeometry(geometry, createProjection(projectedBoundsForGeometry(geometry), 96, 48, 3))} transform="translate(253 220)" className={classes} fillRule="evenodd" aria-hidden="true" pointerEvents="none" />
          {selectable && <><rect x="250" y="216" width="102" height="56" rx="5" className={[styles.hitTarget, isAnswer && selectedId ? styles.correct : '', isSelected && !isAnswer ? styles.wrong : ''].filter(Boolean).join(' ')} role="button" tabIndex={interactive ? 0 : -1} aria-disabled={!interactive} aria-label={revealed ? prefecture.nameHiragana : `${insetIndex + 1}ばんめ の ばしょを えらぶ`} onClick={interactive ? () => onSelect?.(prefecture.id) : undefined} onKeyDown={interactive ? (event) => activate(event, prefecture.id, onSelect) : undefined} /><text x="301" y="248" textAnchor="middle" className={styles.hitTargetText} aria-hidden="true">{isAnswer && selectedId ? '◯' : isSelected ? '✕' : insetIndex + 1}</text></>}
        </Fragment>
      })}
      {touchIds.map((id, index) => {
        const prefecture = mainItems.find((candidate) => candidate.id === id)
        if (!prefecture) return null
        const positions = positionsForGeometry(displayPiecesForPrefecture(prefecture).main).map(localProject)
        const x = (Math.min(...positions.map(([pointX]) => pointX)) + Math.max(...positions.map(([pointX]) => pointX))) / 2
        const y = (Math.min(...positions.map(([, pointY]) => pointY)) + Math.max(...positions.map(([, pointY]) => pointY))) / 2
        return <text key={`${id}-map-marker`} x={x} y={y} textAnchor="middle" dominantBaseline="central" className={styles.mapMarker} aria-hidden="true">{index + 1}</text>
      })}
      {selectable && touchIds.map((id, index) => {
        const prefecture = items.find((candidate) => candidate.id === id)
        if (!prefecture) return null
        const isAnswer = answer?.id === id
        const isSelected = selectedId === id
        return <Fragment key={`${id}-touch-target`}>
          <rect x={8 + index * 116} y="220" width="108" height="52" rx="7" className={[styles.hitTarget, isAnswer && selectedId ? styles.correct : '', isSelected && !isAnswer ? styles.wrong : ''].filter(Boolean).join(' ')} role="button" tabIndex={interactive ? 0 : -1} aria-disabled={!interactive} aria-label={revealed ? prefecture.nameHiragana : `小さい県の ${index + 1}ばんめ`} onClick={interactive ? () => onSelect?.(id) : undefined} onKeyDown={interactive ? (event) => activate(event, id, onSelect) : undefined} />
          <text x={62 + index * 116} y="252" textAnchor="middle" className={styles.hitTargetText} aria-hidden="true">{isAnswer && selectedId ? '◯' : isSelected ? '✕' : index + 1}</text>
        </Fragment>
      })}
    </svg>
  )
}

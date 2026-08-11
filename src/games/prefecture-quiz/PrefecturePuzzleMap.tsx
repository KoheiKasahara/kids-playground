import { Fragment, type DragEvent, type KeyboardEvent } from 'react'
import type { Prefecture, PrefectureId } from './data/prefectures'
import { createProjection, mergeBounds, pathForGeometry, primaryProjectedBounds, projectedBoundsForGeometry } from './map/geometry'
import { displayPiecesForPrefecture } from './map/features'
import { labelPositionsFor } from './map/labelPlacement'
import type { PlacementMap } from './puzzleState'
import styles from './PrefecturePuzzleMap.module.css'

type Props = {
  items: readonly Prefecture[]
  placements: PlacementMap
  selectedPieceId: PrefectureId | null
  checked: boolean
  onTarget: (targetId: PrefectureId) => void
  onDragTarget: (targetId: PrefectureId) => void
}

export default function PrefecturePuzzleMap({ items, placements, selectedPieceId, checked, onTarget, onDragTarget }: Props) {
  const hasOkinawaInset = items.some((item) => item.id === '47')
  const mainItems = hasOkinawaInset ? items.filter((item) => item.id !== '47') : items
  const bounds = mergeBounds(mainItems.map((item) => primaryProjectedBounds(displayPiecesForPrefecture(item).main)))
  const project = createProjection(bounds, 360, 280, 14)
  const labels = labelPositionsFor(mainItems, project, { badgeDiameter: 28, minDistance: 34, maxShift: 28 })
  const byId = new Map(items.map((item) => [item.id, item]))
  const keyActivate = (event: KeyboardEvent<SVGPathElement>, targetId: PrefectureId) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onTarget(targetId) }
  }
  const drop = (event: DragEvent<SVGPathElement>, targetId: PrefectureId) => { event.preventDefault(); onDragTarget(targetId) }
  return <svg className={styles.map} viewBox="0 0 360 280" role="group" aria-label="都道府県パズルの地図">
    {mainItems.map((target) => {
      const placedId = placements[target.id] ?? null
      const placed = placedId ? byId.get(placedId) : undefined
      const position = labels.get(target.id) ?? [180, 140]
      const correct = checked && placedId === target.id
      const wrong = checked && Boolean(placedId) && placedId !== target.id
      return <Fragment key={target.id}>
        <path
          data-puzzle-target={target.id}
          d={pathForGeometry(displayPiecesForPrefecture(target).main, project)}
          className={[styles.prefecture, selectedPieceId ? styles.ready : '', correct ? styles.correct : '', wrong ? styles.wrong : ''].filter(Boolean).join(' ')}
          fillRule="evenodd"
          role="button"
          tabIndex={checked ? -1 : 0}
          aria-label={`${target.nameHiragana}の場所${placed ? `。${placed.nameHiragana}がおいてあります` : ''}`}
          aria-disabled={checked}
          onClick={checked ? undefined : () => onTarget(target.id)}
          onKeyDown={checked ? undefined : (event) => keyActivate(event, target.id)}
          onDragOver={checked ? undefined : (event) => event.preventDefault()}
          onDrop={checked ? undefined : (event) => drop(event, target.id)}
        />
        {placed && <g className={styles.label} pointerEvents="none" aria-hidden="true">
          <rect x={position[0] - 30} y={position[1] - 10} width="60" height="20" rx="8" />
          <text x={position[0]} y={position[1] + 1} textAnchor="middle" dominantBaseline="central">{checked ? target.nameHiragana : placed.nameHiragana}</text>
        </g>}
      </Fragment>
    })}
    {hasOkinawaInset && (() => {
      const target = items.find((item) => item.id === '47')!
      const placedId = placements[target.id] ?? null
      const placed = placedId ? byId.get(placedId) : undefined
      const correct = checked && placedId === target.id
      const wrong = checked && Boolean(placedId) && placedId !== target.id
      const geometry = displayPiecesForPrefecture(target).main
      const insetProject = createProjection(projectedBoundsForGeometry(geometry), 96, 48, 3)
      return <Fragment key={target.id}>
        <rect x="250" y="216" width="102" height="56" rx="5" className={styles.insetFrame} aria-hidden="true" />
        <path d={pathForGeometry(geometry, insetProject)} transform="translate(253 220)" className={styles.prefecture} fillRule="evenodd" pointerEvents="none" aria-hidden="true" />
        <rect data-puzzle-target={target.id} x="250" y="216" width="102" height="56" rx="5" className={[styles.insetHit, selectedPieceId ? styles.ready : '', correct ? styles.correct : '', wrong ? styles.wrong : ''].filter(Boolean).join(' ')} role="button" tabIndex={checked ? -1 : 0} aria-label={`${target.nameHiragana}の場所${placed ? `。${placed.nameHiragana}がおいてあります` : ''}`} aria-disabled={checked} onClick={checked ? undefined : () => onTarget(target.id)} onKeyDown={checked ? undefined : (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onTarget(target.id) } }} onDragOver={checked ? undefined : (event) => event.preventDefault()} onDrop={checked ? undefined : (event) => { event.preventDefault(); onDragTarget(target.id) }} />
        {placed && <g className={styles.label} pointerEvents="none" aria-hidden="true"><rect x="271" y="234" width="60" height="20" rx="8" /><text x="301" y="245" textAnchor="middle" dominantBaseline="central">{checked ? target.nameHiragana : placed.nameHiragana}</text></g>}
      </Fragment>
    })()}
  </svg>
}

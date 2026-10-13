import { useMemo } from 'react'
import type { Species } from './data'
import { creatureImage, imagePaths, SPRITE_H, SPRITE_W } from './sprite'

export default function PixelCreature({ species, className }: { species: Species; className?: string }) {
  const paths = useMemo(() => imagePaths(creatureImage(species.sprite, species.colors)), [species.sprite, species.colors])
  return <svg className={className} viewBox={`0 0 ${SPRITE_W} ${SPRITE_H}`} shapeRendering="crispEdges" aria-hidden="true">
    {paths.map(p => <path key={p.color} fill={p.color} d={p.d} />)}
  </svg>
}

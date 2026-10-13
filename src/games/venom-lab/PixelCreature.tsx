import type { Species } from './data'
import { PIXELS } from './pixelArt'

export default function PixelCreature({ species, className }: { species: Species; className?: string }) {
  const palette: Record<string, string> = { A: species.colors[0], B: species.colors[1], C: species.colors[2], E: '#142634', W: '#fffbea' }
  return <svg className={className} viewBox="0 0 20 16" shapeRendering="crispEdges" aria-hidden="true">
    {PIXELS[species.sprite].flatMap((row, y) => [...row].map((pixel, x) => pixel === '.' ? null :
      <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={palette[pixel]} />))}
  </svg>
}

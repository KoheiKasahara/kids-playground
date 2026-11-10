import { useEffect, useRef } from 'react'
import { mapPixels } from './mapPixels'
import type { World } from './world'
import styles from './BlockCraftPlay.module.css'

type Props = {
  world: World
  /** いま いる ばしょ（カーソルか あるいている ばしょ）。 */
  at: { x: number; z: number }
  /** みつけた たからの かず。かわると しるしを かきなおす。 */
  found: number
}

/** せかいの ちず。まだ みつけていない たからに ✖、いま いる ばしょに ●。 */
export default function CraftMap({ world, at, found }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const context = canvas.current?.getContext('2d')
    if (!context) return
    const draw = () => context.putImageData(new ImageData(mapPixels(world), world.size, world.size), 0, 0)
    draw()
    return world.subscribe(draw)
  }, [world])
  const place = (x: number, z: number) => ({ left: `${(x + 0.5) / world.size * 100}%`, top: `${(z + 0.5) / world.size * 100}%` })
  return <span className={styles.map} data-found={found}>
    <canvas ref={canvas} width={world.size} height={world.size} />
    {world.treasures.map(t => world.isFound(t) ? null
      : <i key={`${t.x},${t.z}`} className={styles.mapTreasure} style={place(t.x, t.z)} data-treasure="">✖</i>)}
    <i className={styles.mapHere} style={place(at.x, at.z)} data-here="" />
  </span>
}

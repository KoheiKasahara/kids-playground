import { SIZE, type Block } from './world'

export type AnimalKind = 'sheep' | 'chicken' | 'rabbit'
export type Cell = { x: number; z: number }
export type Surface = (x: number, z: number) => Block | undefined

/** せかいを うろうろ する どうぶつ（ほぞんは しない）。 */
export const ANIMAL_SPAWNS: readonly (Cell & { kind: AnimalKind })[] = [
  { kind: 'sheep', x: 6, z: 8 },
  { kind: 'sheep', x: 10, z: 11 },
  { kind: 'chicken', x: 5, z: 13 },
  { kind: 'rabbit', x: 9, z: 4 },
]

const STEPS: readonly Cell[] = [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }]

/** どうぶつが のれる じめん：みずや サボテンの うえには いかない。 */
function walkable(ground: Block | undefined): ground is Block {
  return !!ground && ground.material !== 'water' && ground.material !== 'cactus'
}

/** となりの 1マスへ。だんさが 1より おおきい ところや せかいの そとへは いかない。 */
export function nextCell(surface: Surface, at: Cell, random: () => number): Cell {
  const here = surface(at.x, at.z)
  const options = STEPS
    .map(step => ({ x: at.x + step.x, z: at.z + step.z }))
    .filter(cell => cell.x >= 0 && cell.x < SIZE && cell.z >= 0 && cell.z < SIZE)
    .filter(cell => {
      const ground = surface(cell.x, cell.z)
      return walkable(ground) && (!here || Math.abs(ground.y - here.y) <= 1)
    })
  if (!options.length) return at
  return options[Math.min(options.length - 1, Math.floor(random() * options.length))]
}

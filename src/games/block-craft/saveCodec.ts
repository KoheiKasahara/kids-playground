import { DEFAULT_WORLD, flatColumn, materialCode, materialId, validDimensions, World, type Block, type Dimensions } from './world'

export const LEGACY_SAVE_KEY = 'kids-playground:block-craft:v1'
const LEGACY_LENGTH = 250_000
const LEGACY_SIZE = 12

export function decodeLegacyWorld(raw: string | null): World | null {
  if (!raw || raw.length > LEGACY_LENGTH) return null
  try {
    const data: unknown = JSON.parse(raw)
    if (!Array.isArray(data) || data.length < LEGACY_SIZE ** 2 || data.length > DEFAULT_WORLD.size ** 2 * DEFAULT_WORLD.height) return null
    const world = new World(DEFAULT_WORLD, data)
    if (hasFloor(world)) return world
    if (data.some(b => b.x >= LEGACY_SIZE || b.z >= LEGACY_SIZE)) return null
    for (let z = 0; z < LEGACY_SIZE; z++) for (let x = 0; x < LEGACY_SIZE; x++) {
      if (!world.codeAt(x, 0, z)) return null
    }
    const blocks: Block[] = data
    for (let z = 0; z < world.size; z++) for (let x = 0; x < world.size; x++) {
      if (x >= LEGACY_SIZE || z >= LEGACY_SIZE) blocks.push(...flatColumn(x, z))
    }
    return new World(DEFAULT_WORLD, blocks)
  } catch { return null }
}

function hasFloor(world: World) {
  for (let i = 0; i < world.area; i++) if (!world.codeAtIndex(i)) return false
  return true
}

const base64Length = (bytes: number) => 4 * Math.ceil(bytes / 3)

function toBase64(bytes: Uint8Array) {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192))
  return btoa(binary)
}

function encodeRuns(cells: Uint8Array) {
  const bytes = new Uint8Array(cells.length)
  let offset = 0
  for (let start = 0; start < cells.length;) {
    let end = start + 1
    while (end < cells.length && end - start < 65535 && cells[end] === cells[start]) end++
    if (offset + 3 >= bytes.length) return null
    const count = end - start
    bytes[offset++] = cells[start]
    bytes[offset++] = count & 255
    bytes[offset++] = count >> 8
    start = end
  }
  return bytes.subarray(0, offset)
}

/** Horizontal layers compress terrain well. Fall back to bytes for high-entropy builds. */
export function encodeGrid(world: World, order: 'layers' | 'columns' = 'layers') {
  const cells = new Uint8Array(world.volume)
  const palette: string[] = []
  const mapping = new Uint8Array(256)
  for (let i = 0; i < cells.length; i++) {
    const code = world.codeAtIndex(order === 'layers' ? i : (i % world.height) * world.area + Math.floor(i / world.height))
    if (!code) continue
    if (!mapping[code]) {
      palette.push(materialId(code)!)
      mapping[code] = palette.length
    }
    cells[i] = mapping[code]
  }
  const runs = encodeRuns(cells)
  return { size: world.size, height: world.height, palette, order, encoding: runs ? 'rle' : 'bytes', cells: toBase64(runs ?? cells) }
}

export function decodeGrid(value: Record<string, unknown>): World | null {
  const { palette, cells, encoding, order } = value
  const dims = { size: value.size, height: value.height } as Dimensions
  if (!validDimensions(dims) || !Array.isArray(palette) || !palette.length || palette.length > 255) return null
  if ((order !== 'layers' && order !== 'columns') || (encoding !== 'rle' && encoding !== 'bytes')) return null
  const volume = dims.size ** 2 * dims.height
  if (typeof cells !== 'string' || cells.length > base64Length(volume)) return null
  const mapping = [0, ...palette.map(materialCode)]
  if (mapping.slice(1).includes(0) || new Set(mapping).size !== mapping.length) return null
  const binary = atob(cells)
  if (binary.length > volume || (encoding === 'bytes' ? binary.length !== volume : binary.length % 3 !== 0)) return null
  const expanded = new Uint8Array(volume)
  let offset = 0
  for (let i = 0; i < binary.length;) {
    const code = mapping[binary.charCodeAt(i++)]
    const count = encoding === 'bytes' ? 1 : binary.charCodeAt(i++) + 256 * binary.charCodeAt(i++)
    if (code === undefined || !count || offset + count > volume) return null
    expanded.fill(code, offset, offset + count)
    offset += count
  }
  if (offset !== volume) return null
  function* blocks(): IterableIterator<Block> {
    const area = dims.size ** 2
    for (let i = 0; i < volume; i++) {
      const material = materialId(expanded[i])
      if (!material) continue
      const column = order === 'layers' ? i % area : Math.floor(i / dims.height)
      yield { x: column % dims.size, y: order === 'layers' ? Math.floor(i / area) : i % dims.height, z: Math.floor(column / dims.size), material }
    }
  }
  const world = new World(dims, blocks())
  return hasFloor(world) ? world : null
}

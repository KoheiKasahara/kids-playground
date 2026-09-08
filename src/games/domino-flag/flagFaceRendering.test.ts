import { readFileSync } from 'node:fs'
import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import { dominoFlags } from './flagDefinitions'
import { BIG_FLAG_LAYOUT, DOMINO_DEPTH, DOMINO_HEIGHT, NORMAL_FLAG_LAYOUT, FLAG_PITCH_Z, createDominoPlacements } from './dominoLayout'
import { completedFlagBodyMatrix, createFlagFaceLocalMatrix, FLAG_FACE_CLEARANCE, flagPrintBounds, loadFlagFaceTexture } from './flagFaceRendering'

describe('国旗の分割印刷', () => {
  it.each(dominoFlags)('$id: 全40か国に自己完結したSVGがある', (flag) => {
    const svg = readFileSync(`public/${flag.imagePath}`, 'utf8')
    expect(svg).toContain('<svg')
    expect(svg).toMatch(/viewBox="[^"]+"/)
    expect(svg).not.toMatch(/(?:href|src)="https?:/)
  })

  it.each([NORMAL_FLAG_LAYOUT, BIG_FLAG_LAYOUT])('$cols×$rows: 印刷範囲は左上から倒れた最後の先端まで覆う', (size) => {
    const placements = createDominoPlacements('us', size).filter((p) => p.kind === 'flag')
    const bounds = flagPrintBounds(placements)
    const first = placements.find((p) => p.row === 0 && p.col === 0)!
    const last = placements.find((p) => p.row === size.rows - 1 && p.col === size.cols - 1)!
    expect(bounds.x).toBeCloseTo(first.x - first.width * 0.96 / 2)
    expect(bounds.y).toBeCloseTo(first.z + DOMINO_HEIGHT / 2 - FLAG_PITCH_Z * 0.98 * 0.94 / 2)
    expect(bounds.x + bounds.z).toBeCloseTo(last.x + last.width * 0.96 / 2)
    expect(bounds.y + bounds.w).toBeCloseTo(last.z + DOMINO_HEIGHT / 2 + FLAG_PITCH_Z * 0.98 * 0.94 / 2)
  })

  it.each([NORMAL_FLAG_LAYOUT, BIG_FLAG_LAYOUT])('$cols×$rows: 完成後は全ドミノが上向きで隣の本体・国旗面と交差しない', (size) => {
    const placements = createDominoPlacements('us', size).filter((p) => p.kind === 'flag')
    const unitBox = new THREE.Box3(new THREE.Vector3(-0.5, -0.5, -0.5), new THREE.Vector3(0.5, 0.5, 0.5))
    const boxes = placements.map((p) => unitBox.clone().applyMatrix4(completedFlagBodyMatrix(p)))
    for (let index = 0; index < placements.length; index += 1) {
      const matrix = completedFlagBodyMatrix(placements[index]!).multiply(createFlagFaceLocalMatrix())
      const normal = new THREE.Vector3(0, 0, 1).transformDirection(matrix)
      expect(normal.y).toBeCloseTo(1)
      const faceCenter = new THREE.Vector3().applyMatrix4(matrix)
      expect(faceCenter.y).toBeGreaterThan(boxes[index]!.max.y)
      for (let other = index + 1; other < placements.length; other += 1) {
        if (boxes[index]!.intersectsBox(boxes[other]!)) throw new Error(`完成ドミノが交差: ${index}, ${other}`)
      }
    }
  })

  it('倒れたときも国旗面が木の表面より上にあり、地面へ潜らない', () => {
    const fallen = new THREE.Matrix4().compose(
      new THREE.Vector3(0, DOMINO_DEPTH / 2, 0),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2),
      new THREE.Vector3(0.6, DOMINO_HEIGHT, DOMINO_DEPTH),
    ).multiply(createFlagFaceLocalMatrix())
    for (const x of [-0.5, 0.5]) {
      for (const y of [-0.5, 0.5]) {
        const corner = new THREE.Vector3(x, y, 0).applyMatrix4(fallen)
        expect(corner.y).toBeCloseTo(DOMINO_DEPTH + FLAG_FACE_CLEARANCE)
      }
    }
  })

  it('SVG読込失敗を呼び出し側へ返して元の色マス表示を維持できる', async () => {
    const loader = vi.spyOn(THREE.ImageLoader.prototype, 'loadAsync').mockRejectedValue(new Error('offline'))
    try {
      await expect(loadFlagFaceTexture('us')).rejects.toThrow('offline')
    } finally {
      loader.mockRestore()
    }
  })
})

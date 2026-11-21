// 生成済みアセット（public/models/zoo-3d/*.glb）とモーション情報 JSON の整合を確かめる。
// パイプライン（scripts/zoo-3d/build.sh）で作り直したときに、名前や長さのずれを検出する。
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { locomotionOf, playbackRate } from './motion'
import { SPECIES, SPECIES_ORDER } from './species'

type GltfJson = {
  animations?: { name: string; channels: { target: { node: number; path: string } }[]; samplers: { input: number }[] }[]
  accessors: { max?: number[] }[]
  nodes: { name?: string }[]
  skins?: { joints: number[] }[]
  extensionsRequired?: string[]
}

function readGltf(file: string): GltfJson {
  const buf = readFileSync(join(process.cwd(), 'public', 'models', 'zoo-3d', file))
  expect(buf.readUInt32LE(0)).toBe(0x46546c67) // 'glTF'
  const jsonLength = buf.readUInt32LE(12)
  return JSON.parse(buf.subarray(20, 20 + jsonLength).toString('utf8')) as GltfJson
}

const REQUIRED = ['Idle', 'Walk', 'WalkLeft', 'WalkRight', 'Run', 'TurnLeft', 'TurnRight', 'Eat', 'LieDown', 'Sleep', 'GetUp', 'Happy', 'Blink']

describe.each(SPECIES_ORDER)('%s のモデル', id => {
  const species = SPECIES[id]
  const gltf = readGltf(species.manifest.model)

  test('共通のモーション（待機・歩く・走る・方向転換・食事・睡眠）と固有アクションがそろっている', () => {
    const names = (gltf.animations ?? []).map(a => a.name)
    for (const clip of [...REQUIRED, ...species.specials.map(s => s.clip)]) {
      expect(names).toContain(clip)
      expect(species.manifest.clips[clip]).toBeDefined()
    }
  })

  test('GLB のアニメーションの長さが、モーション情報の長さと一致する', () => {
    for (const anim of gltf.animations ?? []) {
      const info = species.manifest.clips[anim.name]
      expect(info, anim.name).toBeDefined()
      const end = Math.max(...anim.samplers.map(s => gltf.accessors[s.input].max?.[0] ?? 0))
      expect(Math.abs(end - info.duration)).toBeLessThan(1 / species.manifest.fps + 1e-3)
    }
  })

  test('まばたきは目の骨の大きさを動かす重ねがけ用クリップで、使う骨が決まっている', () => {
    const info = species.manifest.clips.Blink
    expect(info.kind).toBe('overlay')
    expect(info.bones).toEqual(['eye_l', 'eye_r'])
    const blink = gltf.animations!.find(a => a.name === 'Blink')!
    const targets = blink.channels.map(c => `${gltf.nodes[c.target.node].name}.${c.target.path}`)
    expect(targets).toEqual(expect.arrayContaining(['eye_l.scale', 'eye_r.scale']))
  })

  test('1つのスキンで描け、iPhone 向けに三角形数を抑えている', () => {
    expect(gltf.skins?.length).toBe(1)
    expect(species.manifest.triangles).toBeLessThan(9000)
    expect(gltf.extensionsRequired ?? []).toEqual(expect.arrayContaining([]))
  })

  test('歩き・走り・方向転換の速さが、1周あたりの移動量・旋回量から決まる', () => {
    const lc = locomotionOf(species.manifest)
    expect(lc.walkSpeed).toBeGreaterThan(0.2)
    expect(lc.runSpeed).toBeGreaterThan(lc.walkSpeed * 1.5)
    expect(lc.turnSpeed).toBeGreaterThan(20)
    expect(lc.walkTurn).toBeGreaterThan(5)
    const walk = species.manifest.clips.Walk
    expect(playbackRate(walk.distancePerCycle!, walk.duration, 1, lc.walkSpeed)).toBeCloseTo(1)
    // 子どもは歩幅が小さいので、同じ再生速度なら遅く歩く
    expect(locomotionOf(species.manifest, 0.6).walkSpeed).toBeCloseTo(lc.walkSpeed * 0.6)
  })
})

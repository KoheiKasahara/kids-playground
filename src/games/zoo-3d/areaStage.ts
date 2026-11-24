// 1つのエリアの中身（景色・動物のモデル・行動の世界）を作って片付ける。
// モデル（GLB）は読み込んだら覚えておき、エリアを行き来しても読み直さない。
// エリアを出るときは、そのエリアの動物の GPU の資源を手放す（もう一度来たら作り直される）。

import * as THREE from 'three'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { AnimalAnimator } from './animator'
import { createZoo, type AnimalState, type Random, type ZooWorld } from './behavior'
import { disposeObject } from './effects'
import type { AnimalManifest } from './motion'
import { createScenery, type Scenery } from './scenery'
import { modelUrl, SPECIES, type SpeciesId } from './species'
import type { Area } from './zooMap'

export type Instance = {
  state: AnimalState
  root: THREE.Group
  animator: AnimalAnimator
  /** 効果の出どころ（ゾウの鼻先・カバの口先。水しぶき・音符を出す）。 */
  tip?: THREE.Object3D
  /** 食べ物を持って運ぶ骨（モーション情報の food.bone）。 */
  hold?: THREE.Object3D
  head?: THREE.Object3D
  skipped: number
  /** 影を落とすメッシュ（遠くの動物は影を省く）。 */
  meshes: THREE.Mesh[]
  /** 見た目の大きさ（m）。観察で、画面にどのくらい大きく映るかを測るのに使う。 */
  size: number
}

export type Stage = {
  area: Area
  world: ZooWorld
  scenery: Scenery
  instances: Instance[]
  dispose: () => void
}

/** 効果（水しぶき）を出すクリップが指定する骨。指定がなければゾウの鼻先。 */
function effectBone(manifest: AnimalManifest): string {
  return Object.values(manifest.clips).find(c => c.effect && c.bone)?.bone ?? 'trunk_tip'
}

/** 読み込んだモデルを覚えておく入れ物。 */
export class ModelCache {
  private readonly loaded = new Map<SpeciesId, Promise<GLTF>>()
  private readonly loader: GLTFLoader

  constructor(manager?: THREE.LoadingManager) {
    this.loader = new GLTFLoader(manager)
    this.loader.setMeshoptDecoder(MeshoptDecoder)
  }

  /** エリアの動物のモデルをそろえる。onProgress には読み終わった割合を渡す。 */
  async load(species: readonly SpeciesId[], onProgress: (ratio: number) => void): Promise<Map<SpeciesId, GLTF>> {
    let done = 0
    onProgress(0)
    const entries = await Promise.all(species.map(async id => {
      let p = this.loaded.get(id)
      if (!p) {
        p = this.loader.loadAsync(modelUrl(SPECIES[id]))
        this.loaded.set(id, p)
        // 失敗したら覚えず、次に来たときに読み直す
        p.catch(() => this.loaded.delete(id))
      }
      const gltf = await p
      done += 1
      onProgress(done / species.length)
      return [id, gltf] as const
    }))
    return new Map(entries)
  }

  /** いまのエリアにいない動物の GPU の資源を手放す（CPU 側のデータは残し、また来たら使う）。 */
  async release(keep: readonly SpeciesId[]): Promise<void> {
    for (const [id, p] of this.loaded) {
      if (keep.includes(id)) continue
      const gltf = await p.catch(() => undefined)
      if (gltf) disposeObject(gltf.scene)
    }
  }

  async dispose(): Promise<void> {
    await this.release([])
    this.loaded.clear()
  }
}

/** エリアの中身を作って scene に足す。 */
export function buildStage(scene: THREE.Scene, area: Area, models: Map<SpeciesId, GLTF>, random: Random): Stage {
  const scenery = createScenery(area)
  scene.add(scenery.group)
  const world = createZoo(area, random)
  const instances: Instance[] = []
  for (const state of world.animals) {
    const gltf = models.get(state.species)!
    const model = cloneSkinned(gltf.scene)
    model.scale.setScalar(state.scale)
    const meshes: THREE.Mesh[] = []
    model.traverse(o => {
      const mesh = o as THREE.SkinnedMesh
      if (mesh.isMesh) {
        meshes.push(mesh)
        mesh.castShadow = true
        // スキンメッシュは自前の境界球を持たないので、視錐台カリングはエンジン側で行う
        mesh.frustumCulled = false
        const material = mesh.material as THREE.MeshStandardMaterial
        material.roughness = 0.78
        material.metalness = 0
      }
    })
    const root = new THREE.Group()
    root.name = `zoo-animal-${state.id}`
    root.add(model)
    scene.add(root)
    const manifest = SPECIES[state.species].manifest
    const mixer = new THREE.AnimationMixer(model)
    const animator = new AnimalAnimator(mixer, gltf.animations, manifest, state.scale)
    const { height, length } = manifest.bounds
    instances.push({
      state, root, animator, skipped: 0, meshes,
      tip: model.getObjectByName(effectBone(manifest)) ?? undefined,
      hold: model.getObjectByName(manifest.clips.Eat?.food?.bone ?? '') ?? undefined,
      head: model.getObjectByName('head') ?? undefined,
      size: Math.max(height, length * 0.7) * state.scale,
    })
  }
  return {
    area,
    world,
    scenery,
    instances,
    dispose() {
      for (const inst of instances) {
        inst.animator.dispose()
        scene.remove(inst.root)
        // 複製したスキンごとの骨のテクスチャを手放す（形と材質はモデルと共有なので ModelCache が手放す）
        inst.root.traverse(o => (o as THREE.SkinnedMesh).skeleton?.dispose())
      }
      scene.remove(scenery.group)
      scenery.dispose()
    },
  }
}


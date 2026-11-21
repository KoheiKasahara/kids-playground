// Blender パイプライン（scripts/zoo-3d/）が書き出すモーション情報の型と、そこから導く移動の速さ。
// 歩き・走り・方向転換は「1周あたりの移動量・旋回量」を持ち、ゲームはこれに再生速度を合わせて
// 動物を動かす。こうすると接地中の足が地面に対して止まって見え、足が滑らない。

export type ClipKind = 'idle' | 'locomotion' | 'eat' | 'special' | 'react' | 'sleep' | 'overlay'

export type ClipInfo = {
  duration: number
  loop: boolean
  kind: ClipKind
  distancePerCycle?: number
  turnPerCycle?: number
  speed?: number
  turnSpeed?: number
  /** 重ねがけ用クリップ（まばたき）が動かす骨。 */
  bones?: string[]
  food?: { bone: string; grab: number; release: number; reach?: number }
  source?: string
  effect?: string
  bone?: string
  sound?: string
  sprayStart?: number
  sprayEnd?: number
  callStart?: number
  callEnd?: number
}

export type AnimalManifest = {
  animal: string
  model: string
  fps: number
  triangles: number
  bounds: { width: number; length: number; height: number; front: number; back: number }
  clips: Record<string, ClipInfo>
}

export type Locomotion = {
  /** 直進の歩き（m/s）。 */
  walkSpeed: number
  /** 歩きながら曲がれる最大の速さ（度/s、歩きの速さで歩いているとき）。 */
  walkTurn: number
  runSpeed: number
  /** その場の方向転換（度/s）。 */
  turnSpeed: number
}

/** 体の大きさ（scale）に合わせて歩幅が変わるので、移動の速さも同じ比率で変える。旋回の角速度は変わらない。 */
export function locomotionOf(manifest: AnimalManifest, scale = 1): Locomotion {
  const clip = (name: string) => {
    const info = manifest.clips[name]
    if (!info || info.kind !== 'locomotion') throw new Error(`${manifest.animal}: ${name} がありません`)
    return info
  }
  const walk = clip('Walk')
  const left = clip('WalkLeft')
  return {
    walkSpeed: (walk.distancePerCycle ?? 0) / walk.duration * scale,
    walkTurn: Math.abs(left.turnPerCycle ?? 0) / left.duration,
    runSpeed: (clip('Run').distancePerCycle ?? 0) / clip('Run').duration * scale,
    turnSpeed: Math.abs(clip('TurnLeft').turnPerCycle ?? 0) / clip('TurnLeft').duration,
  }
}

/** 実際の移動の速さから、歩き・走りクリップの再生速度を求める。 */
export function playbackRate(clipDistance: number, clipDuration: number, scale: number, speed: number): number {
  const natural = clipDistance / clipDuration * scale
  return natural > 0 ? speed / natural : 1
}

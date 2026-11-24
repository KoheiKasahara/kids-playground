import * as THREE from 'three'
import { describe, expect, test } from 'vitest'
import { overlayClip } from './animator'

describe('アニメーションの重ねがけ', () => {
  test('まばたきクリップから目の大きさのトラックだけを残す', () => {
    const track = (name: string) => new THREE.VectorKeyframeTrack(name, [0, 0.2], [1, 1, 1, 1, 0.1, 1])
    const clip = new THREE.AnimationClip('Blink', 0.2, [
      track('eye_l.scale'), track('eye_r.scale'), track('hips.position'),
      new THREE.QuaternionKeyframeTrack('head.quaternion', [0, 0.2], [0, 0, 0, 1, 0, 0, 0, 1]),
      new THREE.QuaternionKeyframeTrack('eye_l.quaternion', [0, 0.2], [0, 0, 0, 1, 0, 0, 0, 1]),
    ])
    const overlay = overlayClip(clip, ['eye_l', 'eye_r'])
    expect(overlay.tracks.map(t => t.name)).toEqual(['eye_l.scale', 'eye_r.scale'])
    expect(overlay.duration).toBe(0.2)
  })
})

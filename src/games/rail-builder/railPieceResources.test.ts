import { BoxGeometry, Group, InstancedMesh, MeshStandardMaterial } from 'three'
import { expect, test, vi } from 'vitest'
import { releaseRailPiece } from './railPieceResources'

test('削除線路のinstanceだけ解放し、残る線路の共有geometry/materialを維持する', () => {
  const geometry = new BoxGeometry()
  const material = new MeshStandardMaterial()
  const disposeGeometry = vi.spyOn(geometry, 'dispose')
  const disposeMaterial = vi.spyOn(material, 'dispose')
  const scene = new Group()
  const removed = new Group()
  const nested = new Group()
  const remaining = new Group()
  const instance = new InstancedMesh(geometry, material, 3)
  const otherInstance = new InstancedMesh(geometry, material, 3)
  const disposed = vi.fn()
  const otherDisposed = vi.fn()
  instance.addEventListener('dispose', disposed)
  otherInstance.addEventListener('dispose', otherDisposed)
  nested.add(instance)
  removed.add(nested)
  remaining.add(otherInstance)
  scene.add(removed, remaining)

  releaseRailPiece(removed)
  releaseRailPiece(removed)
  expect(disposed).toHaveBeenCalledTimes(1)
  expect(otherDisposed).not.toHaveBeenCalled()
  expect(scene.children).toEqual([remaining])
  expect(disposeGeometry).not.toHaveBeenCalled()
  expect(disposeMaterial).not.toHaveBeenCalled()

  // 退出時に残る線路も同じ経路で解放する。
  releaseRailPiece(remaining)
  expect(otherDisposed).toHaveBeenCalledTimes(1)
  expect(scene.children).toHaveLength(0)
  geometry.dispose()
  material.dispose()
})

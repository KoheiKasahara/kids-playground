/**
 * 3Dクルマづくりのシーン（レンダラー・カメラ・回転操作）を管理する命令的hook。
 *
 * 車そのものの組み立ては carModel.ts が担当し、このhookは
 *   - シーン／レンダラー／ライト／地面を1回だけ作る
 *   - CarConfigの変化を carModel.update() へ渡す
 *   - ドラッグ回転・ピンチズーム・リサイズを扱う
 * だけを行う。Reactの再描画でシーンやGeometryを作り直さないよう、
 * 生成は「マウント時の1回」、以降は差分更新に限定している。
 */
import { useCallback, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { CarConfig } from './carConfig'
import { carBoundingRadius } from './carDimensions'
import { createCarModel } from './carModel'

export const MIN_CAR_ZOOM = 0.65
export const MAX_CAR_ZOOM = 1.8
const CAMERA_FOV = 40
const MIN_PITCH = 0.06
const MAX_PITCH = 1.05
const DEFAULT_YAW = 0.72
const DEFAULT_PITCH = 0.32

export type CarBuilderSceneOptions = {
  config: CarConfig
}

export type CarBuilderSceneHandle = {
  registerContainer: (element: HTMLDivElement | null) => void
}

/**
 * 車全体が画面へ収まるカメラ距離。縦横どちらでも切れないよう、
 * 縦方向・横方向の必要距離の大きい方を採用する。
 */
export function fitCameraDistance(boundingRadius: number, fovDeg: number, aspect: number): number {
  const halfFov = (fovDeg * Math.PI) / 180 / 2
  const vertical = boundingRadius / Math.tan(halfFov)
  const horizontal = boundingRadius / (Math.tan(halfFov) * Math.max(0.2, aspect))
  return Math.max(vertical, horizontal) * 1.04
}

export function useCarBuilderScene(options: CarBuilderSceneOptions): CarBuilderSceneHandle {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const syncConfigRef = useRef<((config: CarConfig) => void) | null>(null)

  const registerContainer = useCallback((element: HTMLDivElement | null) => {
    containerRef.current = element
  }, [])

  const handle = useMemo<CarBuilderSceneHandle>(() => ({ registerContainer }), [registerContainer])

  // CarConfigが変わったら、シーンを作り直さずモデルの差分更新だけを行う。
  useEffect(() => {
    syncConfigRef.current?.(options.config)
  }, [options.config])

  useEffect(() => {
    const container = containerRef.current
    if (container === null || typeof window === 'undefined') return undefined
    const host = container

    let renderer: THREE.WebGLRenderer | null = null
    let resizeObserver: ResizeObserver | null = null
    let rafId: number | null = null
    let released = false
    let dirty = true

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#dff1fb')
    const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 100)
    const model = createCarModel(options.config)
    scene.add(model.root)

    const groundGeometry = new THREE.CircleGeometry(6, 48)
    const groundMaterial = new THREE.MeshStandardMaterial({ color: '#9fd8a5', roughness: 0.95 })
    const ground = new THREE.Mesh(groundGeometry, groundMaterial)
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    scene.add(ground)

    const hemisphere = new THREE.HemisphereLight('#ffffff', '#88a878', 1.9)
    const directional = new THREE.DirectionalLight('#fff6e0', 1.9)
    directional.position.set(4, 7, 5)
    directional.castShadow = true
    directional.shadow.mapSize.set(1024, 1024)
    directional.shadow.camera.left = -5
    directional.shadow.camera.right = 5
    directional.shadow.camera.top = 5
    directional.shadow.camera.bottom = -5
    directional.shadow.camera.near = 0.5
    directional.shadow.camera.far = 24
    scene.add(hemisphere, directional)

    let yaw = DEFAULT_YAW
    let pitch = DEFAULT_PITCH
    let zoom = 1
    let fitDistance = 8

    const markDirty = () => {
      dirty = true
    }

    function updateCamera() {
      const dimensions = model.getDimensions()
      const aspect = camera.aspect
      fitDistance = fitCameraDistance(carBoundingRadius(dimensions), CAMERA_FOV, aspect)
      const distance = fitDistance * zoom
      const targetY = dimensions.height * 0.45
      camera.position.set(
        Math.sin(yaw) * Math.cos(pitch) * distance,
        targetY + Math.sin(pitch) * distance,
        Math.cos(yaw) * Math.cos(pitch) * distance,
      )
      camera.lookAt(0, targetY, 0)
      markDirty()
    }

    function resize() {
      if (renderer === null) return
      const width = Math.max(1, host.clientWidth)
      const height = Math.max(1, host.clientHeight)
      camera.aspect = width / height
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      renderer.setSize(width, height, false)
      updateCamera()
      camera.updateProjectionMatrix()
      markDirty()
    }

    // ポインターは指ごとに保持する。1本=回転、2本=ピンチズーム。
    const pointers = new Map<number, { x: number; y: number }>()
    let pinchDistance: number | null = null

    function pointerSpread(): number | null {
      const points = [...pointers.values()]
      if (points.length < 2) return null
      return Math.hypot(points[0]!.x - points[1]!.x, points[0]!.y - points[1]!.y)
    }

    function handlePointerDown(event: PointerEvent) {
      event.preventDefault()
      host.setPointerCapture?.(event.pointerId)
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
      pinchDistance = pointerSpread()
    }

    function handlePointerMove(event: PointerEvent) {
      const previous = pointers.get(event.pointerId)
      if (previous === undefined) return
      event.preventDefault()
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })

      if (pointers.size >= 2) {
        const spread = pointerSpread()
        if (spread !== null && pinchDistance !== null && pinchDistance > 0) {
          // 指を広げるほどカメラを近づける（＝ズームイン）。
          zoom = Math.min(MAX_CAR_ZOOM, Math.max(MIN_CAR_ZOOM, zoom * (pinchDistance / spread)))
          pinchDistance = spread
          updateCamera()
        }
        return
      }

      const dx = event.clientX - previous.x
      const dy = event.clientY - previous.y
      yaw -= dx * 0.008
      pitch = Math.min(MAX_PITCH, Math.max(MIN_PITCH, pitch + dy * 0.006))
      updateCamera()
    }

    function releasePointer(event: PointerEvent) {
      pointers.delete(event.pointerId)
      host.releasePointerCapture?.(event.pointerId)
      pinchDistance = pointerSpread()
    }

    function handleWheel(event: WheelEvent) {
      event.preventDefault()
      zoom = Math.min(MAX_CAR_ZOOM, Math.max(MIN_CAR_ZOOM, zoom * (event.deltaY > 0 ? 1.08 : 0.92)))
      updateCamera()
    }

    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.shadowMap.enabled = true
      renderer.shadowMap.type = THREE.PCFSoftShadowMap
      renderer.domElement.setAttribute('aria-hidden', 'true')
      renderer.domElement.style.display = 'block'
      renderer.domElement.style.width = '100%'
      renderer.domElement.style.height = '100%'
      host.appendChild(renderer.domElement)
      resize()

      syncConfigRef.current = (config: CarConfig) => {
        model.update(config)
        // 寸法が変わってもはみ出さないよう、カメラ距離だけ追従させる（向きは維持する）。
        updateCamera()
      }

      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(resize)
        resizeObserver.observe(host)
      } else {
        window.addEventListener('resize', resize)
      }
      window.addEventListener('orientationchange', resize)
      host.addEventListener('pointerdown', handlePointerDown, { passive: false })
      host.addEventListener('pointermove', handlePointerMove, { passive: false })
      host.addEventListener('pointerup', releasePointer)
      host.addEventListener('pointercancel', releasePointer)
      host.addEventListener('wheel', handleWheel, { passive: false })

      const renderLoop = () => {
        if (released || renderer === null) return
        // 変化があったフレームだけ描画する（静止中はGPUを回さない）。
        if (dirty) {
          renderer.render(scene, camera)
          dirty = false
        }
        rafId = window.requestAnimationFrame(renderLoop)
      }
      rafId = window.requestAnimationFrame(renderLoop)
    } catch {
      // WebGLが使えない環境（テスト・一部端末）でも、下部のカスタマイズUIは操作できるようにする。
      if (renderer !== null) {
        try {
          renderer.dispose()
        } catch {
          // 初期化途中のrendererはdisposeできないことがある。
        }
        renderer = null
      }
    }

    return () => {
      released = true
      syncConfigRef.current = null
      if (rafId !== null) window.cancelAnimationFrame(rafId)
      resizeObserver?.disconnect()
      if (resizeObserver === null) window.removeEventListener('resize', resize)
      window.removeEventListener('orientationchange', resize)
      host.removeEventListener('pointerdown', handlePointerDown)
      host.removeEventListener('pointermove', handlePointerMove)
      host.removeEventListener('pointerup', releasePointer)
      host.removeEventListener('pointercancel', releasePointer)
      host.removeEventListener('wheel', handleWheel)
      pointers.clear()

      scene.remove(model.root)
      model.dispose()
      groundGeometry.dispose()
      groundMaterial.dispose()
      hemisphere.dispose()
      directional.dispose()
      const canvas = renderer?.domElement ?? host.querySelector('canvas')
      if (renderer !== null) {
        try {
          renderer.dispose()
        } catch {
          // 既に破棄されたrendererでも、DOMと他の資源は回収する。
        }
        try {
          renderer.forceContextLoss()
        } catch {
          // WebGLモックや既に失われたコンテキストでは不要。
        }
      }
      if (canvas !== null && canvas.parentNode === host) host.removeChild(canvas)
    }
    // マウント時に1回だけシーンを組み立てる。CarConfigの反映は syncConfigRef 経由で行うため、
    // ここでconfigを依存に入れて作り直してはいけない。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return handle
}

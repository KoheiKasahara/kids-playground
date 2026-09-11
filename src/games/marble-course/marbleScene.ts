import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { createPartGeometries } from './marbleGeometry'
import { BALL_RADIUS, connectors, launchPose, PARTS, toWorld, type Course, type Vec3 } from './marbleModel'

export function createMarbleScene(container: HTMLDivElement) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.shadowMap.autoUpdate = false
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  container.appendChild(renderer.domElement)
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#e9f3ef')
  const pmrem = new THREE.PMREMGenerator(renderer)
  const room = new RoomEnvironment()
  const environment = pmrem.fromScene(room, 0.04)
  scene.environment = environment.texture
  scene.environmentIntensity = 0.5
  room.dispose()
  pmrem.dispose()
  const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 180)
  const target = new THREE.Vector3(0, 2, 0)
  const overviewTarget = target.clone()
  const cameraOffset = new THREE.Vector3(10, 15, 18)
  let viewSize = 14
  let overviewSize = 14
  let zoom = 1
  let aspect = 1
  const light = new THREE.DirectionalLight(0xfff1d7, 2)
  light.position.set(-10, 26, 12)
  light.castShadow = true
  light.shadow.mapSize.set(1024, 1024)
  Object.assign(light.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, far: 75 })
  light.shadow.camera.updateProjectionMatrix()
  light.shadow.bias = -0.0004
  light.shadow.normalBias = 0.04
  scene.add(light, new THREE.HemisphereLight(0xd7f5ff, 0xc9c5ad, 0.85))
  const floorMaterial = new THREE.MeshStandardMaterial({ color: '#e5eee4', roughness: 0.95 })
  const floorGeometry = new THREE.PlaneGeometry(120, 120)
  const floor = new THREE.Mesh(floorGeometry, floorMaterial)
  floor.rotation.x = -Math.PI / 2
  floor.position.y = -0.09
  floor.receiveShadow = true
  scene.add(floor)
  const grid = new THREE.GridHelper(48, 24, '#bfcec1', '#d2ded2')
  grid.position.y = -0.075
  scene.add(grid)
  const geometries = createPartGeometries()
  const materials = Object.fromEntries(PARTS.map(part => [part.kind, [
    new THREE.MeshStandardMaterial({ color: part.color, roughness: 0.28, metalness: 0.05, side: THREE.DoubleSide }),
    new THREE.MeshStandardMaterial({ color: new THREE.Color(part.color).lerp(new THREE.Color('#fffdf0'), 0.50), roughness: 0.3, metalness: 0.03, side: THREE.DoubleSide }),
  ]]))
  const root = new THREE.Group()
  scene.add(root)
  const supportGeometry = new THREE.CylinderGeometry(0.17, 0.23, 1, 10)
  const supportMaterial = new THREE.MeshStandardMaterial({ color: '#d4b487', roughness: 0.65 })
  const supports = new THREE.InstancedMesh(supportGeometry, supportMaterial, 108)
  supports.castShadow = true
  supports.receiveShadow = true
  scene.add(supports)
  const markerGeometry = new THREE.TorusGeometry(0.23, 0.055, 6, 16)
  const markerMaterial = new THREE.MeshBasicMaterial({ color: '#ffffff' })
  const markers = new THREE.InstancedMesh(markerGeometry, markerMaterial, 108)
  scene.add(markers)
  const selectionGeometry = new THREE.TorusGeometry(1, 0.055, 6, 40)
  const selectionMaterial = new THREE.MeshBasicMaterial({ color: '#e9a12d', depthTest: false })
  const selection = new THREE.Mesh(selectionGeometry, selectionMaterial)
  selection.rotation.x = -Math.PI / 2
  selection.scale.set(2.5, 1.45, 1)
  selection.renderOrder = 3
  scene.add(selection)
  // A single physical material with clearcoat gets glass-like highlights without a transmission render pass.
  const ballGeometry = new THREE.SphereGeometry(BALL_RADIUS, 28, 20)
  const colors: number[] = []
  const positions = ballGeometry.getAttribute('position')
  const aqua = new THREE.Color('#12b5bd'), blue = new THREE.Color('#2164b9'), cream = new THREE.Color('#cdfaff')
  for (let i = 0; i < positions.count; i++) {
    const band = Math.sin(positions.getY(i) * 17 + Math.atan2(positions.getZ(i), positions.getX(i)) * 2)
    const color = band > 0.6 ? cream : aqua.clone().lerp(blue, (band + 1) / 2)
    colors.push(color.r, color.g, color.b)
  }
  ballGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  const ballMaterial = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.07, metalness: 0.12, clearcoat: 1, clearcoatRoughness: 0.03 })
  const ball = new THREE.Mesh(ballGeometry, ballMaterial)
  // Dynamic contact shadow is a tiny mesh, so rolling never re-renders the static shadow map.
  const shadowGeometry = new THREE.CircleGeometry(0.34, 20)
  const shadowMaterial = new THREE.MeshBasicMaterial({ color: '#254b54', transparent: true, opacity: 0.16, depthWrite: false })
  const ballShadow = new THREE.Mesh(shadowGeometry, shadowMaterial)
  ballShadow.rotation.x = -Math.PI / 2
  scene.add(ball, ballShadow)
  const flag = new THREE.Group()
  const poleGeometry = new THREE.CylinderGeometry(0.04, 0.04, 1.1, 8)
  const flagGeometry = new THREE.BoxGeometry(0.65, 0.38, 0.045)
  const flagMaterial = new THREE.MeshStandardMaterial({ color: '#fb735b', roughness: 0.4 })
  const pole = new THREE.Mesh(poleGeometry, supportMaterial)
  const cloth = new THREE.Mesh(flagGeometry, flagMaterial)
  pole.position.y = 0.55
  cloth.position.set(0.3, 0.87, 0)
  flag.add(pole, cloth)
  scene.add(flag)
  const dummy = new THREE.Object3D()
  let current: Course = { parts: [], startId: null }
  const meshes = new Map<string, THREE.Mesh>()

  const projection = () => {
    camera.left = -viewSize * aspect / (2 * zoom)
    camera.right = -camera.left
    camera.top = viewSize / (2 * zoom)
    camera.bottom = -camera.top
    camera.updateProjectionMatrix()
  }
  const resize = () => {
    const width = Math.max(container.clientWidth, 1), height = Math.max(container.clientHeight, 1)
    aspect = width / height
    renderer.setSize(width, height)
    fit()
    projection()
  }
  const fit = () => {
    const box = new THREE.Box3().setFromObject(root)
    if (box.isEmpty()) box.setFromCenterAndSize(new THREE.Vector3(0, 2, 0), new THREE.Vector3(6, 4, 6))
    box.getCenter(overviewTarget)
    // Project all eight bounds corners onto the fixed camera basis, including elevated supports.
    camera.position.copy(overviewTarget).add(cameraOffset)
    camera.lookAt(overviewTarget)
    camera.updateMatrixWorld()
    let maxX = 0, maxY = 0
    for (const x of [box.min.x, box.max.x]) for (const y of [0, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      const v = new THREE.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse)
      maxX = Math.max(maxX, Math.abs(v.x))
      maxY = Math.max(maxY, Math.abs(v.y))
    }
    overviewSize = Math.max(10, maxY * 2.7, maxX * 2.7 / aspect)
  }
  function update(course: Course, selectedId: string | null, fitCamera = true) {
    current = course
    const ids = new Set(course.parts.map(part => part.id))
    for (const [id, mesh] of meshes) if (!ids.has(id)) { root.remove(mesh); meshes.delete(id) }
    let legIndex = 0, markerIndex = 0
    for (const part of course.parts) {
      let mesh = meshes.get(part.id)
      if (!mesh) {
        mesh = new THREE.Mesh(geometries[part.kind], materials[part.kind])
        mesh.castShadow = true
        mesh.receiveShadow = true
        mesh.userData.partId = part.id
        root.add(mesh)
        meshes.set(part.id, mesh)
      }
      mesh.position.copy(part.position)
      mesh.rotation.y = -part.rotation * Math.PI / 2
      const ends = connectors(part)
      const feet = part.kind === 'goal' ? [ends[0]!.position, toWorld(part, { x: 0.55, y: -0.4, z: 0 })] : ends.map(end => end.position)
      for (const foot of feet) {
        dummy.position.set(foot.x * 0.85 + part.position.x * 0.15, (foot.y - 0.2) / 2, foot.z * 0.85 + part.position.z * 0.15)
        dummy.rotation.set(0, 0, 0)
        dummy.scale.set(1, Math.max(0.1, foot.y - 0.2), 1)
        dummy.updateMatrix()
        supports.setMatrixAt(legIndex++, dummy.matrix)
      }
      for (const end of ends) {
        dummy.position.set(end.position.x, end.position.y + 0.025, end.position.z)
        dummy.rotation.set(-Math.PI / 2, 0, 0)
        dummy.scale.setScalar(1)
        dummy.updateMatrix()
        markers.setMatrixAt(markerIndex++, dummy.matrix)
      }
    }
    supports.count = legIndex
    markers.count = markerIndex
    supports.instanceMatrix.needsUpdate = true
    markers.instanceMatrix.needsUpdate = true
    supports.computeBoundingSphere()
    markers.computeBoundingSphere()
    select(selectedId)
    const pose = launchPose(course)
    ball.visible = Boolean(pose)
    flag.visible = Boolean(pose)
    if (pose) {
      ball.position.copy(pose.position)
      ball.quaternion.identity()
      flag.position.set(pose.position.x, pose.position.y - BALL_RADIUS + 0.1, pose.position.z - 0.95)
    }
    renderer.shadowMap.needsUpdate = true
    if (fitCamera) fit()
  }
  function select(id: string | null) {
    const part = current.parts.find(item => item.id === id)
    selection.visible = Boolean(part)
    if (part) {
      selection.position.set(part.position.x, part.position.y - 0.15, part.position.z)
      selection.rotation.set(-Math.PI / 2, 0, -part.rotation * Math.PI / 2)
    }
  }
  function render(follow: Vec3 | null, reducedMotion: boolean) {
    const destination = follow && !reducedMotion ? new THREE.Vector3(follow.x, Math.max(1, follow.y), follow.z) : overviewTarget
    target.lerp(destination, reducedMotion ? 1 : 0.08)
    viewSize += ((follow && !reducedMotion ? Math.max(8, 9 / aspect) : overviewSize) - viewSize) * (reducedMotion ? 1 : 0.08)
    camera.position.copy(target).add(cameraOffset)
    camera.lookAt(target)
    projection()
    ballShadow.visible = ball.visible
    ballShadow.position.set(ball.position.x, -0.065, ball.position.z)
    renderer.render(scene, camera)
  }
  resize()
  const observer = new ResizeObserver(resize)
  observer.observe(container)
  return {
    renderer, camera, geometries, ball, root, update, select, render,
    zoom(delta: number) { zoom = THREE.MathUtils.clamp(zoom + delta, 0.65, 2); projection() },
    overview() { zoom = 1; fit() },
    dispose() {
      observer.disconnect()
      for (const item of Object.values(geometries)) item.dispose()
      for (const set of Object.values(materials)) for (const material of set) material.dispose()
      for (const item of [floorGeometry, floorMaterial, supportGeometry, supportMaterial, markerGeometry, markerMaterial, selectionGeometry, selectionMaterial, ballGeometry, ballMaterial, shadowGeometry, shadowMaterial, poleGeometry, flagGeometry, flagMaterial, grid.geometry]) item.dispose()
      for (const material of Array.isArray(grid.material) ? grid.material : [grid.material]) material.dispose()
      light.shadow.dispose()
      environment.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    },
  }
}

export type MarbleScene = ReturnType<typeof createMarbleScene>

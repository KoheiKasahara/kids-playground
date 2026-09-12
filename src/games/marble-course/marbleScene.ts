import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { createPartGeometries, seesawBoardGeometry } from './marbleGeometry'
import { BALL_RADIUS, BOARD_LIMIT, connectors, isGadget, launchPose, MAX_PARTS, PARTS, SEESAW_ANGLE, SEESAW_PIVOT, SPINNER_ANGLE, SPINNER_DROP, toLocal, toWorld, type Course, type Vec3 } from './marbleModel'
import type { MarbleEvent, MechanismPose } from './marbleWorld'

const MIN_ZOOM = 0.45
const MAX_ZOOM = 3

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
  // What the fingers dragged the view by, kept on top of whatever the course bounds fit to.
  const panOffset = new THREE.Vector3()
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
  const grid = new THREE.GridHelper(BOARD_LIMIT * 2 + 4, BOARD_LIMIT + 2, '#bfcec1', '#d2ded2')
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
  const supports = new THREE.InstancedMesh(supportGeometry, supportMaterial, MAX_PARTS * 6)
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
  const moving = new Map<string, THREE.Object3D>()
  const boardGeometry = seesawBoardGeometry()
  const barGeometry = new THREE.CapsuleGeometry(0.16, 1.8, 5, 12).rotateZ(Math.PI / 2)
  const hubGeometry = new THREE.CylinderGeometry(0.16, 0.21, 0.7, 16)
  const axleGeometry = new THREE.CylinderGeometry(0.12, 0.12, 2, 12).rotateX(Math.PI / 2)
  const tipGeometry = new THREE.TorusGeometry(0.165, 0.035, 6, 12).rotateY(Math.PI / 2)
  const holeGeometry = new THREE.TorusGeometry(0.49, 0.035, 6, 32).rotateX(-Math.PI / 2)
  const arrowShape = new THREE.Shape()
  arrowShape.moveTo(-0.28, -0.07); arrowShape.lineTo(0, -0.07); arrowShape.lineTo(0, -0.2); arrowShape.lineTo(0.3, 0); arrowShape.lineTo(0, 0.2); arrowShape.lineTo(0, 0.07); arrowShape.lineTo(-0.28, 0.07); arrowShape.closePath()
  const arrowGeometry = new THREE.ShapeGeometry(arrowShape).rotateX(-Math.PI / 2)
  const inkMaterial = new THREE.MeshStandardMaterial({ color: '#43605f', roughness: 0.5, side: THREE.DoubleSide })
  const chalkMaterial = new THREE.MeshStandardMaterial({ color: '#fff8d6', roughness: 0.35, side: THREE.DoubleSide })
  const motionGeometry = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 33 }, (_, i) => {
    const t = i / 32
    return new THREE.Vector3(-0.65 + 2.1 * t, 0.55 + Math.sin(t * Math.PI) * 0.65, 0)
  }))
  const motionMaterial = new THREE.LineDashedMaterial({ color: '#b36c25', dashSize: 0.12, gapSize: 0.09, depthTest: false })
  const jumpGuide = new THREE.Line(motionGeometry, motionMaterial)
  jumpGuide.computeLineDistances()
  jumpGuide.renderOrder = 4
  scene.add(jumpGuide)
  const circleGeometry = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 28 }, (_, i) => {
    const a = i / 27 * Math.PI * 1.65
    return new THREE.Vector3(Math.cos(a) * 1.4, 0.55, 0.3 + Math.sin(a) * 1.4)
  }))
  const circleMaterial = new THREE.LineBasicMaterial({ color: '#a4476e' })
  const spinGuide = new THREE.Group()
  spinGuide.add(new THREE.Line(circleGeometry, circleMaterial))
  const spinArrow = new THREE.Mesh(arrowGeometry, inkMaterial)
  spinArrow.position.set(1.4, 0.55, 0.3)
  spinArrow.rotation.y = Math.PI / 2
  spinGuide.add(spinArrow)
  scene.add(spinGuide)
  const glowGeometry = new THREE.TorusGeometry(0.4, 0.045, 6, 24)
  const glowMaterial = new THREE.MeshBasicMaterial({ color: '#ffdd72', transparent: true, depthWrite: false })
  const glow = new THREE.Mesh(glowGeometry, glowMaterial)
  glow.rotation.x = -Math.PI / 2
  glow.visible = false
  scene.add(glow)
  const boostGlow = new THREE.Group()
  for (const x of [-0.8, 0, 0.8]) {
    const arrow = new THREE.Mesh(arrowGeometry, glowMaterial)
    arrow.position.set(x, 0.045, 0)
    arrow.scale.setScalar(1.55)
    boostGlow.add(arrow)
  }
  boostGlow.visible = false
  scene.add(boostGlow)
  let glowFrames = 0
  const overlapGeometry = new THREE.BoxGeometry(1, 1, 1)
  const overlapMaterial = new THREE.MeshBasicMaterial({ color: '#d27c32', wireframe: true, transparent: true, opacity: 0.8, depthTest: false })
  const overlap = new THREE.InstancedMesh(overlapGeometry, overlapMaterial, 72)
  overlap.count = 0
  scene.add(overlap)

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
    // A course stands on legs, so the ground belongs to it: centring on the track alone
    // would leave as much empty sky above as there is stand below.
    box.min.y = Math.min(box.min.y, 0)
    box.getCenter(overviewTarget)
    // Project all eight bounds corners onto the fixed camera basis, including elevated supports.
    camera.position.copy(overviewTarget).add(cameraOffset)
    camera.lookAt(overviewTarget)
    camera.updateMatrixWorld()
    let maxX = 0, maxY = 0
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      const v = new THREE.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse)
      maxX = Math.max(maxX, Math.abs(v.x))
      maxY = Math.max(maxY, Math.abs(v.y))
    }
    overviewSize = Math.max(10, maxY * 2.7, maxX * 2.7 / aspect)
  }
  function update(course: Course, selectedId: string | null, fitCamera = true) {
    current = course
    const ids = new Set(course.parts.map(part => part.id))
    for (const [id, mesh] of meshes) if (!ids.has(id)) { root.remove(mesh); meshes.delete(id); moving.delete(id) }
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
        if (part.kind === 'spinner') {
          const bar = new THREE.Mesh(barGeometry, materials[part.kind]![0])
          for (const x of [-0.75, 0.75]) { const tip = new THREE.Mesh(tipGeometry, chalkMaterial); tip.position.x = x; bar.add(tip) }
          mesh.add(bar)
          moving.set(part.id, bar)
          const hub = new THREE.Mesh(hubGeometry, supportMaterial)
          hub.position.set(0, 0.34 - SPINNER_DROP / 2, 0.3)
          mesh.add(hub)
        }
        if (part.kind === 'seesaw') {
          const board = new THREE.Mesh(boardGeometry, materials[part.kind])
          mesh.add(board)
          moving.set(part.id, board)
          const axle = new THREE.Mesh(axleGeometry, supportMaterial)
          axle.position.y = SEESAW_PIVOT - 0.1
          mesh.add(axle)
          for (const z of [-0.93, 0.93]) { const foot = new THREE.Mesh(hubGeometry, supportMaterial); foot.position.set(0, -0.35, z); mesh.add(foot) }
        }
        if (part.kind === 'funnel') {
          const hole = new THREE.Mesh(holeGeometry, materials[part.kind]![0])
          hole.position.y = -0.59
          mesh.add(hole)
        }
        // Direction marks use both a mouth ring and an arrow; the lower funnel outlet remains explicit.
        if (isGadget(part.kind)) {
          for (const [i, end] of connectors({ ...part, position: { x: 0, y: 0, z: 0 }, rotation: 0 }).entries()) {
            const arrow = new THREE.Mesh(arrowGeometry, inkMaterial)
            arrow.position.set(end.position.x + (i === 0 ? 0.25 : -0.3), end.position.y + 0.025, end.position.z)
            mesh.add(arrow)
          }
        }
        if (part.kind === 'booster') for (const x of [-0.8, 0, 0.8]) {
          const arrow = new THREE.Mesh(arrowGeometry, chalkMaterial)
          arrow.position.set(x, 0.035, 0)
          arrow.scale.setScalar(1.5)
          mesh.add(arrow)
        }
      }
      mesh.position.copy(part.position)
      mesh.rotation.y = -part.rotation * Math.PI / 2
      const mechanism = moving.get(part.id)
      if (mechanism) {
        mechanism.position.set(0, part.kind === 'spinner' ? 0.34 - SPINNER_DROP / 2 : SEESAW_PIVOT, part.kind === 'spinner' ? 0.3 : 0)
        mechanism.rotation.set(0, part.kind === 'spinner' ? SPINNER_ANGLE : 0, part.kind === 'seesaw' ? SEESAW_ANGLE : 0)
      }
      const ends = connectors(part)
      const feet = part.kind === 'goal' ? [ends[0]!.position, toWorld(part, { x: 0.55, y: -0.4, z: 0 })] : ends.map(end => end.position)
      if (part.kind === 'funnel') for (const x of [-1.6, 1.6]) for (const z of [-1.6, 1.6]) feet.push(toWorld(part, { x, y: -0.1, z }))
      if (part.kind === 'seesaw' || part.kind === 'spinner') for (const z of [-1, 1]) feet.push(toWorld(part, { x: 0, y: part.kind === 'seesaw' ? SEESAW_PIVOT : -SPINNER_DROP / 2, z: z * (part.kind === 'seesaw' ? 1.1 : 2.2) }))
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
    glow.visible = false
    boostGlow.visible = false
    glowFrames = 0
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
    jumpGuide.visible = part?.kind === 'jump'
    spinGuide.visible = part?.kind === 'spinner'
    if (part) {
      selection.scale.set(isGadget(part.kind) && part.kind !== 'booster' ? 3.35 : 2.5, part.kind === 'funnel' || part.kind === 'spinner' ? 2.65 : 1.45, 1)
      selection.position.set(part.position.x, part.position.y - 0.15, part.position.z)
      selection.rotation.set(-Math.PI / 2, 0, -part.rotation * Math.PI / 2)
      for (const guide of [jumpGuide, spinGuide]) { guide.position.copy(part.position); guide.rotation.y = -part.rotation * Math.PI / 2 }
      if (part.kind === 'spinner') spinGuide.scale.x = part.settings.reverse ? -1 : 1
    }
    // Highlight only the occupied jump gap/landing, while still permitting experimental overlaps.
    root.updateMatrixWorld(true)
    let count = 0
    for (const jump of current.parts.filter(item => item.kind === 'jump')) {
      for (const [left, right] of [[-0.45, 0.2], [0.2, 3]]) {
        const zone = new THREE.Box3().setFromPoints([new THREE.Vector3(left, -0.1, -1.2), new THREE.Vector3(right, 1.1, 1.2)])
        zone.applyMatrix4(meshes.get(jump.id)!.matrixWorld)
        if (!current.parts.some(other => other.id !== jump.id && (id === jump.id || id === other.id) && zone.intersectsBox(new THREE.Box3().setFromObject(meshes.get(other.id)!).expandByScalar(-0.08)))) continue
        zone.getCenter(dummy.position); zone.getSize(dummy.scale); dummy.rotation.set(0, 0, 0); dummy.updateMatrix()
        overlap.setMatrixAt(count++, dummy.matrix)
      }
    }
    overlap.count = count
    overlap.instanceMatrix.needsUpdate = true
    if (count) overlap.computeBoundingSphere()
  }
  function render(follow: Vec3 | null, reducedMotion: boolean) {
    const destination = follow && !reducedMotion ? new THREE.Vector3(follow.x, Math.max(1, follow.y), follow.z) : overviewTarget.clone().add(panOffset)
    target.lerp(destination, reducedMotion ? 1 : 0.08)
    const nearJump = follow && current.parts.some(part => part.kind === 'jump' && Math.abs(toLocal(part, follow).x) < 4 && Math.abs(toLocal(part, follow).z) < 2)
    viewSize += ((follow && !reducedMotion ? Math.max(nearJump ? 11 : 8, (nearJump ? 12 : 9) / aspect) * (nearJump ? Math.max(1, zoom) : 1) : overviewSize) - viewSize) * (reducedMotion ? 1 : 0.08)
    camera.position.copy(target).add(cameraOffset)
    camera.lookAt(target)
    projection()
    ballShadow.visible = ball.visible
    ballShadow.position.set(ball.position.x, -0.065, ball.position.z)
    if (follow) { jumpGuide.visible = false; spinGuide.visible = false; selection.visible = false; overlap.count = 0 }
    if (glowFrames > 0) {
      glow.visible = true
      glowMaterial.opacity = glowFrames / 18
      glow.scale.setScalar(reducedMotion ? 1 : 1 + (18 - glowFrames) / 12)
      glowFrames--
    } else { glow.visible = false; boostGlow.visible = false }
    renderer.render(scene, camera)
  }
  resize()
  const observer = new ResizeObserver(resize)
  observer.observe(container)
  return {
    renderer, camera, geometries, ball, root, update, select, render,
    syncMechanisms(poses: MechanismPose[]) {
      for (const pose of poses) {
        const part = current.parts.find(item => item.id === pose.id), mesh = moving.get(pose.id)
        if (!part || !mesh) continue
        mesh.position.copy(toLocal(part, pose.position))
        mesh.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), part.rotation * Math.PI / 2).multiply(new THREE.Quaternion(pose.rotation.x, pose.rotation.y, pose.rotation.z, pose.rotation.w))
      }
    },
    effect(event: MarbleEvent) {
      glow.position.copy(event.position)
      glowFrames = 18
      boostGlow.visible = event.kind === 'boost'
      const part = current.parts.find(item => item.id === event.id)
      if (part && boostGlow.visible) { boostGlow.position.copy(part.position); boostGlow.rotation.y = -part.rotation * Math.PI / 2 }
    },
    zoom(delta: number) { zoom = THREE.MathUtils.clamp(zoom + delta, MIN_ZOOM, MAX_ZOOM); projection() },
    /** Pinching scales what is already on screen, so the same gesture works at any zoom. */
    zoomBy(factor: number) { zoom = THREE.MathUtils.clamp(zoom * factor, MIN_ZOOM, MAX_ZOOM); projection() },
    /** Drags the board under the fingers: screen pixels become ground distance at the current zoom. */
    pan(dx: number, dy: number) {
      const perPixel = viewSize / zoom / Math.max(container.clientHeight, 1)
      camera.updateMatrixWorld()
      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0)
      const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1)
      // Screen-up runs into the board, so only the part of it that lies on the ground counts.
      const ground = new THREE.Vector3(up.x, 0, up.z)
      const lean = Math.max(0.25, ground.length())
      panOffset.addScaledVector(right, -dx * perPixel).addScaledVector(ground.normalize(), dy * perPixel / lean)
      panOffset.x = THREE.MathUtils.clamp(panOffset.x, -BOARD_LIMIT, BOARD_LIMIT)
      panOffset.z = THREE.MathUtils.clamp(panOffset.z, -BOARD_LIMIT, BOARD_LIMIT)
    },
    overview() { zoom = 1; panOffset.set(0, 0, 0); fit() },
    dispose() {
      observer.disconnect()
      for (const item of Object.values(geometries)) item.dispose()
      for (const set of Object.values(materials)) for (const material of set) material.dispose()
      for (const item of [floorGeometry, floorMaterial, supportGeometry, supportMaterial, markerGeometry, markerMaterial, selectionGeometry, selectionMaterial, ballGeometry, ballMaterial, shadowGeometry, shadowMaterial, poleGeometry, flagGeometry, flagMaterial, grid.geometry]) item.dispose()
      for (const item of [boardGeometry, barGeometry, hubGeometry, axleGeometry, tipGeometry, holeGeometry, arrowGeometry, inkMaterial, chalkMaterial, motionGeometry, motionMaterial, circleGeometry, circleMaterial, glowGeometry, glowMaterial, overlapGeometry, overlapMaterial]) item.dispose()
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

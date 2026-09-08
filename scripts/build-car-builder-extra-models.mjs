/** Original low-poly bodies. Run: node scripts/build-car-builder-extra-models.mjs
 * No downloads or Blender needed. The committed GLBs are used at runtime.
 * Coordinates: +Z front, +Y up, wheel contact at Y=0. Prints measured catalog data.
 */
import { writeFile } from 'node:fs/promises'
import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'

globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buffer) => {
      this.result = buffer
      this.onloadend?.()
    })
  }
}

function build(id) {
  const pickup = id === 'pickup'
  const root = new THREE.Group()
  const materials = Object.fromEntries(Object.entries({
    Body: '#3d7bf5', Glass: '#24566e', Trim: '#c4cbd2',
    TrimDark: '#28343e', LightRear: '#e54a42',
  }).map(([name, color]) => {
    const material = new THREE.MeshStandardMaterial({ color, roughness: name === 'Glass' ? 0.22 : 0.5 })
    material.name = name
    return [name, material]
  }))
  function block(name, size, position, role = 'Body') {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), materials[role])
    mesh.name = name
    mesh.position.set(...position)
    root.add(mesh)
    return mesh
  }
  // Extrude a side silhouette across the width; round cut-outs leave real wheel arches.
  function profile(name, points, width, role = 'Body') {
    const shape = new THREE.Shape()
    points.forEach(([z, y], index) => index ? shape.lineTo(z, y) : shape.moveTo(z, y))
    shape.closePath()
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false })
    geometry.rotateY(-Math.PI / 2)
    geometry.translate(width / 2, 0, 0)
    const mesh = new THREE.Mesh(geometry, materials[role])
    mesh.name = name
    root.add(mesh)
  }
  const length = pickup ? 4.4 : 4.2
  const width = 1.85
  const half = length / 2
  const axle = pickup ? 1.4 : 1.3
  const lower = [[-half, 0.22]]
  for (const z of [-axle, axle]) {
    lower.push([z - 0.39, 0.22])
    for (let i = 0; i <= 12; i++) {
      const angle = Math.PI - i * Math.PI / 12
      lower.push([z + Math.cos(angle) * 0.39, 0.22 + Math.sin(angle) * 0.39])
    }
  }
  lower.push([half, 0.22], [half, 0.82], [-half, 0.82])
  profile('arch-cut-shell', lower, width)
  if (pickup) {
    profile('cab', [[-0.35, 0.82], [1.26, 0.82], [0.87, 1.61], [0.63, 1.72], [-0.35, 1.72]], 1.69)
    block('hood', [1.81, 0.12, 0.92], [0, 0.88, 1.74])
    // Open cargo bed: dark floor surrounded by three painted walls.
    block('cargo-floor', [1.57, 0.05, 1.64], [0, 0.855, -1.26], 'TrimDark')
    block('tailgate', [1.85, 0.3, 0.12], [0, 0.97, -2.14])
    for (const side of [-1, 1]) {
      block('bed-side', [0.14, 0.3, 1.77], [side * 0.855, 0.97, -1.195])
      block('bed-rail', [0.16, 0.035, 1.77], [side * 0.855, 1.1375, -1.195], 'TrimDark')
    }
    block('tailgate-handle', [0.3, 0.05, 0.02], [0, 1.04, -2.205], 'TrimDark')
    const glass = block('windshield', [1.43, 0.59, 0.015], [0, 1.287, 1.034], 'Glass')
    glass.rotation.x = -Math.atan2(0.39, 0.79)
    block('rear-window', [1.3, 0.45, 0.012], [0, 1.37, -0.357], 'Glass')
    for (const side of [-1, 1]) {
      profile('side-window', [[-0.24, 1.08], [1.09, 1.08], [0.80, 1.59], [-0.24, 1.59]], 0.014, 'Glass')
      root.children.at(-1).position.x = side * 0.848
      block('door-handle', [0.025, 0.045, 0.18], [side * 0.86, 0.98, -0.13], 'TrimDark')
    }
  } else {
    profile('van-cabin', [[-half, 0.82], [half, 0.82], [1.73, 1.78], [1.5, 1.94], [-1.87, 1.94], [-half, 1.72]], 1.81)
    const glass = block('windshield', [1.53, 0.70, 0.015], [0, 1.375, 1.894], 'Glass')
    glass.rotation.x = -Math.atan2(0.37, 0.96)
    for (const side of [-1, 1]) {
      for (const z of [-1.23, -0.23, 0.77]) block('side-window', [0.014, 0.61, 0.82], [side * 0.912, 1.44, z], 'Glass')
      block('sliding-door-track', [0.026, 0.035, 1.95], [side * 0.929, 0.94, -0.67], 'TrimDark')
      block('sliding-door-handle', [0.03, 0.05, 0.21], [side * 0.93, 1.04, 0.13], 'TrimDark')
    }
    block('rear-window', [1.51, 0.48, 0.016], [0, 1.42, -2.108], 'Glass')
    block('rear-door-seam', [0.025, 0.95, 0.02], [0, 1.20, -2.11], 'TrimDark')
  }
  for (const side of [-1, 1]) {
    block('mirror-stem', [0.16, 0.045, 0.06], [side * 0.95, 1.04, pickup ? 1.01 : 1.58], 'TrimDark')
    block('mirror', [0.08, 0.16, 0.23], [side * 1.03, 1.09, pickup ? 1.01 : 1.58], 'TrimDark')
    block('rear-light', [0.16, 0.22, 0.022], [side * 0.72, 0.69, -half - 0.012], 'LightRear')
  }
  block('rear-bumper', [1.86, 0.11, 0.07], [0, 0.36, -half - 0.025], 'Trim')
  // Center the actual geometry, including mirrors/bumper, and measure the result.
  const bounds = new THREE.Box3().setFromObject(root)
  const center = bounds.getCenter(new THREE.Vector3())
  for (const mesh of root.children) mesh.position.sub(new THREE.Vector3(center.x, 0, center.z))
  bounds.setFromObject(root)
  const glassBounds = new THREE.Box3()
  root.children.filter((mesh) => mesh.material.name === 'Glass').forEach((mesh) => glassBounds.expandByObject(mesh))
  const size = bounds.getSize(new THREE.Vector3())
  const cabin = glassBounds.getSize(new THREE.Vector3())
  // The pickup's rear window and the van's rear glass are included in cabin measurements.
  const wheel = { halfTrack: 0.84, radius: 0.3, width: 0.23 }
  return { root, metrics: {
    id, size: { length: size.z, width: size.x, height: size.y }, bodyFloor: bounds.min.y,
    cabin: { centerZ: glassBounds.getCenter(new THREE.Vector3()).z, length: cabin.z, width: cabin.x, floorY: glassBounds.min.y },
    wheels: { front: { z: axle - center.z, ...wheel }, rear: { z: -axle - center.z, ...wheel } },
    materials: [...new Set(root.children.map((mesh) => mesh.material.name))],
  } }
}

for (const id of ['pickup', 'van']) {
  const { root, metrics } = build(id)
  const bytes = await new GLTFExporter().parseAsync(root, { binary: true })
  await writeFile(`public/models/car-builder/${id}.glb`, Buffer.from(bytes))
  console.log(JSON.stringify(metrics))
}

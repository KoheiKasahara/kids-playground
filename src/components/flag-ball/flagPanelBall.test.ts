import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import { findFlagBall } from './flagBalls'
import {
  configureFlagPanelTexture,
  createFlagPanelBallResource,
  createFlagPanelGeometry,
  createFlagPanelTexture,
  DEFAULT_FLAG_PANEL_LAYOUT,
  disposeFlagPanelBallResource,
  FLAG_PANEL_BALL_COLOR,
  FLAG_PANEL_BORDER_COLOR,
  FLAG_PANEL_BORDER_IN_RADII,
  FLAG_PANEL_BORDER_RADIUS_IN_RADII,
  FLAG_PANEL_DEFAULT_ANISOTROPY,
  FLAG_PANEL_FLAG_ASPECT_RATIO,
  FLAG_PANEL_FLAG_RADIUS_IN_RADII,
  FLAG_PANEL_HEIGHT_IN_RADII,
  FLAG_PANEL_LAYOUTS,
  FLAG_PANEL_MAX_ANISOTROPY,
  FLAG_PANEL_SEGMENTS_X,
  FLAG_PANEL_SEGMENTS_Y,
  FLAG_PANEL_WIDTH_IN_RADII,
  getFlagPanelTextureConfig,
  getFlagPanelTextureUrl,
  type FlagPanelDirection,
  type FlagPanelLayoutName,
} from './flagPanelBall'

function flag(id: string) {
  const value = findFlagBall(id)
  if (!value) throw new Error(`test flag is missing: ${id}`)
  return value
}

function panelMeshes(group: THREE.Group, prefix: string): THREE.Mesh[] {
  return group.children.filter(
    (child): child is THREE.Mesh =>
      child instanceof THREE.Mesh && child.name.startsWith(prefix),
  )
}

function uvBounds(geometry: THREE.BufferGeometry) {
  const uv = geometry.getAttribute('uv')
  if (!uv) throw new Error('flag-panel geometry has no UV attribute')

  let minU = Infinity
  let maxU = -Infinity
  let minV = Infinity
  let maxV = -Infinity
  for (let index = 0; index < uv.count; index += 1) {
    minU = Math.min(minU, uv.getX(index))
    maxU = Math.max(maxU, uv.getX(index))
    minV = Math.min(minV, uv.getY(index))
    maxV = Math.max(maxV, uv.getY(index))
  }
  return { minU, maxU, minV, maxV }
}

function layoutNormals(layout: FlagPanelLayoutName): THREE.Vector3[] {
  return FLAG_PANEL_LAYOUTS[layout].map(
    (direction: FlagPanelDirection) =>
      new THREE.Vector3(direction[0], direction[1], direction[2]),
  )
}

/** 仰角58°のカメラから、1回転中に少なくとも1枚が読める割合を求める。 */
function readableSampleCount(layout: FlagPanelLayoutName, directionDegrees: number): number {
  const elevation = THREE.MathUtils.degToRad(58)
  const cameraDirection = new THREE.Vector3(
    0,
    Math.sin(elevation),
    Math.cos(elevation),
  )
  const directionAngle = THREE.MathUtils.degToRad(directionDegrees)
  // 0°を +Z、そこから +X 側へ回す。物理の転がり軸は指定どおり up × d とする。
  const travelDirection = new THREE.Vector3(
    Math.sin(directionAngle),
    0,
    Math.cos(directionAngle),
  )
  const rollAxis = new THREE.Vector3()
    .crossVectors(new THREE.Vector3(0, 1, 0), travelDirection)
    .normalize()
  const normals = layoutNormals(layout)
  const rotation = new THREE.Quaternion()
  const sampleCount = 3600
  let readableCount = 0

  for (let sample = 0; sample < sampleCount; sample += 1) {
    rotation.setFromAxisAngle(rollAxis, (sample / sampleCount) * Math.PI * 2)
    const hasReadablePanel = normals.some(
      (normal) => normal.clone().applyQuaternion(rotation).dot(cameraDirection) >= 0.45,
    )
    if (hasReadablePanel) readableCount += 1
  }

  return readableCount
}

describe('flag panel texture mapping', () => {
  it('resolves public flag URLs under either root or a configured base path', () => {
    expect(getFlagPanelTextureUrl(flag('jp'), '/')).toBe('/flags/jp.svg')
    expect(getFlagPanelTextureUrl(flag('jp'), '/kids-playground')).toBe(
      '/kids-playground/flags/jp.svg',
    )
    expect(getFlagPanelTextureUrl(flag('jp'), '/kids-playground/')).toBe(
      '/kids-playground/flags/jp.svg',
    )
  })

  it('uses one complete 4:3 image with no repeat or offset for representative flags', () => {
    expect(FLAG_PANEL_FLAG_ASPECT_RATIO).toBe(4 / 3)
    expect(FLAG_PANEL_HEIGHT_IN_RADII).toBeCloseTo(0.93)
    expect(FLAG_PANEL_FLAG_RADIUS_IN_RADII).toBeGreaterThan(
      FLAG_PANEL_BORDER_RADIUS_IN_RADII,
    )

    const ids = ['jp', 'bd', 'kr', 'br', 'ca', 'gb', 'us']
    for (const id of ids) {
      const texture = new THREE.Texture()
      const resource = createFlagPanelBallResource(flag(id), {
        loader: { load: vi.fn(() => texture) },
      })
      const flagPanels = panelMeshes(resource.group, 'flag-panel-flag-')

      expect(flagPanels).toHaveLength(4)
      for (const panel of flagPanels) {
        expect(uvBounds(panel.geometry)).toEqual({
          minU: 0,
          maxU: 1,
          minV: 0,
          maxV: 1,
        })
      }
      expect(texture.repeat.x).toBe(1)
      expect(texture.repeat.y).toBe(1)
      expect(texture.offset.x).toBe(0)
      expect(texture.offset.y).toBe(0)
      expect(texture.wrapS).toBe(THREE.ClampToEdgeWrapping)
      expect(texture.wrapT).toBe(THREE.ClampToEdgeWrapping)
      disposeFlagPanelBallResource(resource)
    }
  })

  it('keeps sRGB, mipmap filtering, and the mobile-safe anisotropy cap', () => {
    const config = getFlagPanelTextureConfig(flag('us'))

    expect(config.colorSpace).toBe(THREE.SRGBColorSpace)
    expect(config.repeatX).toBe(1)
    expect(config.repeatY).toBe(1)
    expect(config.offsetX).toBe(0)
    expect(config.offsetY).toBe(0)
    expect(config.wrapS).toBe(THREE.ClampToEdgeWrapping)
    expect(config.wrapT).toBe(THREE.ClampToEdgeWrapping)
    expect(config.minFilter).toBe(THREE.LinearMipmapLinearFilter)
    expect(config.magFilter).toBe(THREE.LinearFilter)
    expect(config.generateMipmaps).toBe(true)
    expect(config.anisotropy).toBe(FLAG_PANEL_DEFAULT_ANISOTROPY)
    expect(getFlagPanelTextureConfig(flag('us'), { maxAnisotropy: 1 }).anisotropy).toBe(1)
    expect(getFlagPanelTextureConfig(flag('us'), { anisotropy: 99 }).anisotropy).toBe(
      FLAG_PANEL_MAX_ANISOTROPY,
    )
  })

  it('applies the texture config to the same Texture instance', () => {
    const texture = new THREE.Texture()
    const config = getFlagPanelTextureConfig(flag('jp'))

    expect(configureFlagPanelTexture(texture, config)).toBe(texture)
    expect(texture.repeat.x).toBe(1)
    expect(texture.repeat.y).toBe(1)
    expect(texture.offset.x).toBe(0)
    expect(texture.offset.y).toBe(0)
    expect(texture.wrapS).toBe(config.wrapS)
    expect(texture.wrapT).toBe(config.wrapT)
    expect(texture.colorSpace).toBe(config.colorSpace)
    expect(texture.anisotropy).toBe(config.anisotropy)
    texture.dispose()
  })

  it('supports creating only a texture with a test loader', () => {
    const texture = new THREE.Texture()
    const load = vi.fn(() => texture)

    expect(
      createFlagPanelTexture(flag('kr'), {
        baseUrl: '/app/',
        loader: { load },
      }),
    ).toBe(texture)
    expect(load).toHaveBeenCalledWith('/app/flags/kr.svg')
    texture.dispose()
  })
})

describe('flag panel geometry and resource lifecycle', () => {
  it('maps the center lines by exact arc length and fills the full UV range', () => {
    const geometry = createFlagPanelGeometry(
      1,
      FLAG_PANEL_WIDTH_IN_RADII,
      FLAG_PANEL_HEIGHT_IN_RADII,
      FLAG_PANEL_SEGMENTS_X,
      FLAG_PANEL_SEGMENTS_Y + 1,
    )
    const position = geometry.getAttribute('position')
    const row = FLAG_PANEL_SEGMENTS_X + 1
    const centerRow = (FLAG_PANEL_SEGMENTS_Y + 1) / 2
    const center = new THREE.Vector3().fromBufferAttribute(position, centerRow * row + 6)
    const horizontalEdge = new THREE.Vector3().fromBufferAttribute(
      position,
      centerRow * row + FLAG_PANEL_SEGMENTS_X,
    )
    const verticalEdge = new THREE.Vector3().fromBufferAttribute(
      position,
      (FLAG_PANEL_SEGMENTS_Y + 1) * row + 6,
    )

    expect(center.toArray()).toEqual([0, 0, 1])
    expect(center.angleTo(horizontalEdge)).toBeCloseTo(FLAG_PANEL_WIDTH_IN_RADII / 2)
    expect(center.angleTo(verticalEdge)).toBeCloseTo(FLAG_PANEL_HEIGHT_IN_RADII / 2)
    expect(uvBounds(geometry)).toEqual({ minU: 0, maxU: 1, minV: 0, maxV: 1 })
    geometry.dispose()
  })

  it('creates a group with a neutral ball, border panels, and flag panels', () => {
    const texture = new THREE.Texture()
    const resource = createFlagPanelBallResource(flag('jp'), {
      loader: { load: () => texture },
    })

    expect(resource.group).toBeInstanceOf(THREE.Group)
    expect(resource.group.name).toBe('flag-panel-ball')
    expect(panelMeshes(resource.group, 'flag-panel-border-')).toHaveLength(4)
    expect(panelMeshes(resource.group, 'flag-panel-flag-')).toHaveLength(4)
    expect(resource.geometries).toHaveLength(3)
    expect(resource.materials).toHaveLength(3)

    const sphereMaterial = resource.materials.find(
      (material): material is THREE.MeshLambertMaterial =>
        material instanceof THREE.MeshLambertMaterial && material.map === null,
    )
    expect(sphereMaterial?.color.getHex()).toBe(FLAG_PANEL_BALL_COLOR)
    const borderMaterial = resource.materials.find(
      (material): material is THREE.MeshLambertMaterial =>
        material instanceof THREE.MeshLambertMaterial && material.color.getHex() === FLAG_PANEL_BORDER_COLOR,
    )
    expect(borderMaterial).toBeDefined()
    const flagMaterial = resource.materials.find(
      (material): material is THREE.MeshLambertMaterial =>
        material instanceof THREE.MeshLambertMaterial && material.map !== null,
    )
    expect(flagMaterial?.map).toBe(texture)
    disposeFlagPanelBallResource(resource)
  })

  it('disposes every geometry, material, and the shared texture together', () => {
    const texture = new THREE.Texture()
    const resource = createFlagPanelBallResource(flag('jp'), {
      loader: { load: () => texture },
    })
    const geometryDisposes = resource.geometries.map((geometry) => vi.spyOn(geometry, 'dispose'))
    const materialDisposes = resource.materials.map((material) => vi.spyOn(material, 'dispose'))
    const textureDispose = vi.spyOn(texture, 'dispose')

    disposeFlagPanelBallResource(resource)

    for (const dispose of geometryDisposes) expect(dispose).toHaveBeenCalledTimes(1)
    for (const dispose of materialDisposes) expect(dispose).toHaveBeenCalledTimes(1)
    expect(textureDispose).toHaveBeenCalledTimes(1)
  })
})

describe('flag panel layout visibility comparison', () => {
  it('compares readable time for two and four panels over one roll', () => {
    const expectedCounts = {
      two: [2530, 1472, 3600],
      four: [2530, 2944, 3600],
    }

    for (const layout of ['two', 'four'] as const) {
      for (const [index, direction] of [0, 45, 90].entries()) {
        expect(readableSampleCount(layout, direction)).toBe(expectedCounts[layout][index])
      }
    }

    expect(DEFAULT_FLAG_PANEL_LAYOUT).toBe('four')
    // 4枚は斜め方向で 40.89% → 81.78% へ改善し、正面・側面でも2枚を下回らない。
    expect(readableSampleCount('four', 45)).toBeGreaterThan(
      readableSampleCount('two', 45),
    )
  })

  it('keeps neighboring curved panels from overlapping on the sphere', () => {
    const borderHalfWidthInRadians =
      (FLAG_PANEL_WIDTH_IN_RADII / 2 + FLAG_PANEL_BORDER_IN_RADII) /
      FLAG_PANEL_BORDER_RADIUS_IN_RADII

    for (const layout of ['two', 'four'] as const) {
      const normals = layoutNormals(layout)
      let minimumCenterAngle = Math.PI
      for (let first = 0; first < normals.length; first += 1) {
        for (let second = first + 1; second < normals.length; second += 1) {
          minimumCenterAngle = Math.min(
            minimumCenterAngle,
            normals[first].angleTo(normals[second]),
          )
        }
      }

      expect(borderHalfWidthInRadians * 2).toBeLessThan(minimumCenterAngle)
    }

    expect(borderHalfWidthInRadians * 2).toBeLessThan(Math.PI / 2)
  })
})

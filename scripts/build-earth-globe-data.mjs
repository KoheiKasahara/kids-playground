import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { feature } from 'topojson-client'
import worldTopology from 'world-atlas/countries-50m.json' with { type: 'json' }

// 巨大arcだけを間引くことで、共有される国境を保ったまま地理データ生成を軽量化する。
const minPoints = 40
// 50mデータで形状を大きく崩さず、ベンチマークで生成時間を大幅に短縮できた値。
const eps = 0.05
// Douglas-Peuckerが残した折れ角を丸めるChaikin(角切り)の反復回数。
const smoothingIterations = 2
// 丸めたあとの輪郭から、見た目を変えずに冗長な点だけを間引くときの許容誤差。
// 最大ズームでは画面1px≒0.03度なので、0.015度は0.5px相当までのずれに収まる。
const smoothedEps = 0.015
// 最大の島・飛び地は必ず残し、小さな島だけを描画対象から減らす。
const areaThreshold = 0.05
// 小数3桁(約110m)は最大ズームでも0.02px相当の誤差しかなく、角を丸めて増えた
// 座標の出力サイズを抑えられる。
const coordinateDecimals = 3
// 0.5度に密度化すると球面の弦の沈み込みは 100 * (1 - cos(0.25°)) ≈ 0.001
// world unit。three-conic-polygon-geometryの曲面グリッドに沿った三角形分割が
// 長い輪郭辺でポリゴンを覆いきれず穴を残す問題にも対策する。実測では4度の
// 欠損合計2.267/最大0.429平方度が、0.5度で0.454/0.065平方度に減少した
// （座標数37,950→42,323、生成時間1279→1306ms）。
const maxArcAngleDegrees = 0.5

const outputPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../src/games/earth-globe/data/worldFeatures.json',
)

const samePoint = (a, b) => a[0] === b[0] && a[1] === b[1]

function decodeArcs(topology) {
  const [scaleX, scaleY] = topology.transform.scale
  const [translateX, translateY] = topology.transform.translate

  return topology.arcs.map((arc) => {
    let x = 0
    let y = 0

    return arc.map(([deltaX, deltaY]) => {
      x += deltaX
      y += deltaY
      return [x * scaleX + translateX, y * scaleY + translateY]
    })
  })
}

function encodeArcs(arcs, topology) {
  const [scaleX, scaleY] = topology.transform.scale
  const [translateX, translateY] = topology.transform.translate

  return arcs.map((arc) => {
    let previousX = 0
    let previousY = 0

    return arc.map(([absoluteX, absoluteY]) => {
      const x = Math.round((absoluteX - translateX) / scaleX)
      const y = Math.round((absoluteY - translateY) / scaleY)
      const delta = [x - previousX, y - previousY]
      previousX = x
      previousY = y
      return delta
    })
  })
}

function distanceFromLine(point, start, end) {
  const [startX, startY] = start
  const [endX, endY] = end
  const [pointX, pointY] = point
  const deltaX = endX - startX
  const deltaY = endY - startY
  const denominator = Math.hypot(deltaX, deltaY) || 1

  return Math.abs(
    deltaY * pointX - deltaX * pointY + endX * startY - endY * startX,
  ) / denominator
}

function greatCircleAngleDegrees(start, end) {
  const degreesToRadians = Math.PI / 180
  const [startLongitude, startLatitude] = start.map((value) => value * degreesToRadians)
  const [endLongitude, endLatitude] = end.map((value) => value * degreesToRadians)
  const cosine = Math.sin(startLatitude) * Math.sin(endLatitude)
    + Math.cos(startLatitude) * Math.cos(endLatitude)
      * Math.cos(endLongitude - startLongitude)

  return Math.acos(Math.min(1, Math.max(-1, cosine))) / degreesToRadians
}

function douglasPeucker(points, tolerance) {
  if (points.length <= 2) return points

  const keep = new Uint8Array(points.length)
  keep[0] = 1
  keep[points.length - 1] = 1
  const stack = [[0, points.length - 1]]

  while (stack.length > 0) {
    const [startIndex, endIndex] = stack.pop()
    const start = points[startIndex]
    const end = points[endIndex]
    let farthestIndex = -1
    let farthestDistance = tolerance

    for (let index = startIndex + 1; index < endIndex; index += 1) {
      const distance = distanceFromLine(points[index], start, end)
      if (distance > farthestDistance) {
        farthestDistance = distance
        farthestIndex = index
      }
    }

    if (farthestIndex === -1) continue

    keep[farthestIndex] = 1
    stack.push([startIndex, farthestIndex], [farthestIndex, endIndex])
  }

  return points.filter((_, index) => keep[index] === 1)
}

function simplifyClosedArc(arc, tolerance) {
  let farthestIndex = -1
  let farthestDistance = 0
  const [startX, startY] = arc[0]

  for (let index = 1; index < arc.length - 1; index += 1) {
    const [x, y] = arc[index]
    const distance = (x - startX) ** 2 + (y - startY) ** 2
    if (distance > farthestDistance) {
      farthestDistance = distance
      farthestIndex = index
    }
  }

  // 全点が同じ閉じたarcは、分割しても形状を復元できないため元のarcを残す。
  if (farthestIndex === -1) return arc

  const firstPart = douglasPeucker(arc.slice(0, farthestIndex + 1), tolerance)
  const secondPart = douglasPeucker(arc.slice(farthestIndex), tolerance)
  const simplified = [...firstPart.slice(0, -1), ...secondPart]

  // 始点・最遠点・始点の3点だけになった場合は、閉じた輪を壊さない。
  return simplified.length >= 4 ? simplified : arc
}

/**
 * Chaikinの角切りを1回かける。各辺を1:3と3:1に内分した2点で置き換えるため、
 * 折れ点が2つの緩い角に分かれ、繰り返すほど滑らかな曲線に近づく。
 * arcは隣接国と共有されるため、arc単位で丸めれば国境に隙間は生じない。
 * 開いたarcの端点は他のarcとの接続点なので固定する。
 */
function chaikinOnce(points, isClosed) {
  const loop = isClosed ? points.slice(0, -1) : points
  if (loop.length < 3) return points

  const smoothed = []
  if (!isClosed) smoothed.push(points[0])

  const lastIndex = isClosed ? loop.length - 1 : loop.length - 2
  for (let index = 0; index <= lastIndex; index += 1) {
    const start = loop[index]
    const end = loop[(index + 1) % loop.length]
    smoothed.push([
      start[0] * 0.75 + end[0] * 0.25,
      start[1] * 0.75 + end[1] * 0.25,
    ])
    smoothed.push([
      start[0] * 0.25 + end[0] * 0.75,
      start[1] * 0.25 + end[1] * 0.75,
    ])
  }

  if (isClosed) {
    smoothed.push([...smoothed[0]])
  } else {
    smoothed.push(points[points.length - 1])
  }

  return smoothed
}

function crossesAntimeridian(arc) {
  for (let index = 1; index < arc.length; index += 1) {
    if (Math.abs(arc[index][0] - arc[index - 1][0]) > 180) return true
  }

  return false
}

function smoothArc(arc) {
  const isClosed = samePoint(arc[0], arc[arc.length - 1])
  if (arc.length < (isClosed ? 4 : 3)) return arc
  // 日付変更線をまたぐ辺は経度が+180と-180で不連続になり、平均すると地球を一周する
  // 点が生まれてポリゴンが全球を覆ってしまう。該当するarcは丸めずそのまま残す。
  if (crossesAntimeridian(arc)) return arc

  let smoothed = arc
  for (let iteration = 0; iteration < smoothingIterations; iteration += 1) {
    smoothed = chaikinOnce(smoothed, isClosed)
  }

  // 角切りは直線部分にも点を増やすので、見た目に影響しない範囲で間引き直す。
  const thinned = isClosed
    ? simplifyClosedArc(smoothed, smoothedEps)
    : douglasPeucker(smoothed, smoothedEps)

  return thinned.length >= (isClosed ? 4 : 2) ? thinned : smoothed
}

function simplifyArc(arc) {
  if (arc.length <= minPoints) return arc

  const lastPoint = arc[arc.length - 1]
  const simplified = samePoint(arc[0], lastPoint)
    ? simplifyClosedArc(arc, eps)
    : douglasPeucker(arc, eps)

  // 折れ角を作るのは間引いたarcだけなので、丸めるのも間引いたarcだけにする。
  // 小さな島の輪など元のまま残したarcは、点数も形も変えない。
  return simplified.length >= 2 ? smoothArc(simplified) : arc
}

function splitLongEdges(arc) {
  if (arc.length <= 1) return { arc, splitEdgeCount: 0, insertedPointCount: 0 }

  const splitArc = [arc[0]]
  let splitEdgeCount = 0
  let insertedPointCount = 0

  for (let index = 1; index < arc.length; index += 1) {
    const start = arc[index - 1]
    const end = arc[index]
    const angle = greatCircleAngleDegrees(start, end)
    const segmentCount = Math.max(1, Math.ceil(angle / maxArcAngleDegrees))

    if (segmentCount > 1) {
      splitEdgeCount += 1
      insertedPointCount += segmentCount - 1
    }

    for (let segmentIndex = 1; segmentIndex < segmentCount; segmentIndex += 1) {
      const ratio = segmentIndex / segmentCount
      splitArc.push([
        start[0] + (end[0] - start[0]) * ratio,
        start[1] + (end[1] - start[1]) * ratio,
      ])
    }

    splitArc.push(end)
  }

  return { arc: splitArc, splitEdgeCount, insertedPointCount }
}

function simplifyTopology(topology) {
  const decodedArcs = decodeArcs(topology)
  const simplifiedArcs = decodedArcs.map(simplifyArc)
  let splitEdgeCount = 0
  let insertedPointCount = 0
  const splitArcs = simplifiedArcs.map((arc) => {
    const result = splitLongEdges(arc)
    splitEdgeCount += result.splitEdgeCount
    insertedPointCount += result.insertedPointCount
    return result.arc
  })

  return {
    topology: {
      ...topology,
      arcs: encodeArcs(splitArcs, topology),
    },
    splitEdgeCount,
    insertedPointCount,
  }
}

function roundCoordinate(value) {
  return Number(value.toFixed(coordinateDecimals))
}

function sanitizeRing(ring) {
  const sanitized = []

  for (const point of ring) {
    const roundedPoint = [roundCoordinate(point[0]), roundCoordinate(point[1])]
    const previousPoint = sanitized[sanitized.length - 1]
    if (previousPoint === undefined || !samePoint(previousPoint, roundedPoint)) {
      sanitized.push(roundedPoint)
    }
  }

  if (sanitized.length > 0 && !samePoint(sanitized[0], sanitized.at(-1))) {
    sanitized.push([...sanitized[0]])
  }

  return sanitized.length >= 4 ? sanitized : null
}

function sanitizePolygon(polygon) {
  const outerRing = sanitizeRing(polygon[0])
  if (outerRing === null) return null

  const holes = polygon
    .slice(1)
    .map(sanitizeRing)
    .filter((ring) => ring !== null)

  return {
    coordinates: [outerRing, ...holes],
    area: ringArea(outerRing),
  }
}

function ringArea(ring) {
  let area = 0

  for (let index = 0, previousIndex = ring.length - 1; index < ring.length; index += 1) {
    const previous = ring[previousIndex]
    const current = ring[index]
    area += previous[0] * current[1] - current[0] * previous[1]
    previousIndex = index
  }

  return Math.abs(area / 2)
}

function polygonsOfGeometry(geometry) {
  return geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
}

function featureId(sourceFeature, nextSyntheticId) {
  if (sourceFeature.id !== undefined) return Number(sourceFeature.id)
  return nextSyntheticId
}

function cleanFeatures(collection) {
  let nextSyntheticId = -1
  const recordsById = new Map()

  for (const sourceFeature of collection.features) {
    if (sourceFeature.geometry === null) {
      throw new Error(`Geometryがないfeatureがあります: ${sourceFeature.id ?? 'undefined'}`)
    }

    const polygons = polygonsOfGeometry(sourceFeature.geometry)
      .map(sanitizePolygon)
      .filter((polygon) => polygon !== null)

    if (polygons.length === 0) {
      throw new Error(`外側リングがすべて破棄されました: ${sourceFeature.id ?? 'undefined'}`)
    }

    const id = featureId(sourceFeature, nextSyntheticId)
    if (sourceFeature.id === undefined) nextSyntheticId -= 1

    // AustraliaとAshmoreのように同じISO IDを持つfeatureは1国のMultiPolygonへ統合する。
    const existing = recordsById.get(id)
    if (existing === undefined) {
      recordsById.set(id, { id, polygons })
    } else {
      existing.polygons.push(...polygons)
    }
  }

  return [...recordsById.values()]
}

function keepPolygonsByArea(records) {
  return records.map((record) => {
    let largestIndex = 0

    for (let index = 1; index < record.polygons.length; index += 1) {
      if (record.polygons[index].area > record.polygons[largestIndex].area) {
        largestIndex = index
      }
    }

    const polygons = record.polygons.filter(
      (polygon, index) => index === largestIndex || polygon.area >= areaThreshold,
    )

    if (polygons.length === 0) {
      throw new Error(`ポリゴンが0個になりました: ${record.id}`)
    }

    return { id: record.id, polygons }
  })
}

function toGeoJsonFeatures(records) {
  return records.map(({ id, polygons }) => ({
    id,
    geometry: polygons.length === 1
      ? { type: 'Polygon', coordinates: polygons[0].coordinates }
      : { type: 'MultiPolygon', coordinates: polygons.map((polygon) => polygon.coordinates) },
  }))
}

function summarizeRecords(records) {
  let polygonCount = 0
  let coordinateCount = 0
  let maxRingPoints = 0

  for (const record of records) {
    polygonCount += record.polygons.length
    for (const polygon of record.polygons) {
      for (const ring of polygon.coordinates) {
        coordinateCount += ring.length
        maxRingPoints = Math.max(maxRingPoints, ring.length)
      }
    }
  }

  return {
    polygonCount,
    coordinateCount,
    maxRingPoints,
    countryCount: records.length,
  }
}

function summarizeSource(collection) {
  const records = collection.features.map((sourceFeature) => {
    if (sourceFeature.geometry === null) return { polygons: [] }
    return { polygons: polygonsOfGeometry(sourceFeature.geometry).map((coordinates) => ({ coordinates })) }
  })

  return summarizeRecords(records)
}

const sourceCollection = feature(worldTopology, worldTopology.objects.countries)
const sourceStats = summarizeSource(sourceCollection)
const {
  topology: simplifiedTopology,
  splitEdgeCount,
  insertedPointCount,
} = simplifyTopology(worldTopology)
const simplifiedCollection = feature(simplifiedTopology, simplifiedTopology.objects.countries)
const cleanedRecords = cleanFeatures(simplifiedCollection)
const simplifiedStats = summarizeRecords(cleanedRecords)
const outputFeatures = toGeoJsonFeatures(keepPolygonsByArea(cleanedRecords))
const outputRecords = outputFeatures.map((outputFeature) => ({
  id: outputFeature.id,
  polygons: polygonsOfGeometry(outputFeature.geometry).map((coordinates) => ({ coordinates })),
}))
const outputStats = summarizeRecords(outputRecords)

const ids = new Set(outputFeatures.map((outputFeature) => outputFeature.id))
if (ids.size !== outputFeatures.length) throw new Error('出力featureのidが重複しています')

const serialized = [
  '[',
  outputFeatures.map((outputFeature) => `  ${JSON.stringify(outputFeature)}`).join(',\n'),
  ']\n',
].join('\n')
fs.writeFileSync(outputPath, serialized, 'utf8')

console.log(`簡略化パラメータ: minPoints=${minPoints}, eps=${eps}, 面積閾値=${areaThreshold}`)
console.log(
  `角丸めパラメータ: Chaikin=${smoothingIterations}回, 再間引きeps=${smoothedEps}, `
  + `座標小数=${coordinateDecimals}桁`,
)
console.log(
  `座標数: ${sourceStats.coordinateCount.toLocaleString()} -> `
  + `${simplifiedStats.coordinateCount.toLocaleString()} -> ${outputStats.coordinateCount.toLocaleString()}`,
)
console.log(
  `長辺再分割: ${splitEdgeCount}辺, 中間点追加=${insertedPointCount.toLocaleString()}点`,
)
console.log(
  `ポリゴン数: ${sourceStats.polygonCount.toLocaleString()} -> `
  + `${simplifiedStats.polygonCount.toLocaleString()} -> ${outputStats.polygonCount.toLocaleString()}`,
)
const syntheticCountryCount = outputFeatures.filter((outputFeature) => outputFeature.id < 0).length
const isoCountryCount = outputFeatures.length - syntheticCountryCount
console.log(
  `国数: ${outputStats.countryCount} (ISO numeric ${isoCountryCount}固有ID `
  + `/入力feature 236 + 特殊領域 ${syntheticCountryCount})`,
)
console.log(
  `最大リング点数: ${sourceStats.maxRingPoints} -> `
  + `${simplifiedStats.maxRingPoints} -> ${outputStats.maxRingPoints}`,
)
console.log(`生成JSON: ${outputPath} (${fs.statSync(outputPath).size.toLocaleString()} bytes)`)

for (const [id, name] of [[392, '日本'], [410, '韓国'], [380, 'イタリア'], [826, 'イギリス'], [158, '台湾']]) {
  const record = outputRecords.find((outputRecord) => outputRecord.id === id)
  if (record === undefined) throw new Error(`確認対象のfeatureがありません: ${id}`)
  const stats = summarizeRecords([record])
  console.log(
    `${name}(${id}): 座標数=${stats.coordinateCount}, `
    + `ポリゴン数=${stats.polygonCount}, 最大リング点数=${stats.maxRingPoints}`,
  )
}

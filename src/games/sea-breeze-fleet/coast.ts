import { chartHeight, chartWidth, shoreDistance, type Chart } from './charts'

export function noiseSeed(i: number) {
  let n = Math.imul(i ^ (i >>> 16), 0x45d9f3b)
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b)
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296
}

function noise(x: number, y: number) {
  const ix = Math.floor(x), iy = Math.floor(y)
  let fx = x - ix, fy = y - iy
  fx *= fx * (3 - 2 * fx)
  fy *= fy * (3 - 2 * fy)
  const key = ix + iy * 1021
  const a = noiseSeed(key) * (1 - fx) + noiseSeed(key + 1) * fx
  const b = noiseSeed(key + 1021) * (1 - fx) + noiseSeed(key + 1022) * fx
  return a * (1 - fy) + b * fy
}

const seas = {
  harbor: ['235f74', '266579', '286b7e', '308596', '439eaa', '65b8b8', '94cfbf', 'cae1c6'],
  escort: ['22717c', '237882', '267e86', '319c9e', '4db2aa', '7ac6b2', 'a6d9ba', 'd9e9c5'],
  flagship: ['495872', '4e6078', '54677e', '688795', '899e9d', 'b7aaa0', 'd7bba3', 'f1d9b2'],
}
const ground = ['faf0c8', 'f1d49d', 'ddb981', 'bd996b', '9ba663', 'aeBD77', '8da665', '75915c', '64885a']

function rgba(hex: string) {
  const rgb = parseInt(hex, 16)
  return (0xff000000 | (rgb & 255) << 16 | (rgb & 0xff00) | rgb >>> 16) >>> 0
}
type Context = CanvasRenderingContext2D

function polygon(ctx: Context, color: string, points: number[][]) {
  ctx.fillStyle = color
  ctx.beginPath()
  points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))
  ctx.closePath()
  ctx.fill()
}

function lighthouse(c: Context) {
  const blocks = (x: number, y: number, w: number, h: number, col: string) => {
    c.fillStyle = col
    c.fillRect(x, y, w, h)
  }
  polygon(c, '#809368', [[-11, 2], [9, -3], [23, 0], [12, 5], [-8, 6]])
  blocks(-10, -3, 20, 6, '#726f60')
  blocks(-9, -5, 17, 5, '#d5c499')
  for (let h = 0; h < 33; h++) {
    const radius = Math.floor(7.8 - h / 11)
    const red = (h >= 8 && h < 15) || h > 25
    blocks(-radius, -h - 4, radius * 2, 1, red ? '#c35641' : '#f6e8c5')
    blocks(radius - 3, -h - 4, 3, 1, red ? '#98483d' : '#b5bdab')
    blocks(-radius, -h - 4, 2, 1, red ? '#e78055' : '#fff7d6')
  }
  blocks(-3, -9, 4, 8, '#4f584f')
  blocks(-2, -25, 3, 4, '#546770')
  blocks(-9, -37, 18, 2, '#3a575c')
  blocks(-7, -40, 14, 1, '#435e60')
  for (const x of [-7, -4, 3, 6]) blocks(x, -40, 1, 4, '#536968')
  blocks(-5, -44, 10, 7, '#385767')
  blocks(-3, -43, 2, 5, '#ffe18d')
  blocks(0, -43, 3, 5, '#ffeeb6')
  polygon(c, '#ab5142', [[-8, -44], [-6, -47], [-1, -50], [2, -50], [8, -45], [8, -44]])
  blocks(-1, -52, 2, 3, '#385767')
}

function cottage(c: Context, roof: string) {
  polygon(c, '#8b966e', [[-9, 0], [4, -6], [19, 0], [11, 5], [-5, 4]])
  polygon(c, '#f3dba6', [[-10, -9], [4, -13], [4, 0], [-10, 3]])
  polygon(c, '#c7b288', [[4, -13], [13, -9], [13, 1], [4, 4]])
  polygon(c, roof, [[-13, -8], [-7, -18], [8, -21], [2, -11]])
  polygon(c, '#9b5847', [[2, -11], [8, -21], [15, -10], [11, -8], [7, -15], [4, -10]])
  c.fillStyle = '#526875'
  c.fillRect(-8, -7, 3, 4); c.fillRect(-2, -8, 3, 7); c.fillRect(8, -7, 3, 4)
  c.fillStyle = '#f3c879'
  c.fillRect(-8, -7, 2, 2); c.fillRect(8, -7, 2, 2)
  c.fillStyle = '#987766'
  c.fillRect(-4, -21, 3, 5)
}

function pine(c: Context, shade: number) {
  c.fillStyle = '#919761'; c.fillRect(-1, 0, 10, 2)
  c.fillStyle = '#796b4e'; c.fillRect(-1, -5, 3, 7)
  for (let i = 0; i < 3; i++) {
    const y = -i * 5
    polygon(c, shade > 0.4 ? '#436e5c' : '#4d7757', [[-7 + i, y - 2], [-3, y - 8], [0, y - 14], [4, y - 8], [7 - i, y - 3], [3, y], [-3, y]])
    polygon(c, shade > 0.4 ? '#81a76d' : '#739764', [[-6 + i, y - 3], [0, y - 13], [1, y - 7], [-1, y - 6], [-1, y - 4]])
  }
}

function palm(c: Context) {
  polygon(c, '#93784f', [[-2, 1], [2, 1], [1, -9], [4, -17], [2, -18], [-1, -10]])
  for (const side of [-1, 1]) {
    polygon(c, '#427d61', [[2, -17], [2 + side * 7, -19], [2 + side * 13, -16], [2 + side * 15, -11], [2 + side * 8, -15]])
    polygon(c, '#73a45f', [[2, -17], [2 + side * 6, -23], [2 + side * 10, -23], [2 + side * 13, -21], [2 + side * 7, -21]])
    polygon(c, '#508e60', [[2, -17], [2 + side * 6, -16], [2 + side * 8, -6], [2 + side * 5, -10]])
  }
}

function pier(c: Context) {
  for (let i = 0; i <= 23; i++) {
    const x = i * 1.6, y = i * 0.5
    if (i % 6 === 0) {
      c.fillStyle = '#435d58'; c.fillRect(x, y, 2, 9); c.fillRect(x + 4, y - 5, 2, 7)
    }
    c.fillStyle = i % 3 ? '#c99965' : '#dbb582'
    c.fillRect(x, y - 4, 2, 7)
    c.fillStyle = '#805f4d'; c.fillRect(x, y + 3, 2, 2)
  }
  c.fillStyle = '#f6d6a1'; c.fillRect(35, 6, 2, 5)
  c.fillStyle = '#cc7050'; c.fillRect(35, 5, 2, 3)
}

export function paintStamp(c: Context, kind: Chart['kind']) {
  const dusk = kind === 'flagship'
  c.fillStyle = dusk ? '#ebad82' : kind === 'escort' ? '#a8d9c9' : '#a9cbd0'
  c.fillRect(0, 0, 72, 46)
  c.fillStyle = dusk ? '#ffe2a0' : '#f6efce'
  if (dusk) {
    c.fillRect(46, 7, 12, 12); c.fillRect(44, 9, 16, 8)
  } else {
    c.fillRect(43, 8, 14, 2); c.fillRect(48, 6, 6, 2)
    c.fillRect(6, 13, 9, 2)
  }
  polygon(c, dusk ? '#978d98' : '#80aaa1', [[0, 30], [0, 24], [14, 21], [22, 24], [32, 23], [43, 28], [72, 25], [72, 30]])
  c.fillStyle = dusk ? '#7b8796' : '#468e99'; c.fillRect(0, 29, 72, 17)
  c.fillStyle = dusk ? '#debd97' : '#a1d2c1'
  for (let i = 0; i < 17; i++) c.fillRect(Math.floor(noiseSeed(i + 75) * 72), 30 + i % 14, 4 + i % 5, 1)
  if (dusk) {
    polygon(c, '#384a5a', [[13, 29], [52, 29], [45, 35], [21, 35]])
    c.fillStyle = '#c65c47'; c.fillRect(21, 32, 25, 2)
    c.fillStyle = '#efd6a7'; c.fillRect(24, 24, 17, 5); c.fillRect(36, 20, 6, 5)
    c.fillStyle = '#394957'; c.fillRect(25, 18, 4, 7); c.fillRect(31, 18, 3, 7); c.fillRect(38, 12, 1, 9)
    c.fillStyle = '#f5c26d'; c.fillRect(25, 20, 4, 3); c.fillRect(31, 20, 3, 3)
  } else {
    polygon(c, '#e8c582', [[4, 34], [13, 30], [32, 27], [50, 30], [61, 34], [43, 37], [15, 37]])
    polygon(c, '#849b62', [[9, 32], [23, 28], [37, 26], [51, 32], [34, 34]])
    c.save()
    c.translate(32, 31)
    if (kind === 'harbor') { c.scale(0.52, 0.52); lighthouse(c) }
    else { c.scale(1.15, 1.15); palm(c); c.translate(12, 1); c.scale(0.68, 0.68); palm(c) }
    c.restore()
  }
}

// Bake the chart once per size. All moving sprites and water glints are drawn separately.
export function paintCoast(chart: Chart, width: number, height: number) {
  const out = document.createElement('canvas')
  out.width = width; out.height = height
  const c = out.getContext('2d')!
  const image = c.createImageData(width, height)
  const pixels = new Uint32Array(image.data.buffer)
  const colors = [...seas[chart.kind], ...ground].map(rgba)
  for (let j = 0; j < height; j++) {
    const y = j * chartHeight / height
    for (let i = 0; i < width; i++) {
      const x = i * chartWidth / width
      const grain = noiseSeed(i + j * 1777)
      const patch = noise(x / 31, y / 14)
      const d = shoreDistance(x, y, chart.islands) + 2.8 * patch + noise(x * 0.32, y * 0.38) * 2
      const water = d + 10 * noise(x / 20, y / 11)
      let index: number
      if (d < -7) {
        const grass = patch + noise(x / 6, y / 4) * 0.6 + grain * 0.18
        index = grass > 1.22 ? 15 : grass > 0.95 ? 14 : grass > 0.70 ? 13 : 12
        if (grain > 0.977) index = grass > 1 ? 16 : 10
      } else if (d < -4.5) index = grain < 0.24 ? 10 : 11
      else if (d < -1) index = grain < 0.32 ? 10 : 9
      else if (d < 0.8) index = 8
      else if (water < 6) index = 7
      else if (water < 11) index = 6
      else if (water < 18) index = 5
      else if (water < 25) index = 4
      else if (water < 34) index = 3
      else {
        const current = noise(x / 70 + 0.4 * Math.sin(y / 21), y / 25) + patch * 0.22
        index = current > 0.77 ? 2 : current > 0.32 ? 1 : 0
      }
      pixels[j * width + i] = colors[index]
    }
  }
  c.putImageData(image, 0, 0)
  const scale = Math.min(width / chartWidth, height / chartHeight)
  const objects: { x: number; y: number; size: number; draw: (ctx: Context) => void }[] = []
  for (const [idx, isle] of chart.islands.entries()) {
    for (let n = 0; n < 54; n++) {
      const r = n + idx * 180
      const x = isle.x + (2 * noiseSeed(r + 10) - 1) * isle.rx
      const y = isle.y + (2 * noiseSeed(r + 471) - 1) * isle.ry
      if (shoreDistance(x, y, chart.islands) > -9) continue
      if (idx === 0 && x > isle.x - 25 && y > isle.y - 7) continue
      const size = 0.48 + 0.74 * noiseSeed(r + 193)
      objects.push({ x, y, size, draw: ctx => chart.kind === 'escort' ? palm(ctx) : pine(ctx, noiseSeed(r)) })
    }
  }
  const port = chart.islands[0]
  const x = Math.max(28, port.x + 20), y = Math.max(29, port.y + port.ry * 0.56)
  objects.push(
    { x: port.x + port.rx * 0.75, y: port.y + port.ry * 0.52, size: 1, draw: pier },
    { x: x - 27, y: y + 1, size: 0.84, draw: ctx => cottage(ctx, '#c8654b') },
    { x: x + 23, y: y - 8, size: 0.72, draw: ctx => cottage(ctx, '#58848a') },
    { x, y, size: 0.92, draw: lighthouse },
  )
  objects.sort((a, b) => a.y - b.y)
  for (const obj of objects) {
    c.save()
    c.translate(Math.round(obj.x * width / chartWidth), Math.round(obj.y * height / chartHeight))
    c.scale(scale * obj.size, scale * obj.size)
    obj.draw(c)
    c.restore()
  }
  return out
}

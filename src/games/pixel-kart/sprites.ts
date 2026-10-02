import type { CourseId, ItemId } from './types'

type Ctx = CanvasRenderingContext2D
export type SceneryKind = 'tree' | 'fir' | 'mushroom' | 'flowers' | 'stump' | 'lantern' | 'palm' | 'coral' | 'shell' | 'sail' | 'crystal' | 'ice' | 'arch' | 'cloudtree' | 'tower' | 'balloon' | 'sign' | 'banner'

const sprites = new Map<string, HTMLCanvasElement>()
const rect = (g: Ctx, color: string, x: number, y: number, w: number, h: number) => { g.fillStyle = color; g.fillRect(x, y, w, h) }
const poly = (g: Ctx, color: string, points: number[]) => {
  g.fillStyle = color; g.beginPath(); g.moveTo(points[0], points[1])
  for (let i = 2; i < points.length; i += 2) g.lineTo(points[i], points[i + 1])
  g.closePath(); g.fill()
}
const cloud = (g: Ctx, x: number, y: number, color: string, scale = 1) => {
  rect(g, color, x + 6 * scale, y, 12 * scale, 3 * scale)
  rect(g, color, x + 3 * scale, y + 3 * scale, 21 * scale, 4 * scale)
  rect(g, color, x, y + 7 * scale, 29 * scale, 6 * scale)
  rect(g, color, x + 3 * scale, y + 13 * scale, 22 * scale, 3 * scale)
}
const star = (g: Ctx, x: number, y: number, color: string, s = 1) => {
  rect(g, color, x, y - 3 * s, s, 7 * s); rect(g, color, x - 3 * s, y, 7 * s, s)
  rect(g, color, x - s, y - s, 3 * s, 3 * s)
}
function leaves(g: Ctx, x: number, y: number, s: number, dark: string, mid: string, light: string) {
  poly(g, dark, [x + 3 * s, y, x + 13 * s, y, x + 13 * s, y + 2 * s, x + 17 * s, y + 2 * s, x + 17 * s, y + 6 * s, x + 20 * s, y + 6 * s, x + 20 * s, y + 12 * s, x + 17 * s, y + 12 * s, x + 17 * s, y + 15 * s, x + 3 * s, y + 15 * s, x + 3 * s, y + 12 * s, x, y + 12 * s, x, y + 5 * s, x + 3 * s, y + 5 * s])
  rect(g, mid, x + 3 * s, y + 2 * s, 11 * s, 8 * s)
  rect(g, mid, x + 6 * s, y, 5 * s, 2 * s)
  rect(g, mid, x + s, y + 6 * s, 14 * s, 4 * s)
  rect(g, light, x + 4 * s, y + 3 * s, 7 * s, 2 * s)
  rect(g, light, x + 2 * s, y + 6 * s, 5 * s, 2 * s)
  rect(g, light, x + 10 * s, y + 7 * s, 3 * s, s)
}
function crystal(g: Ctx, x: number, y: number, h: number, colors: string[]) {
  const w = Math.round(h * 0.32)
  poly(g, colors[0], [x, y - h, x + w, y - h + w * 1.5, x + w, y - w, x, y, x - w, y - w, x - w, y - h + w * 1.5])
  poly(g, colors[1], [x, y - h + 2, x, y - 2, x - w + 2, y - w, x - w + 2, y - h + w * 1.5])
  poly(g, colors[2], [x, y - h + 2, x + w - 2, y - h + w * 1.5, x, y - h + w * 2.1, x - w + 2, y - h + w * 1.5])
  rect(g, colors[3], x - w + 3, y - h + w * 1.5 + 2, 2, Math.max(2, h - w * 3.2))
}

function makeScenery(kind: SceneryKind, theme: CourseId, variant: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas'); canvas.width = 96; canvas.height = 128
  const g = canvas.getContext('2d')!; g.imageSmoothingEnabled = false
  switch (kind) {
    case 'tree': {
      const warm = variant % 3 === 1
      const colors = warm ? ['#364e49', '#6e9864', '#b5c775'] : ['#194c43', '#378365', '#79ad71']
      poly(g, '#573c35', [43, 121, 37, 124, 58, 124, 53, 118, 52, 62, 43, 63])
      rect(g, '#946243', 44, 71, 4, 47); rect(g, '#bd8954', 44, 85, 2, 21)
      poly(g, '#573c35', [46, 95, 24, 71, 28, 68, 47, 84, 69, 62, 71, 68, 49, 99])
      leaves(g, 11, 56, 2, ...colors as [string, string, string])
      leaves(g, 43, 49, 2, ...colors as [string, string, string])
      leaves(g, 21, 30, 2.3, ...colors as [string, string, string])
      leaves(g, 34, 17, 1.7, ...colors as [string, string, string])
      leaves(g, 19, 56, 1, colors[1], colors[2], '#c7d990')
      for (let i = 0; i < 18; i++) { const x = 15 + (i * 23 % 65); const y = 47 + (i * 17 % 25); rect(g, i % 3 ? '#275e46' : '#b9c477', x, y, 2, 2) }
      rect(g, '#41865b', 34, 122, 28, 3); rect(g, '#90b96f', 36, 122, 7, 2)
      break
    }
    case 'fir': {
      rect(g, '#78564b', 44, 62, 8, 62); rect(g, '#bd9066', 44, 106, 3, 15)
      for (let i = 0; i < 4; i++) {
        const y = 85 - i * 18, width = 36 - i * 6
        poly(g, '#214f53', [48, y - 36, 48 - width, y + 20, 48 + width, y + 20])
        poly(g, '#3c7a70', [48, y - 36, 48 - width + 4, y + 12, 48, y + 6])
        poly(g, '#89b59c', [48, y - 36, 37 - i * -2, y - 5, 48, y - 10])
        rect(g, '#598f7b', 48 - width + 6, y + 14, 13, 2)
      }
      break
    }
    case 'mushroom': {
      rect(g, '#b28575', 39, 87, 15, 34); rect(g, '#fff0c2', 40, 88, 9, 32)
      rect(g, '#dbbd97', 45, 116, 15, 8)
      poly(g, '#803d59', [15, 86, 15, 74, 23, 74, 23, 65, 32, 65, 32, 59, 58, 59, 58, 64, 68, 64, 68, 72, 77, 72, 77, 87, 68, 92, 23, 92])
      poly(g, '#d76d76', [18, 80, 25, 68, 35, 61, 56, 61, 67, 68, 71, 80])
      rect(g, '#f8cc9a', 31, 68, 9, 5); rect(g, '#f7e3b6', 48, 63, 8, 5)
      rect(g, '#f4c391', 57, 76, 10, 6); rect(g, '#f8e3b5', 22, 79, 7, 6)
      rect(g, '#f3c09c', 31, 88, 27, 2)
      rect(g, '#68a974', 26, 122, 40, 3)
      break
    }
    case 'flowers': {
      for (let i = 0; i < 11; i++) {
        const x = 11 + i * 7, y = 112 - ((i * 11) % 20), color = ['#fff4bb', '#f5a2bd', '#bac3fc', '#ffe089'][i % 4]
        rect(g, '#438d69', x, y, 2, 123 - y)
        rect(g, '#80be83', x - 4, y + 6, 4, 2)
        rect(g, color, x - 3, y, 7, 3); rect(g, color, x - 1, y - 2, 3, 7)
        rect(g, '#e9a358', x, y + 1, 2, 2)
      }
      break
    }
    case 'stump': {
      rect(g, '#725142', 26, 101, 39, 23); rect(g, '#ae7950', 29, 103, 9, 21)
      rect(g, '#95663f', 51, 101, 8, 23); rect(g, '#d9b484', 29, 96, 34, 9)
      rect(g, '#906440', 35, 98, 22, 5); rect(g, '#e5bd7e', 38, 99, 16, 2)
      rect(g, '#6f9558', 22, 119, 47, 6); rect(g, '#a8b967', 25, 119, 12, 2)
      break
    }
    case 'lantern': {
      rect(g, '#544d63', 44, 46, 5, 78); rect(g, '#baab8e', 45, 50, 2, 73)
      rect(g, '#544d63', 30, 122, 31, 4); rect(g, '#817071', 34, 118, 22, 5)
      rect(g, '#534a62', 33, 44, 28, 4); rect(g, '#ac7a5e', 36, 22, 23, 23)
      rect(g, '#f9cd78', 39, 25, 16, 17); rect(g, '#fff6be', 43, 25, 6, 16)
      rect(g, '#715662', 46, 24, 2, 18); rect(g, '#715662', 37, 31, 19, 2)
      poly(g, '#544d63', [32, 23, 37, 19, 42, 19, 45, 13, 49, 13, 52, 19, 57, 19, 62, 23])
      rect(g, '#c7a787', 37, 20, 19, 2)
      break
    }
    case 'palm': {
      poly(g, '#855a4f', [35, 124, 43, 124, 46, 94, 53, 62, 59, 38, 53, 34, 44, 59, 39, 94])
      poly(g, '#c99165', [37, 121, 41, 121, 43, 93, 50, 64, 55, 39, 53, 39, 46, 65, 40, 93])
      for (let i = 0; i < 8; i++) rect(g, '#654d46', 38 + Math.floor(i * 1.6), 117 - i * 10, 7, 2)
      const fronds = [[55, 40, 28, 30, 8, 37, 4, 56, 13, 48, 27, 42], [55, 38, 68, 19, 83, 22, 94, 38, 81, 29, 70, 29], [54, 38, 48, 13, 28, 7, 17, 17, 36, 16, 47, 30], [57, 38, 73, 35, 91, 48, 90, 64, 81, 50, 66, 46], [53, 39, 27, 44, 17, 64, 20, 76, 26, 63, 37, 50]]
      for (const f of fronds) poly(g, '#247c72', f)
      poly(g, '#58af83', [54, 36, 28, 30, 8, 37, 28, 35, 48, 41])
      poly(g, '#8ad292', [54, 37, 47, 17, 29, 11, 46, 23])
      poly(g, '#6bc28e', [58, 38, 70, 23, 81, 25, 70, 27])
      poly(g, '#61b888', [57, 40, 75, 39, 86, 48, 69, 44])
      rect(g, '#654c43', 48, 37, 7, 8); rect(g, '#926249', 56, 39, 7, 8)
      rect(g, '#eecb89', 27, 123, 27, 3)
      break
    }
    case 'coral': {
      const color = variant % 2 ? '#c882b2' : '#e38d8a', highlight = variant % 2 ? '#f3b5d2' : '#ffbda1'
      rect(g, color, 45, 78, 9, 46); rect(g, color, 29, 93, 39, 7)
      rect(g, color, 25, 72, 7, 26); rect(g, color, 62, 67, 7, 30)
      rect(g, color, 54, 72, 12, 6); rect(g, color, 18, 85, 12, 6)
      rect(g, highlight, 46, 79, 3, 42); rect(g, highlight, 26, 73, 2, 19)
      rect(g, highlight, 63, 68, 2, 27); rect(g, '#ffe1ba', 35, 121, 32, 4)
      break
    }
    case 'shell': {
      poly(g, '#d3a5a8', [21, 118, 20, 109, 27, 102, 37, 98, 51, 98, 64, 106, 68, 117, 55, 124, 35, 124])
      poly(g, '#ffe0c1', [23, 111, 28, 104, 39, 100, 52, 101, 62, 108, 44, 120])
      for (let i = 0; i < 5; i++) poly(g, '#e8b5af', [43, 122, 27 + i * 8, 103 + Math.abs(i - 2) * 3, 30 + i * 8, 103 + Math.abs(i - 2) * 3])
      rect(g, '#fff3d5', 31, 105, 7, 2)
      break
    }
    case 'sail': {
      rect(g, '#775f65', 47, 21, 3, 93)
      poly(g, '#ffe9c3', [44, 25, 44, 95, 8, 95]); poly(g, '#ffb990', [51, 38, 51, 95, 77, 95])
      poly(g, '#f3d3a4', [44, 25, 44, 95, 33, 95])
      poly(g, '#6a6476', [10, 111, 81, 111, 67, 124, 26, 124]); rect(g, '#ad7472', 17, 111, 57, 5)
      rect(g, '#fff3d8', 25, 114, 36, 2); rect(g, '#8dd8d1', 4, 125, 85, 2)
      break
    }
    case 'crystal': {
      const c = variant % 3 === 0 ? ['#876fd0', '#af8cea', '#ddbcfa', '#fff0ff'] : ['#388ba8', '#66bdd3', '#b9ecef', '#ecffff']
      crystal(g, 48, 124, 96, c); crystal(g, 27, 124, 51, c); crystal(g, 73, 124, 65, c)
      rect(g, '#474c8b', 15, 124, 67, 4); star(g, 48, 46, '#f2ffff'); star(g, 74, 78, '#d7f5ff')
      break
    }
    case 'ice': {
      poly(g, '#526ea4', [5, 124, 18, 101, 25, 104, 43, 82, 65, 91, 79, 107, 91, 124])
      poly(g, '#81b4ce', [9, 121, 22, 103, 26, 108, 43, 85, 46, 120])
      poly(g, '#bae5e8', [28, 106, 43, 85, 61, 93, 48, 95, 40, 108])
      poly(g, '#8f8fc6', [48, 98, 61, 95, 75, 109, 63, 107, 69, 122, 48, 122])
      rect(g, '#d9f1ed', 21, 115, 16, 2); rect(g, '#879dca', 4, 124, 87, 3)
      break
    }
    case 'arch': {
      rect(g, '#5a5684', 11, 27, 17, 98); rect(g, '#71698e', 68, 27, 17, 98)
      rect(g, '#9287b0', 14, 28, 7, 94); rect(g, '#b4a2c4', 70, 28, 7, 94)
      rect(g, '#71698e', 21, 15, 55, 15); rect(g, '#b4a2c4', 23, 14, 51, 5)
      rect(g, '#8881a6', 28, 21, 40, 12); rect(g, '#5a5684', 26, 30, 9, 12); rect(g, '#5a5684', 61, 30, 9, 12)
      for (let i = 0; i < 6; i++) { rect(g, '#4e537b', 11, 42 + i * 14, 17, 2); rect(g, '#787291', 68, 42 + i * 14, 17, 2) }
      rect(g, '#a099b8', 7, 121, 25, 6); rect(g, '#b3acc6', 64, 121, 25, 6)
      crystal(g, 49, 29, 21, ['#617dbc', '#8fbddf', '#c9e9f5', '#ffffff'])
      break
    }
    case 'cloudtree': {
      rect(g, '#aa8aaa', 43, 57, 8, 67); rect(g, '#eed2cd', 45, 66, 3, 56)
      poly(g, '#aa8aaa', [45, 102, 28, 78, 33, 77, 48, 94, 66, 68, 69, 72, 50, 103])
      cloud(g, 8, 51, '#ad9cc8', 2.5); cloud(g, 12, 45, '#d5b7dc', 2.4)
      cloud(g, 22, 30, '#ebcde5', 1.8); cloud(g, 32, 20, '#ffe4eb', 1.2)
      rect(g, '#fff1ea', 31, 47, 25, 3); rect(g, '#ffe4eb', 19, 61, 16, 3)
      star(g, 69, 42, '#ffecb5'); star(g, 21, 80, '#fff4c9')
      rect(g, '#ddc8e3', 30, 121, 35, 5)
      break
    }
    case 'tower': {
      rect(g, '#857296', 24, 43, 47, 82); rect(g, '#f1d6c4', 28, 43, 35, 81)
      rect(g, '#c6a8b5', 52, 43, 13, 80); rect(g, '#ffebcf', 29, 45, 7, 73)
      poly(g, '#8b80b4', [18, 47, 48, 7, 77, 47]); poly(g, '#c2b0d8', [22, 44, 48, 10, 48, 44])
      rect(g, '#ecd3b8', 46, 4, 3, 11); rect(g, '#e2a684', 49, 4, 15, 7)
      for (let i = 0; i < 3; i++) { rect(g, '#857294', 39, 58 + i * 22, 14, 14); rect(g, '#8eb6cb', 41, 60 + i * 22, 9, 10); rect(g, '#d5ecdf', 41, 60 + i * 22, 3, 7) }
      rect(g, '#b99bb1', 22, 122, 53, 5); rect(g, '#fff0d5', 24, 121, 46, 2)
      break
    }
    case 'balloon': {
      poly(g, '#ac6d93', [23, 23, 33, 12, 63, 12, 74, 24, 78, 46, 70, 61, 55, 77, 42, 77, 26, 61, 19, 43])
      poly(g, '#ebacae', [26, 25, 36, 16, 62, 16, 71, 26, 74, 44, 66, 60, 53, 73, 43, 73, 29, 59, 23, 43])
      poly(g, '#fff0cf', [39, 16, 48, 15, 43, 39, 45, 71, 35, 57, 31, 40])
      poly(g, '#c891ad', [56, 16, 62, 18, 66, 38, 57, 66, 52, 73, 59, 41])
      rect(g, '#aa8e9b', 42, 76, 2, 17); rect(g, '#aa8e9b', 54, 76, 2, 17)
      rect(g, '#967274', 39, 92, 21, 15); rect(g, '#dbb48a', 41, 94, 17, 9); rect(g, '#f3d6a8', 42, 94, 14, 2)
      break
    }
    case 'sign': {
      rect(g, '#7f6864', 28, 81, 5, 44); rect(g, '#b19c82', 30, 84, 2, 37)
      rect(g, '#7f6864', 64, 81, 5, 44); rect(g, '#b19c82', 65, 85, 2, 35)
      rect(g, '#485568', 13, 56, 70, 32); rect(g, '#f5dd99', 16, 59, 64, 26)
      for (let i = 0; i < 3; i++) poly(g, '#638285', [22 + i * 18, 62, 30 + i * 18, 62, 40 + i * 18, 72, 30 + i * 18, 82, 22 + i * 18, 82, 32 + i * 18, 72])
      break
    }
    case 'banner': {
      rect(g, '#6e6688', 44, 12, 5, 113); rect(g, '#d9bb9d', 45, 15, 2, 107)
      rect(g, '#ffe9bd', 42, 8, 9, 6)
      const fill = { forest: '#e9a782', coast: '#82d8d1', crystal: '#bfb0e5', sky: '#f2bcce' }[theme]
      poly(g, '#685c88', [51, 18, 79, 18, 79, 71, 65, 62, 51, 71]); poly(g, fill, [53, 20, 76, 20, 76, 66, 65, 58, 53, 66])
      star(g, 64, 36, '#fff4cf', 2); rect(g, '#fff4cf', 58, 52, 14, 2)
      break
    }
  }
  return canvas
}

export function scenerySprite(kind: SceneryKind, theme: CourseId, variant = 0) {
  const key = `${kind}-${theme}-${variant % 3}`
  if (!sprites.has(key)) sprites.set(key, makeScenery(kind, theme, variant))
  return sprites.get(key)!
}

export function kartSprite(id: number, steer: number, frame: number, stunned = false) {
  const direction = steer < -0.16 ? -1 : steer > 0.16 ? 1 : 0
  const key = `kart-${id % 4}-${direction}-${frame % 2}-${stunned}`
  if (sprites.has(key)) return sprites.get(key)!
  const c = document.createElement('canvas'); c.width = 48; c.height = 50
  const g = c.getContext('2d')!; g.imageSmoothingEnabled = false
  const body = ['#e67468', '#76aacf', '#c1a1d7', '#dfb85c'][id % 4]
  const light = ['#ffb996', '#b6e9ec', '#eac8f3', '#fff0a7'][id % 4]
  const shadow = ['#a34554', '#497291', '#816395', '#b78152'][id % 4]
  const dx = direction * 2
  rect(g, '#283244', 6 + dx, 32, 9, 15); rect(g, '#283244', 33 + dx, 32, 9, 15)
  rect(g, '#586177', 7 + dx, 33, 3, 12); rect(g, '#586177', 34 + dx, 33, 3, 12)
  for (let i = 0; i < 3; i++) { rect(g, '#7e8390', 7 + dx, 34 + i * 4 + frame % 2, 6, 1); rect(g, '#7e8390', 34 + dx, 34 + i * 4 + frame % 2, 6, 1) }
  rect(g, '#413a51', 11 + dx, 28, 27, 18); rect(g, body, 12 + dx, 27, 25, 15)
  rect(g, light, 14 + dx, 27, 21, 4); rect(g, shadow, 13 + dx, 38, 23, 6)
  rect(g, '#ffe8c1', 15 + dx, 36, 5, 3); rect(g, '#ffe8c1', 29 + dx, 36, 5, 3)
  rect(g, '#bc746b', 16 + dx, 39, 3, 2); rect(g, '#bc746b', 30 + dx, 39, 3, 2)
  rect(g, '#e7d6b9', 17 + dx, 43, 15, 3); rect(g, '#706471', 19 + dx, 44, 11, 2)
  rect(g, '#66747c', 6 + dx, 29, 7, 4); rect(g, '#d1d7c5', 7 + dx, 29, 5, 1)
  rect(g, '#66747c', 35 + dx, 29, 7, 4); rect(g, '#d1d7c5', 36 + dx, 29, 5, 1)
  rect(g, '#493d52', 15, 20, 20, 12); rect(g, body, 17, 23, 16, 7)
  const animal = id % 4
  const fur = ['#e9ac7d', '#dfe7d4', '#d4b8a0', '#dca075'][animal]
  const furLight = ['#ffe2b0', '#fff9df', '#eee0b9', '#ffe0a3'][animal]
  const faceX = direction
  if (animal === 0 || animal === 3) {
    poly(g, '#684c53', [13 + faceX, 16, 11 + faceX, 3, 20 + faceX, 8, 29 + faceX, 8, 38 + faceX, 3, 36 + faceX, 19])
    poly(g, fur, [14 + faceX, 15, 13 + faceX, 6, 21 + faceX, 11, 29 + faceX, 11, 36 + faceX, 6, 35 + faceX, 19])
    rect(g, '#d28480', 15 + faceX, 8, 3, 6); rect(g, '#d28480', 32 + faceX, 8, 3, 6)
  } else if (animal === 1) {
    rect(g, '#7e777a', 14 + faceX, 0, 7, 16); rect(g, '#7e777a', 28 + faceX, 0, 7, 16)
    rect(g, furLight, 15 + faceX, 1, 5, 15); rect(g, furLight, 29 + faceX, 1, 5, 15)
    rect(g, '#efb3b0', 17 + faceX, 3, 2, 8); rect(g, '#efb3b0', 30 + faceX, 3, 2, 8)
  } else {
    rect(g, '#76646b', 11 + faceX, 7, 11, 11); rect(g, '#76646b', 28 + faceX, 7, 11, 11)
    rect(g, fur, 13 + faceX, 8, 7, 7); rect(g, fur, 30 + faceX, 8, 7, 7)
    rect(g, '#b39088', 15 + faceX, 10, 4, 3); rect(g, '#b39088', 31 + faceX, 10, 4, 3)
  }
  rect(g, '#69535e', 13 + faceX, 12, 23, 13); rect(g, '#69535e', 16 + faceX, 9, 17, 19)
  rect(g, fur, 14 + faceX, 12, 21, 12); rect(g, furLight, 17 + faceX, 10, 14, 5)
  rect(g, fur, 17 + faceX, 21, 15, 6); rect(g, furLight, 17 + faceX, 20, 15, 5)
  // The rear-facing drivers glance into bends; their ears and tiny scarves stay readable.
  if (direction) {
    const eyeX = direction > 0 ? 31 : 15
    rect(g, '#453c51', eyeX, 16, 2, 3); rect(g, '#fff2d9', eyeX, 16, 1, 1)
    rect(g, '#e19991', eyeX - direction, 20, 3, 2)
  }
  rect(g, '#fff1ca', 19, 26, 11, 3); rect(g, body, 20, 26, 9, 2)
  rect(g, body, 29, 26, 5, 4); rect(g, light, 32, 28, 5, 2)
  if (animal === 3) { rect(g, '#ac6e55', 19, 14, 2, 5); rect(g, '#ac6e55', 28, 14, 2, 5) }
  if (stunned) { star(g, 7, 12, '#fff2a6'); star(g, 40, 19, '#ffe393'); star(g, 25, 4, '#fff2b7') }
  sprites.set(key, c); return c
}

export function itemSprite(item: ItemId | 'pickup') {
  const key = `item-${item}`
  if (sprites.has(key)) return sprites.get(key)!
  const c = document.createElement('canvas'); c.width = 32; c.height = 36
  const g = c.getContext('2d')!; g.imageSmoothingEnabled = false
  switch (item) {
    case 'pickup':
      poly(g, '#724d98', [3, 9, 16, 2, 29, 9, 29, 26, 16, 34, 3, 26]); poly(g, '#ffcf87', [4, 9, 16, 3, 28, 9, 16, 16])
      poly(g, '#c983c7', [4, 11, 15, 17, 15, 31, 4, 25]); poly(g, '#9368b7', [17, 17, 28, 11, 28, 25, 17, 31])
      rect(g, '#ffecc1', 7, 15, 3, 3); rect(g, '#fff2ce', 9, 14, 3, 9); rect(g, '#fff2ce', 10, 25, 2, 2)
      star(g, 22, 21, '#ffe4a8'); rect(g, '#ffefb9', 13, 6, 6, 2)
      break
    case 'boost':
      poly(g, '#bd675c', [5, 27, 5, 15, 10, 8, 18, 8, 25, 15, 25, 27]); rect(g, '#eeb778', 7, 15, 16, 13)
      rect(g, '#fff0b4', 11, 10, 6, 16); poly(g, '#fff8d5', [17, 5, 11, 17, 16, 17, 12, 30, 23, 14, 18, 14])
      break
    case 'jump':
      poly(g, '#ae7b99', [5, 25, 9, 12, 20, 5, 27, 8, 24, 20, 14, 29]); poly(g, '#f6dacb', [8, 24, 12, 14, 21, 7, 25, 9, 21, 19, 13, 27])
      poly(g, '#fff4d8', [7, 30, 10, 30, 23, 10, 21, 10]); rect(g, '#dca8b5', 13, 20, 8, 2)
      break
    case 'star':
      poly(g, '#c58c64', [16, 2, 21, 12, 32, 14, 24, 22, 26, 33, 16, 28, 6, 33, 8, 22, 0, 14, 11, 12])
      poly(g, '#ffdf88', [16, 5, 20, 14, 29, 15, 22, 21, 24, 30, 16, 25, 8, 30, 10, 21, 3, 15, 12, 14])
      poly(g, '#fff8bd', [16, 5, 16, 22, 10, 21, 3, 15, 12, 14]); rect(g, '#946963', 13, 17, 2, 5); rect(g, '#946963', 20, 17, 2, 5)
      break
    case 'bomb':
      rect(g, '#aa775b', 15, 5, 3, 8); rect(g, '#ffdd8e', 17, 3, 5, 3); star(g, 24, 4, '#fff2b5')
      rect(g, '#71435e', 8, 11, 16, 21); rect(g, '#71435e', 4, 16, 24, 12)
      rect(g, '#d47480', 8, 13, 15, 15); rect(g, '#f6b0a0', 9, 15, 6, 4)
      rect(g, '#fde7b9', 10, 22, 4, 4); rect(g, '#fde7b9', 19, 22, 4, 4)
      rect(g, '#694a63', 12, 23, 2, 3); rect(g, '#694a63', 19, 23, 2, 3)
      break
    case 'puddle':
      rect(g, '#775a96', 3, 24, 26, 8); rect(g, '#9b83c3', 7, 20, 19, 12); rect(g, '#d3b9e8', 9, 23, 14, 4)
      rect(g, '#684f8a', 12, 27, 2, 2); rect(g, '#684f8a', 21, 27, 2, 2)
      break
  }
  sprites.set(key, c); return c
}

export function clearSpriteCache() { sprites.clear() }

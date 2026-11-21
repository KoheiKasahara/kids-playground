const models = [
  { length: 74, width: 32, roofBack: -19, roofFront: 18, height: 16, paint: '#3065b8', trim: '#193968', highlight: '#5989d2' },
  { length: 70, width: 31, roofBack: -21, roofFront: 15, height: 17, paint: '#e06c32', trim: '#763b2e', highlight: '#f79649' },
  { length: 66, width: 33, roofBack: -26, roofFront: 16, height: 21, paint: '#3b8469', trim: '#234b43', highlight: '#65a888' },
]
const tileWidth = 80
const tileHeight = 40
const pitch = 0.73

// Each tile is a horizontal cut through the car, from the tires to the roof.
export function makeCarStacks() {
  return models.map(({ length, width, roofBack, roofFront, height, paint, trim, highlight }, index) => {
    const sheet = document.createElement('canvas')
    sheet.width = tileWidth
    sheet.height = tileHeight * height
    const g = sheet.getContext('2d')!
    const half = Math.floor(length / 2)
    const side = Math.floor(width / 2)
    function rect(color: string, x: number, y: number, w: number, h: number) {
      g.fillStyle = color
      g.fillRect(x, y, w, h)
    }
    function panel(color: string, rear: number, nose: number, radius: number) {
      rect(color, rear, -radius + 3, nose - rear, 2 * radius - 6)
      rect(color, rear + 2, -radius + 1, nose - rear - 4, 2 * radius - 2)
      rect(color, rear + 4, -radius, nose - rear - 8, 2 * radius)
    }
    for (let z = 0; z < height; z++) {
      g.setTransform(1, 0, 0, 1, tileWidth / 2, z * tileHeight + tileHeight / 2)
      if (z < 10) {
        if (z >= 2) panel(z < 5 ? '#28303c' : trim, -half, half, side - 1)
        for (const axle of [-half + 13, half - 14]) {
          const tread = Math.round(Math.sqrt(36 - (z - 5) ** 2))
          for (const edge of [-side - 1, side - 4]) {
            rect('#252a32', axle - tread, edge, tread * 2, 5)
            if (z >= 3 && z <= 7) rect('#a9a9a3', axle - 3, edge, 6, 5)
          }
        }
      }
      if (z >= 6 && z <= 10) {
        panel(z === 10 ? highlight : paint, -half + 1, half - 1, side - (z === 10 ? 2 : 0))
        for (const sign of [-1, 1]) {
          rect('#fff0c9', -half + 2, sign * 5 - 2, length - 4, index === 2 ? 2 : 3)
          rect('#fff3b6', half - 4, sign * (side - 5) - 2, 3, 4)
          rect('#be3934', -half + 1, sign * (side - 5) - 2, 3, 4)
          if (z === 10) {
            rect(trim, half - 13, sign * 9 - 1, 5, 2)
            rect('#e9d9b9', half - 5, sign * (side - 5) - 2, 3, 4)
          }
        }
      }
      if (z > 10) {
        const rise = (z - 10) / (height - 10)
        const rear = roofBack + Math.round(4 * rise)
        const nose = roofFront - Math.round(11 * rise)
        const radius = side - 3 - Math.round(2 * rise)
        const roof = z === height - 1
        panel(roof ? paint : '#294652', rear, nose, radius)
        if (roof) {
          for (const stripe of [-7, 3]) rect('#fff0c9', rear + 2, stripe, nose - rear - 4, index === 2 ? 2 : 3)
        } else {
          rect('#558998', nose - 3, -radius + 2, 3, 2 * radius - 4)
          rect('#9dc2bc', nose - 2, -radius + 4, 2, 4)
          rect(trim, rear + 8, -radius, 3, 2 * radius)
        }
      }
    }
    return sheet
  })
}

export function drawCar(g: CanvasRenderingContext2D, sheet: HTMLCanvasElement,
  x: number, y: number, angle: number, boostFrame: number | null) {
  // The track tangent is already in screen coordinates. Undo foreshortening
  // before turning the car on the ground plane, then project each slice.
  const yaw = Math.atan2(Math.sin(angle) / pitch, Math.cos(angle))
  g.save()
  g.translate(Math.round(x), Math.round(y))
  g.imageSmoothingEnabled = false
  g.save()
  g.translate(3, 4)
  g.scale(1, pitch)
  g.rotate(yaw)
  g.fillStyle = '#29273555'
  g.beginPath()
  g.ellipse(0, 0, 37, 17, 0, 0, Math.PI * 2)
  g.fill()
  g.restore()
  if (boostFrame !== null) {
    g.save()
    g.scale(1, pitch)
    g.rotate(yaw)
    for (const offset of [-7, 7]) {
      const tail = 15 + (boostFrame + offset + 7) % 9
      g.fillStyle = '#e9843d'
      g.beginPath()
      g.moveTo(-34 - tail, offset)
      g.lineTo(-34, offset - 4)
      g.lineTo(-34, offset + 4)
      g.fill()
      g.fillStyle = '#fff0a8'
      g.fillRect(-43, offset - 1, 10, 3)
    }
    g.restore()
  }
  for (let row = 0; row < sheet.height; row += tileHeight) {
    g.save()
    g.scale(1, pitch)
    g.rotate(yaw)
    g.drawImage(sheet, 0, row, tileWidth, tileHeight, -tileWidth / 2, -tileHeight / 2, tileWidth, tileHeight)
    g.restore()
    g.translate(0, -0.8)
  }
  g.restore()
}

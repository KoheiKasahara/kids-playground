import { drawCar } from './cars'
import { BOOST_TIME, RECHARGE, rivals, type Race } from './race'

import { line, pose } from './circuit'

export function makeLoadingCircuit() {
  const map = document.createElement('canvas')
  map.width = 1536
  map.height = 1024
  const g = map.getContext('2d')!
  g.fillStyle = '#92a65f'
  g.fillRect(0, 0, map.width, map.height)
  g.beginPath()
  g.moveTo(line[0].x, line[0].y)
  for (const point of line) g.lineTo(point.x, point.y)
  g.closePath()
  g.lineWidth = 131
  g.strokeStyle = '#756d6a'
  g.stroke()
  return map
}

const reflections = [[641, 477], [715, 505], [790, 483], [685, 521], [804, 617], [857, 642]]

export function drawRace(g: CanvasRenderingContext2D, map: HTMLCanvasElement | HTMLImageElement,
  stacks: HTMLCanvasElement[], race: Race) {
  const cars = [race.distance, ...rivals(race.elapsed)].map((laps, index) => ({
    ...pose(laps, race.offsets[index]), angle: race.headings[index], index,
  }))
  const player = cars[0]
  const { width, height } = g.canvas
  const cameraX = Math.max(0, Math.min(map.width - width, Math.round(player.x - width / 2 + 36 * Math.cos(player.angle))))
  const cameraY = Math.max(0, Math.min(map.height - height, Math.round(player.y - height / 2 + 25 * Math.sin(player.angle))))
  g.drawImage(map, cameraX, cameraY, width, height, 0, 0, width, height)
  reflections.forEach(([x, y], i) => {
    const ripple = Math.sin(race.elapsed * 2.6 + i * 2)
    if (ripple <= 0) return
    g.fillStyle = `rgba(225,255,238,${ripple * 0.75})`
    g.fillRect(x - cameraX - Math.round(ripple), y - cameraY, 1 + Math.round(6 * ripple), 1)
  })
  cars.sort((a, b) => a.y - b.y)
    .forEach((p) => drawCar(g, stacks[p.index], p.x - cameraX, p.y - cameraY, p.angle,
      p.index === 0 && race.cooldown > RECHARGE - BOOST_TIME ? Math.floor(race.elapsed * 24) : null))
}

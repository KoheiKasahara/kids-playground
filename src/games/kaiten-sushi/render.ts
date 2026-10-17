// ドット絵の バッファを canvas に うつし、かいてんレーンの ばめんを まいフレーム かく。
// え を つくる ところ（sushiArt・sprites・sceneArt）は きりはなしてあるので、ここは ならべて かく だけ。

import { plateDef, type NetaId } from './data'
import {
  CHEF_POS, CUSTOMER_BOTTOM, LANE, SCENE_H, SCENE_W, SEATS, TRAIN_DISH_X, TRAIN_DISH_Y, TRAIN_H, TRAIN_RAIL_Y, mod,
} from './layout'
import { isExcited, platePoint, type Customer, type LaneWorld } from './lane'
import { PixelBuffer } from './pixel'
import { isSparkly, recipeKey, type Recipe } from './recipe'
import {
  BELT_PERIOD, LANTERN_CENTERS, beltMap, drawBackground, drawBeltFrame, drawBubble, drawIslandFront, drawLanternGlow, drawMiniPlate,
  drawPreviewBackdrop, type BeltMap,
} from './sceneArt'
import {
  CHEF_H, CHEF_W, CUSTOMER_H, CUSTOMER_W, drawChef, drawCustomer, drawHeart, drawPuff, drawSparkle, drawSteam, drawTrain,
  type ChefPose, type Expression,
} from './sprites'
import { DISH_ANCHOR, drawDish, drawNetaChip } from './sushiArt'

/** 2D の かきこみ口。jsdom など canvas が つかえない ところでは null。 */
export function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  try {
    return canvas.getContext('2d')
  } catch {
    return null
  }
}

/** バッファを canvas に。かけない ところでは null。 */
export function toCanvas(buf: PixelBuffer): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = buf.w
  canvas.height = buf.h
  const ctx = context2d(canvas)
  if (!ctx) return null
  const image = ctx.createImageData(buf.w, buf.h)
  new Uint32Array(image.data.buffer).set(buf.data)
  ctx.putImageData(image, 0, 0)
  return canvas
}

const urlCache = new Map<string, string>()
/** くみあわせは たくさん あるので、ためすぎたら すてて つくりなおす。 */
const URL_CACHE_LIMIT = 400

/** <img> に つかう え の URL。かけない ところでは ''。 */
export function spriteUrl(key: string, make: () => PixelBuffer): string {
  const cached = urlCache.get(key)
  if (cached !== undefined) return cached
  if (urlCache.size >= URL_CACHE_LIMIT) urlCache.clear()
  let url = ''
  const canvas = toCanvas(make())
  if (canvas) {
    try { url = canvas.toDataURL('image/png') } catch { url = '' }
  }
  urlCache.set(key, url)
  return url
}

export const dishUrl = (recipe: Recipe) => spriteUrl(`dish:${recipeKey(recipe)}`, () => drawDish(recipe))
export const chipUrl = (neta: NetaId) => spriteUrl(`chip:${neta}`, () => drawNetaChip(neta))

/** つくる がめんの おおきな みほん（カウンターの うえに おいた おすし）。 */
export function drawPreview(recipe: Recipe): PixelBuffer {
  const buf = drawPreviewBackdrop()
  buf.draw(drawDish(recipe), 8, 7)
  return buf
}

type Cache<T> = Map<string, T>
function cached<T>(cache: Cache<T>, key: string, make: () => T): T {
  let v = cache.get(key)
  if (v === undefined) {
    v = make()
    cache.set(key, v)
  }
  return v
}

export type RenderOptions = { still: boolean }

/** いまの きもちの かお。 */
export function expressionOf(world: LaneWorld, c: Customer): Expression {
  const blink = mod(world.time + c.seat * 1.37, 4.2) < .14
  switch (c.phase) {
    case 'grab':
    case 'waitTrain':
      return 'want'
    case 'eat':
      return mod(c.t, .5) < .22 ? 'munch' : 'chew'
    case 'react':
      return c.reaction === 'spicy' && c.t < 1.6 ? 'spicy' : 'happy'
    default:
      if (isExcited(world, c)) return 'want'
      return blink ? 'blink' : 'idle'
  }
}

export class LaneRenderer {
  private scene: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private background: HTMLCanvasElement | null = null
  private islandFront: HTMLCanvasElement | null = null
  private glow: HTMLCanvasElement | null = null
  private map: BeltMap | null = null
  private belts: (HTMLCanvasElement | null)[] = []
  private sprites: Cache<HTMLCanvasElement | null> = new Map()

  private sprite(key: string, make: () => PixelBuffer): HTMLCanvasElement | null {
    return cached(this.sprites, key, () => toCanvas(make()))
  }

  private ensure(): boolean {
    if (this.ctx) return true
    if (typeof document === 'undefined') return false
    const scene = document.createElement('canvas')
    scene.width = SCENE_W
    scene.height = SCENE_H
    const ctx = context2d(scene)
    if (!ctx) return false
    ctx.imageSmoothingEnabled = false
    this.scene = scene
    this.ctx = ctx
    this.background = toCanvas(drawBackground())
    this.islandFront = toCanvas(drawIslandFront())
    this.glow = toCanvas(drawLanternGlow())
    this.map = beltMap()
    return true
  }

  private belt(index: number): HTMLCanvasElement | null {
    if (!this.belts[index] && this.map) this.belts[index] = toCanvas(drawBeltFrame(this.map, index))
    return this.belts[index] ?? null
  }

  private put(img: HTMLCanvasElement | null, x: number, y: number, alpha = 1) {
    if (!img || !this.ctx) return
    if (alpha < 1) this.ctx.globalAlpha = alpha
    this.ctx.drawImage(img, Math.round(x), Math.round(y))
    if (alpha < 1) this.ctx.globalAlpha = 1
  }

  /** ばめんを かいて、target に ひきのばして うつす。 */
  draw(target: CanvasRenderingContext2D, world: LaneWorld, options: RenderOptions): void {
    if (!this.ensure()) return
    const ctx = this.ctx!
    const time = world.time
    ctx.clearRect(0, 0, SCENE_W, SCENE_H)
    this.put(this.background, 0, 0)
    LANTERN_CENTERS.forEach((p, i) => this.put(this.glow, p.x - 24, p.y - 24, .16 + (options.still ? 0 : .06 * Math.sin(time * 2.3 + i * 1.7))))
    this.put(this.belt(Math.floor(mod(world.offset, BELT_PERIOD))), 0, 0)

    this.drawCustomers(world, options)
    this.drawTrain(world, options)

    const plates = world.plates.map(plate => ({ plate, p: platePoint(world, plate) })).sort((a, b) => a.p.y - b.p.y)
    const drawPlate = ({ plate, p }: (typeof plates)[number]) => {
      const age = time - plate.born
      const drop = age < .3 ? (1 - age / .3) ** 2 * 10 : 0
      const img = this.sprite(`dish:${recipeKey(plate.recipe)}`, () => drawDish(plate.recipe))
      this.put(img, p.x - DISH_ANCHOR.x, p.y - DISH_ANCHOR.y - drop)
      if (isSparkly(plate.recipe) && !options.still) {
        const phase = mod(time * 1.4 + plate.id * .37, 1)
        if (phase < .35) this.put(this.sprite('sparkle1', () => drawSparkle(1)), p.x - 14 + (plate.id * 7) % 20, p.y - 26 + (plate.id * 3) % 8)
      }
    }
    for (const item of plates) if (item.p.y < LANE.cy) drawPlate(item)

    const pose: ChefPose = world.chef > .4 ? 'nigi' : world.chef > 0 ? 'press'
      : world.customers.some(c => c.phase === 'react' && c.t < .8) ? 'wave' : 'idle'
    const chefBlink = mod(time, 3.7) < .14
    this.put(this.sprite(`chef:${pose}:${chefBlink}`, () => drawChef(pose, chefBlink)), CHEF_POS.x - CHEF_W / 2, CHEF_POS.y - CHEF_H + (options.still || pose !== 'idle' ? 0 : Math.round(Math.sin(time * 2) * .6)))
    this.put(this.islandFront, 0, 0)

    for (const item of plates) if (item.p.y >= LANE.cy) drawPlate(item)

    this.drawEffects(world)
    // ゆのみの ゆげ。
    if (!options.still) this.put(this.sprite(`steam:${Math.floor(time * 4) % 4}`, () => drawSteam(Math.floor(time * 4) % 4)), 21, 207, .55)

    target.imageSmoothingEnabled = false
    target.clearRect(0, 0, target.canvas.width, target.canvas.height)
    target.drawImage(this.scene!, 0, 0, target.canvas.width, target.canvas.height)
  }

  private drawCustomers(world: LaneWorld, options: RenderOptions) {
    for (const c of world.customers) {
      const x = SEATS[c.seat]
      const expr = expressionOf(world, c)
      const bob = options.still ? 0 : Math.floor(mod(world.time * 1.2 + c.seat * .45, 2))
      this.put(this.sprite(`cust:${c.animal}:${expr}:${bob}`, () => drawCustomer(c.animal, expr, bob)), x - CUSTOMER_W / 2, CUSTOMER_BOTTOM - CUSTOMER_H)
      // たべた おさらの やま。
      c.stack.slice(-9).forEach((plate, i) => {
        this.put(this.sprite(`mini:${plate}`, () => drawMiniPlate(plateDef(plate).ramp)), x + 11, CUSTOMER_BOTTOM - 6 - i * 2)
      })
      if (c.phase === 'eat' && c.eating) {
        const chip = this.sprite(`chip:${c.eating.neta}`, () => drawNetaChip(c.eating!.neta))
        if (chip && this.ctx) {
          const left = Math.max(0, 1 - c.bites / 3)
          const w = Math.ceil(16 * left)
          if (w > 0) this.ctx.drawImage(chip, 0, 0, w, 12, x - 8, CUSTOMER_BOTTOM - 17, w, 12)
        }
      }
      if (c.reaction === 'spicy' && c.phase === 'react' && c.t < 2 && !options.still) {
        const f = Math.floor(world.time * 6) % 4
        const steam = this.sprite(`steam:${f}`, () => drawSteam(f))
        this.put(steam, x - 15, CUSTOMER_BOTTOM - 44, .85)
        this.put(steam, x + 6, CUSTOMER_BOTTOM - 44, .85)
      }
      if (c.wish && (c.phase === 'idle' || c.phase === 'waitTrain')) {
        const wish = c.wish
        const lift = options.still ? 0 : Math.round(Math.sin(world.time * 3 + c.seat) * 1)
        this.put(this.sprite(`bubble:${wish}`, () => drawBubble(wish)), x - 11, CUSTOMER_BOTTOM - CUSTOMER_H - 15 + lift - (c.animal === 'usagi' ? 2 : 0))
      }
    }
  }

  private drawTrain(world: LaneWorld, options: RenderOptions) {
    const tr = world.train
    if (tr.phase === 'idle') return
    const right = tr.phase !== 'back'
    const frame = options.still ? 0 : Math.floor(world.time * 10) % 2
    this.put(this.sprite(`train:${right}:${frame}`, () => drawTrain(right, frame)), tr.x, TRAIN_RAIL_Y - TRAIN_H)
    if (tr.recipe) {
      const recipe = tr.recipe
      this.put(this.sprite(`dish:${recipeKey(recipe)}`, () => drawDish(recipe)), tr.x + TRAIN_DISH_X - DISH_ANCHOR.x, TRAIN_DISH_Y - DISH_ANCHOR.y)
    }
  }

  private drawEffects(world: LaneWorld) {
    for (const e of world.effects) {
      if (e.delay > 0) continue
      const fade = 1 - e.t / e.life
      if (e.kind === 'heart') this.put(this.sprite('heart', drawHeart), e.x - 3, e.y - 3, Math.min(1, fade * 2))
      else if (e.kind === 'sparkle') {
        const size = e.t < e.life * .5 ? 1 : 0
        this.put(this.sprite(`sparkle${size}`, () => drawSparkle(size as 0 | 1)), e.x - 2, e.y - 2, Math.min(1, fade * 2))
      } else {
        const f = Math.min(3, Math.floor((e.t / e.life) * 4))
        this.put(this.sprite(`puff:${f}`, () => drawPuff(f)), e.x - 12, e.y - 8, fade)
      }
    }
  }
}

import { describe, expect, test } from 'vitest'
import { ANIMALS, NETAS, PLATES, PRIZES, RICES, STYLES, TOPPINGS } from './data'
import { LANE, SCENE_H, SCENE_W, laneCoord } from './layout'
import { PixelBuffer, fromArt } from './pixel'
import { DEFAULT_RECIPE, recipeKey } from './recipe'
import { BELT_PERIOD, beltMap, drawBackground, drawBeltFrame, drawBubble, drawIslandFront, drawPreviewBackdrop } from './sceneArt'
import { drawCapsule, drawChef, drawCustomer, drawGacha, drawPrize, drawTrain, silhouette, type Expression } from './sprites'
import { DISH_H, DISH_W, SUSHI_H, SUSHI_W, drawDish, drawNetaChip, drawPlate, drawRiceIcon, drawSushi, drawToppingIcon } from './sushiArt'

const same = (a: PixelBuffer, b: PixelBuffer) => a.data.every((v, i) => v === b.data[i])

describe('おすしの ドット絵', () => {
  test('すべての かたち × ネタ × シャリ を かける（からっぽに ならない）', () => {
    for (const style of STYLES) {
      for (const neta of NETAS) {
        for (const rice of RICES) {
          const buf = drawSushi({ style: style.id, rice: rice.id, neta: neta.id, toppings: [], plate: 'ao' })
          expect(buf.w).toBe(SUSHI_W)
          expect(buf.h).toBe(SUSHI_H)
          expect(buf.count(), `${style.id}/${neta.id}/${rice.id}`).toBeGreaterThan(260)
        }
      }
    }
  })

  test('トッピングを のせると え が かわる', () => {
    for (const style of STYLES) {
      const plain = drawSushi({ ...DEFAULT_RECIPE, style: style.id })
      for (const topping of TOPPINGS) {
        const topped = drawSushi({ ...DEFAULT_RECIPE, style: style.id, toppings: [topping.id] })
        expect(same(plain, topped), `${style.id}+${topping.id}`).toBe(false)
      }
    }
  })

  test('シャリの いろが ちがえば え も ちがう', () => {
    const images = RICES.map(rice => drawSushi({ ...DEFAULT_RECIPE, style: 'maki', rice: rice.id }))
    for (let i = 1; i < images.length; i++) expect(same(images[0], images[i])).toBe(false)
  })

  test('おさらに のせた え は おさらの いろで かわり、ふちどりが ある', () => {
    const dishes = PLATES.map(plate => drawDish({ ...DEFAULT_RECIPE, plate: plate.id }))
    for (const dish of dishes) {
      expect(dish.w).toBe(DISH_W)
      expect(dish.h).toBe(DISH_H)
      const b = dish.bounds()!
      // はしまで はみださない（ふちどりが きれずに のこる）。
      expect(b.x0).toBeGreaterThanOrEqual(0)
      expect(b.x1).toBeLessThan(DISH_W)
      expect(b.y1).toBeLessThan(DISH_H)
    }
    for (let i = 1; i < dishes.length; i++) expect(same(dishes[0], dishes[i])).toBe(false)
  })

  test('えらぶ ボタンの え と ふきだしの ちいさな ネタ', () => {
    for (const rice of RICES) expect(drawRiceIcon(rice.id).count()).toBeGreaterThan(200)
    for (const topping of TOPPINGS) expect(drawToppingIcon(topping.id).count()).toBeGreaterThan(30)
    for (const plate of PLATES) expect(drawPlate(plate.id).count()).toBeGreaterThan(400)
    for (const neta of NETAS) expect(drawNetaChip(neta.id).count()).toBeGreaterThan(60)
  })

  test('おなじ レシピは いつも おなじ え（キャッシュできる）', () => {
    const recipe = { style: 'gunkan', rice: 'goma', neta: 'natto', toppings: ['negi', 'kinpaku'], plate: 'kuro' } as const
    expect(same(drawDish(recipe), drawDish({ ...recipe, toppings: ['negi', 'kinpaku'] }))).toBe(true)
    expect(recipeKey(recipe)).toBe('gunkan.goma.natto.negi+kinpaku.kuro')
  })
})

describe('おみせの ドット絵', () => {
  test('おきゃくさんは どの きもちでも かける', () => {
    const expressions: Expression[] = ['idle', 'blink', 'want', 'munch', 'chew', 'happy', 'spicy']
    for (const animal of ANIMALS) {
      const faces = expressions.map(e => drawCustomer(animal.id, e))
      for (const face of faces) expect(face.count()).toBeGreaterThan(500)
      expect(same(faces[0], faces[5]), `${animal.id} の えがおが ふだんと おなじ`).toBe(false)
    }
  })

  test('たいしょう・しんかんせん・ガチャ・たからもの', () => {
    for (const pose of ['idle', 'nigi', 'press', 'wave'] as const) expect(drawChef(pose).count()).toBeGreaterThan(600)
    expect(drawTrain(true).count()).toBeGreaterThan(400)
    expect(same(drawTrain(true), drawTrain(false))).toBe(false)
    expect(drawGacha(0).count()).toBeGreaterThan(1200)
    expect(drawCapsule(0).count()).toBeGreaterThan(100)
    for (const prize of PRIZES) {
      const img = drawPrize(prize.id)
      expect(img.count(), prize.id).toBeGreaterThan(80)
      expect(silhouette(img).count()).toBe(img.count())
    }
    for (const neta of NETAS) expect(drawBubble(neta.id).count()).toBeGreaterThan(300)
  })

  test('はいけいは ばめんを うめ、ベルトは ながれる', () => {
    const bg = drawBackground()
    expect(bg.w).toBe(SCENE_W)
    expect(bg.h).toBe(SCENE_H)
    const map = beltMap()
    // ベルトの ところだけ はいけいが あいていて、こまで うまる。
    for (let i = 0; i < map.index.length; i += 97) expect(bg.data[map.index[i]]).toBe(0)
    const a = drawBeltFrame(map, 0), b = drawBeltFrame(map, 3)
    expect(a.count()).toBe(map.index.length)
    expect(same(a, b)).toBe(false)
    expect(same(a, drawBeltFrame(map, BELT_PERIOD * 2))).toBe(true)
    expect(drawIslandFront().count()).toBeGreaterThan(500)
    expect(drawPreviewBackdrop().count()).toBe(64 * 50)
  })

  test('ベルトの ピクセルは みな レーンの はばの なか', () => {
    const map = beltMap()
    for (let i = 0; i < map.index.length; i += 13) {
      const x = map.index[i] % SCENE_W, y = Math.floor(map.index[i] / SCENE_W)
      expect(Math.abs(laneCoord(x + .5, y + .5).w)).toBeLessThanOrEqual(LANE.half)
    }
  })

  test('もじの え の パレットに ない もじは エラー', () => {
    expect(() => fromArt(['ab'], { a: '#000000' })).toThrow()
  })
})

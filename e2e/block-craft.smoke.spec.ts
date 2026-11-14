import { expect, test } from '@playwright/test'
import { decodeGame, encodeGame, newGame, SAVE_KEY } from '../src/games/block-craft/save'
import { editWorld } from '../src/games/block-craft/world'
import { capturePageErrors } from './support/runtimeErrors'
import { expectLiveApp } from './support/liveApp'

test.use({ launchOptions: { args: ['--enable-unsafe-swiftshader'] } })

test('ひろいブロッククラフトで建築・歩行・保存し、入り直せる', async ({ page }) => {
  const pageErrors = capturePageErrors(page)
  const game = { ...newGame('meadow', { size: 64, height: 12 }), wheat: 7 }
  editWorld(game.world, { x: 60, y: 3, z: 60 }, 'glass', 'place')
  await page.addInitScript(({ key, raw }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, raw)
  }, { key: SAVE_KEY, raw: encodeGame(game) })
  await page.goto('/games/block-craft')
  await expectLiveApp(page)
  const resume = page.getByRole('button', { name: /つづきから あそぶ/ })
  await resume.click()
  const scene = page.getByRole('application')
  await expect(scene.locator('canvas')).toBeVisible()
  await expect(page.getByRole('button', { name: 'あるく' })).toBeVisible()
  const before = await page.evaluate(key => localStorage.getItem(key), SAVE_KEY)
  await page.getByRole('button', { name: 'れんが', exact: true }).click()
  await scene.press('Enter')
  const undo = page.getByRole('button', { name: /もどす/ })
  await expect(undo).toBeEnabled()
  await undo.click()
  await expect(undo).toBeDisabled()
  await scene.press('Enter')
  await page.getByRole('button', { name: 'あるく' }).click()
  await expect(page.getByRole('button', { name: 'まえへ すすむ' })).toBeVisible()
  await scene.press('ArrowLeft')
  await scene.press('ArrowUp')
  await page.getByRole('button', { name: /ほぞん/ }).click()
  const raw = await page.evaluate(key => localStorage.getItem(key), SAVE_KEY)
  expect(raw).not.toBe(before)
  const saved = decodeGame(raw)!
  expect(saved.world.size).toBe(64)
  expect(saved.world.materialAt({ x: 32, y: 3, z: 32 })).toBe('brick')
  expect(saved.world.materialAt({ x: 60, y: 3, z: 60 })).toBe('glass')
  expect(saved.wheat).toBe(7)
  expect(saved.herd).toEqual(game.herd)
  await page.getByRole('button', { name: 'タイトルへ もどる' }).click()
  await expect(scene.locator('canvas')).toHaveCount(0)
  await resume.click()
  await expect(scene.locator('canvas')).toBeVisible()
  await expect(page.getByLabel('もっている こむぎ 7こ')).toBeVisible()
  expect(pageErrors).toEqual([])
})

// スマホの縦・横どちらでも、スクロールなしで ひろい せかいを つくって たんけん できる。
for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }, { width: 844, height: 390 }, { width: 667, height: 375 }]) {
  test.describe(`${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport })

    test('あたらしい ひろい せかいを タッチ・ちず・あるくで あそび、ほぞん できる', async ({ page }) => {
      const pageErrors = capturePageErrors(page)
      await page.goto('/games/block-craft')
      await expectLiveApp(page)
      const lands = page.getByRole('group', { name: 'あたらしい せかいを えらぶ' }).getByRole('button')
      await expect(lands).toHaveCount(10)
      await page.getByRole('button', { name: 'だいぼうけん', exact: true }).click()
      const scene = page.getByRole('application')
      const canvas = scene.locator('canvas')
      await expect(canvas).toBeVisible()

      // おもな そうさが ぜんぶ がめんの なかに あり、ページは スクロールしない
      const name = (text: string | RegExp) => page.getByRole('button', { name: text })
      const controls = [name('タイトルへ もどる'), name('よる'), name('おと'), name('ちず'), name('あるく'), name(/おく/), name(/こわす/), name(/ひろく/), name(/もどす/), name(/ほぞん/), name(/はじめの せかい/), page.getByRole('button', { name: 'くさ', exact: true })]
      for (const control of controls) await expect(control).toBeInViewport({ ratio: 1 })
      await expect(canvas).toBeInViewport({ ratio: 1 })
      const box = (await canvas.boundingBox())!
      expect(box.width).toBeGreaterThanOrEqual(200)
      expect(box.height).toBeGreaterThanOrEqual(200)
      expect(await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.scrollHeight])).toEqual([viewport.width, viewport.height])
      // ざいりょうは スクロールして ぜんぶ えらべる
      await name('はちみつ').scrollIntoViewIfNeeded()
      await name('はちみつ').tap()
      await expect(name('はちみつ')).toHaveAttribute('aria-pressed', 'true')
      await expect(canvas).toBeInViewport({ ratio: 1 })

      // せかいを タッチして ブロックを おく
      const undo = name(/もどす/)
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
      await expect(undo).toBeEnabled()

      // ちずを ひらき、タッチした ばしょへ とぶ
      await name('ちず').tap()
      const map = name('ちずの ばしょへ いく')
      await expect(map).toBeInViewport({ ratio: 1 })
      await expect(name('とじる')).toBeInViewport({ ratio: 1 })
      const mapBox = (await map.boundingBox())!
      expect(Math.abs(mapBox.width - mapBox.height)).toBeLessThan(2)
      expect(mapBox.width).toBeGreaterThanOrEqual(140)
      await page.touchscreen.tap(mapBox.x + mapBox.width * 0.25, mapBox.y + mapBox.height * 0.75)
      await expect(page.getByRole('dialog')).toHaveCount(0)

      // あるく：ボタンは がめんの なかで、ちず・あるく ボタンと かさならない
      await name('あるく').tap()
      const pad = [name('まえへ すすむ'), name('うしろへ さがる'), name('ひだりを むく'), name('みぎを むく')]
      const fixed = [(await name('ちず').boundingBox())!, (await name('あるく').boundingBox())!]
      for (const button of pad) {
        await expect(button).toBeInViewport({ ratio: 1 })
        const b = (await button.boundingBox())!
        expect(b.width).toBeGreaterThanOrEqual(44)
        expect(b.height).toBeGreaterThanOrEqual(44)
        for (const other of fixed) {
          expect(b.x + b.width <= other.x || other.x + other.width <= b.x || b.y + b.height <= other.y || other.y + other.height <= b.y).toBe(true)
        }
      }
      await name('みぎを むく').tap()
      await name('まえへ すすむ').tap()
      await name('あるく').tap()
      await expect(name('まえへ すすむ')).toHaveCount(0)

      await name(/ほぞん/).tap()
      const saved = decodeGame(await page.evaluate(key => localStorage.getItem(key), SAVE_KEY))!
      expect(saved.world.size).toBe(96)
      expect(saved.biome).toBe('adventure')
      expect([...saved.world.blocks()].some(b => b.material === 'honey')).toBe(true)
      expect(pageErrors).toEqual([])
    })
  })
}

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
  await page.getByRole('button', { name: 'れんが' }).click()
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

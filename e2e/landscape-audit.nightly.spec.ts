import { expect, test } from '@playwright/test'
import { boxesOverlap } from './support/layout'

for (const viewport of [{ width: 667, height: 375 }, { width: 844, height: 390 }]) {
  test.describe(`${viewport.width}x${viewport.height} 横画面レビューの回帰`, () => {
    test.use({ viewport })

    test('花壇6個がスクロールなしで使える [pixel-garden]', async ({ page }) => {
      await page.goto('/games/pixel-garden')
      const plots = page.getByRole('button', { name: /ばんの はなだん/ })
      await expect(plots).toHaveCount(6)
      for (const plot of await plots.all()) await expect(plot).toBeInViewport({ ratio: 1 })
      await plots.first().tap()
      await plots.first().tap()
      await expect(plots.first()).toHaveAccessibleName(/おひさま/)
    })

    test('地図と全ピースが同時に見える [prefecture-quiz]', async ({ page }) => {
      await page.goto('/games/prefecture-quiz/puzzle/tohoku/play')
      await expect(page.getByRole('group', { name: '都道府県パズルの地図' })).toBeInViewport({ ratio: 1 })
      const pieces = page.locator('[data-puzzle-tray] button')
      await expect(pieces).toHaveCount(6)
      for (const piece of await pieces.all()) await expect(piece).toBeInViewport({ ratio: 1 })
      await page.getByRole('button', { name: 'あおもりけん', exact: true }).tap()
      await expect(page.getByRole('button', { name: 'えらんだピースを もどす' })).toBeInViewport({ ratio: 1 })
      for (const piece of await pieces.all()) await expect(piece).toBeInViewport({ ratio: 1 })
    })

    test('完成と内観の3D表示が画面内に収まる [house-builder]', async ({ page }) => {
      await page.goto('/games/house-builder')
      await page.getByRole('button', { name: /おまかせで つくる/ }).tap()
      const canvas = page.locator('canvas')
      await expect(canvas).toBeInViewport({ ratio: 1 })
      expect((await canvas.boundingBox())!.height).toBeGreaterThan(200)
      await page.getByRole('button', { name: 'なかを みる', exact: true }).tap()
      await expect(canvas).toBeInViewport({ ratio: 1 })
      expect((await canvas.boundingBox())!.height).toBeGreaterThan(200)
    })

    test('生き物の観察と解説が画面内に出る [venom-lab]', async ({ page }) => {
      await page.goto('/games/venom-lab')
      const octopus = page.getByRole('button', { name: /ヒョウモンダコのなかまを かんさつ/ })
      await expect(octopus).toBeInViewport()
      await octopus.tap()
      await expect(page.getByRole('heading', { name: 'ヒョウモンダコのなかま', exact: true })).toBeInViewport()
    })

    test('進行バーが所持数に重ならない [dot-run]', async ({ page }) => {
      await page.goto('/games/dot-run')
      await page.getByRole('button', { name: /ステージ1 / }).tap()
      const bar = page.getByRole('progressbar', { name: 'ゴールまで' })
      const carrots = page.getByLabel('にんじん 0こ', { exact: true })
      await expect(bar).toBeVisible()
      await expect(carrots).toBeVisible()
      expect(boxesOverlap(await bar.boundingBox(), await carrots.boundingBox())).toBe(false)
    })

    test('拡大後も指の位置に部品を置けて全体表示へ戻れる [flag-roll-puzzle]', async ({ page }) => {
      await page.goto('/games/flag-roll-puzzle')
      await page.getByRole('button', { name: 'かんたん', exact: true }).tap()
      const board = page.getByTestId('puzzle-board')
      const before = await board.boundingBox()
      await page.getByRole('button', { name: 'ばんめんを おおきく', exact: true }).tap()
      await expect.poll(async () => (await board.boundingBox())!.height).toBeGreaterThan(before!.height * 1.5)
      await page.getByRole('button', { name: 'ひだりへ', exact: true }).tap()
      const enlarged = (await board.boundingBox())!
      // Center of logical cell (3, 2), including the start strip above the grid.
      await page.touchscreen.tap(enlarged.x + enlarged.width * 210 / 480, enlarged.y + enlarged.height * 222 / 740)
      await expect(page.getByTestId('puzzle-part')).toHaveCount(1)
      await page.getByRole('button', { name: 'ばんめんを したへ', exact: true }).tap()
      await page.getByRole('button', { name: 'ばんめんを ぜんたいひょうじ', exact: true }).tap()
      await expect(page.getByTestId('puzzle-part')).toHaveCount(1)
      await expect(board).toBeInViewport({ ratio: 1 })
    })
  })
}

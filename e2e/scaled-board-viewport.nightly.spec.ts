import { expect, test } from '@playwright/test'
import { expectScaledBoardInViewport } from './support/layout'

test('拡縮盤面の丸め誤差だけを許容し、親によるクリップも検出する', async ({ page }) => {
  await page.setContent(`
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <div style="width:100px;height:100px;overflow:hidden">
      <div id="board" style="width:100px;height:100px;transform:translateX(0.5px);background:blue"></div>
    </div>
  `)
  const board = page.locator('#board')
  await expectScaledBoardInViewport(board)
  await board.evaluate((element) => { (element as HTMLElement).style.transform = 'translateX(3px)' })
  await expect(expectScaledBoardInViewport(board, 500)).rejects.toThrow(/1 CSS px/)
  await board.evaluate((element) => { (element as HTMLElement).style.transform = 'translateX(101px)' })
  await expect(expectScaledBoardInViewport(board, 500)).rejects.toThrow(/1 CSS px/)
})

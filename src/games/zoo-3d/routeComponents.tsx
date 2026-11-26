import { lazy } from 'react'

// 動物園と レース場は 画面ごとに読み込む（レース場を開くまで レースのコードを読まない）。
export const Zoo = lazy(() => import('./Zoo3dPlay'))
export const Race = lazy(() => import('./race/ZooRacePlay'))

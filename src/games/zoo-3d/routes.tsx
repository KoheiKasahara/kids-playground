import type { RouteObject } from 'react-router-dom'
import { Race, Zoo } from './routeComponents'

// このゲーム内の相対URLを所有する。Suspense/読込失敗UIはAppの共通境界を使う。
// プレイ面（GamePlaySurface）は、どちらの画面もゲーム内で包む。
export const zoo3dRoutes: RouteObject[] = [
  { index: true, element: <Zoo /> },
  { path: 'race', element: <Race /> },
]

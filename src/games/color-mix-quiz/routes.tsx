import { lazy } from 'react'
import { Navigate, type RouteObject } from 'react-router-dom'
import GamePlaySurface from '../../components/GamePlaySurface'

const Start = lazy(() => import('./ColorMixQuizStart'))
const Play = lazy(() => import('./ColorMixQuizPlay'))
const Result = lazy(() => import('./ColorMixQuizResult'))

// このゲーム内の相対URLを所有する。Suspense/読込失敗UIはAppの共通境界を使う。
export const colorMixQuizRoutes: RouteObject[] = [
  { index: true, element: <Start /> },
  { path: 'play', element: <GamePlaySurface><Play /></GamePlaySurface> },
  { path: 'result', element: <Result /> },
  { path: 'level', element: <Navigate to="/games/color-mix-quiz/play" replace /> },
  { path: ':level/play', element: <Navigate to="/games/color-mix-quiz/play" replace /> },
  { path: ':level/result', element: <Navigate to="/games/color-mix-quiz" replace /> },
]

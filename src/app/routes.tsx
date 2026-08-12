import { lazy, Suspense, type ComponentType } from 'react'
import { Navigate, type RouteObject } from 'react-router-dom'
import Home from '../pages/Home'
import FlagQuizStart from '../games/flag-quiz/FlagQuizStart'
import FlagQuizLevelSelect from '../games/flag-quiz/FlagQuizLevelSelect'
import FlagQuizPlay from '../games/flag-quiz/FlagQuizPlay'
import FlagQuizResult from '../games/flag-quiz/FlagQuizResult'
import PanelFlagQuizPlay from '../games/flag-quiz/PanelFlagQuizPlay'
import WorkingVehicleQuizStart from '../games/working-vehicle-quiz/WorkingVehicleQuizStart'
import WorkingVehicleQuizLevelSelect from '../games/working-vehicle-quiz/WorkingVehicleQuizLevelSelect'
import WorkingVehicleQuizPlay from '../games/working-vehicle-quiz/WorkingVehicleQuizPlay'
import WorkingVehicleQuizResult from '../games/working-vehicle-quiz/WorkingVehicleQuizResult'
import MathQuizStart from '../games/math-quiz/MathQuizStart'
import MathQuizLevelSelect from '../games/math-quiz/MathQuizLevelSelect'
import MathQuizPlay from '../games/math-quiz/MathQuizPlay'
import MathQuizResult from '../games/math-quiz/MathQuizResult'
import { MODE_PATH as MATH_QUIZ_MODE_PATH } from '../games/math-quiz/types'
import type { MathQuizMode } from '../games/math-quiz/types'
import PrefectureQuizStart from '../games/prefecture-quiz/PrefectureQuizStart'
import PrefectureQuizPlay from '../games/prefecture-quiz/PrefectureQuizPlay'
import PrefectureQuizResult from '../games/prefecture-quiz/PrefectureQuizResult'
import PrefecturePuzzleStart from '../games/prefecture-quiz/PrefecturePuzzleStart'
import PrefecturePuzzlePlay from '../games/prefecture-quiz/PrefecturePuzzlePlay'
import ColorMixQuizStart from '../games/color-mix-quiz/ColorMixQuizStart'
import ColorMixQuizPlay from '../games/color-mix-quiz/ColorMixQuizPlay'
import ColorMixQuizResult from '../games/color-mix-quiz/ColorMixQuizResult'

// 50m世界地図は大きいため、旅行クイズを開くときだけ読込む。Vite PWAは生成された
// chunkもprecacheするため、初回取得後は他のゲームと同様にオフラインで遊べる。
const travelRoute = (loader: () => Promise<{ default: ComponentType }>) => {
  const Screen = lazy(loader)
  return <Suspense fallback={null}><Screen /></Suspense>
}

// さんすうクイズは4モード(add/sub/mul/div)ぶんの「むずかしさ選択・プレイ・結果」が
// 完全に同型のため、直書きの繰り返しを避けて配列から組み立てる。
const MATH_QUIZ_MODES: MathQuizMode[] = ['add', 'sub', 'mul', 'div']

export const routes: RouteObject[] = [
  { path: '/', element: <Home /> },
  { path: '/games/flag-quiz', element: <FlagQuizStart /> },
  { path: '/games/flag-quiz/flag-to-name', element: <FlagQuizLevelSelect mode="flagToName" /> },
  {
    path: '/games/flag-quiz/flag-to-name/:level/play',
    element: <FlagQuizPlay mode="flagToName" />,
  },
  {
    path: '/games/flag-quiz/flag-to-name/:level/result',
    element: <FlagQuizResult mode="flagToName" />,
  },
  { path: '/games/flag-quiz/name-to-flag', element: <FlagQuizLevelSelect mode="nameToFlag" /> },
  {
    path: '/games/flag-quiz/name-to-flag/:level/play',
    element: <FlagQuizPlay mode="nameToFlag" />,
  },
  {
    path: '/games/flag-quiz/name-to-flag/:level/result',
    element: <FlagQuizResult mode="nameToFlag" />,
  },
  { path: '/games/flag-quiz/panel-flag', element: <FlagQuizLevelSelect mode="panelFlag" /> },
  {
    path: '/games/flag-quiz/panel-flag/:level/play',
    element: <PanelFlagQuizPlay />,
  },
  {
    path: '/games/flag-quiz/panel-flag/:level/result',
    element: <FlagQuizResult mode="panelFlag" />,
  },
  { path: '/games/working-vehicle-quiz', element: <WorkingVehicleQuizStart /> },
  {
    path: '/games/working-vehicle-quiz/photo-to-name',
    element: <WorkingVehicleQuizLevelSelect mode="photoToName" />,
  },
  {
    path: '/games/working-vehicle-quiz/photo-to-name/:level/play',
    element: <WorkingVehicleQuizPlay mode="photoToName" />,
  },
  {
    path: '/games/working-vehicle-quiz/photo-to-name/:level/result',
    element: <WorkingVehicleQuizResult mode="photoToName" />,
  },
  {
    path: '/games/working-vehicle-quiz/name-to-photo',
    element: <WorkingVehicleQuizLevelSelect mode="nameToPhoto" />,
  },
  {
    path: '/games/working-vehicle-quiz/name-to-photo/:level/play',
    element: <WorkingVehicleQuizPlay mode="nameToPhoto" />,
  },
  {
    path: '/games/working-vehicle-quiz/name-to-photo/:level/result',
    element: <WorkingVehicleQuizResult mode="nameToPhoto" />,
  },
  { path: '/games/math-quiz', element: <MathQuizStart /> },
  { path: '/games/color-mix-quiz', element: <ColorMixQuizStart /> },
  { path: '/games/color-mix-quiz/play', element: <ColorMixQuizPlay /> },
  { path: '/games/color-mix-quiz/result', element: <ColorMixQuizResult /> },
  // Old difficulty URLs now begin the single colour-mix game directly.
  { path: '/games/color-mix-quiz/level', element: <Navigate to="/games/color-mix-quiz/play" replace /> },
  { path: '/games/color-mix-quiz/:level/play', element: <Navigate to="/games/color-mix-quiz/play" replace /> },
  { path: '/games/color-mix-quiz/:level/result', element: <Navigate to="/games/color-mix-quiz" replace /> },
  { path: '/games/prefecture-quiz', element: <PrefectureQuizStart /> },
  { path: '/games/prefecture-quiz/puzzle', element: <PrefecturePuzzleStart /> },
  { path: '/games/prefecture-quiz/puzzle/:region/play', element: <PrefecturePuzzlePlay /> },
  { path: '/games/prefecture-quiz/:mode/play', element: <PrefectureQuizPlay /> },
  { path: '/games/prefecture-quiz/:mode/result', element: <PrefectureQuizResult /> },
  { path: '/games/world-travel-quiz', element: travelRoute(() => import('../games/world-travel-quiz/WorldTravelQuizStart')) },
  { path: '/games/world-travel-quiz/:region/play', element: travelRoute(() => import('../games/world-travel-quiz/WorldTravelQuizPlay')) },
  { path: '/games/world-travel-quiz/:region/result', element: travelRoute(() => import('../games/world-travel-quiz/WorldTravelQuizResult')) },
  ...MATH_QUIZ_MODES.flatMap((mode) => [
    {
      path: `/games/math-quiz/${MATH_QUIZ_MODE_PATH[mode]}`,
      element: <MathQuizLevelSelect mode={mode} />,
    },
    {
      path: `/games/math-quiz/${MATH_QUIZ_MODE_PATH[mode]}/:level/play`,
      element: <MathQuizPlay mode={mode} />,
    },
    {
      path: `/games/math-quiz/${MATH_QUIZ_MODE_PATH[mode]}/:level/result`,
      element: <MathQuizResult mode={mode} />,
    },
  ]),
  // 旧URL（むずかしさ追加前）のブックマークやホーム画面ショートカット互換のためのリダイレクト。
  // 旧 /play は現在の全105か国を出題する「むずかしい」へ倒す。
  // 旧 /result は state（正解数など）に依存するため復元できず、開始画面へ戻す。
  {
    path: '/games/flag-quiz/play',
    element: <Navigate to="/games/flag-quiz/flag-to-name/hard/play" replace />,
  },
  {
    path: '/games/flag-quiz/flag-to-name/play',
    element: <Navigate to="/games/flag-quiz/flag-to-name/hard/play" replace />,
  },
  {
    path: '/games/flag-quiz/name-to-flag/play',
    element: <Navigate to="/games/flag-quiz/name-to-flag/hard/play" replace />,
  },
  { path: '/games/flag-quiz/result', element: <Navigate to="/games/flag-quiz" replace /> },
  {
    path: '/games/flag-quiz/flag-to-name/result',
    element: <Navigate to="/games/flag-quiz" replace />,
  },
  {
    path: '/games/flag-quiz/name-to-flag/result',
    element: <Navigate to="/games/flag-quiz" replace />,
  },
  { path: '*', element: <Navigate to="/" replace /> },
]

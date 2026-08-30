import { lazy, type ComponentType } from 'react'
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
import { VegetableQuizPlay, VegetableQuizResult, VegetableQuizStart } from '../games/vegetable-quiz/VegetableQuiz'
import { FruitQuizPlay, FruitQuizResult, FruitQuizStart } from '../games/fruit-quiz/FruitQuiz'
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

// 50m世界地図やmatter-js(物理エンジン)など、特定ゲームだけが必要とする重い依存は
// そのゲームを開くときだけ読込む。Vite PWAは生成されたchunkもprecacheするため、
// 初回取得後は他のゲームと同様にオフラインで遊べる。
//
// Suspense境界はここではなくApp.tsxに1つだけ置く（各ルートで個別にfallback={null}の
// Suspenseを持たせない）。GameIntroもその同じ境界の中に同居させることで、チャンク未解決の間は
// ゲーム本体・GameIntroの両方が丸ごとfallbackに置き換わり、GameIntroだけが先に見える
// 中間状態が構造的に発生しなくなる（詳細はApp.tsxのコメント、Issue #298を参照）。
const lazyRoute = (loader: () => Promise<{ default: ComponentType }>) => {
  const Screen = lazy(loader)
  return <Screen />
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
  { path: '/games/vegetable-quiz', element: <VegetableQuizStart /> },
  { path: '/games/vegetable-quiz/image-to-name/play', element: <VegetableQuizPlay mode="imageToName" /> },
  { path: '/games/vegetable-quiz/image-to-name/result', element: <VegetableQuizResult mode="imageToName" /> },
  { path: '/games/vegetable-quiz/name-to-image/play', element: <VegetableQuizPlay mode="nameToImage" /> },
  { path: '/games/vegetable-quiz/name-to-image/result', element: <VegetableQuizResult mode="nameToImage" /> },
  { path: '/games/fruit-quiz', element: <FruitQuizStart /> },
  { path: '/games/fruit-quiz/image-to-name/play', element: <FruitQuizPlay mode="imageToName" /> },
  { path: '/games/fruit-quiz/image-to-name/result', element: <FruitQuizResult mode="imageToName" /> },
  { path: '/games/fruit-quiz/name-to-image/play', element: <FruitQuizPlay mode="nameToImage" /> },
  { path: '/games/fruit-quiz/name-to-image/result', element: <FruitQuizResult mode="nameToImage" /> },
  { path: '/games/math-quiz', element: <MathQuizStart /> },
  { path: '/games/color-mix-quiz', element: <ColorMixQuizStart /> },
  { path: '/games/color-mix-quiz/play', element: <ColorMixQuizPlay /> },
  { path: '/games/color-mix-quiz/result', element: <ColorMixQuizResult /> },
  // Old difficulty URLs now begin the single colour-mix game directly.
  { path: '/games/color-mix-quiz/level', element: <Navigate to="/games/color-mix-quiz/play" replace /> },
  { path: '/games/color-mix-quiz/:level/play', element: <Navigate to="/games/color-mix-quiz/play" replace /> },
  { path: '/games/color-mix-quiz/:level/result', element: <Navigate to="/games/color-mix-quiz" replace /> },
  // こっきピンボールは物理エンジン(matter-js)を含み main chunk のサイズ警告を超えるため、
  // 旅行クイズの世界地図と同様に開くときだけ読込む。
  { path: '/games/flag-pinball', element: lazyRoute(() => import('../games/flag-pinball/FlagPinballSelect')) },
  { path: '/games/flag-pinball/play', element: lazyRoute(() => import('../games/flag-pinball/FlagPinballPlay')) },
  { path: '/games/flag-pinball/result', element: lazyRoute(() => import('../games/flag-pinball/FlagPinballResult')) },
  { path: '/games/domino-flag', element: lazyRoute(() => import('../games/domino-flag/DominoFlagPlay')) },
  // 選択画面と、Three.js・Rapier(wasm)を使うプレイ画面を必要なときだけ読込む。
  { path: '/games/flag-roll-maze', element: lazyRoute(() => import('../games/flag-roll-maze/FlagRollMazeSelect')) },
  { path: '/games/flag-roll-maze/play', element: lazyRoute(() => import('../games/flag-roll-maze/FlagRollMazePlay')) },
  // こっきコロコロパズルも物理エンジン(matter-js)を含むため、開くときだけ読込む。
  { path: '/games/flag-roll-puzzle', element: lazyRoute(() => import('../games/flag-roll-puzzle/FlagRollPuzzlePlay')) },
  { path: '/games/earth-globe', element: lazyRoute(() => import('../games/earth-globe/EarthGlobePlay')) },
  { path: '/games/planet-globe', element: lazyRoute(() => import('../games/planet-globe/PlanetGlobePlay')) },
  { path: '/games/rail-builder', element: lazyRoute(() => import('../games/rail-builder/RailBuilderPlay')) },
  { path: '/games/flag-roll-adventure', element: lazyRoute(() => import('../games/flag-roll-adventure/FlagRollAdventureSelect')) },
  { path: '/games/flag-roll-adventure/play', element: lazyRoute(() => import('../games/flag-roll-adventure/FlagRollAdventurePlay')) },
  { path: '/games/flag-roll-adventure/goal', element: lazyRoute(() => import('../games/flag-roll-adventure/FlagRollAdventureGoal')) },
  { path: '/games/prefecture-quiz', element: <PrefectureQuizStart /> },
  { path: '/games/prefecture-quiz/puzzle', element: <PrefecturePuzzleStart /> },
  { path: '/games/prefecture-quiz/puzzle/:region/play', element: <PrefecturePuzzlePlay /> },
  { path: '/games/prefecture-quiz/:mode/play', element: <PrefectureQuizPlay /> },
  { path: '/games/prefecture-quiz/:mode/result', element: <PrefectureQuizResult /> },
  { path: '/games/world-travel-quiz', element: lazyRoute(() => import('../games/world-travel-quiz/WorldTravelQuizStart')) },
  { path: '/games/world-travel-quiz/:region/answer-mode', element: lazyRoute(() => import('../games/world-travel-quiz/WorldTravelAnswerModeSelect')) },
  { path: '/games/world-travel-quiz/:region/:answerMode/play', element: lazyRoute(() => import('../games/world-travel-quiz/WorldTravelQuizPlay')) },
  { path: '/games/world-travel-quiz/:region/:answerMode/result', element: lazyRoute(() => import('../games/world-travel-quiz/WorldTravelQuizResult')) },
  { path: '/games/japan-travel-quiz', element: lazyRoute(() => import('../games/japan-travel-quiz/JapanTravelQuizStart')) },
  { path: '/games/japan-travel-quiz/play', element: lazyRoute(() => import('../games/japan-travel-quiz/JapanTravelQuizPlay')) },
  { path: '/games/japan-travel-quiz/result', element: lazyRoute(() => import('../games/japan-travel-quiz/JapanTravelQuizResult')) },
  { path: '/games/piano-play', element: lazyRoute(() => import('../games/piano-play/PianoPlay')) },
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

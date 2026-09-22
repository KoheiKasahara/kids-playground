import { lazy } from 'react'

// 地図データ・国旗・プレイ用UIをホーム画面で読み込まない。
// Appの共通Suspense境界とPWAキャッシュを使う。
export const FlagQuizPlay = lazy(() => import('../games/flag-quiz/FlagQuizPlay'))
export const PanelFlagQuizPlay = lazy(() => import('../games/flag-quiz/PanelFlagQuizPlay'))
export const WorkingVehicleQuizPlay = lazy(() => import('../games/working-vehicle-quiz/WorkingVehicleQuizPlay'))
export const PrefectureQuizPlay = lazy(() => import('../games/prefecture-quiz/PrefectureQuizPlay'))
export const PrefecturePuzzlePlay = lazy(() => import('../games/prefecture-quiz/PrefecturePuzzlePlay'))

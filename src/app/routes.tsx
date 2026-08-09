import { Navigate, type RouteObject } from 'react-router-dom'
import Home from '../pages/Home'
import FlagQuizStart from '../games/flag-quiz/FlagQuizStart'
import FlagQuizPlay from '../games/flag-quiz/FlagQuizPlay'
import FlagQuizResult from '../games/flag-quiz/FlagQuizResult'

export const routes: RouteObject[] = [
  { path: '/', element: <Home /> },
  { path: '/games/flag-quiz', element: <FlagQuizStart /> },
  {
    path: '/games/flag-quiz/flag-to-name/play',
    element: <FlagQuizPlay mode="flagToName" />,
  },
  {
    path: '/games/flag-quiz/flag-to-name/result',
    element: <FlagQuizResult mode="flagToName" />,
  },
  {
    path: '/games/flag-quiz/name-to-flag/play',
    element: <FlagQuizPlay mode="nameToFlag" />,
  },
  {
    path: '/games/flag-quiz/name-to-flag/result',
    element: <FlagQuizResult mode="nameToFlag" />,
  },
  // 旧URL（モード追加前）のブックマークやホーム画面ショートカット互換のためのリダイレクト。
  // 旧 /play は元々「国旗→国名」のみだったため、そのモードへ倒す。
  // 旧 /result は state（正解数など）に依存するため復元できず、開始画面へ戻す。
  { path: '/games/flag-quiz/play', element: <Navigate to="/games/flag-quiz/flag-to-name/play" replace /> },
  { path: '/games/flag-quiz/result', element: <Navigate to="/games/flag-quiz" replace /> },
  { path: '*', element: <Navigate to="/" replace /> },
]

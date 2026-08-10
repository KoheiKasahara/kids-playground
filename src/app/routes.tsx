import { Navigate, type RouteObject } from 'react-router-dom'
import Home from '../pages/Home'
import FlagQuizStart from '../games/flag-quiz/FlagQuizStart'
import FlagQuizLevelSelect from '../games/flag-quiz/FlagQuizLevelSelect'
import FlagQuizPlay from '../games/flag-quiz/FlagQuizPlay'
import FlagQuizResult from '../games/flag-quiz/FlagQuizResult'
import WorkingVehicleQuizStart from '../games/working-vehicle-quiz/WorkingVehicleQuizStart'
import WorkingVehicleQuizLevelSelect from '../games/working-vehicle-quiz/WorkingVehicleQuizLevelSelect'
import WorkingVehicleQuizPlay from '../games/working-vehicle-quiz/WorkingVehicleQuizPlay'
import WorkingVehicleQuizResult from '../games/working-vehicle-quiz/WorkingVehicleQuizResult'

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
  // 旧URL（むずかしさ追加前）のブックマークやホーム画面ショートカット互換のためのリダイレクト。
  // むずかしさ追加前は全100か国が出題対象だったため、旧 /play はすべて「むずかしい」へ倒す。
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

import { Navigate, type RouteObject } from 'react-router-dom'
import Home from '../pages/Home'
import FlagQuizStart from '../games/flag-quiz/FlagQuizStart'
import FlagQuizPlay from '../games/flag-quiz/FlagQuizPlay'
import FlagQuizResult from '../games/flag-quiz/FlagQuizResult'

export const routes: RouteObject[] = [
  { path: '/', element: <Home /> },
  { path: '/games/flag-quiz', element: <FlagQuizStart /> },
  { path: '/games/flag-quiz/play', element: <FlagQuizPlay /> },
  { path: '/games/flag-quiz/result', element: <FlagQuizResult /> },
  { path: '*', element: <Navigate to="/" replace /> },
]

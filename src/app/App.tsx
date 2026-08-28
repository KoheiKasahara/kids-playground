import { useRoutes } from 'react-router-dom'
import { routes } from './routes'
import PwaStatus from '../pwa/PwaStatus'
import SeoManager from '../seo/SeoManager'

export default function App() {
  const element = useRoutes(routes)
  return (
    <>
      <SeoManager />
      {element}
      <PwaStatus />
    </>
  )
}

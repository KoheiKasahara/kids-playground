import { Component, Suspense, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import styles from './GameRouteBoundary.module.css'

class RouteErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className={styles.page}>
        <h1 className={styles.title}>うまく よみこめませんでした</h1>
        <p role="alert">もういちど よみこむか、べつの ゲームを えらんでね。</p>
        {/* lazyが保持するrejectも解消するため、再試行は明示操作によるページ再読込。 */}
        <button type="button" className={styles.action} onClick={() => window.location.reload()}>
          もういちど よみこむ
        </button>
        <Link className={styles.action} to="/">ゲームを えらぶ</Link>
      </main>
    )
  }
}

export default function GameRouteBoundary({ children }: { children: ReactNode }) {
  const location = useLocation()
  return (
    <RouteErrorBoundary key={location.pathname + location.search}>
      <Suspense fallback={
        <div className={styles.page}>
          <p role="status" className={styles.title}>よみこみちゅう…</p>
          <Link className={styles.action} to="/">ゲームを えらぶ</Link>
        </div>
      }>
        {children}
      </Suspense>
    </RouteErrorBoundary>
  )
}

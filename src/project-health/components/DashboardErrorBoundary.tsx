import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

/**
 * Dashboard内で想定外の例外が起きても、真っ白なエラー画面ではなく
 * 最低限のフォールバック表示にとどめる（Issue #526「JavaScriptエラーで
 * Dashboard全体が落ちる実装は避ける」）。
 */
export default class DashboardErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    console.error('[project-health-dashboard]', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="ph-page">
          <p className="ph-error">Project Health Dashboard の表示中にエラーが発生しました。</p>
        </div>
      )
    }
    return this.props.children
  }
}

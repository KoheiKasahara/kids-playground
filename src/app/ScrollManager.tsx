import { useEffect, useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

// このタブのセッション内だけで、履歴エントリ(location.key)ごとのスクロール位置を覚えておく。
// 別タブ・次回起動には影響させたくないのでsessionStorageを使う。
const STORAGE_PREFIX = 'kp:scrollY:'

function readSavedScrollY(key: string): number {
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + key)
    return raw === null ? 0 : Number(raw) || 0
  } catch {
    // プライベートブラウズ等でsessionStorageが使えなくても致命的ではないため握りつぶす。
    return 0
  }
}

function writeSavedScrollY(key: string, y: number): void {
  try {
    sessionStorage.setItem(STORAGE_PREFIX + key, String(y))
  } catch {
    // 上記と同様、保存できなくても無視する（先頭表示にフォールバックするだけ）。
  }
}

// ブラウザの自動スクロール復元は、SPAのpush遷移かback/forwardかを区別してくれない。
// このモジュールが読み込まれた時点（アプリ起動時、初回popstateより十分前）で
// 一度だけ'manual'に切り替え、以降の復元判断はすべてこのコンポーネントに委ねる。
if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual'
}

/**
 * SPA遷移時のスクロール位置を一括管理する。App.tsxでこの1箇所だけをマウントする。
 *
 * SEO Phase 4でゲームページ下部に説明文（GameIntro）が増え、ページが縦に長くなった結果、
 * 遷移前のスクロール位置が残ったままだと説明文付近が初期表示されてしまう回帰が起きていた
 * （Issue #299）。ここでは遷移の種類ごとに以下のように振る舞いを分ける。
 *
 * - 通常の遷移（トップからゲームを開く、ゲーム間を移動する等のPUSH/REPLACE）は
 *   常にページ先頭から始まるようにする。
 * - ブラウザの戻る/進む（POP）は、そのページを最後に見ていたスクロール位置へ戻す
 *   （ブラウザ標準の履歴挙動を壊さないため）。
 */
export default function ScrollManager(): null {
  const location = useLocation()
  const navigationType = useNavigationType()
  const currentKeyRef = useRef(location.key)
  // 直近に位置合わせを済ませたlocation.key。nullは「まだ一度も処理していない」を表す。
  const resolvedKeyRef = useRef<string | null>(null)

  // レイアウト確定後・ペイント前に位置を合わせ、先頭以外の位置が一瞬でも見えないようにする。
  useLayoutEffect(() => {
    currentKeyRef.current = location.key

    // StrictMode（開発時）はeffectを1回のコミットで2回実行するが、その2回は
    // 同じ[location.key, navigationType]のまま呼ばれる。ブラウザの実際の遷移は
    // 必ずlocation.keyが変わるため、前回処理したキーと同じであれば実質的な遷移ではない
    // 二重実行とみなしてスキップする（真偽値フラグだと2回目の実行で誤って
    // 「初回ではない」と判定してしまうため、キー自体を比較する）。
    if (resolvedKeyRef.current === location.key) {
      return
    }

    // React Routerは、初回読み込み・リロード・直リンクのたびにlocation.keyを
    // 同じ文字列'default'から始める。そのためアプリ起動直後（まだ何も処理していない）は
    // navigationTypeが'POP'に見えても、それは実際の戻る操作ではなく単なる初期表示であり、
    // sessionStorageの'default'キーは同じタブ内で以前開いていた別URLの値かもしれず信用できない。
    // 起動直後だけは常に先頭へ。以降の本物のPOP（戻る/進む）でのみ保存済み位置を復元する。
    const isInitialLoad = resolvedKeyRef.current === null
    resolvedKeyRef.current = location.key

    if (!isInitialLoad && navigationType === 'POP') {
      window.scrollTo(0, readSavedScrollY(location.key))
    } else {
      window.scrollTo(0, 0)
    }
  }, [location.key, navigationType])

  // 遷移先を問わず、現在のページを離れる直前のスクロール位置をpopstate復元用に覚えておく。
  useEffect(() => {
    const handleScroll = () => {
      writeSavedScrollY(currentKeyRef.current, window.scrollY)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return null
}

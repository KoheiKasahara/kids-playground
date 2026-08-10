/**
 * `virtual:pwa-register/react` は vite-plugin-pwa がビルド時に生成する仮想モジュールで、
 * vitest（jsdom 環境）では解決できない。
 * vite.config.ts の test.alias でこのスタブに差し替えることで、
 * PwaStatus をレンダリングするテストが SW 登録処理なしに動作するようにする。
 *
 * さらにこのスタブは、テストコードから
 * - 「更新が見つかった」（needRefresh）
 * - 「オフライン準備完了」（offlineReady）
 * - onRegisteredSW に渡される registration
 * - updateServiceWorker の呼び出し履歴
 * を直接操作・検証できるように、制御用の関数（`__` 始まり）を公開する。
 *
 * デフォルトの挙動は「何も表示しない」（needRefresh / offlineReady とも初期 false、
 * registration は undefined）を維持しており、PwaStatus を経由してマウントされる
 * 既存の他テスト（Home.test.tsx など）には影響しない。
 * テスト間で状態が漏れないよう、`__resetPwaRegisterStub` を用意しているので
 * 各テストファイルの `beforeEach` で呼び出すこと。
 */
import { useEffect, useState } from 'react'
import { vi } from 'vitest'

type SetBooleanState = (value: boolean) => void

export type PwaRegisterStubOptions = {
  onRegisteredSW?: (swUrl: string, registration: ServiceWorkerRegistration | undefined) => void
}

// updateServiceWorker の呼び出しをテストから検証できるように、モジュールスコープの
// モック関数として公開する（本物の updateServiceWorker も Promise を返す非同期関数）。
export const updateServiceWorkerMock = vi.fn(async () => {})

// onRegisteredSW に渡す registration をテストから差し替えられるようにする。
let mockRegistration: ServiceWorkerRegistration | undefined

// 直近にマウントされた useRegisterSW インスタンスの setState を保持し、
// テストから needRefresh / offlineReady を切り替えられるようにする。
let setNeedRefreshRef: SetBooleanState | null = null
let setOfflineReadyRef: SetBooleanState | null = null

/** テストから「更新が見つかった」状態（needRefresh）を再現する。 */
export function __setNeedRefresh(value = true) {
  setNeedRefreshRef?.(value)
}

/** テストから「オフライン準備完了」状態（offlineReady）を再現する。 */
export function __setOfflineReady(value = true) {
  setOfflineReadyRef?.(value)
}

/** onRegisteredSW の第2引数として渡す registration をテストから設定する。 */
export function __setMockRegistration(registration: ServiceWorkerRegistration | undefined) {
  mockRegistration = registration
}

/**
 * テスト間の状態汚染を防ぐためのリセット関数。各テストファイルの beforeEach で呼ぶこと。
 */
export function __resetPwaRegisterStub() {
  mockRegistration = undefined
  setNeedRefreshRef = null
  setOfflineReadyRef = null
  updateServiceWorkerMock.mockClear()
}

/**
 * 本物の registerSW() を模した内部関数。
 * 実装の useRegisterSW と同様に「マウント時に1回だけ」呼ばれることを
 * useState の遅延初期化で再現する（useEffect ではないため、依存配列の考慮が不要）。
 */
function fakeRegisterSW(options: PwaRegisterStubOptions) {
  options.onRegisteredSW?.('/sw.js', mockRegistration)
  return updateServiceWorkerMock
}

export function useRegisterSW(options: PwaRegisterStubOptions = {}) {
  const [needRefresh, setNeedRefresh] = useState(false)
  const [offlineReady, setOfflineReady] = useState(false)
  const [updateServiceWorker] = useState(() => fakeRegisterSW(options))

  // setState は毎レンダー安定した参照のため、マウント時に1回だけ
  // モジュールスコープの参照へ保存すればよい。レンダー本体で直接代入すると
  // 純粋性のルールに反するため、effect 内で行う。
  useEffect(() => {
    setNeedRefreshRef = setNeedRefresh
    setOfflineReadyRef = setOfflineReady

    return () => {
      setNeedRefreshRef = null
      setOfflineReadyRef = null
    }
  }, [setNeedRefresh, setOfflineReady])

  return {
    needRefresh: [needRefresh, setNeedRefresh] as [boolean, SetBooleanState],
    offlineReady: [offlineReady, setOfflineReady] as [boolean, SetBooleanState],
    updateServiceWorker,
  }
}

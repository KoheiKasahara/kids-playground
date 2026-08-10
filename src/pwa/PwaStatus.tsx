import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import styles from './PwaStatus.module.css'

/**
 * 「一度でもオフライン準備（Service Worker のプリキャッシュ）が完了したか」を
 * localStorage に記録するためのキー。
 * SW が既に有効な状態で再訪問した場合、useRegisterSW の offlineReady は
 * 発火しないため、初回オフラインアクセス時の案内表示にはこのフラグを使う。
 */
const OFFLINE_READY_KEY = 'pwa-offline-ready'

// オフライン対応トーストを表示しておく時間（ミリ秒）。常駐させず自動で消す。
const OFFLINE_TOAST_DURATION_MS = 5000

// Service Worker の更新確認を行う間隔（ミリ秒）。長時間開きっぱなしのタブでも
// 新しいバージョンに気づけるよう、1時間おきにバックグラウンドで確認する。
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000

/**
 * onRegisteredSW から渡される registration に対して、起動時・復帰時・定期の
 * 3タイミングで registration.update() を仕込む。
 *
 * React 18 の StrictMode では開発時に副作用が二重実行されるため、
 * onRegisteredSW 自体が複数回呼ばれる可能性がある。setInterval や
 * addEventListener をそのまま登録すると多重登録になってしまうので、
 * モジュールスコープのフラグで「登録済みの registration」を1つだけに絞り込み、
 * 2回目以降の呼び出しでは何もしない（冪等にする）ことで対策する。
 */
let updateWatcherRegistration: ServiceWorkerRegistration | undefined

function setupUpdateChecks(registration: ServiceWorkerRegistration | undefined) {
  if (!registration) return
  if (updateWatcherRegistration === registration) return
  updateWatcherRegistration = registration

  const checkForUpdate = () => {
    void registration.update()
  }

  // 起動時（登録直後）に1回確認する。
  checkForUpdate()

  // タブがバックグラウンドから復帰したタイミングで確認する。
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkForUpdate()
    }
  })

  // 長時間開きっぱなしでも気づけるよう、定期的に確認する。
  setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS)
}

function readOfflineReadyFlag(): boolean {
  try {
    return window.localStorage.getItem(OFFLINE_READY_KEY) === 'true'
  } catch {
    // localStorage が使えない環境（プライベートモード等）では常に false 扱いにする。
    return false
  }
}

function writeOfflineReadyFlag() {
  try {
    window.localStorage.setItem(OFFLINE_READY_KEY, 'true')
  } catch {
    // 保存に失敗しても致命的ではないため無視する。
  }
}

function getIsOnline(): boolean {
  return typeof navigator === 'undefined' ? true : navigator.onLine
}

/**
 * Service Worker の登録・オフライン対応・アップデート案内をまとめて扱う UI。
 * 既存の画面レイアウトには影響を与えず、画面下部に控えめなトーストとして表示する。
 */
export default function PwaStatus() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      setupUpdateChecks(registration)
    },
  })

  // localStorage の「過去にオフライン準備が完了したか」フラグは、初回マウント時に一度だけ読む。
  // offlineReady が今回のセッションで true になった場合は、これに OR して即座に反映する
  // （setState を増やさず、レンダー時の派生値として扱うことで effect 内の同期 setState を避ける）。
  const [wasOfflineReadyBefore] = useState(readOfflineReadyFlag)
  const [isOnline, setIsOnline] = useState(getIsOnline)

  // オフライン準備完了 (offlineReady) を検知したら、フラグを保存し、数秒後に
  // 自分自身（useRegisterSW の offlineReady）を false に戻してトーストを消す。
  useEffect(() => {
    if (!offlineReady) return

    writeOfflineReadyFlag()

    const timer = setTimeout(() => {
      setOfflineReady(false)
    }, OFFLINE_TOAST_DURATION_MS)

    return () => clearTimeout(timer)
  }, [offlineReady, setOfflineReady])

  // online/offline の切り替わりを監視し、初回未キャッシュ時の案内表示に反映する。
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const closeOfflineToast = () => {
    setOfflineReady(false)
  }

  const handleUpdateClick = () => {
    void updateServiceWorker(true)
  }

  const showOfflineToast = offlineReady
  const hasOfflineReadyBefore = wasOfflineReadyBefore || offlineReady
  // オフラインかつ、これまでに一度もオフライン準備が完了していない場合の案内。
  const showNotReadyNotice = !isOnline && !hasOfflineReadyBefore

  if (!showOfflineToast && !showNotReadyNotice && !needRefresh) {
    return null
  }

  return (
    <div className={styles.container}>
      {showOfflineToast && (
        <div className={styles.toast} role="status">
          <span className={styles.message}>オフラインでも あそべるように なりました</span>
          <button
            type="button"
            className={styles.closeButton}
            onClick={closeOfflineToast}
            aria-label="とじる"
          >
            ×
          </button>
        </div>
      )}

      {showNotReadyNotice && (
        <div className={styles.notice} role="alert">
          <span className={styles.message}>
            はじめての じゅんびが まだ おわっていません。インターネットに つないでから、もういちど
            アプリを ひらいてね。（おうちの かたへ：初回のデータ読み込みが完了していません。インターネットに接続して、もう一度アプリを開いてください。）
          </span>
        </div>
      )}

      {needRefresh && (
        <div className={styles.toast} role="status">
          <span className={styles.message}>あたらしい バージョンが あります</span>
          <button type="button" className={styles.updateButton} onClick={handleUpdateClick}>
            こうしんする
          </button>
        </div>
      )}
    </div>
  )
}

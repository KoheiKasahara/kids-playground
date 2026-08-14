import { useSyncExternalStore } from 'react'

/**
 * 「問題文を読み上げるか」の ON/OFF は React Context/Provider ではなく、
 * quizSound.ts と同じモジュールスコープの単純なストアで持つ。
 * クイズ画面はテストの中でアプリ全体の Provider なしに直接 render されることが多く、
 * Context だとその都度ラップし忘れて壊れる／Provider 未設置でクラッシュするリスクがある。
 * モジュールストアなら import するだけでどこでも同じ挙動になり、しかも全クイズ間で
 * 設定が共有される（ある画面で ON にしたら他の画面でも ON のまま）。
 */

export const SPEECH_ENABLED_STORAGE_KEY = 'kids-playground:speech-enabled'

const STORED_ON = 'on'
const STORED_OFF = 'off'

let cachedEnabled: boolean | undefined
const listeners = new Set<() => void>()

function readFromStorage(): boolean {
  try {
    const raw = window.localStorage.getItem(SPEECH_ENABLED_STORAGE_KEY)
    // 未設定・不明な値（壊れたデータ含む）はすべて OFF 扱いにする。ON になるのは 'on' のときだけ。
    return raw === STORED_ON
  } catch {
    // localStorage が使えない環境（Safari プライベートモード等）では既定の OFF にする。
    return false
  }
}

/** 現在よみあげが有効かどうかを返す。値は初回読み取り時に localStorage から復元しキャッシュする。 */
export function isSpeechEnabled(): boolean {
  if (cachedEnabled === undefined) {
    cachedEnabled = readFromStorage()
  }
  return cachedEnabled
}

/** よみあげの ON/OFF を切り替える。実際に値が変わったときだけ購読者に通知する。 */
export function setSpeechEnabled(enabled: boolean): void {
  const previous = isSpeechEnabled()
  cachedEnabled = enabled

  try {
    window.localStorage.setItem(SPEECH_ENABLED_STORAGE_KEY, enabled ? STORED_ON : STORED_OFF)
  } catch {
    // 保存に失敗しても致命的ではないため無視する（メモリ上のキャッシュは更新済み）。
  }

  if (previous !== enabled) {
    listeners.forEach((listener) => listener())
  }
}

/** 値が変わるたびに listener を呼ぶ。返り値の関数で購読解除できる。 */
export function subscribeSpeechEnabled(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** クイズ画面から使う React Hook。値が変わると自動で再レンダーされる。 */
export function useSpeechEnabled(): boolean {
  return useSyncExternalStore(subscribeSpeechEnabled, isSpeechEnabled, () => false)
}

/** テストで localStorage を差し替えたあとにキャッシュを捨てるための関数。アプリ本体からは呼ばない。 */
export function resetSpeechEnabledCache(): void {
  cachedEnabled = undefined
}

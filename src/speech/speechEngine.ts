/**
 * Web Speech API (SpeechSynthesis) の薄いラッパー。
 * 対応状況の判定・声の選択・発話の開始/停止という「毎回書くと面倒で事故りやすい」部分だけを
 * ここに集約し、呼び出し側（useQuestionSpeech など）はテキストと問題キーだけ渡せばよくする。
 * 一部の Android WebView や PWA 復帰直後など、実装が半端でメソッド呼び出しが例外を投げる
 * 環境があるため、実際に触る箇所はすべて try/catch で包み、UI 側には絶対に影響させない。
 */

/** window.speechSynthesis と SpeechSynthesisUtterance の両方が揃っている場合のみ対応とみなす。 */
export function isSpeechSupported(): boolean {
  try {
    return (
      typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      typeof window.SpeechSynthesisUtterance === 'function'
    )
  } catch {
    return false
  }
}

/**
 * 日本語音声を選ぶ。
 * getVoices() はブラウザによって初回は空配列を返し、非同期（voiceschanged）で後から
 * 埋まることがあるため、モジュール読み込み時にはキャッシュせず、話す直前に毎回読み直す。
 * 'ja' で始まる（'-'/'_' を正規化し大文字小文字を無視）ものの中から、
 * ローカルにインストールされている（localService === true）ものを優先する
 * （ネットワーク音声よりレイテンシが小さく、オフラインの PWA でも確実に鳴るため）。
 */
function pickJapaneseVoice(): SpeechSynthesisVoice | undefined {
  try {
    const voices = window.speechSynthesis.getVoices()
    const japaneseVoices = voices.filter((voice) =>
      voice.lang.replace('_', '-').toLowerCase().startsWith('ja'),
    )
    if (japaneseVoices.length === 0) return undefined
    return japaneseVoices.find((voice) => voice.localService === true) ?? japaneseVoices[0]
  } catch {
    return undefined
  }
}

/**
 * テキストを読み上げる。
 * 直前の発話が残っていると新旧の音声が重なって聞き取りづらくなるため、必ず cancel() してから
 * 新しい発話を speak() する（呼び出し順が重要）。
 */
export function speak(text: string): void {
  if (!isSpeechSupported()) return
  if (!text || text.trim() === '') return

  try {
    window.speechSynthesis.cancel()

    const utterance = new window.SpeechSynthesisUtterance(text)
    utterance.lang = 'ja-JP'

    const voice = pickJapaneseVoice()
    if (voice) {
      utterance.voice = voice
    }

    // 子ども向けに、大人の標準速度より少しゆっくり・少しやわらかい高さで読む。
    utterance.rate = 0.95
    utterance.pitch = 1.05

    window.speechSynthesis.speak(utterance)
  } catch {
    // 半端な実装（一部の Android WebView、PWA 復帰直後など）が投げても、
    // アプリ本体（クイズの進行）を壊さないよう黙って無視する。
  }
}

/** 読み上げを止める。次の問題に進むときや画面を離れるときに呼ぶ。 */
export function stopSpeaking(): void {
  if (!isSpeechSupported()) return
  try {
    window.speechSynthesis.cancel()
  } catch {
    // 同上: 例外を握りつぶして安全側に倒す。
  }
}

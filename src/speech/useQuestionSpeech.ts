import { useEffect, useRef } from 'react'
import { speak, stopSpeaking } from './speechEngine'
import { useSpeechEnabled } from './speechSettingsStore'

/**
 * 「いま読み上げるべき問題文」(text) と「問題の識別子」(questionKey) を渡すだけで、
 * よみあげ ON/OFF・問題の切り替え・画面離脱のすべてに正しく追従する。
 * 各クイズ画面はこの Hook だけを呼べばよく、発話タイミングの制御はここに閉じ込める。
 *
 * 実装のポイント（すべて意図的で、ここを変えると壊れる）:
 *
 * - useEffect の依存配列を [enabled, questionKey] だけにしている。
 *   選択肢タップ・正解演出・アニメーションなど、問題文と無関係な state 更新のたびに
 *   text の参照が変わっても、この effect は再実行されない＝再読み上げされない。
 *
 * - text は useRef で保持し、effect 本体では毎回 textRef.current を読む。
 *   同じ問題のままコンポーネントが再レンダーされて text の文字列が（内容は同じでも）
 *   新しいインスタンスとして再生成されても、依存配列に text 自体が入っていないので
 *   effect は再実行されず、二重に読み上げられない。
 *
 * - questionKey が変わる（＝次の問題に進む）と effect が再実行される。React は次の effect を
 *   走らせる前に必ず前回の cleanup を呼ぶため、「前の問題の音声を stopSpeaking() で止めてから
 *   新しい問題を speak() する」順序が保証され、2つの音声が重なることはない。
 *
 * - enabled が false→true になったとき（OFF→ON への切り替え）も依存配列的には
 *   effect が再実行されるので、そのタイミングの問題文をその場で1回読み上げる。
 *   true→false（ON→OFF）になったときは cleanup だけが走り、stopSpeaking() で即座に止まる
 *   （false になった直後の effect 本体は enabled チェックで早期 return するので何も読まない）。
 *
 * - アンマウント時（クイズをやめる／結果画面へ進む／別ページに移動する）も同じ cleanup が
 *   走るため、画面を離れたのに音声だけ流れ続けることはない。
 *
 * - React 18 の StrictMode（開発時）は effect を「実行→即 cleanup→再実行」と二重に走らせるが、
 *   speak() は毎回 speechSynthesis.cancel() を先に呼んでから発話するため、
 *   実際に聞こえる音声は最後の1回だけになる（キャンセルされた1回目は音として鳴らない）。
 */
export function useQuestionSpeech(text: string | null | undefined, questionKey: string | number): void {
  const enabled = useSpeechEnabled()
  const textRef = useRef(text)
  // text 自体を読み上げ effect の依存配列に入れると、同じ問題のまま文字列が再生成された
  // だけでも再読み上げされてしまう。そこで ref に「最新の問題文」だけを写しておく。
  // 同期用の effect をこの下の読み上げ effect より先に宣言しているのが重要で、
  // React は effect を宣言順に実行するため、問題が切り替わったレンダーでも
  // 読み上げ effect が走る時点では textRef.current が必ず新しい問題文になっている。
  useEffect(() => {
    textRef.current = text
  })

  useEffect(() => {
    if (!enabled) return
    const current = textRef.current
    if (!current) return
    speak(current)
    return () => {
      stopSpeaking()
    }
  }, [enabled, questionKey])
}

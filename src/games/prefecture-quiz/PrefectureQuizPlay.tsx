import { useReducer, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import BigButton from '../../components/BigButton'
import ProgressBar from '../../components/ProgressBar'
import QuizResultOverlay from '../../components/QuizResultOverlay'
import { playCorrectSound } from '../../utils/quizSound'
import { SpeechToggle, useQuestionSpeech } from '../../speech'
import { prefectures } from './data/prefectures'
import { numberedPrefecturesForRegion, prefecturesForRegion, REGION_LABEL } from './data/regions'
import PrefectureMap from './map/PrefectureMap'
import PrefectureNumberPad from './PrefectureNumberPad'
import PrefectureShape from './map/PrefectureShape'
import { generateMapQuestions, generatePrefectureQuestions } from './questionGenerator'
import { MODE_PATH } from './types'
import type { PrefectureQuizMode } from './types'
import styles from './PrefectureQuizPlay.module.css'

type State = { index: number; selectedId: string | null; correctCount: number }
type Action = { type: 'select'; id: string; correct: boolean } | { type: 'next' }
const initialState: State = { index: 0, selectedId: null, correctCount: 0 }
const pathToMode: Record<string, PrefectureQuizMode> = { 'shape-to-name': 'shapeToName', 'name-to-shape': 'nameToShape', 'name-to-map': 'nameToMap' }
function reducer(state: State, action: Action): State {
  if (action.type === 'select') return state.selectedId ? state : { ...state, selectedId: action.id, correctCount: state.correctCount + (action.correct ? 1 : 0) }
  return { ...state, index: state.index + 1, selectedId: null }
}

export default function PrefectureQuizPlay() {
  const { mode: modePath } = useParams()
  const mode = modePath ? pathToMode[modePath] : undefined
  if (!mode) return <Navigate to="/games/prefecture-quiz" replace />
  return <PrefectureQuizPlayGame mode={mode} />
}

function PrefectureQuizPlayGame({ mode }: { mode: PrefectureQuizMode }) {
  const navigate = useNavigate()
  const [questions] = useState(() => generatePrefectureQuestions(prefectures))
  const [mapAnswers] = useState(() => generateMapQuestions(prefectures))
  const [state, dispatch] = useReducer(reducer, initialState)
  const question = mode === 'nameToMap' ? { answer: mapAnswers[state.index], choices: [] } : questions[state.index]
  const answered = state.selectedId !== null
  const isCorrect = state.selectedId === question.answer.id
  const isLast = state.index === questions.length - 1
  const numbered = numberedPrefecturesForRegion(question.answer.region)
  const speechText = mode === 'shapeToName' ? 'この かたちは なーんだ？' : mode === 'nameToShape' ? `${question.answer.nameHiragana}は どれ？` : `${question.answer.nameHiragana}は どこ？`
  useQuestionSpeech(speechText, state.index)
  const select = (id: string) => {
    if (answered) return
    const correct = id === question.answer.id
    dispatch({ type: 'select', id, correct })
    if (correct) playCorrectSound()
  }
  const next = () => {
    if (isLast) navigate(`/games/prefecture-quiz/${MODE_PATH[mode]}/result`, { replace: true, state: { correctCount: state.correctCount, totalCount: questions.length } })
    else dispatch({ type: 'next' })
  }
  return <main className={styles.page}>
    <header className={styles.header}>
      <SpeechToggle />
      <button type="button" className={styles.quit} onClick={() => navigate('/games/prefecture-quiz')}>やめる</button>
      <div className={styles.progress}><p>{state.index + 1} / {questions.length}</p><ProgressBar current={state.index + 1} total={questions.length} /></div>
    </header>
    <section className={styles.body} aria-label="もんだい">
      {mode === 'shapeToName' && <><PrefectureShape prefecture={question.answer} revealed={answered} /><h1 className={styles.question}>この かたちは なーんだ？</h1><ChoiceNames choices={question.choices} answerId={question.answer.id} selectedId={state.selectedId} onSelect={select} /></>}
      {mode === 'nameToShape' && <><h1 className={styles.question}>「<strong>{question.answer.nameHiragana}</strong>」は どれ？</h1><div className={styles.shapeChoices}>{question.choices.map((choice, index) => <button key={choice.id} type="button" className={choiceClass(choice.id, question.answer.id, state.selectedId)} disabled={answered} aria-label={answered ? `${choice.nameHiragana} の かたち` : `${index + 1}ばんめ の かたち`} onClick={() => select(choice.id)}><PrefectureShape prefecture={choice} revealed={answered} /><span aria-hidden="true">{mark(choice.id, question.answer.id, state.selectedId)}</span></button>)}</div></>}
      {mode === 'nameToMap' && <><h1 className={styles.question}>「<strong>{question.answer.nameHiragana}</strong>」は どこ？</h1><div className={styles.mapAnswer}><PrefectureMap items={prefecturesForRegion(question.answer.region)} answer={question.answer} selectedId={state.selectedId} onSelect={select} disabled={answered} revealed={answered} numbered label={answered ? `${REGION_LABEL[question.answer.region]}の ちず` : '都道府県をえらぶ ちず'} /><PrefectureNumberPad items={numbered} answerId={question.answer.id} selectedId={state.selectedId} onSelect={select} className={styles.numberPad} /><p className={styles.mapHint}>ちずか ばんごうで こたえよう</p></div></>}
    </section>
    {answered && <QuizResultOverlay result={isCorrect ? 'correct' : 'wrong'} wrongLabel="おしい！" answer={question.answer.nameHiragana} nextLabel={isLast ? 'けっかを みる' : 'つぎの もんだい'} onNext={next} />}
  </main>
}

function ChoiceNames({ choices, answerId, selectedId, onSelect }: { choices: typeof prefectures; answerId: string; selectedId: string | null; onSelect: (id: string) => void }) {
  return <div className={styles.nameChoices}>{choices.map((choice) => <BigButton key={choice.id} className={choiceClass(choice.id, answerId, selectedId)} variant={selectedId ? choice.id === answerId ? 'correct' : choice.id === selectedId ? 'wrong' : 'secondary' : 'primary'} disabled={Boolean(selectedId)} onClick={() => onSelect(choice.id)}>{mark(choice.id, answerId, selectedId)} {choice.nameHiragana}</BigButton>)}</div>
}
function choiceClass(id: string, answerId: string, selectedId: string | null) { return [styles.choice, selectedId && id === answerId ? styles.choiceCorrect : '', selectedId && id === selectedId && id !== answerId ? styles.choiceWrong : ''].filter(Boolean).join(' ') }
function mark(id: string, answerId: string, selectedId: string | null) { return selectedId ? id === answerId ? '◯' : id === selectedId ? '✕' : '' : '' }

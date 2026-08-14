import { useCallback, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import BigButton from '../../components/BigButton'
import ProgressBar from '../../components/ProgressBar'
import QuizResultOverlay from '../../components/QuizResultOverlay'
import FlagChoiceGrid from '../flag-quiz/FlagChoiceGrid'
import { countries } from '../flag-quiz/data/countries'
import { playCorrectSound } from '../../utils/quizSound'
import { SpeechToggle, useQuestionSpeech } from '../../speech'
import { coursesForRegion } from './data/travelCourses'
import WorldTravelMap from './map/WorldTravelMap'
import { generateTravelQuestions } from './questionGenerator'
import { QUESTION_COUNT, isAnswerMode, isTravelRegion, type AnswerMode, type TravelCourse, type TravelPhase, type TravelRegion } from './types'
import styles from './WorldTravelQuizPlay.module.css'

export default function WorldTravelQuizPlay() {
  const { region: pathRegion, answerMode: pathAnswerMode } = useParams()
  if (!isTravelRegion(pathRegion) || !isAnswerMode(pathAnswerMode)) return <Navigate to="/games/world-travel-quiz" replace />
  return <TravelGame region={pathRegion} answerMode={pathAnswerMode} />
}

function TravelGame({ region, answerMode }: { region: TravelRegion; answerMode: AnswerMode }) {
  const navigate = useNavigate()
  const [course] = useState<TravelCourse>(() => {
    const choices = coursesForRegion(region)
    return choices[Math.floor(Math.random() * choices.length)]
  })
  const [questions] = useState(() => generateTravelQuestions(course, Math.random, answerMode === 'flag' ? countries : undefined))
  const [index, setIndex] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [correctCount, setCorrectCount] = useState(0)
  const [phase, setPhase] = useState<TravelPhase>('answering')
  const answerLockRef = useRef(false)
  const travelLockRef = useRef(false)
  const question = questions[index]
  const isLast = index === QUESTION_COUNT - 1
  const select = (id: string) => {
    if (answerLockRef.current || phase !== 'answering') return
    answerLockRef.current = true
    setSelectedId(id); setPhase('feedback')
    if (id === question.answer.id) { setCorrectCount((value) => value + 1); playCorrectSound() }
  }
  const next = () => {
    if (travelLockRef.current || phase !== 'feedback') return
    travelLockRef.current = true
    if (isLast) { navigate(`/games/world-travel-quiz/${region}/${answerMode}/result`, { replace: true, state: { correctCount, totalCount: QUESTION_COUNT, courseId: course.id, answerMode } }); return }
    setPhase('traveling')
  }
  const completeTravel = useCallback(() => {
    if (!travelLockRef.current) return
    travelLockRef.current = false; answerLockRef.current = false
    setIndex((value) => value + 1); setSelectedId(null); setPhase('answering')
  }, [])
  const isCorrect = selectedId === question.answer.id
  useQuestionSpeech(answerMode === 'flag' ? 'この くにの こっきは どれ？' : 'この くには どこ？', index)
  return <main className={styles.page}>
    <header className={styles.header}><SpeechToggle /><button type="button" className={styles.quit} onClick={() => navigate('/games/world-travel-quiz')}>やめる</button><div className={styles.progress}><p>{index + 1} / {QUESTION_COUNT}</p><ProgressBar current={index + 1} total={QUESTION_COUNT} /></div></header>
    <section className={styles.content} aria-label="せかい旅行クイズのもんだい">
      <div className={styles.mapWrap}><WorldTravelMap course={course} questionIndex={index} phase={phase} onTravelComplete={completeTravel} /><p className={styles.mapHint}>{phase === 'traveling' ? 'ひこうきで いどう中…' : 'ひかっている くにを さがそう！'}</p></div>
      <div className={styles.answerWrap}>
        <h1 className={styles.question}>{answerMode === 'flag' ? 'この くにの こっきは どれ？' : 'この くには どこ？'}</h1>
        {answerMode === 'flag' ? (
          <FlagChoiceGrid choices={question.choices} answer={question.answer} selectedId={selectedId} disabled={phase !== 'answering'} onSelect={select} className={styles.flagChoices} />
        ) : (
          <div className={styles.choices}>{question.choices.map((choice) => <BigButton key={choice.id} className={styles.choice} variant={selectedId ? choice.id === question.answer.id ? 'correct' : choice.id === selectedId ? 'wrong' : 'secondary' : 'primary'} disabled={phase !== 'answering'} onClick={() => select(choice.id)}>{selectedId ? choice.id === question.answer.id ? '○ ' : choice.id === selectedId ? '× ' : '' : ''}{choice.nameJa}</BigButton>)}</div>
        )}
      </div>
    </section>
    {phase === 'feedback' && <QuizResultOverlay result={isCorrect ? 'correct' : 'wrong'} wrongLabel="おしい！" answer={question.answer.nameJa} nextLabel={isLast ? 'けっかを みる' : 'つぎの くにへ'} onNext={next} />}
  </main>
}

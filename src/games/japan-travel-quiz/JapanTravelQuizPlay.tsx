import { useCallback, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BigButton from '../../components/BigButton'
import ProgressBar from '../../components/ProgressBar'
import QuizResultOverlay from '../../components/QuizResultOverlay'
import { playCorrectSound } from '../../utils/quizSound'
import { japanTravelCourses } from './data/travelCourses'
import JapanTravelMap from './map/JapanTravelMap'
import { generateJapanTravelQuestions } from './questionGenerator'
import { JAPAN_TRAVEL_QUESTION_COUNT, type JapanTravelCourse, type JapanTravelPhase } from './types'
import styles from './JapanTravelQuizPlay.module.css'

export default function JapanTravelQuizPlay() {
  const navigate = useNavigate()
  const [course] = useState<JapanTravelCourse>(() => japanTravelCourses[Math.floor(Math.random() * japanTravelCourses.length)])
  const [questions] = useState(() => generateJapanTravelQuestions(course))
  const [index, setIndex] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [correctCount, setCorrectCount] = useState(0)
  const [phase, setPhase] = useState<JapanTravelPhase>('answering')
  const answerLockRef = useRef(false)
  const travelLockRef = useRef(false)
  const question = questions[index]
  const isLast = index === JAPAN_TRAVEL_QUESTION_COUNT - 1

  const select = (id: string) => {
    if (answerLockRef.current || phase !== 'answering') return
    answerLockRef.current = true
    setSelectedId(id); setPhase('feedback')
    if (id === question.answer.id) { setCorrectCount((value) => value + 1); playCorrectSound() }
  }
  const next = () => {
    if (travelLockRef.current || phase !== 'feedback') return
    travelLockRef.current = true
    if (isLast) { navigate('/games/japan-travel-quiz/result', { replace: true, state: { correctCount, totalCount: JAPAN_TRAVEL_QUESTION_COUNT, courseId: course.id } }); return }
    setPhase('traveling')
  }
  const completeTravel = useCallback(() => {
    if (!travelLockRef.current) return
    travelLockRef.current = false; answerLockRef.current = false
    setIndex((value) => value + 1); setSelectedId(null); setPhase('answering')
  }, [])
  const isCorrect = selectedId === question.answer.id

  return <main className={styles.page}>
    <header className={styles.header}><button type="button" className={styles.quit} onClick={() => navigate('/games/japan-travel-quiz')}>やめる</button><div className={styles.progress}><p>{index + 1} / {JAPAN_TRAVEL_QUESTION_COUNT}</p><ProgressBar current={index + 1} total={JAPAN_TRAVEL_QUESTION_COUNT} /></div></header>
    <section className={styles.content} aria-label="にほん旅行クイズのもんだい">
      <div className={styles.mapWrap}><JapanTravelMap course={course} questionIndex={index} phase={phase} onTravelComplete={completeTravel} /><p className={styles.mapHint}>{phase === 'traveling' ? 'ひこうきで いどう中…' : 'ひかっている けんを さがそう！'}</p></div>
      <div className={styles.answerWrap}><p className={styles.route} aria-label={`旅行コース: ${course.name}`}>{course.name}</p><h1 className={styles.question}>ここは なんけん？</h1><div className={styles.choices}>{question.choices.map((choice) => <BigButton key={choice.id} className={styles.choice} variant={selectedId ? choice.id === question.answer.id ? 'correct' : choice.id === selectedId ? 'wrong' : 'secondary' : 'primary'} disabled={phase !== 'answering'} onClick={() => select(choice.id)}>{selectedId ? choice.id === question.answer.id ? '○ ' : choice.id === selectedId ? '× ' : '' : ''}{choice.nameHiragana}</BigButton>)}</div></div>
    </section>
    {phase === 'feedback' && <QuizResultOverlay result={isCorrect ? 'correct' : 'wrong'} wrongLabel="おしい！" answer={question.answer.nameHiragana} detail={isCorrect ? `${question.answer.nameHiragana}に とうちゃく！` : undefined} nextLabel={isLast ? 'けっかを みる' : 'つぎの けんへ'} onNext={next} />}
  </main>
}

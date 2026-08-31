import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import GamePlaySurface from '../../components/GamePlaySurface'
import { komaSpecsForCount, type KomaSpec } from './komaSpecs'
import { useKomaBattleEngine } from './useKomaBattleEngine'
import type { KomaDefeatReason, MatchOutcome } from './komaOutcome'
import styles from './KomaBattlePlay.module.css'

type Phase = 'select' | 'battling' | 'finished'

const DEFEAT_LABEL: Record<KomaDefeatReason, string> = {
  toppled: 'たおれた',
  stopped: 'とまった',
  outOfArena: 'そとに でた',
}

/** 1個モードの終わり方を、勝敗ではない言い方で伝える。 */
function soloMessage(reason: KomaDefeatReason): string {
  if (reason === 'outOfArena') return 'コマが そとへ とびだしたよ'
  if (reason === 'toppled') return 'さいごは たおれたよ'
  return 'さいごまで まわりきったよ'
}

export default function KomaBattlePlay() {
  const [phase, setPhase] = useState<Phase>('select')
  const [komaCount, setKomaCount] = useState(2)
  const [runId, setRunId] = useState(0)
  const [outcome, setOutcome] = useState<MatchOutcome | null>(null)

  const specs = useMemo(() => komaSpecsForCount(komaCount), [komaCount])

  const startBattle = useCallback(() => {
    setOutcome(null)
    setPhase('battling')
    setRunId((current) => current + 1)
  }, [])

  const backToSelect = useCallback(() => {
    setOutcome(null)
    setPhase('select')
  }, [])

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>コマバトル</h1>
        <Link to="/" className={styles.backLink}>
          ホームへ
        </Link>
      </header>

      {phase === 'select' ? (
        <div className={styles.scene}>
          <div className={styles.overlay}>
            <h2 className={styles.overlayTitle}>コマを えらんでね</h2>
            <div className={styles.countChoices}>
              {[1, 2].map((count) => (
                <button
                  key={count}
                  type="button"
                  className={`${styles.countButton} ${
                    komaCount === count ? styles.countButtonSelected : ''
                  }`}
                  aria-pressed={komaCount === count}
                  onClick={() => setKomaCount(count)}
                >
                  <span className={styles.countEmoji} aria-hidden="true">
                    {count === 1 ? '🌀' : '🌀🌀'}
                  </span>
                  {count === 1 ? '1こで まわす' : '2こで たいせん'}
                </button>
              ))}
            </div>
            <button type="button" className={styles.primaryButton} onClick={startBattle}>
              まわせ！
            </button>
          </div>
        </div>
      ) : (
        <GamePlaySurface>
          <KomaBattleScene
            runId={runId}
            komaCount={komaCount}
            specs={specs}
            outcome={outcome}
            onFinished={(result) => {
              setOutcome(result)
              setPhase('finished')
            }}
            onRematch={startBattle}
            onChangeKoma={backToSelect}
          />
        </GamePlaySurface>
      )}
    </main>
  )
}

type SceneProps = {
  runId: number
  komaCount: number
  specs: KomaSpec[]
  outcome: MatchOutcome | null
  onFinished: (outcome: MatchOutcome) => void
  onRematch: () => void
  onChangeKoma: () => void
}

/**
 * 3D表示と結果オーバーレイ。
 *
 * エンジンは runId が変わるたびに世界を作り直す。
 * 対戦中はエンジンからReactへ何も流れてこないので、ここは再レンダーされない。
 */
function KomaBattleScene({
  runId,
  komaCount,
  specs,
  outcome,
  onFinished,
  onRematch,
  onChangeKoma,
}: SceneProps) {
  const { registerContainer } = useKomaBattleEngine({
    runId,
    komaCount,
    onFinished,
  })

  return (
    <div className={styles.scene}>
      <div className={styles.sceneCanvas} ref={registerContainer} />

      <div className={styles.komaLabels}>
        {specs.map((spec) => (
          <span key={spec.id} className={styles.komaLabel}>
            <span
              className={styles.komaSwatch}
              style={{ background: spec.color }}
              aria-hidden="true"
            />
            {spec.name}
          </span>
        ))}
      </div>

      {outcome !== null ? (
        <div className={styles.resultOverlay} role="status">
          <div className={styles.resultCard}>
            <ResultMessage outcome={outcome} specs={specs} />
            <button type="button" className={styles.primaryButton} onClick={onRematch}>
              もういちど
            </button>
            <button type="button" className={styles.backLink} onClick={onChangeKoma}>
              コマを えらびなおす
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function ResultMessage({
  outcome,
  specs,
}: {
  outcome: MatchOutcome
  specs: KomaSpec[]
}) {
  if (outcome.kind === 'soloFinished') {
    return (
      <>
        <h2 className={styles.overlayTitle}>おしまい！</h2>
        <p className={styles.overlayNote}>{soloMessage(outcome.reason)}</p>
      </>
    )
  }

  if (outcome.kind === 'draw') {
    return (
      <>
        <h2 className={styles.overlayTitle}>ひきわけ！</h2>
        <p className={styles.overlayNote}>
          {outcome.reason === 'timeLimit'
            ? 'どちらも さいごまで まわっていたよ'
            : 'おなじ タイミングで きまったよ'}
        </p>
      </>
    )
  }

  const winner = specs[outcome.winnerIndex]
  const loser = specs[outcome.loserIndex]
  return (
    <>
      <h2 className={styles.overlayTitle}>かち！</h2>
      <p className={styles.resultWinner}>
        <span
          className={styles.resultSwatch}
          style={{ background: winner?.color }}
          aria-hidden="true"
        />
        {winner?.name}
      </p>
      <p className={styles.overlayNote}>
        {loser?.name}が {DEFEAT_LABEL[outcome.reason]}よ
      </p>
    </>
  )
}

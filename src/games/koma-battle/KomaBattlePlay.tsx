import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import GamePlaySurface from '../../components/GamePlaySurface'
import { playKomaBattleStartSound, primeAudio } from '../../utils/quizSound'
import {
  KOMA_COLOR_CONFIGS,
  KOMA_TYPE_CONFIGS,
  komaSpecsForSelection,
  type KomaColorId,
  type KomaPlayerSlotId,
  type KomaSpec,
  type KomaTypeId,
} from './komaSpecs'
import { useKomaBattleEngine } from './useKomaBattleEngine'
import type { KomaDefeatReason, MatchOutcome } from './komaOutcome'
import {
  DEFAULT_KOMA_FIELD_ID,
  getKomaField,
  KOMA_FIELD_DEFINITIONS,
  type KomaField,
  type KomaFieldId,
} from './komaStadium'
import styles from './KomaBattlePlay.module.css'

type Phase = 'select' | 'battling' | 'finished'

const KOMA_COUNT = 2

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
  const [fieldId, setFieldId] = useState<KomaFieldId>(DEFAULT_KOMA_FIELD_ID)
  // プレイヤー枠ごとに選ぶ。再戦ではこの値をそのまま使い、明示的な変更まで保持する。
  const [selectedTypes, setSelectedTypes] = useState<[KomaTypeId, KomaTypeId]>([
    'balance',
    'balance',
  ])
  // 色も枠ごとに選ぶ。今までどおり1P=あか/2P=あおから始まる。
  const [selectedColors, setSelectedColors] = useState<[KomaColorId, KomaColorId]>([
    'red',
    'blue',
  ])
  // 色選択ボタンで開いたモーダルがどちらの枠向けか。常時は表示しない。
  const [colorPickerSlot, setColorPickerSlot] = useState<KomaPlayerSlotId | null>(null)
  const [runId, setRunId] = useState(0)
  const [outcome, setOutcome] = useState<MatchOutcome | null>(null)

  const specs = useMemo(
    () => komaSpecsForSelection(selectedTypes, KOMA_COUNT, selectedColors),
    [selectedTypes, selectedColors],
  )

  const selectColor = useCallback((slotIndex: number, colorId: KomaColorId) => {
    setSelectedColors((current) => {
      const otherIndex = slotIndex === 0 ? 1 : 0
      const next: [KomaColorId, KomaColorId] = [...current]
      if (next[otherIndex] === colorId) {
        // 相手と同じ色を選んだら、いま自分が使っていた色を相手へ譲って重ならないようにする。
        next[otherIndex] = current[slotIndex]
      }
      next[slotIndex] = colorId
      return next
    })
    setColorPickerSlot(null)
  }, [])

  const startBattle = useCallback(() => {
    // iOSでも「まわせ！」の直後からSEを鳴らせるよう、操作イベント中に準備する。
    primeAudio()
    playKomaBattleStartSound()
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
        <Link to="/" className={styles.backLink} aria-label="もどる">
          もどる
        </Link>
        <h1 className={styles.title}>コマバトル</h1>
      </header>

      {phase === 'select' ? (
        <div className={styles.scene}>
          <div className={styles.overlay}>
            <h2 className={styles.overlayTitle}>ばしょを えらんでね</h2>
            <div className={styles.fieldChoices} role="group" aria-label="フィールドをえらぶ">
              {KOMA_FIELD_DEFINITIONS.map((field) => {
                const isSelected = fieldId === field.id
                return (
                  <button
                    key={field.id}
                    type="button"
                    className={`${styles.fieldButton} ${isSelected ? styles.fieldButtonSelected : ''}`}
                    aria-label={field.name}
                    aria-pressed={isSelected}
                    onClick={() => setFieldId(field.id)}
                  >
                    <FieldPreview field={field} />
                    <span className={styles.fieldName}>{field.name}</span>
                    <span className={styles.fieldDescription}>{field.description}</span>
                  </button>
                )
              })}
            </div>
            <div className={styles.typePickers}>
              {specs.map((spec, slotIndex) => (
                <section
                  key={spec.slotId}
                  className={styles.typePicker}
                  aria-labelledby={`${spec.slotId}-type-heading`}
                >
                  <div className={styles.typePickerHeader}>
                    <h3 id={`${spec.slotId}-type-heading`} className={styles.typePickerTitle}>
                      {spec.name}のタイプ
                    </h3>
                    <button
                      type="button"
                      className={styles.colorPickerButton}
                      aria-label={`${spec.name}の いろを かえる`}
                      onClick={() => setColorPickerSlot(spec.slotId)}
                    >
                      <span
                        className={styles.colorPickerSwatch}
                        style={{ background: spec.color }}
                        aria-hidden="true"
                      />
                      <span>いろを かえる</span>
                    </button>
                  </div>
                  <div className={styles.typeChoices}>
                    {KOMA_TYPE_CONFIGS.map((type) => {
                      const isSelected = selectedTypes[slotIndex] === type.id
                      return (
                        <button
                          key={type.id}
                          type="button"
                          className={`${styles.typeButton} ${
                            isSelected ? styles.typeButtonSelected : ''
                          }`}
                          aria-label={`${spec.name} ${type.name}`}
                          aria-pressed={isSelected}
                          onClick={() => {
                            setSelectedTypes((current) => {
                              const next: [KomaTypeId, KomaTypeId] = [...current]
                              next[slotIndex] = type.id
                              return next
                            })
                          }}
                        >
                          <span
                            className={styles.typeIcon}
                            style={{ color: spec.color, background: type.accentColor }}
                            aria-hidden="true"
                          >
                            {type.icon}
                          </span>
                          <span className={styles.typeName}>{type.name}</span>
                          <span className={styles.typeDescription}>{type.description}</span>
                        </button>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
            <button type="button" className={styles.primaryButton} onClick={startBattle}>
              まわせ！
            </button>
          </div>
          {colorPickerSlot !== null ? (
            <ColorPickerModal
              slotName={specs.find((spec) => spec.slotId === colorPickerSlot)?.name ?? ''}
              currentColorId={selectedColors[colorPickerSlot === 'player1' ? 0 : 1]}
              onSelect={(colorId) => selectColor(colorPickerSlot === 'player1' ? 0 : 1, colorId)}
              onClose={() => setColorPickerSlot(null)}
            />
          ) : null}
        </div>
      ) : (
        <GamePlaySurface>
          <KomaBattleScene
            runId={runId}
            komaCount={KOMA_COUNT}
            specs={specs}
            fieldId={fieldId}
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
  fieldId: KomaFieldId
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
  fieldId,
  outcome,
  onFinished,
  onRematch,
  onChangeKoma,
}: SceneProps) {
  const { registerContainer } = useKomaBattleEngine({
    runId,
    komaCount,
    specs,
    fieldId,
    onFinished,
  })

  return (
    <div className={styles.scene}>
      <div className={styles.sceneCanvas} ref={registerContainer} />

      <span className={styles.fieldChip} aria-label={`フィールド ${getKomaField(fieldId).name}`}>
        {getKomaField(fieldId).icon} {getKomaField(fieldId).name}
      </span>

      <div className={styles.komaLabels}>
        {specs.map((spec) => (
          <span key={spec.id} className={styles.komaLabel}>
            <span
              className={styles.komaSwatch}
              style={{ background: spec.color }}
              aria-hidden="true"
            />
            <span>{spec.name}</span>
            <span className={styles.komaTypeLabel}>{spec.type.name}</span>
          </span>
        ))}
      </div>

      {outcome !== null ? (
        <div className={styles.resultOverlay} role="status" aria-live="polite">
          {outcome.kind === 'win' ? (
            <div className={styles.resultSparkles} aria-hidden="true">
              <span>✦</span>
              <span>✧</span>
              <span>✦</span>
              <span>✧</span>
              <span>✦</span>
              <span>✧</span>
            </div>
          ) : null}
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

/**
 * 色えらびボタンを押したときだけ出す、小さな色選択モーダル。
 * 常に全色を並べず、必要なときだけ画面に重ねるので選択画面は一画面に収まる。
 */
function ColorPickerModal({
  slotName,
  currentColorId,
  onSelect,
  onClose,
}: {
  slotName: string
  currentColorId: KomaColorId
  onSelect: (colorId: KomaColorId) => void
  onClose: () => void
}) {
  return (
    <div className={styles.colorModalBackdrop} onClick={onClose}>
      <div
        className={styles.colorModal}
        role="dialog"
        aria-modal="true"
        aria-label={`${slotName}の いろを えらぶ`}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className={styles.colorModalTitle}>{slotName}の いろ</h2>
        <div className={styles.colorSwatches}>
          {KOMA_COLOR_CONFIGS.map((color) => (
            <button
              key={color.id}
              type="button"
              className={styles.colorSwatchButton}
              style={{ background: color.color }}
              aria-label={color.name}
              aria-pressed={currentColorId === color.id}
              onClick={() => onSelect(color.id)}
            />
          ))}
        </div>
        <button type="button" className={styles.backLink} onClick={onClose}>
          とじる
        </button>
      </div>
    </div>
  )
}

/** 文字を読めなくても地形の違いが分かる、軽量なCSSプレビュー。 */
function FieldPreview({ field }: { field: KomaField }) {
  return (
    <span className={`${styles.fieldPreview} ${styles[`fieldPreview${field.shape}`]}`} aria-hidden="true">
      <span className={styles.previewBowl} />
      {field.shape === 'bumper'
        ? field.obstacles.map((obstacle, index) => (
            <span
              key={index}
              className={styles.previewBumper}
              style={{
                left: `${50 + (obstacle.x / 1.2) * 28}%`,
                top: `${50 + (obstacle.z / 1.2) * 28}%`,
              }}
            />
          ))
        : null}
      {field.shape === 'ridge' ? <span className={styles.previewRidge} /> : null}
      {field.shape === 'belt' ? (
        <span className={styles.previewBelt} aria-hidden="true">
          ➡️➡️➡️
        </span>
      ) : null}
      <span className={styles.previewCenter} />
    </span>
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
        <div className={styles.resultHeadline}>
          <span className={styles.resultIcon} aria-hidden="true">🌀</span>
          <h2 className={styles.overlayTitle}>おしまい！</h2>
        </div>
        <p className={styles.overlayNote}>{soloMessage(outcome.reason)}</p>
      </>
    )
  }

  if (outcome.kind === 'draw') {
    return (
      <>
        <div className={styles.resultHeadline}>
          <span className={styles.resultIcon} aria-hidden="true">🤝</span>
          <h2 className={styles.overlayTitle}>ひきわけ！</h2>
        </div>
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
      <div className={styles.resultHeadline}>
        <span className={styles.resultIcon} aria-hidden="true">🏆</span>
        <h2 className={styles.overlayTitle}>かち！</h2>
      </div>
      <p className={styles.resultWinner}>
        <span
          className={styles.resultSwatch}
          style={{ background: winner?.color }}
          aria-hidden="true"
        />
        <span>{winner?.name}</span>
        <span className={styles.komaTypeLabel}>{winner?.type.name}</span>
      </p>
      <p className={styles.overlayNote}>
        {loser?.name}が {DEFEAT_LABEL[outcome.reason]}よ
      </p>
    </>
  )
}

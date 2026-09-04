import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CAR_CATEGORIES,
  carCategoryOrder,
  currentCarOption,
  DEFAULT_CAR_CONFIG,
  selectCarOption,
  type CarCategoryDefinition,
  type CarCategoryId,
  type CarConfig,
  type CarOptionDefinition,
  type CarOptionPreview,
} from './carConfig'
import { useCarBuilderScene } from './useCarBuilderScene'
import styles from './CarBuilderPlay.module.css'

function OptionPreviewMark({ preview, className }: { preview: CarOptionPreview; className: string }) {
  if (preview.kind === 'color') {
    return <span className={`${className} ${styles.colorChip}`} style={{ backgroundColor: preview.hex }} aria-hidden="true" />
  }
  if (preview.kind === 'wheel') {
    return (
      <span
        className={`${className} ${styles.wheelPreview} ${styles[`wheelPreview-${preview.variant}`]}`}
        aria-hidden="true"
      >
        <span className={styles.wheelPreviewHub} />
      </span>
    )
  }
  return (
    <span className={className} aria-hidden="true">
      {preview.emoji}
    </span>
  )
}

export default function CarBuilderPlay() {
  const navigate = useNavigate()
  // カスタマイズ状態はこの1か所だけが持つ（3D側は同じCarConfigを受け取るだけで状態を複製しない）。
  const [config, setConfig] = useState<CarConfig>(DEFAULT_CAR_CONFIG)
  // 下部エリアが「カテゴリ一覧」か「詳細選択」かだけを持つUI状態。CarConfigとは別物。
  const [openCategoryId, setOpenCategoryId] = useState<CarCategoryId | null>(null)

  const { registerContainer } = useCarBuilderScene({ config })

  const handleSelectOption = useCallback((categoryId: CarCategoryId, optionId: string) => {
    // 決定ボタンは置かない。選んだ瞬間にCarConfigが変わり、3D側がそれを受け取る。
    setConfig((current) => selectCarOption(current, categoryId, optionId))
  }, [])

  const openCategory =
    openCategoryId === null
      ? null
      : (CAR_CATEGORIES[openCategoryId] as CarCategoryDefinition<CarCategoryId>)

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <button
          type="button"
          className={styles.homeButton}
          onClick={() => navigate('/')}
          aria-label="ホームへ もどる"
        >
          <span aria-hidden="true">‹</span>
          <span>もどる</span>
        </button>
        <h1 className={styles.title}>
          <span aria-hidden="true">🚙</span> 3Dクルマづくり
        </h1>
      </header>

      <div
        ref={registerContainer}
        className={styles.scene}
        role="application"
        aria-label="3Dの くるま。ゆびで まわせるよ"
      />

      <section className={styles.panel} aria-label="くるまの カスタマイズ">
        {openCategory === null ? (
          <>
            <div className={styles.categoryGrid}>
              {carCategoryOrder().map((category) => (
                <button
                  key={category.id}
                  type="button"
                  className={styles.categoryButton}
                  onClick={() => setOpenCategoryId(category.id)}
                  aria-label={category.ariaLabel}
                >
                  <span className={styles.categoryEmoji} aria-hidden="true">
                    {category.emoji}
                  </span>
                  <span className={styles.categoryLabel}>{category.label}</span>
                  <OptionPreviewMark
                    preview={currentCarOption(config, category.id).preview}
                    className={styles.categoryBadge}
                  />
                </button>
              ))}
            </div>
            <p className={styles.hint}>えらぶと すぐに くるまが かわるよ</p>
          </>
        ) : (
          <div className={styles.detail}>
            <div className={styles.detailHeader}>
              <button
                type="button"
                className={styles.backButton}
                onClick={() => setOpenCategoryId(null)}
                aria-label="カテゴリ一覧へ もどる"
              >
                <span aria-hidden="true">‹</span>
                <span>もどる</span>
              </button>
              <h2 className={styles.detailTitle}>
                <span aria-hidden="true">{openCategory.emoji}</span>
                {openCategory.label}
              </h2>
            </div>
            <div
              className={styles.optionList}
              role="group"
              aria-label={openCategory.ariaLabel}
              data-category={openCategory.id}
            >
              {(openCategory.options as readonly CarOptionDefinition<string>[]).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={styles.optionButton}
                  aria-pressed={config[openCategory.id] === option.id}
                  onClick={() => handleSelectOption(openCategory.id, option.id)}
                >
                  <OptionPreviewMark preview={option.preview} className={styles.optionPreview} />
                  <span className={styles.optionLabel}>{option.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  )
}

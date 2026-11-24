import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { CRAFT_SLOTS, craftResult, INGREDIENTS, isCrafted, RECIPES, type CraftedMaterial } from './recipes'
import { materialDef, type Material } from './world'
import styles from './BlockCraftPlay.module.css'

type Props = {
  /** もう つくった ブロック。 */
  crafted: readonly Material[]
  onCraft: (result: CraftedMaterial) => void
  onClose: () => void
  /** ならべる・とりだす ときの おと。 */
  onSelect: () => void
}

function Swatch({ material, locked = false }: { material: Material; locked?: boolean }) {
  const def = materialDef(material)
  return <span className={styles.swatch} style={{ background: locked ? '#e7e3d8' : def.color }} aria-hidden="true">{locked ? '❓' : def.emoji}</span>
}

/** クラフトだい：ざいりょうを ならべると あたらしい ブロックが できる。レシピを タッチすると ならべて くれる。 */
export default function CraftPanel({ crafted, onCraft, onClose, onSelect }: Props) {
  const [slots, setSlots] = useState<Material[]>([])
  const panel = useRef<HTMLDivElement>(null)
  const resultButton = useRef<HTMLButtonElement>(null)
  const recoverFocus = useRef(false)
  useEffect(() => { panel.current?.focus() }, [])
  useLayoutEffect(() => {
    const dialog = panel.current
    if (!dialog || !recoverFocus.current) return
    recoverFocus.current = false
    const active = dialog.ownerDocument.activeElement
    if (active && active !== dialog.ownerDocument.body &&
      (!dialog.contains(active) || !active.matches(':disabled'))) return
    // ざいりょうボタンが無効になったり、取り出した枠が消えたりしても、フォーカスを外へ逃がさない。
    const button = resultButton.current
    const nextFocus = button && !button.disabled ? button : dialog
    nextFocus.focus({ preventScroll: true })
  }, [slots])
  const result = craftResult(slots)
  const usable = (material: Material) => !isCrafted(material) || crafted.includes(material)
  const update = (next: Material[]) => {
    const dialog = panel.current
    recoverFocus.current = Boolean(dialog?.contains(dialog.ownerDocument.activeElement))
    setSlots(next)
    onSelect()
  }
  return <div className={styles.craftPanel} ref={panel} tabIndex={-1} role="dialog" aria-label="クラフトだい"
    onKeyDown={event => { if (event.key === 'Escape') onClose() }}>
    <div className={styles.craftColumn}>
      <p className={styles.craftTitle}>🛠️ ざいりょうを ならべて つくろう！</p>
      <div className={styles.craftTable}>
        {Array.from({ length: CRAFT_SLOTS }, (_, i) => {
          const material = slots[i]
          return material
            ? <button key={i} className={styles.slot} aria-label={`${materialDef(material).label}を とりだす`} onClick={() => update(slots.filter((_, j) => j !== i))}><Swatch material={material} /></button>
            : <span key={i} className={styles.slot} aria-hidden="true" />
        })}
        <span className={styles.arrow} aria-hidden="true">➡</span>
        <button ref={resultButton} className={styles.craftResult} disabled={!result} onClick={() => result && onCraft(result)}
          aria-label={result ? `${materialDef(result).label}を つくる` : 'まだ できない'}>
          {result ? <><Swatch material={result} />{crafted.includes(result) ? 'つかう' : 'つくる！'}</> : <span className={styles.slotEmpty} aria-hidden="true">？</span>}
        </button>
      </div>
      <div className={styles.ingredients} role="group" aria-label="ざいりょう">
        {INGREDIENTS.map(material => {
          const locked = !usable(material)
          return <button key={material} disabled={locked || slots.length >= CRAFT_SLOTS} onClick={() => update([...slots, material])}
            aria-label={locked ? 'クラフトだいで つくると つかえる' : `${materialDef(material).label}を ならべる`}>
            <Swatch material={material} locked={locked} />{locked ? '？' : materialDef(material).label}
          </button>
        })}
      </div>
    </div>
    <div className={styles.craftColumn}>
      <p className={styles.craftHint}>📖 レシピ（タッチすると ならべるよ）</p>
      <div className={styles.recipes} role="group" aria-label="レシピ">
        {RECIPES.map(({ result: made, ingredients }) => {
          const done = crafted.includes(made)
          const ready = ingredients.every(usable)
          return <button key={made} disabled={!ready} onClick={() => update([...ingredients])}
            aria-label={`${materialDef(made).label}の レシピ${done ? '（つくった）' : ''}`}>
            {/* せまい がめんでも 3つの ざいりょうと できる ものが ならぶよう、きごうは ちいさく */}
            <span aria-hidden="true">
              {ingredients.map((m, i) => <Fragment key={i}>{i > 0 && <span className={styles.sign}>+</span>}{usable(m) ? materialDef(m).emoji : '❓'}</Fragment>)}
              <span className={styles.sign}>=</span>{materialDef(made).emoji}
            </span>
            {done && <span className={styles.done} aria-hidden="true">✓</span>}
          </button>
        })}
      </div>
      <div className={styles.craftActions}>
        <button disabled={!slots.length} onClick={() => update([])}>けす</button>
        <button onClick={onClose}>とじる</button>
      </div>
    </div>
  </div>
}

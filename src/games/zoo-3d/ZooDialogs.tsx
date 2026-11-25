// エリアを選ぶ「ちず」、観察のスタンプを集める「ずかん」、しいくいんさんの「おねがい」とお祝い。

import { useEffect, useRef, type ReactNode } from 'react'
import { SPECIES, type SpeciesId } from './species'
import { countStamps, discovered, hasStamp, stampInfo, stampKinds, type Zukan } from './zukan'
import { AREAS, areaById, homeOf, speciesOfArea, type AreaId } from './zooMap'
import { missionText, type MissionSet } from './missions'
import styles from './Zoo3dPlay.module.css'

/** ダイアログの外側（背景）をタップすると閉じる。Escape でも閉じる。 */
function Backdrop({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  const box = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    box.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className={styles.infoBackdrop} onClick={onClose}>
      <div ref={box} className={styles.dialog} role="dialog" aria-modal="true" aria-label={label} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

export function AreaMapDialog({ current, zukan, onGo, onClose }: {
  current: AreaId; zukan: Zukan; onGo: (area: AreaId) => void; onClose: () => void
}) {
  return (
    <Backdrop label="どこへ いく？" onClose={onClose}>
      <h2 className={styles.dialogTitle}><span aria-hidden="true">🗺️</span> どこへ いく？</h2>
      <div className={styles.areaList}>
        {AREAS.map(a => {
          const species = speciesOfArea(a)
          const { got, total } = countStamps(zukan, species)
          const here = a.id === current
          return (
            <button type="button" key={a.id} className={styles.areaCard} aria-current={here ? 'location' : undefined}
              onClick={() => onGo(a.id)} aria-label={`${a.name}${here ? '（いま ここ）' : ''}。スタンプ ${got}こ / ${total}こ`}
              data-autofocus={here ? true : undefined} style={{ background: a.grass }}>
              <span className={styles.areaEmoji} aria-hidden="true">{a.emoji}</span>
              <b>{a.name}</b>
              <span className={styles.areaAnimals} aria-hidden="true">{species.map(id => SPECIES[id].emoji).join('')}</span>
              <span className={styles.areaStamps} aria-hidden="true">{got === total ? '🏅' : '📖'} {got}/{total}</span>
              {here && <span className={styles.here} aria-hidden="true">いま ここ</span>}
            </button>
          )
        })}
      </div>
      <button type="button" className={styles.dialogClose} onClick={onClose}>とじる</button>
    </Backdrop>
  )
}

function StampRow({ zukan, species }: { zukan: Zukan; species: SpeciesId }) {
  return (
    <span className={styles.stampRow}>
      {stampKinds(species).map(kind => {
        const got = hasStamp(zukan, species, kind)
        return <span key={kind} className={got ? styles.stampGot : styles.stampEmpty} aria-hidden="true">{got ? stampInfo(species, kind).emoji : '・'}</span>
      })}
    </span>
  )
}

export function ZukanDialog({ zukan, focus, area, onFocus, onClose }: {
  zukan: Zukan; focus: SpeciesId | null; area: AreaId; onFocus: (species: SpeciesId | null) => void; onClose: () => void
}) {
  if (focus) {
    const s = SPECIES[focus]
    const known = discovered(zukan, focus)
    const home = homeOf(focus).area
    return (
      <Backdrop label={known ? s.name : 'まだ みつけて いない どうぶつ'} onClose={onClose}>
        <span className={styles.infoEmoji} aria-hidden="true" data-known={known}>{s.emoji}</span>
        <h2 className={styles.dialogTitle}>{known ? s.name : '？？？'}</h2>
        <p className={styles.where}><span aria-hidden="true">{home.emoji}</span> {home.name}に いるよ</p>
        {known
          ? <ul className={styles.facts}>{s.facts.map(f => <li key={f}>{f}</li>)}</ul>
          : <p className={styles.where}>ちかくで よく みると ずかんに のるよ</p>}
        <ul className={styles.stampList} aria-label="スタンプ">
          {stampKinds(focus).map(kind => {
            const got = hasStamp(zukan, focus, kind)
            const info = stampInfo(focus, kind)
            const label = kind === 'feed' ? `${s.food.label}を あげた` : info.label
            return (
              <li key={kind} className={got ? styles.stampGot : styles.stampEmpty}>
                <span aria-hidden="true">{got ? info.emoji : '？'}</span>
                <span>{got || kind === 'see' || kind === 'feed' || kind === 'sleep' ? label : `${info.emoji} を みつけよう`}</span>
                <b>{got ? 'ゲット！' : 'まだ'}</b>
              </li>
            )
          })}
        </ul>
        <div className={styles.dialogButtons}>
          <button type="button" className={styles.dialogClose} onClick={() => onFocus(null)}>もどる</button>
          <button type="button" className={styles.dialogClose} onClick={onClose} data-autofocus>とじる</button>
        </div>
      </Backdrop>
    )
  }
  const all = Object.keys(SPECIES) as SpeciesId[]
  const { got, total } = countStamps(zukan, all)
  // いまのエリアを先に並べる
  const ordered = [...AREAS].sort((a, b) => (a.id === area ? -1 : b.id === area ? 1 : 0))
  return (
    <Backdrop label="どうぶつ ずかん" onClose={onClose}>
      <h2 className={styles.dialogTitle}><span aria-hidden="true">📖</span> どうぶつ ずかん</h2>
      <p className={styles.where}>スタンプ {got} / {total}</p>
      <ul className={styles.howTo}>
        <li><span aria-hidden="true">👀</span> ちかくで よく みる</li>
        <li><span aria-hidden="true">🍽️</span> えさ</li>
        <li><span aria-hidden="true">💤</span> ねがお</li>
        <li><span aria-hidden="true">✨</span> とくいわざ</li>
      </ul>
      <div className={styles.zukanScroll}>
        {ordered.map(a => (
          <section key={a.id} aria-label={a.name}>
            <h3 className={styles.zukanArea}><span aria-hidden="true">{a.emoji}</span> {a.name}</h3>
            <div className={styles.zukanGrid}>
              {speciesOfArea(a).map(id => {
                const known = discovered(zukan, id)
                const c = countStamps(zukan, [id])
                return (
                  <button type="button" key={id} className={styles.zukanTile} onClick={() => onFocus(id)}
                    aria-label={`${known ? SPECIES[id].name : 'まだ みつけて いない どうぶつ'}。スタンプ ${c.got}こ / ${c.total}こ`}>
                    {/* まだ見つけていない動物は、黒いシルエット（だれかな？）にする */}
                    <span className={styles.zukanEmoji} aria-hidden="true" data-known={known}>{SPECIES[id].emoji}</span>
                    <b>{known ? SPECIES[id].name : '？？？'}</b>
                    <StampRow zukan={zukan} species={id} />
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </div>
      <button type="button" className={styles.dialogClose} onClick={onClose} data-autofocus>とじる</button>
    </Backdrop>
  )
}

export function MissionDialog({ set, medals, onClose }: { set: MissionSet; medals: number; onClose: () => void }) {
  const area = areaById(set.area)
  return (
    <Backdrop label="しいくいんさんの おねがい" onClose={onClose}>
      <h2 className={styles.dialogTitle}><span aria-hidden="true">📋</span> おねがい</h2>
      <p className={styles.where}><span aria-hidden="true">{area.emoji}</span> {area.name}の しいくいんさんから</p>
      <ul className={styles.stampList} aria-label="おねがい">
        {set.missions.map((m, i) => {
          const { emoji, text } = missionText(m)
          const done = set.done[i]
          return (
            <li key={`${m.species}-${m.kind}`} className={done ? styles.stampGot : styles.stampEmpty}>
              <span aria-hidden="true">{m.species ? SPECIES[m.species].emoji : emoji}</span>
              <span>{text}</span>
              <b>{done ? '✅ できた！' : 'まだ'}</b>
            </li>
          )
        })}
      </ul>
      <p className={styles.where}>ぜんぶ できたら メダル <span aria-hidden="true">🏅</span> × {medals}</p>
      <button type="button" className={styles.dialogClose} onClick={onClose} data-autofocus>とじる</button>
    </Backdrop>
  )
}

export type Celebration = { kind: 'medal'; medals: number } | { kind: 'area'; area: AreaId }

/** メダルをもらったとき・エリアの ずかんを ぜんぶ集めたときのお祝い。 */
export function CelebrationDialog({ celebration, onClose }: { celebration: Celebration; onClose: () => void }) {
  const medal = celebration.kind === 'medal'
  const area = medal ? undefined : areaById(celebration.area)
  const title = medal ? 'メダル ゲット！' : `${area!.name} コンプリート！`
  return (
    <Backdrop label={title} onClose={onClose}>
      <div className={styles.celebrate} aria-hidden="true">
        <span>🎉</span><span className={styles.celebrateBig}>{medal ? '🏅' : '🏆'}</span><span>🎉</span>
      </div>
      <h2 className={styles.dialogTitle}>{title}</h2>
      <p className={styles.where}>
        {medal
          ? `おねがいを ぜんぶ できたね！ メダルは ${celebration.medals}こ`
          : `${area!.name}の どうぶつの スタンプを ぜんぶ あつめたよ！`}
      </p>
      <button type="button" className={styles.dialogClose} onClick={onClose} data-autofocus>
        {medal ? 'つぎの おねがい' : 'やったね！'}
      </button>
    </Backdrop>
  )
}

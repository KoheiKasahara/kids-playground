import { useEffect, useRef, useState } from 'react'
import GameBackButton from '../../components/GameBackButton'
import GamePlaySurface from '../../components/GamePlaySurface'
import { useSoundToggle } from '../../audio/useSoundToggle'
import { HABITATS, LEVEL_LABELS, MAX_RESIDENTS, RANKING, RANKING_NOTE, RANK_FILTERS, SPECIES, addResident, createExhibits, matchesRankFilter, type HabitatId, type RankFilter, type Resident, type Species } from './data'
import PixelCreature from './PixelCreature'
import HabitatScene from './HabitatScene'
import { SIGNATURE_MOVES } from './motion'
import { playLabSound } from './sounds'
import styles from './VenomLabPlay.module.css'

const NOTEBOOK_KEY = 'venom-lab-observed-v1'

function readNotebook(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(NOTEBOOK_KEY) ?? '[]')
    return Array.isArray(value) ? SPECIES.filter(s => value.includes(s.id)).map(s => s.id) : []
  } catch { return [] }
}

function VenomMeter({ species }: { species: Species }) {
  return <span className={styles.meter} aria-label={`毒のつよさ めやす ${species.level} / 5`}>
    {Array.from({ length: 5 }, (_, i) => <i key={i} data-filled={i < species.level} />)}
    <b>{species.level}<small>/5</small></b>
  </span>
}

export default function VenomLabPlay() {
  const [habitatId, setHabitatId] = useState<HabitatId>('reef')
  const [exhibits, setExhibits] = useState(createExhibits)
  const [selected, setSelected] = useState<Species | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [observed, setObserved] = useState(readNotebook)
  const [paused, setPaused] = useState(false)
  const [tab, setTab] = useState<'observe' | 'ranking'>('observe')
  const [rankFilter, setRankFilter] = useState<RankFilter>('all')
  const [message, setMessage] = useState('いきものを タップして かんさつしよう！')
  const [actSignal, setActSignal] = useState(0)
  const [sound, toggleSound] = useSoundToggle()
  const detailRef = useRef<HTMLElement>(null)
  const revealNote = useRef(false)
  const habitat = HABITATS.find(h => h.id === habitatId)!
  const residents = exhibits[habitatId]
  const speciesInHabitat = SPECIES.filter(s => s.habitat === habitatId)
  const nextDiscovery = speciesInHabitat.find(s => !observed.includes(s.id))

  useEffect(() => {
    try { localStorage.setItem(NOTEBOOK_KEY, JSON.stringify(observed)) } catch { /* Private browsing can still play. */ }
  }, [observed])

  useEffect(() => {
    if (tab === 'observe' && revealNote.current) {
      revealNote.current = false
      detailRef.current?.scrollIntoView?.({ block: 'center' })
    }
  }, [selected, tab])

  function inspect(species: Species, residentId: number | null) {
    const fresh = !observed.includes(species.id)
    playLabSound(fresh ? 'discover' : 'tap')
    setSelected(species)
    setSelectedId(residentId)
    setActSignal(n => n + 1)
    setObserved(current => current.includes(species.id) ? current : [...current, species.id])
    setMessage(fresh ? `${species.name}を はっけん！ ずかんに きろくしたよ。` : `${species.name}を かんさつ中。`)
  }

  function changeHabitat(id: HabitatId) {
    playLabSound()
    setHabitatId(id)
    setSelected(null)
    setSelectedId(null)
    setMessage('いきものを タップして かんさつしよう！')
  }

  function observe(resident: Resident) {
    inspect(SPECIES.find(s => s.id === resident.speciesId)!, resident.id)
  }

  function add(species: Species) {
    if (residents.length >= MAX_RESIDENTS) return
    playLabSound('add')
    setExhibits(current => addResident(current, habitatId, species.id))
    setMessage(`${species.name}が なかまいり！ エリアで タップしてみよう。`)
  }

  function removeSelected() {
    if (selectedId === null) return
    playLabSound()
    setExhibits(current => ({ ...current, [habitatId]: current[habitatId].filter(r => r.id !== selectedId) }))
    setSelectedId(null)
    setMessage('1ぴき もどしたよ。また「＋」で よべるよ。')
  }

  return <GamePlaySurface><main className={styles.page}>
    <div className={styles.shell}>
      <header className={styles.header}>
        <GameBackButton to="/" reserveSpace />
        <span className={styles.brand}>◈ LITTLE NATURE LAB</span>
        <button type="button" className={styles.smallButton} onClick={toggleSound} aria-label="おと" aria-pressed={sound}>{sound ? '♪ おと ON' : '♪ おと OFF'}</button>
      </header>

      <div className={styles.hero}>
        <div><p className={styles.eyebrow}>日本から 世界へ。{HABITATS.length}つの エリアを たんけん。</p><h1>どくの いきものラボ</h1><p className={styles.lead}>{SPECIES.length}種類の なかまを みつけて、ひみつを しろう。</p></div>
        <div className={styles.notebook} aria-label={`かんさつずかん ${observed.length} / ${SPECIES.length}`}><span>かんさつずかん</span><strong>{String(observed.length).padStart(2, '0')}<small> / {String(SPECIES.length).padStart(2, '0')}</small></strong><div className={styles.progress}><i style={{ width: `${observed.length / SPECIES.length * 100}%` }} /></div></div>
      </div>

      <nav className={styles.modeNav} aria-label="あそびかた">
        <button type="button" aria-pressed={tab === 'observe'} onClick={() => { setTab('observe'); playLabSound() }}>◉ かんさつする</button>
        <button type="button" aria-pressed={tab === 'ranking'} onClick={() => { setTab('ranking'); playLabSound() }}>♛ 毒のつよさランキング</button>
      </nav>

      {tab === 'observe' ? <>
        <nav className={styles.habitats} aria-label="かんさつエリアを えらぶ">
          {HABITATS.map(h => <button type="button" key={h.id} onClick={() => changeHabitat(h.id)} aria-label={`AREA ${h.number} ${h.name}`} aria-pressed={h.id === habitatId}>
            <span className={styles.habitatIcon}>{h.icon}</span><span><small>AREA {h.number}</small><b>{h.name}</b><em>{SPECIES.filter(s => s.habitat === h.id && observed.includes(s.id)).length} / {SPECIES.filter(s => s.habitat === h.id).length} 種類 はっけん</em></span><span className={styles.habitatArrow}>↗</span>
          </button>)}
        </nav>

        <div className={styles.observationGrid}>
          <section className={styles.exhibit} aria-label={habitat.name}>
            <div className={styles.exhibitHeader}><div><p className={styles.eyebrow}>AREA {habitat.number}</p><h2>{habitat.name}</h2></div><button type="button" className={styles.smallButton} aria-pressed={paused} onClick={() => { setPaused(!paused); playLabSound() }}>{paused ? '▶ うごかす' : 'Ⅱ とめてみる'}</button></div>
            <HabitatScene habitat={habitatId} residents={residents} selectedId={selectedId} paused={paused} onObserve={observe} />
            <div className={styles.sceneFooter}><span>{habitat.subtitle}</span><b>{residents.length}<small> / {MAX_RESIDENTS} ひき</small></b></div>
            <div className={styles.mission}><span className={styles.missionIcon}>{nextDiscovery ? '⌕' : '✓'}</span><div><small>{nextDiscovery ? 'かんさつミッション' : 'このエリアは ぜんぶ はっけん！'}</small><p>{nextDiscovery ? residents.some(r => r.speciesId === nextDiscovery.id) ? nextDiscovery.clue : `「＋」で ${nextDiscovery.name}を よんでみよう` : 'すきな なかまを ふやして ながめよう。'}</p></div></div>
          </section>

          <aside ref={detailRef} className={styles.detail} aria-label="いきものの かいせつ" aria-live="polite">
            {selected ? <>
              <div className={styles.detailTop}><span className={styles.eyebrow}>FIELD NOTE / {String(SPECIES.indexOf(selected) + 1).padStart(2, '0')}</span><span className={styles.recorded}>✓ きろくずみ</span></div>
              <div className={styles.portrait}><PixelCreature species={selected} live actSignal={actSignal} /></div>
              <h2>{selected.name}</h2><p className={styles.scientific}>{selected.scientific}</p>
              <div className={styles.venomLine}><span>毒のつよさ <small>めやす</small></span><VenomMeter species={selected} /></div>
              <div className={styles.signature}>
                <span><small>とくいわざ</small>{SIGNATURE_MOVES[selected.id]}</span>
                <button type="button" onClick={() => { setActSignal(n => n + 1); playLabSound() }} aria-label={`${selected.name}の とくいわざを みる`}>▶ みる</button>
              </div>
              <span className={styles.delivery}>{selected.delivery}</span>{selected.inJapan && <span className={styles.japanBadge}>日本にもいる</span>}
              <p className={styles.fact}>{selected.fact}</p>
              <dl className={styles.facts}><dt>すむところ</dt><dd>{selected.home}</dd><dt>たべもの</dt><dd>{selected.food}</dd></dl>
              <details className={styles.more} key={selected.id}><summary>毒のひみつ・出典をみる</summary><p>{selected.venom}</p><p className={styles.note}>毒のつよさは ゲーム内のめやす。詳しくは ランキングをみてね。</p><a href={selected.source.url} target="_blank" rel="noreferrer">{selected.source.label} ↗</a></details>
              {selectedId !== null && <button type="button" className={styles.removeButton} onClick={removeSelected}>− この1ぴきを もどす</button>}
            </> : <div className={styles.detailEmpty}><span className={styles.eyebrow}>YOUR FIELD NOTES</span><div className={styles.emptyPortrait}><PixelCreature species={speciesInHabitat[0]} live small /></div><h2>どんな ひみつが<br />あるのかな？</h2><p>エリアの いきものを タップ！<br />ここに かいせつが でるよ。</p><span className={styles.emptyArrow}>← みつけてみよう</span></div>}
          </aside>

          <section className={styles.residentPicker} aria-label="いきものを ふやす">
            <div className={styles.pickerHeading}><h2>なかまを ふやそう</h2><span>{residents.length >= MAX_RESIDENTS ? 'いっぱい！ 1ぴき もどすと よべるよ' : 'おなじ なかまも よべるよ'}</span></div>
            <div className={styles.speciesCards}>{speciesInHabitat.map(s => <div key={s.id} className={styles.speciesCard}>
              <div className={styles.cardArt}><PixelCreature species={s} small /><span className={styles.seen}>{observed.includes(s.id) ? '✓' : '?'}</span></div>
              <b>{s.name}</b><span className={styles.inArea}>{residents.filter(r => r.speciesId === s.id).length}ひき かんさつ中</span>
              <button type="button" onClick={() => add(s)} disabled={residents.length >= MAX_RESIDENTS} aria-label={`${s.name}を ふやす`}>＋ なかまにする</button>
            </div>)}</div>
            <p className={styles.habitatDescription}>{habitat.description}</p>
          </section>
        </div>
      </> : <section className={styles.rankPanel} aria-labelledby="ranking-title">
        <div className={styles.rankHeading}><span className={styles.eyebrow}>VENOM GUIDE</span><h2 id="ranking-title">毒のつよさランキング</h2><p>ふしぎな毒を くらべてみよう</p></div>
        <p className={styles.rankNote}>{RANKING_NOTE}</p>
        <nav className={styles.rankFilters} aria-label="ランキングを しぼりこむ">{RANK_FILTERS.map(filter => <button key={filter.id} type="button" aria-pressed={rankFilter === filter.id} onClick={() => { setRankFilter(filter.id); playLabSound() }}>{filter.label}<small>{SPECIES.filter(s => matchesRankFilter(s, filter.id)).length}</small></button>)}</nav>
        <p className={styles.filterSummary}>{SPECIES.filter(s => matchesRankFilter(s, rankFilter)).length}種類を 表示中{rankFilter === 'japan' ? ' · 日本に定着した 外来種も ふくむよ' : ' · タップで かいせつへ'}</p>
        {RANKING.map((group, index) => {
          const entries = group.species.filter(s => matchesRankFilter(s, rankFilter))
          return entries.length > 0 && <section key={group.level} className={styles.rankGroup} aria-label={`${index + 1}位 ${LEVEL_LABELS[group.level]}`}>
          <div className={styles.rankGroupTitle}><strong>{String(index + 1).padStart(2, '0')}<small>同順位</small></strong><div><h3>{LEVEL_LABELS[group.level]}</h3><span>ゲーム内のめやす {group.level} / 5</span></div></div>
          <div className={styles.rankCards}>{entries.map(s => <button type="button" key={s.id} onClick={() => { revealNote.current = true; setHabitatId(s.habitat); setTab('observe'); inspect(s, exhibits[s.habitat].find(r => r.speciesId === s.id)?.id ?? null) }} aria-label={`${s.name}の かいせつをみる`}>
            <PixelCreature species={s} small /><span><b>{s.name}</b><small>{s.delivery}</small></span><span className={styles.rankGo}>↗</span>
          </button>)}</div>
        </section>})}
        <div className={styles.rankExplanation}><h3>「毒がある」にも ちがいがあるよ</h3><p>ヘビやサソリは かんだり さしたりして 毒を入れる。ヤドクガエルは 皮ふの毒で「食べないで」と 身をまもる。同じ「毒」でも つかい方が ちがうんだね。</p><p>実際の毒の強さは、毒の種類や動物・測定条件をそろえて調べます。この展示の段階は学習用の分類で、死亡数や実験値の順位ではありません。</p></div>
      </section>}

      <div className={styles.status} role="status">{observed.length === SPECIES.length ? '✦ ずかん かんせい！ きみは いきもの研究員！' : message}</div>
      <footer className={styles.footer}><span>◇ ほんものは さわらず、はなれて みよう。</span><p>ここは ゲームの観察展示。にた環境の生き物を まとめています。実際の混合飼育は 再現していません。大きさも 見やすく 変えています。</p></footer>
    </div>
  </main></GamePlaySurface>
}

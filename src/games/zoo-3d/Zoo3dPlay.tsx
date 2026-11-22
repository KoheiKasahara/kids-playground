import { useCallback, useMemo, useState, type CSSProperties } from 'react'
import GameBackButton from '../../components/GameBackButton'
import GamePlaySurface from '../../components/GamePlaySurface'
import { primeAudio } from '../../audio/sound'
import { useSoundToggle } from '../../audio/useSoundToggle'
import { playZooSound } from './sounds'
import { SPECIES, SPECIES_ORDER, type Species } from './species'
import { useZooEngine, type ZooStatus } from './useZooEngine'
import styles from './Zoo3dPlay.module.css'

type Member = { id: string; label: string; species: Species }

const MEMBERS: Member[] = SPECIES_ORDER.flatMap(id => SPECIES[id].members.map(m => ({ id: m.id, label: m.label, species: SPECIES[id] })))

export default function Zoo3dPlay() {
  const [sound, toggleSound] = useSoundToggle()
  const [status, setStatus] = useState<ZooStatus>('loading')
  const [progress, setProgress] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [following, setFollowing] = useState(false)
  const [info, setInfo] = useState(false)
  const [specialTurn, setSpecialTurn] = useState<Record<string, number>>({})
  const [reducedMotion] = useState(() => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const onSelect = useCallback((id: string | null) => {
    setSelected(id)
    if (!id) setInfo(false)
  }, [])
  const { registerContainer, retry, select, feed: dropFood, special, setFollow, overview } = useZooEngine({ reducedMotion, onStatus: setStatus, onProgress: setProgress, onSelect, onFollow: setFollowing })
  const member = useMemo(() => MEMBERS.find(m => m.id === selected), [selected])
  const ready = status === 'ready'

  const choose = (m: Member) => {
    primeAudio()
    select(m.id)
    setFollow(true)
  }
  const feed = () => {
    primeAudio()
    dropFood()
  }
  const act = () => {
    if (!member) return
    primeAudio()
    const turn = specialTurn[member.species.id] ?? 0
    const spec = member.species.specials[turn % member.species.specials.length]
    special(spec.clip)
    setSpecialTurn(t => ({ ...t, [member.species.id]: turn + 1 }))
  }
  const nextSpecial = member ? member.species.specials[(specialTurn[member.species.id] ?? 0) % member.species.specials.length] : undefined

  return (
    <GamePlaySurface>
      <main className={styles.page}>
        <header className={styles.header}>
          <GameBackButton to="/" />
          <h1>3Dどうぶつえん</h1>
          <button type="button" className={styles.soundButton} aria-label="おと" aria-pressed={sound} onClick={toggleSound}>
            <span aria-hidden="true">{sound ? '🔊' : '🔇'}</span>
          </button>
        </header>
        <div className={styles.scene} ref={registerContainer} role="application" aria-label="3Dの どうぶつえん。どうぶつを タップすると えらべるよ" data-testid="zoo-scene">
          {status !== 'ready' && <div className={styles.status} role={status === 'error' ? 'alert' : 'status'}>
            <span className={styles.statusIcon} aria-hidden="true">{status === 'error' ? '🚧' : '🐘'}</span>
            <strong>{status === 'error' ? 'どうぶつえんを ひらけなかったよ' : 'どうぶつたちが じゅんびちゅう…'}</strong>
            {status === 'error'
              ? <button type="button" onClick={retry}>もういちど</button>
              : <progress className={styles.progress} aria-label="よみこみ" value={Math.round(progress * 100)} max={100} />}
          </div>}
          {ready && !member && <p className={styles.hint}><span aria-hidden="true">👆</span> どうぶつを タップしてね</p>}
          {ready && member && following && <button type="button" className={styles.overview} onClick={overview}>
            <span aria-hidden="true">🗺️</span> ぜんたい
          </button>}
        </div>
        <section className={styles.panel} aria-label={member ? `${member.species.name}と あそぶ` : 'どうぶつを えらぶ'}>
          {member ? <>
            <div className={styles.who} style={{ '--accent': member.species.color } as CSSProperties}>
              <span className={styles.whoEmoji} aria-hidden="true">{member.species.emoji}</span>
              <strong>{member.species.name}</strong>
              <small>{member.label}</small>
              <button type="button" className={styles.close} aria-label="えらぶのを やめる" onClick={() => select(null)}>✕</button>
            </div>
            <div className={styles.actions}>
              <button type="button" className={styles.action} disabled={!ready} onClick={feed} aria-label={`${member.species.food.label}を あげる`}>
                <span aria-hidden="true">{member.species.food.emoji}</span><b>えさ</b>
              </button>
              <button type="button" className={styles.action} disabled={!ready || !nextSpecial} onClick={act} aria-label={`${nextSpecial?.label ?? 'アクション'}を みる`}>
                <span aria-hidden="true">{nextSpecial?.emoji ?? '✨'}</span><b>{nextSpecial?.label ?? 'アクション'}</b>
              </button>
              <button type="button" className={styles.action} disabled={!ready} aria-pressed={following} onClick={() => { primeAudio(); setFollow(!following) }} aria-label="おいかける">
                <span aria-hidden="true">🎥</span><b>おいかける</b>
              </button>
              <button type="button" className={styles.action} disabled={!ready} onClick={() => { playZooSound('info'); setInfo(true) }} aria-label="じょうほうを みる">
                <span aria-hidden="true">📖</span><b>じょうほう</b>
              </button>
            </div>
          </> : <div className={styles.picker} role="group" aria-label="どうぶつを えらぶ">
            {/* 動物の種類ごとに1つ（親を選ぶ）。子どもは画面の中でタップして選べる。動物が増えても並びが崩れない */}
            {SPECIES_ORDER.map(id => {
              const m = MEMBERS.find(x => x.species.id === id)!
              return (
                <button type="button" key={id} disabled={!ready} onClick={() => choose(m)} aria-label={`${m.species.name}を みる`}>
                  <span aria-hidden="true">{m.species.emoji}</span>
                  <b>{m.species.name}</b>
                </button>
              )
            })}
          </div>}
        </section>
        {info && member && <div className={styles.infoBackdrop} onClick={() => setInfo(false)}>
          <div className={styles.info} role="dialog" aria-modal="true" aria-labelledby="zoo3d-info-title" onClick={e => e.stopPropagation()}>
            <span className={styles.infoEmoji} aria-hidden="true">{member.species.emoji}</span>
            <h2 id="zoo3d-info-title">{member.species.name}</h2>
            <ul>{member.species.facts.map(f => <li key={f}>{f}</li>)}</ul>
            <p className={styles.infoFood}>すきな たべもの: <span aria-hidden="true">{member.species.food.emoji}</span> {member.species.food.label}</p>
            <button type="button" onClick={() => setInfo(false)} autoFocus>とじる</button>
          </div>
        </div>}
      </main>
    </GamePlaySurface>
  )
}

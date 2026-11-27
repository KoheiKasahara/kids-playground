import { useState, type CSSProperties } from 'react'
import { primeAudio } from '../../audio/sound'
import { useSoundToggle } from '../../audio/useSoundToggle'
import GameBackButton from '../../components/GameBackButton'
import { useGameIntroPlaying } from '../../components/gameIntroState'
import { useGameInterval } from '../../utils/useGameInterval'
import meadow from './assets/meadow.webp'
import sunny from './assets/sunny.webp'
import sky from './assets/sky.webp'
import lily from './assets/lily.webp'
import PondIcon from './PondIcon'
import { playFrog, playPondTap, type FrogVoice } from './sounds'
import styles from './FrogChorusGame.module.css'

const frogs = {
  meadow: { name: 'みどり', note: 'ド', image: meadow },
  sunny: { name: 'きいろ', note: 'ミ', image: sunny },
  sky: { name: 'そらいろ', note: 'ソ', image: sky },
} as const
const voices: FrogVoice[] = ['meadow', 'sunny', 'sky']
const tempos = [
  { label: 'ゆっくり', ms: 780 },
  { label: 'ふつう', ms: 560 },
  { label: 'はやい', ms: 360 },
]
type Pattern = (FrogVoice | null)[]
const initialPattern: Pattern = ['meadow', null, null, 'sunny', null, 'sky', null, null]
const counters = ['ひき', 'ぴき', 'ひき', 'びき', 'ひき', 'ひき', 'ぴき', 'ひき', 'ひき']
const seats = initialPattern.map((_, index) => {
  const angle = (index - 2.5) * Math.PI / 4
  return { left: `${50 + 38 * Math.cos(angle)}%`, top: `${50 + 37 * Math.sin(angle)}%` }
})

export default function FrogChorusGame() {
  useGameIntroPlaying(true)
  const [sound, toggleSound] = useSoundToggle()
  const [pattern, setPattern] = useState<Pattern>(initialPattern)
  const [history, setHistory] = useState<Pattern[]>([])
  const [voice, setVoice] = useState<FrogVoice>('meadow')
  const [tempo, setTempo] = useState(1)
  const [beat, setBeat] = useState<number | null>(null)
  const playing = beat !== null
  const count = pattern.filter(Boolean).length

  function sing(index: number) {
    setBeat(index)
    const singer = pattern[index]
    if (singer) playFrog(singer)
  }

  useGameInterval(() => {
    if (beat !== null) sing((beat + 1) % pattern.length)
  }, playing ? tempos[tempo].ms : null)

  function togglePlayback() {
    if (playing) {
      setBeat(null)
      playPondTap()
    } else {
      primeAudio()
      sing(0)
    }
  }

  function editLeaf(index: number) {
    const singer = pattern[index] === voice ? null : voice
    setHistory(previous => [...previous.slice(-31), pattern])
    setPattern(pattern.map((frog, i) => i === index ? singer : frog))
    if (singer) playFrog(singer)
    else playPondTap()
  }

  function undoEdit() {
    const previous = history.at(-1)
    if (!previous) return
    setPattern(previous)
    setHistory(history.slice(0, -1))
    playPondTap()
  }

  return (
    <main className={styles.game}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <GameBackButton to="/" />
          <h1 className={styles.title}>
            <i aria-hidden="true" className={styles.titleNotes}>♫</i>
            かえるの <span>がっしょういけ</span>
            <i aria-hidden="true" className={styles.titleNotes}>♪</i>
          </h1>
          <button className={styles.sound} type="button" onClick={toggleSound} aria-label="おと" aria-pressed={sound}>
            <PondIcon name={sound ? 'sound' : 'mute'} /><span>おと</span>
          </button>
        </header>

        <div className={styles.layout}>
          <section className={styles.board} aria-label="かえるの いけ">
            <div className={styles.water}>
              <div className={styles.boardBar}>
                <span className={styles.count}><PondIcon name="music" />{count}{counters[count]}</span>
                <button className={styles.undo} type="button" onClick={undoEdit} disabled={!history.length} aria-label="ひとつ もどす" title="ひとつ もどす">
                  <PondIcon name="undo" />
                </button>
              </div>
              <div className={styles.stage}>
                <div className={styles.orbit} aria-hidden="true" />
                {pattern.map((frog, index) => (
                  <button key={index} type="button" className={styles.leaf} style={seats[index]}
                    aria-label={`${index + 1}ばんの はっぱ、${frog ? frogs[frog].name + 'の かえる' : 'あいている'}`}
                    aria-current={index === beat ? 'step' : undefined} onClick={() => editLeaf(index)}>
                    <span className={styles.ripple} aria-hidden="true" />
                    <img className={styles.lily} src={lily} alt="" draggable={false} />
                    {frog
                      ? <img className={styles.singer} src={frogs[frog].image} alt="" draggable={false} />
                      : <span aria-hidden="true" className={styles.plus}>+</span>}
                    <span className={styles.number} aria-hidden="true">{index + 1}</span>
                  </button>
                ))}
                <div className={styles.firefly} data-playing={playing} aria-hidden="true"
                  style={{ ...(beat === null ? { left: '50%', top: '44%' } : seats[beat]), '--flight': `${tempos[tempo].ms * 0.52}ms` } as CSSProperties}>
                  <span className={styles.bug}><i /><b /></span>
                </div>
                {!playing && <p className={styles.hint}>はっぱを タップ！</p>}
              </div>
            </div>
            <div className={styles.score} aria-label="いけの リズム">
              <strong><PondIcon name="music" />リズム</strong>
              <div className={styles.beats}>
                {pattern.map((frog, i) => (
                  <span key={i} data-voice={frog ?? 'rest'} aria-current={i === beat ? 'step' : undefined}
                    aria-label={`${i + 1}はくめ、${frog ? frogs[frog].note : 'おやすみ'}`}>{frog ? frogs[frog].note : '–'}</span>
                ))}
              </div>
            </div>
          </section>

          <section className={styles.controls} aria-label="がっしょうの せってい">
            <div className={styles.picker}>
              <h2>かえるを えらぶ</h2>
              <div className={styles.voices}>
                {voices.map(id => (
                  <button key={id} type="button" className={styles.voice} data-voice={id} aria-pressed={id === voice}
                    aria-label={`${frogs[id].name}の かえる`} onClick={() => { setVoice(id); playFrog(id) }}>
                    <img src={frogs[id].image} alt="" draggable={false} />
                    <span className={styles.voiceName}>{frogs[id].name}</span>
                    <span className={styles.voiceNote}>{frogs[id].note}</span>
                    {id === voice && <span className={styles.selected}><PondIcon name="check" /></span>}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.transport}>
              <div className={styles.speed}>
                <h2><PondIcon name="tempo" />はやさ</h2>
                <div className={styles.tempos}>
                  {tempos.map(({ label }, index) => (
                    <button key={label} type="button" aria-pressed={tempo === index} onClick={() => { setTempo(index); playPondTap() }}>{label}</button>
                  ))}
                </div>
              </div>
              <button className={styles.play} type="button" onClick={togglePlayback}>
                <PondIcon name={playing ? 'stop' : 'play'} />{playing ? 'とめる' : 'えんそうする'}
              </button>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}

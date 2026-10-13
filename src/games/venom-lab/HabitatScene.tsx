import type { CSSProperties } from 'react'
import { SPECIES, type HabitatId, type Resident } from './data'
import PixelCreature from './PixelCreature'
import styles from './VenomLabPlay.module.css'

function Scenery({ habitat }: { habitat: HabitatId }) {
  return <svg className={styles.scenery} viewBox="0 0 600 360" preserveAspectRatio="none" shapeRendering="crispEdges" aria-hidden="true">
    {habitat === 'reef' ? <>
      <path fill="#1c6270" d="M0 0H600V360H0Z" />
      <path fill="#237a83" d="M0 0H600V48H0Z" />
      <path fill="#5db9ac" opacity=".12" d="M80 0H144L260 300H168ZM310 0H345L460 300H410Z" />
      <path fill="#184956" d="M0 205H28V184H70V220H122V205H170V248H270V236H338V222H388V244H448V206H490V180H542V201H600V360H0Z" />
      <path fill="#8baf9c" d="M0 305H70V312H155V300H226V310H350V302H435V291H510V305H600V360H0Z" />
      <path fill="#b4c4a2" d="M0 332H90V324H170V338H280V326H380V340H489V325H600V360H0Z" />
      {[20, 520].map(x => <g key={x} transform={`translate(${x} 205)`}>
        <path fill="#e29c8c" d="M20 100V20H28V56H40V34H48V64H28V100ZM20 74H4V42H12V66H20Z" />
        <path fill="#f4bd9e" d="M20 20H28V44H20ZM4 42H12V54H4ZM40 34H48V46H40Z" />
      </g>)}
      <path fill="#446766" d="M330 302V278H342V264H380V280H400V310H330Z" />
      <path fill="#64887c" d="M340 280V267H380V280Z" />
      <path fill="#80b48b" d="M90 308V268H98V286H108V255H115V306ZM476 304V251H484V272H493V240H501V307Z" />
      {[55, 143, 280, 400, 558].map((x, i) => <g key={x} fill="#96c9c0" opacity=".45"><rect x={x} y={70 + i * 29} width="4" height="4" /><rect x={x + 10} y={63 + i * 29} width="3" height="3" /></g>)}
    </> : habitat === 'forest' ? <>
      <path fill="#204c42" d="M0 0H600V360H0Z" />
      <path fill="#31674f" d="M0 0H600V85H555V62H460V95H390V69H275V105H170V76H66V104H0Z" />
      {[25, 170, 455, 560].map((x, i) => <g key={x}>
        <rect x={x} y="0" width={i % 2 ? 21 : 33} height="305" fill="#29493c" />
        <rect x={x + 7} y="0" width="7" height="287" fill="#385c43" />
        <path fill="#428059" d={`M${x - 20} 42h80v12h-80zM${x + 7} 70h55v13h-55z`} />
      </g>)}
      <path fill="#345647" d="M0 185H55V206H150V192H225V226H313V197H390V211H482V184H600V360H0Z" />
      <path fill="#4b6145" d="M0 289H85V280H162V300H246V280H350V295H480V283H600V360H0Z" />
      <path fill="#61744b" d="M0 327H88V317H195V330H350V322H440V334H600V360H0Z" />
      <path fill="#285d59" d="M288 320H360V326H390V342H270V330H288Z" />
      <path fill="#63a29b" d="M298 327H349V332H298Z" />
      {[12, 505].map(x => <g key={x} transform={`translate(${x} 240)`}><path fill="#73a765" d="M28 65V21H37V65ZM28 28H10V19H0V10H10V19H28ZM37 43H55V32H65V23H55V32H37ZM28 49H8V40H0V31H8V40H28Z" /></g>)}
      {[85, 211, 425, 559].map(x => <path key={x} fill="#b5a562" d={`M${x} 337h12v5h-12zM${x + 14} 315h7v4h-7z`} />)}
    </> : <>
      <path fill="#263b50" d="M0 0H600V360H0Z" />
      <path fill="#e9c18b" d="M475 36H503V44H511V72H503V80H475V72H467V44H475Z" />
      <path fill="#815f5e" d="M0 70H30V49H60V30H110V54H138V93H231V72H270V47H293V23H345V53H368V76H447V56H477V82H550V60H600V360H0Z" />
      <path fill="#b48168" d="M0 83H84V73H158V89H290V79H411V95H527V78H600V360H0Z" />
      <path fill="#d6aa7a" d="M0 143H99V152H215V141H332V156H410V141H530V149H600V360H0Z" />
      {[40, 524].map(x => <g key={x} transform={`translate(${x} 155)`}><path fill="#487c68" d="M20 150V15H28V7H37V15H45V150ZM20 88H0V38H8V30H16V74H20ZM45 111H65V57H57V49H49V97H45Z" /><path fill="#6f9b73" d="M28 18H33V150H28ZM4 38H8V81H4Z" /></g>)}
      <path fill="#986e60" d="M288 297V281H300V267H335V281H351V307H288Z" />
      {[89, 212, 396, 552].map(x => <path key={x} fill="#ab825f" d={`M${x} 338h14v4h-14zM${x + 17} 323h6v4h-6z`} />)}
    </>}
  </svg>
}

export default function HabitatScene({ habitat, residents, paused, selectedId, onObserve }: {
  habitat: HabitatId; residents: Resident[]; paused: boolean; selectedId: number | null; onObserve: (resident: Resident) => void
}) {
  return <div className={styles.scene} data-paused={paused} role="group" aria-label="かんさつエリア">
    <Scenery habitat={habitat} />
    <div className={styles.sceneLabel}><span /> {paused ? 'いちじていし中' : 'かんさつ中'}<span className={styles.pixelLabel}>PIXEL HABITAT</span></div>
    {residents.map(resident => {
      const species = SPECIES.find(s => s.id === resident.speciesId)!
      const row = Math.floor(resident.slot / 3)
      const isBottom = species.motion === 'still' || species.sprite === 'octopus'
      const style = {
        left: `${19 + (resident.slot % 3) * 30}%`,
        top: `${isBottom ? 36 + row * 23 : 28 + row * 24}%`,
        '--delay': `${-(resident.id * 1.7)}s`,
        '--duration': `${species.motion === 'swim' ? 10 : 7 + resident.id % 5}s`,
      } as CSSProperties
      return <button key={resident.id} type="button" className={`${styles.resident} ${styles[species.motion]}`}
        style={style} aria-label={`${species.name}を かんさつ ${resident.id}`} aria-pressed={selectedId === resident.id}
        onClick={() => onObserve(resident)}>
        <PixelCreature species={species} />
        <span className={styles.creatureName}>{species.name}</span>
      </button>
    })}
    {residents.length === 0 && <p className={styles.emptyScene}>下の「＋」で<br />いきものを いれてみよう</p>}
    <div className={styles.sceneHint}>いきものを タップして しらべよう</div>
  </div>
}

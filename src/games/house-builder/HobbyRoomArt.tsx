import type { RoomStyle, RoomTypeId } from './data'

type Box = { x: number; y: number; w: number; h: number }
const INK = '#5c4c40'

/** 趣味・くらしの へやを うえから みた かぐ。せまい へやにも おさめる。 */
export function HobbyRoomArt({ b, s, type }: { b: Box; s: RoomStyle; type: RoomTypeId }) {
  const scale = Math.min(b.w / 160, b.h / 140)
  const v = s.variant
  return <g transform={`translate(${b.x + (b.w - 160 * scale) / 2} ${b.y + (b.h - 140 * scale) / 2}) scale(${scale})`} stroke={INK} strokeWidth={2} strokeLinejoin="round">
    {type === 'library' && <>
      <rect x={8} y={7} width={144} height={26} rx={3} fill={s.main} />
      {Array.from({ length: 15 }, (_, i) => <rect key={i} x={13 + i * 9} y={11 + i % 3} width={6} height={18 - i % 3} fill={[s.accent, '#f4d47a', '#dd8b83'][i % 3]} />)}
      {v === 'study' ? <>
        <rect x={45} y={64} width={90} height={42} rx={3} fill={s.main} />
        <path d="M60 70 H86 V96 H60 Z M87 70 H113 V96 H87 Z" fill="#fff9e8" />
        <rect x={73} y={109} width={33} height={23} rx={8} fill={s.accent} />
      </> : <>
        <ellipse cx={85} cy={89} rx={54} ry={36} fill={s.accent} opacity={.3} stroke="none" />
        <rect x={17} y={53} width={45} height={57} rx={v === 'picturebooks' ? 20 : 8} fill={s.accent} />
        <rect x={21} y={55} width={37} height={12} rx={4} fill={s.main} />
        <path d="M87 70 Q102 64 115 70 V99 Q101 93 87 99 Z M115 70 Q130 64 143 70 V99 Q129 93 115 99 Z" fill="#fff9e8" />
      </>}
    </>}
    {type === 'music' && <>
      <rect x={12} y={10} width={136} height={120} rx={14} fill={s.accent} opacity={.18} stroke="none" />
      {v === 'piano' && <>
        <path d="M28 25 H125 V75 H28 Z" fill={s.main} />
        {Array.from({ length: 12 }, (_, i) => <g key={i}>
          <rect x={31 + i * 7.5} y={55} width={7.5} height={27} fill="#ffffff" />
          {i % 3 !== 2 && <rect x={36 + i * 7.5} y={55} width={4} height={15} fill="#34343e" stroke="none" />}
        </g>)}
        <rect x={53} y={98} width={48} height={19} rx={3} fill={s.main} />
      </>}
      {v === 'drums' && <>
        {[[80, 78, 26], [53, 44, 18], [104, 43, 16]].map(([cx, cy, r]) => <circle key={cx} cx={cx} cy={cy} r={r} fill={s.main} stroke="#f1ebe0" strokeWidth={5} />)}
        {[25, 134].map((cx) => <circle key={cx} cx={cx} cy={72} r={18} fill={s.accent} />)}
        <path d="M63 106 L96 53 M95 109 L65 60" stroke="#b68e60" strokeWidth={4} />
      </>}
      {v === 'guitar' && <>
        <path d="M80 62 C43 42 42 89 55 104 C75 130 120 113 111 86 C106 72 94 80 94 63 Z" fill={s.main} />
        <rect x={79} y={13} width={14} height={70} rx={3} fill="#b88a57" />
        <circle cx={84} cy={89} r={10} fill="#473f39" />
        <path d="M83 17 V107 M88 17 V107" stroke="#f9e6ad" strokeWidth={1} />
        <rect x={13} y={12} width={42} height={36} rx={3} fill="#41434c" />
        <circle cx={34} cy={30} r={12} fill={s.accent} />
      </>}
    </>}
    {type === 'art' && <>
      <rect x={14} y={25} width={75} height={85} rx={4} fill={s.main} />
      {v === 'painting' ? <>
        <path d="M24 105 L35 14 H71 L82 105 M26 84 H82" fill="none" stroke="#b58b5d" strokeWidth={5} />
        <rect x={26} y={27} width={55} height={53} fill="#fff7e6" />
        <circle cx={66} cy={41} r={8} fill={s.accent} stroke="none" />
        <path d="M28 76 L45 48 L61 65 L71 57 L79 76 Z" fill="#70aaa0" stroke="none" />
      </> : v === 'craft' ? <>
        <path d="M27 36 H75 V84 H27 Z" fill="#fff7e6" />
        <path d="M41 42 L68 68 L35 73 Z" fill={s.accent} />
        <path d="M30 96 L70 78 M70 96 L30 78" stroke="#6693b2" strokeWidth={5} />
      </> : <>
        <circle cx={52} cy={65} r={28} fill="#dfd5c6" />
        <circle cx={52} cy={65} r={17} fill={s.accent} />
        <circle cx={52} cy={65} r={9} fill="#a56e53" />
      </>}
      <rect x={107} y={14} width={35} height={111} rx={3} fill={s.main} />
      {[31, 63, 95].map((cy, i) => <circle key={cy} cx={124} cy={cy} r={11} fill={[s.accent, '#edcf60', '#84b0c4'][i]} />)}
    </>}
    {type === 'playroom' && <>
      <rect x={12} y={12} width={136} height={116} rx={18} fill={s.main} opacity={.35} />
      {v === 'balls' && <>
        <rect x={24} y={24} width={112} height={92} rx={22} fill={s.main} strokeWidth={8} />
        {Array.from({ length: 20 }, (_, i) => <circle key={i} cx={37 + (i % 5) * 22} cy={36 + Math.floor(i / 5) * 22} r={9} fill={[s.accent, '#f5d65c', '#8fcba4', '#faf2dd'][i % 4]} stroke="none" />)}
      </>}
      {v === 'blocks' && <>
        {[0, 1, 2, 3, 4, 5].map((i) => <rect key={i} x={27 + (i % 3) * 36} y={32 + Math.floor(i / 3) * 47} width={26} height={32} rx={3} fill={[s.main, s.accent, '#df8d7f'][i % 3]} transform={`rotate(${i * 9 - 15} ${40 + (i % 3) * 36} ${48 + Math.floor(i / 3) * 47})`} />)}
      </>}
      {v === 'slide' && <>
        <path d="M25 37 H60 V111 H25 M25 58 H60 M25 79 H60" fill="none" stroke={s.main} strokeWidth={7} />
        <path d="M61 29 H95 V111 H61 Z" fill={s.accent} strokeWidth={5} />
        <circle cx={121} cy={97} r={17} fill="#f7d46b" />
      </>}
    </>}
    {type === 'pet' && <>
      <rect x={87} y={59} width={59} height={57} rx={20} fill={s.accent} />
      <ellipse cx={116} cy={87} rx={21} ry={18} fill="#fff3df" />
      {v === 'cat' ? <>
        <rect x={15} y={15} width={55} height={99} rx={9} fill={s.main} />
        <circle cx={42} cy={40} r={20} fill={s.accent} />
        <circle cx={42} cy={85} r={17} fill="#eadbc3" />
      </> : v === 'dog' ? <>
        <path d="M16 58 L44 24 L74 58 V111 H16 Z" fill={s.main} />
        <path d="M33 111 V78 Q45 62 57 78 V111 Z" fill="#68564b" />
      </> : <>
        <rect x={13} y={15} width={60} height={98} rx={6} fill={s.main} />
        <ellipse cx={43} cy={78} rx={17} ry={20} fill="#fff6ed" />
        <ellipse cx={35} cy={46} rx={6} ry={18} fill="#fff6ed" />
        <ellipse cx={51} cy={46} rx={6} ry={18} fill="#fff6ed" />
      </>}
      <circle cx={104} cy={27} r={13} fill={s.main} /><circle cx={135} cy={27} r={13} fill={s.accent} />
      <circle cx={104} cy={27} r={7} fill="#9bcbd5" /><circle cx={135} cy={27} r={7} fill="#b0855d" />
    </>}
    {type === 'laundry' && <>
      <rect x={12} y={13} width={55} height={61} rx={5} fill={s.main} />
      <circle cx={39} cy={46} r={19} fill={s.accent} /><circle cx={39} cy={46} r={12} fill="#daedf0" />
      <path d="M20 23 H38 M51 23 H58" stroke={s.accent} strokeWidth={4} />
      <rect x={18} y={94} width={43} height={30} rx={8} fill="#d2b68b" />
      <path d="M23 104 H55 M23 114 H55" stroke="#a68b67" />
      {v === 'washer' ? <>
        <rect x={86} y={13} width={55} height={61} rx={5} fill={s.main} />
        <circle cx={113} cy={46} r={19} fill={s.accent} /><circle cx={113} cy={46} r={12} fill="#f8e5be" />
        <path d="M94 23 H112 M125 23 H132" stroke={s.accent} strokeWidth={4} />
        <rect x={85} y={91} width={58} height={32} rx={3} fill={s.accent} />
        <path d="M89 101 H139 M89 112 H139" stroke="#f5f9f4" strokeWidth={5} />
      </> : v === 'ironing' ? <>
        <rect x={86} y={29} width={51} height={91} rx={23} fill={s.accent} />
        <path d="M95 55 L127 55 L119 82 L96 82 Z" fill={s.main} />
      </> : <>
        <path d="M87 17 V120 M144 17 V120 M84 26 H147 M84 113 H147" fill="none" stroke="#9caaa6" strokeWidth={4} />
        {[39, 62, 85].map((y) => <rect key={y} x={94} y={y} width={43} height={17} rx={2} fill={s.accent} />)}
      </>}
    </>}
    {type === 'closet' && <>
      <rect x={10} y={9} width={140} height={38} rx={3} fill={s.main} />
      {Array.from({ length: 6 }, (_, i) => <path key={i} d={`M${19 + i * 21} 16 h15 l4 22 h-23 Z`} fill={[s.accent, '#e4be70', '#d891a3'][i % 3]} />)}
      {v === 'wardrobe' ? <>
        <rect x={13} y={66} width={51} height={61} rx={3} fill={s.main} />
        {[84, 104].map((y) => <path key={y} d={`M15 ${y} H62 M35 ${y - 10} H45`} fill="none" />)}
      </> : <>
        <ellipse cx={41} cy={91} rx={24} ry={31} fill="#cce5e8" stroke={s.main} strokeWidth={6} />
        {v === 'costume' && <path d="M97 70 L106 83 L119 65 L128 83 L142 70 L138 107 H101 Z" fill="#efcf68" />}
      </>}
      <rect x={85} y={115} width={60} height={15} rx={4} fill={s.accent} />
      {v === 'boutique' && <rect x={94} y={63} width={45} height={37} rx={3} fill={s.main} />}
    </>}
    {type === 'plants' && <>
      <rect x={9} y={10} width={142} height={30} rx={3} fill={s.main} />
      {[[31, 25], [78, 25], [127, 25], [34, 88], [111, 94]].map(([cx, cy], i) => <g key={i}>
        <circle cx={cx} cy={cy} r={i < 3 ? 16 : 24} fill={s.main} />
        {[0, 60, 120].map((a) => <ellipse key={a} cx={cx} cy={cy} rx={i < 3 ? 8 : 11} ry={i < 3 ? 19 : 26} fill={s.accent} stroke="#4b885c" strokeWidth={1} transform={`rotate(${a} ${cx} ${cy})`} />)}
        {v === 'flowers' && <circle cx={cx} cy={cy} r={8} fill="#f8d56f" stroke="#dc849b" strokeWidth={6} />}
      </g>)}
      {v === 'hanging' && <path d="M68 47 Q93 66 70 84 T77 128 M72 63 l-13 -6 M77 79 l16 -4 M68 104 l-14 -4 M72 119 l17 -6" fill="none" stroke={s.accent} strokeWidth={5} />}
    </>}
  </g>
}

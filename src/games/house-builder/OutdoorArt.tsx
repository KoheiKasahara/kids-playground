import { OUTDOOR_EXTRAS, type OutdoorExtraId } from './data'

/** 160×150 の みほんと、そとがわの えで つかう おにわの どうぐ。 */
export function OutdoorArt({ id }: { id: OutdoorExtraId }) {
  return (
    <g aria-label={OUTDOOR_EXTRAS.find((item) => item.id === id)!.name} data-outdoor={id}>
      <ellipse cx={80} cy={141} rx={74} ry={7} fill="#527840" opacity={.2} />
      {id === 'tent' && <>
        <path d="M8 136 L60 32 L148 125 L91 142 Z" fill="#f5b650" stroke="#ac7536" strokeWidth={3} />
        <path d="M60 32 L91 142 L148 125 Z" fill="#d58b35" />
        <path d="M28 135 L60 65 L79 139 Z" fill="#344b54" stroke="#fff0c8" strokeWidth={3} />
        <path d="M38 135 L70 135 L83 146 L25 146 Z" fill="#8fc9b4" />
        <path d="M60 22 V47 M60 32 L7 130 M148 125 L156 137" fill="none" stroke="#fff0c8" strokeWidth={3} />
        <rect x={103} y={104} width={20} height={13} rx={3} fill="#fff0c8" transform="rotate(-12 113 110)" />
      </>}
      {id === 'teepee' && <>
        <path d="M72 12 L89 40 M88 12 L74 40 M80 8 V40" stroke="#957047" strokeWidth={4} strokeLinecap="round" />
        <path d="M80 28 L145 138 Q80 150 15 138 Z" fill="#f4e0b5" stroke="#b58b60" strokeWidth={3} />
        <path d="M80 71 L105 141 Q80 145 55 141 Z" fill="#735749" />
        <path d="M42 96 L51 108 L60 96 M100 96 L109 108 L118 96" fill="none" stroke="#5faeae" strokeWidth={8} />
        <path d="M28 124 L39 132 L49 124 M111 124 L122 132 L133 124" fill="none" stroke="#dc8762" strokeWidth={7} />
      </>}
      {id === 'gazebo' && <>
        <rect x={14} y={131} width={132} height={12} rx={3} fill="#cda878" stroke="#9b704b" strokeWidth={2} />
        {[25, 126].map((x) => <rect key={x} x={x} y={58} width={9} height={76} fill="#ac8159" />)}
        <path d="M7 60 L80 15 L153 60 Z" fill="#67a38d" stroke="#3d7566" strokeWidth={3} />
        <path d="M80 15 L100 60 H153 Z" fill="#4d8977" />
        <rect x={44} y={93} width={72} height={21} rx={3} fill="#ba9063" />
        <rect x={41} y={114} width={78} height={7} rx={2} fill="#a77b52" />
        <path d="M49 120 V131 M111 120 V131" stroke="#8a6345" strokeWidth={6} />
      </>}
      {id === 'slide' && <>
        <path d="M28 135 V54 M58 135 V54 M28 78 H58 M28 99 H58 M28 120 H58" fill="none" stroke="#5d9cbb" strokeWidth={6} strokeLinecap="round" />
        <path d="M30 54 V28 H62 V54" fill="none" stroke="#5d9cbb" strokeWidth={5} />
        <path d="M24 54 H67 L126 128 H149 V140 H120 L60 65 H24 Z" fill="#f58470" stroke="#d06459" strokeWidth={2} />
        <path d="M61 54 L126 130 H148" fill="none" stroke="#ffd36a" strokeWidth={7} strokeLinecap="round" />
      </>}
      {id === 'sandbox' && <>
        <path d="M16 83 L128 76 L150 134 L9 141 Z" fill="#ecd192" stroke="#bc8655" strokeWidth={9} strokeLinejoin="round" />
        <rect x={40} y={91} width={46} height={30} fill="#d9b96f" />
        {[36, 73].map((x) => <g key={x} fill="#e7c983" stroke="#c5a75f" strokeWidth={2}>
          <path d={`M${x} 116 V78 h6 v6 h7 v-6 h6 v38 Z`} />
        </g>)}
        <path d="M98 111 h22 l-3 23 h-16 Z" fill="#ed7765" />
        <path d="M99 111 C99 91 120 91 120 111" fill="none" stroke="#ed7765" strokeWidth={3} />
        <path d="M90 121 L111 138" stroke="#5eacc3" strokeWidth={5} />
        <ellipse cx={113} cy={139} rx={8} ry={4} fill="#5eacc3" />
      </>}
      {id === 'hammock' && <>
        <path d="M14 139 H40 M120 139 H147 M27 137 V45 M133 137 V45" fill="none" stroke="#a37a50" strokeWidth={8} strokeLinecap="round" />
        <path d="M28 55 Q80 118 132 55 L131 80 Q80 151 29 80 Z" fill="#77c8c3" stroke="#398f91" strokeWidth={3} />
        <path d="M28 55 Q80 118 132 55 M29 80 Q80 151 131 80" fill="none" stroke="#fff1c9" strokeWidth={4} />
        <path d="M45 76 L61 88 L53 105 L37 93 Z" fill="#fff1c9" />
        <path d="M72 99 L65 119 M89 99 L96 119" stroke="#edf6cf" strokeWidth={5} />
      </>}
      {id === 'seesaw' && <>
        <path d="M62 136 L80 83 L100 136 Z" fill="#6ca7ad" stroke="#447b86" strokeWidth={3} />
        <path d="M13 68 L147 113" stroke="#e8b75e" strokeWidth={14} strokeLinecap="round" />
        <path d="M28 73 V50 H44 M130 108 V82 H114" fill="none" stroke="#db7c78" strokeWidth={6} strokeLinecap="round" />
        <circle cx={80} cy={91} r={7} fill="#f1db9d" />
      </>}
      {id === 'trampoline' && <>
        <path d="M28 118 V141 M132 118 V141 M48 128 V147 M112 128 V147" stroke="#778b9d" strokeWidth={6} />
        <ellipse cx={80} cy={112} rx={65} ry={23} fill="#374b5d" stroke="#6db6b5" strokeWidth={10} />
        <path d="M18 109 V27 M142 109 V27 M48 129 V42 M112 129 V42" stroke="#778b9d" strokeWidth={4} />
        <path d="M18 27 Q80 52 142 27 V108 Q80 148 18 108 Z" fill="#c8e3e3" fillOpacity={.25} stroke="#7fa4ad" strokeWidth={3} />
        {[35, 55, 75, 95, 115, 135].map((x) => <path key={x} d={`M${x} 42 V119`} stroke="#7fa4ad" opacity={.5} />)}
      </>}
      {id === 'playhouse' && <>
        <rect x={28} y={61} width={105} height={78} rx={3} fill="#f6dca5" stroke="#c7a176" strokeWidth={3} />
        <path d="M15 65 L80 14 L146 65 Z" fill="#dd8c81" stroke="#b56662" strokeWidth={3} />
        <path d="M64 139 V91 Q80 74 96 91 V139" fill="#7fb1b6" stroke="#507e8a" strokeWidth={3} />
        <rect x={36} y={80} width={22} height={25} fill="#b9e2e8" stroke="#ffffff" strokeWidth={4} />
        <rect x={104} y={80} width={22} height={25} fill="#b9e2e8" stroke="#ffffff" strokeWidth={4} />
        <circle cx={88} cy={111} r={3} fill="#f7d76c" />
      </>}
      {id === 'basketball' && <>
        <path d="M15 137 L44 101 H142 L150 137 Z" fill="#cce0bc" stroke="#ffffff" strokeWidth={3} />
        <ellipse cx={83} cy={123} rx={27} ry={9} fill="none" stroke="#ffffff" strokeWidth={3} />
        <path d="M101 125 V29" stroke="#738994" strokeWidth={7} />
        <rect x={57} y={10} width={87} height={55} rx={3} fill="#eff6f3" stroke="#738994" strokeWidth={4} />
        <rect x={82} y={29} width={35} height={25} fill="none" stroke="#da8466" strokeWidth={3} />
        <path d="M82 61 L88 85 H112 L118 61 M91 64 V84 M107 64 V84" fill="none" stroke="#d5cdb6" strokeWidth={2} />
        <ellipse cx={100} cy={60} rx={20} ry={6} fill="none" stroke="#e18c62" strokeWidth={4} />
        <circle cx={36} cy={122} r={15} fill="#ebaa60" stroke="#a56c40" strokeWidth={2} />
        <path d="M21 122 H51 M36 107 Q25 122 36 137 M36 107 Q47 122 36 137" fill="none" stroke="#a56c40" />
      </>}
      {id === 'flowerarch' && <>
        <path d="M28 140 V66 C28 4 132 4 132 66 V140 M40 140 V66 C40 21 120 21 120 66 V140" fill="none" stroke="#baa17a" strokeWidth={7} />
        <path d="M32 131 Q55 106 33 84 Q15 56 53 36 Q83 7 119 43 Q148 65 126 94 Q107 120 131 139" fill="none" stroke="#6fa477" strokeWidth={10} />
        {[[32, 105], [35, 63], [63, 29], [104, 33], [128, 73], [126, 116]].map(([x, y]) => <g key={y}>
          <circle cx={x} cy={y} r={10} fill="#df94ad" /><circle cx={x} cy={y} r={4} fill="#f6d976" />
        </g>)}
      </>}
      {id === 'bench' && <>
        <path d="M31 111 V140 M130 111 V140 M36 84 V122 M126 84 V122" stroke="#5d7975" strokeWidth={7} />
        <rect x={23} y={56} width={116} height={15} rx={3} fill="#c49b6f" />
        <rect x={23} y={77} width={116} height={15} rx={3} fill="#c49b6f" />
        <path d="M22 99 H139 L148 118 H12 Z" fill="#dfb78b" stroke="#a77a52" strokeWidth={3} />
        <path d="M15 90 V110 M146 90 V110" stroke="#5d7975" strokeWidth={7} />
      </>}
      {id === 'bbq' && <>
        <path d="M36 92 L24 140 M92 92 L104 140 M26 125 H101" stroke="#75868c" strokeWidth={6} />
        <path d="M17 62 H111 Q106 111 64 112 Q22 109 17 62" fill="#d9806c" stroke="#9e5e52" strokeWidth={3} />
        <ellipse cx={64} cy={62} rx={48} ry={18} fill="#414a4f" stroke="#7a8b91" strokeWidth={4} />
        {[38, 50, 62, 74, 86].map((x) => <path key={x} d={`M${x} 50 V75`} stroke="#bfc7c4" strokeWidth={2} />)}
        <path d="M38 51 L52 61 M67 59 L81 69" stroke="#e7a46e" strokeWidth={8} strokeLinecap="round" />
        <path d="M44 38 Q35 27 46 14 M79 37 Q67 24 81 8" fill="none" stroke="#b7c9c5" strokeWidth={4} strokeLinecap="round" />
        <path d="M111 82 H155 V94 H111 Z M120 94 V139 M149 94 V139" fill="#d4ae79" stroke="#a0815b" strokeWidth={3} />
      </>}
      {id === 'birdhouse' && <>
        <path d="M81 79 V140 M60 140 H103" stroke="#bc9669" strokeWidth={9} strokeLinecap="round" />
        <path d="M49 42 H112 V92 H49 Z" fill="#f4dda4" stroke="#b69565" strokeWidth={3} />
        <path d="M39 43 L80 11 L123 43 Z" fill="#7ca897" stroke="#528270" strokeWidth={3} />
        <circle cx={80} cy={58} r={13} fill="#655344" />
        <path d="M72 81 H97" stroke="#b69565" strokeWidth={5} strokeLinecap="round" />
        <ellipse cx={126} cy={95} rx={13} ry={9} fill="#dfb86a" /><circle cx={136} cy={86} r={8} fill="#dfb86a" />
        <path d="M142 84 L151 89 L142 91" fill="#dc8a59" /><circle cx={138} cy={84} r={2} fill="#444b4d" />
        <path d="M115 92 L103 82 L107 99" fill="#8baab2" />
      </>}
      {id === 'greenhouse' && <>
        <path d="M20 139 V54 L80 14 L141 54 V139 Z" fill="#c8e8dc" fillOpacity={.7} stroke="#6f9b88" strokeWidth={4} />
        <path d="M20 54 H141 M80 14 V139 M20 96 H141 M49 35 V139 M111 35 V139" fill="none" stroke="#84b19c" strokeWidth={3} />
        {[40, 80, 120].map((x) => <g key={x}>
          <path d={`M${x - 10} 117 h20 l-4 19 h-12 Z`} fill="#c89970" />
          <path d={`M${x} 121 V89 M${x} 106 q-23 -18 -10 -24 M${x} 112 q24 -22 12 -28`} fill="none" stroke="#64a177" strokeWidth={5} />
        </g>)}
        <path d="M64 139 V81 H96 V139" fill="none" stroke="#6f9b88" strokeWidth={4} />
      </>}
      {id === 'yardlights' && <>
        {[39, 120].map((x, i) => <g key={x} transform={`translate(${x} ${i * 10})`}>
          <ellipse cx={0} cy={57} rx={31} ry={35} fill="#ffe7a3" opacity={.35} />
          <path d="M-18 133 H18 M0 133 V77" stroke="#617a78" strokeWidth={7} strokeLinecap="round" />
          <path d="M-14 42 H14 L11 77 H-11 Z" fill="#ffe2a0" stroke="#617a78" strokeWidth={4} />
          <path d="M-21 43 L0 23 L21 43 Z" fill="#617a78" />
          <path d="M-7 22 Q0 7 7 22" fill="none" stroke="#617a78" strokeWidth={3} />
        </g>)}
      </>}
    </g>
  )
}

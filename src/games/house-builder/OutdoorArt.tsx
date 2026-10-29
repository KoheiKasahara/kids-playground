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
    </g>
  )
}

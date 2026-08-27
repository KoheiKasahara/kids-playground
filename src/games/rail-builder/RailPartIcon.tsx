import type { RailPieceKind } from './railModel'

/**
 * パーツ選択トレイ専用のアイコン。実ゲームの3Dモデルとは完全に独立していて、
 * 「形だけで見分けられること」を優先したデフォルメ表現にしている
 * (Issue #221)。実配置される線路の見た目やロジックには一切影響しない。
 */

const RAIL_COLOR = '#697784'
const SLEEPER_COLOR = '#b45309'
const BRANCH_COLOR = '#f59e0b'
const ROOF_COLOR = '#ef6b73'
const TUNNEL_COLOR = '#3730a3'
const MOUNTAIN_COLOR = '#8fa888'
const WATER_COLOR = '#38bdf8'
const PIER_COLOR = '#8b5e34'
const DECK_COLOR = '#6b7280'
const GROUND_COLOR = '#a9c47a'
const PLATFORM_COLOR = '#dcc9a0'
const ARCH_RIM_COLOR = '#c7d2fe'

type RailPartIconProps = {
  kind: RailPieceKind
}

export default function RailPartIcon({ kind }: RailPartIconProps) {
  switch (kind) {
    case 'straight':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
          <line x1="24" y1="2" x2="24" y2="62" stroke={RAIL_COLOR} strokeWidth="6" strokeLinecap="round" />
          <line x1="40" y1="2" x2="40" y2="62" stroke={RAIL_COLOR} strokeWidth="6" strokeLinecap="round" />
          <line x1="18" y1="14" x2="46" y2="14" stroke={SLEEPER_COLOR} strokeWidth="6" strokeLinecap="round" />
          <line x1="18" y1="32" x2="46" y2="32" stroke={SLEEPER_COLOR} strokeWidth="6" strokeLinecap="round" />
          <line x1="18" y1="50" x2="46" y2="50" stroke={SLEEPER_COLOR} strokeWidth="6" strokeLinecap="round" />
        </svg>
      )

    case 'short-straight':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
          <line x1="24" y1="20" x2="24" y2="44" stroke={RAIL_COLOR} strokeWidth="6" strokeLinecap="round" />
          <line x1="40" y1="20" x2="40" y2="44" stroke={RAIL_COLOR} strokeWidth="6" strokeLinecap="round" />
          <line x1="18" y1="24" x2="46" y2="24" stroke={SLEEPER_COLOR} strokeWidth="6" strokeLinecap="round" />
          <line x1="18" y1="32" x2="46" y2="32" stroke={SLEEPER_COLOR} strokeWidth="6" strokeLinecap="round" />
          <line x1="18" y1="40" x2="46" y2="40" stroke={SLEEPER_COLOR} strokeWidth="6" strokeLinecap="round" />
        </svg>
      )

    case 'curve':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
          <path d="M8,60 A52,52 0 0 1 60,8" fill="none" stroke={RAIL_COLOR} strokeWidth="6" strokeLinecap="round" />
          <path d="M24,60 A36,36 0 0 1 60,24" fill="none" stroke={RAIL_COLOR} strokeWidth="6" strokeLinecap="round" />
          <line x1="11.1" y1="42.2" x2="26.2" y2="47.7" stroke={SLEEPER_COLOR} strokeWidth="6" strokeLinecap="round" />
          <line x1="23.2" y1="23.2" x2="34.5" y2="34.5" stroke={SLEEPER_COLOR} strokeWidth="6" strokeLinecap="round" />
          <line x1="42.2" y1="11.1" x2="47.7" y2="26.2" stroke={SLEEPER_COLOR} strokeWidth="6" strokeLinecap="round" />
        </svg>
      )

    case 'branch':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
          <line x1="26" y1="62" x2="26" y2="42" stroke={RAIL_COLOR} strokeWidth="6" strokeLinecap="round" />
          <line x1="38" y1="62" x2="38" y2="42" stroke={RAIL_COLOR} strokeWidth="6" strokeLinecap="round" />
          <line x1="20" y1="52" x2="44" y2="52" stroke={SLEEPER_COLOR} strokeWidth="6" strokeLinecap="round" />
          <path d="M32,42 Q18,28 9,8" fill="none" stroke={RAIL_COLOR} strokeWidth="7" strokeLinecap="round" />
          <path d="M32,42 Q47,28 57,8" fill="none" stroke={BRANCH_COLOR} strokeWidth="7" strokeLinecap="round" />
          <circle cx="32" cy="42" r="5.5" fill={BRANCH_COLOR} />
        </svg>
      )

    case 'slope':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
          <polygon points="4,60 60,60 60,20" fill={GROUND_COLOR} />
          <line x1="14.9" y1="38.7" x2="24.1" y2="49.3" stroke={SLEEPER_COLOR} strokeWidth="5" strokeLinecap="round" />
          <line x1="26.4" y1="28.7" x2="35.6" y2="39.3" stroke={SLEEPER_COLOR} strokeWidth="5" strokeLinecap="round" />
          <line x1="37.9" y1="18.7" x2="47.1" y2="29.3" stroke={SLEEPER_COLOR} strokeWidth="5" strokeLinecap="round" />
          <line x1="8" y1="54" x2="54" y2="14" stroke={RAIL_COLOR} strokeWidth="6" strokeLinecap="round" />
          <path d="M44,18 L52,8 L60,16" fill="none" stroke="#2f6b2f" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )

    case 'bridge':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
          <rect x="2" y="46" width="60" height="13" rx="6" fill={WATER_COLOR} />
          <rect x="14" y="28" width="7" height="20" fill={PIER_COLOR} />
          <rect x="43" y="28" width="7" height="20" fill={PIER_COLOR} />
          <rect x="4" y="22" width="56" height="7" rx="2" fill={DECK_COLOR} />
          <line x1="8" y1="16" x2="56" y2="16" stroke={RAIL_COLOR} strokeWidth="5" strokeLinecap="round" />
          <line x1="8" y1="9" x2="56" y2="9" stroke={RAIL_COLOR} strokeWidth="5" strokeLinecap="round" />
          <line x1="16" y1="9" x2="16" y2="16" stroke={SLEEPER_COLOR} strokeWidth="5" strokeLinecap="round" />
          <line x1="32" y1="9" x2="32" y2="16" stroke={SLEEPER_COLOR} strokeWidth="5" strokeLinecap="round" />
          <line x1="48" y1="9" x2="48" y2="16" stroke={SLEEPER_COLOR} strokeWidth="5" strokeLinecap="round" />
        </svg>
      )

    case 'station':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
          <line x1="6" y1="52" x2="58" y2="52" stroke={RAIL_COLOR} strokeWidth="5" strokeLinecap="round" />
          <line x1="6" y1="59" x2="58" y2="59" stroke={RAIL_COLOR} strokeWidth="5" strokeLinecap="round" />
          <line x1="14" y1="52" x2="14" y2="59" stroke={SLEEPER_COLOR} strokeWidth="5" strokeLinecap="round" />
          <line x1="32" y1="52" x2="32" y2="59" stroke={SLEEPER_COLOR} strokeWidth="5" strokeLinecap="round" />
          <line x1="50" y1="52" x2="50" y2="59" stroke={SLEEPER_COLOR} strokeWidth="5" strokeLinecap="round" />
          <rect x="6" y="36" width="52" height="10" rx="2" fill={PLATFORM_COLOR} />
          <rect x="6" y="34" width="52" height="3" fill="#f4c542" />
          <rect x="14" y="20" width="4" height="14" fill="#8b98a3" />
          <rect x="46" y="20" width="4" height="14" fill="#8b98a3" />
          <path d="M4,20 L32,8 L60,20 Z" fill={ROOF_COLOR} />
        </svg>
      )

    case 'tunnel':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
          <path d="M2,44 Q32,4 62,44 L62,60 L2,60 Z" fill={MOUNTAIN_COLOR} />
          <path
            d="M18,60 L18,34 Q18,16 32,16 Q46,16 46,34 L46,60 Z"
            fill={TUNNEL_COLOR}
            stroke={ARCH_RIM_COLOR}
            strokeWidth="3"
          />
          <line x1="22" y1="59" x2="42" y2="59" stroke={SLEEPER_COLOR} strokeWidth="5" strokeLinecap="round" />
        </svg>
      )

    case 'depot':
      return (
        <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
          <path d="M6,24 L32,6 L58,24 Z" fill={ROOF_COLOR} />
          <rect x="10" y="24" width="44" height="30" rx="3" fill="#e8eef1" stroke="#9fb0ba" strokeWidth="2" />
          <path
            d="M22,54 L22,38 Q22,28 32,28 Q42,28 42,38 L42,54 Z"
            fill={TUNNEL_COLOR}
          />
          <line x1="27" y1="54" x2="27" y2="60" stroke={RAIL_COLOR} strokeWidth="5" strokeLinecap="round" />
          <line x1="37" y1="54" x2="37" y2="60" stroke={RAIL_COLOR} strokeWidth="5" strokeLinecap="round" />
        </svg>
      )

    default:
      return null
  }
}

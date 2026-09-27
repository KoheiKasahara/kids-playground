import type { FloaterKind } from './types'
import styles from './PukupukaRescuePlay.module.css'

// 浮遊物（隊長のアヒルと、助けを待つ仲間）の絵だけを持つモジュール。
//
// どの絵も「当たり判定の半径が8」の座標で描き、呼び出し側で半径に合わせて縮める。
// 右向きで描き、左へ進むときは呼び出し側で左右反転する。水に浮いたときは下の約4割が水に入る。
// 小さな画面でも見分けられるよう、はっきりした輪郭線とシルエットの違いを優先する。

type Mood = 'leader' | 'waiting' | 'happy'

const INK = '#3b2a1e'

/** 目。happy はにっこりの弧、waiting は少し困った眉つき。 */
function Eye({ x, y, mood, size = 1 }: { x: number; y: number; mood: Mood; size?: number }) {
  if (mood === 'happy') {
    return (
      <path
        d={`M${x - 1.2 * size} ${y + 0.3 * size} Q${x} ${y - 1.3 * size} ${x + 1.2 * size} ${y + 0.3 * size}`}
        fill="none"
        stroke={INK}
        strokeWidth={0.75 * size}
        strokeLinecap="round"
      />
    )
  }
  return (
    <g>
      <ellipse cx={x} cy={y} rx={1.05 * size} ry={1.35 * size} fill={INK} />
      <circle cx={x + 0.35 * size} cy={y - 0.5 * size} r={0.42 * size} fill="#ffffff" />
      {mood === 'waiting' ? (
        <path
          d={`M${x - 1.1 * size} ${y - 2.3 * size} L${x + 0.9 * size} ${y - 2.9 * size}`}
          stroke={INK}
          strokeWidth={0.55 * size}
          strokeLinecap="round"
        />
      ) : null}
    </g>
  )
}

function Blush({ x, y, r = 1.2 }: { x: number; y: number; r?: number }) {
  return <ellipse cx={x} cy={y} rx={r} ry={r * 0.7} fill="#ff8fa3" opacity="0.6" />
}

/** レスキュー隊長のアヒル。赤い隊長ぼうしで、仲間と見分ける。 */
function Duck({ mood }: { mood: Mood }) {
  return (
    <g>
      <path d="M-8.6 -0.6 Q-12.4 -5.4 -10.6 -8.4 Q-8 -4.8 -5.6 -3.4 Z" fill="url(#pukupuka-duck)" stroke="#c46f00" strokeWidth="0.6" strokeLinejoin="round" />
      <path
        d="M-9.2 0.8 Q-9.4 -5 -3 -4.6 L1.8 -4 Q9.6 -4.6 10 1.6 Q9.8 7.8 0.4 7.8 Q-9 7.8 -9.2 0.8 Z"
        fill="url(#pukupuka-duck)"
        stroke="#c46f00"
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
      <path d="M-5.6 0.6 Q-1.4 -2.4 3.4 0.4 Q0 4.6 -5.6 0.6 Z" fill="#f7b500" opacity="0.8" />
      <path d="M-6.6 -2.6 Q-3 -4 1 -3.2" fill="none" stroke="#fffbe0" strokeWidth="1.1" strokeLinecap="round" opacity="0.8" />
      <circle cx="4.6" cy="-6.4" r="5.1" fill="url(#pukupuka-duck)" stroke="#c46f00" strokeWidth="0.6" />
      <path d="M8.8 -7.4 Q13.4 -7.4 13.6 -5.8 Q13.2 -4.1 9 -4.4 Z" fill="#ff8a2a" stroke="#c4540d" strokeWidth="0.5" strokeLinejoin="round" />
      <path d="M9.4 -5.8 H12.8" stroke="#c4540d" strokeWidth="0.4" strokeLinecap="round" />
      <Eye x={6} y={-7.4} mood={mood} />
      <Blush x={4.2} y={-4.6} />
      {/* 隊長ぼうし */}
      <path d="M0.2 -9.6 Q4.2 -14.6 9 -10.2 Z" fill="#f03e3e" stroke="#a51d1d" strokeWidth="0.5" strokeLinejoin="round" />
      <path d="M8.2 -10.4 Q11.6 -10.4 12.4 -9 Q10 -8.6 8 -9.6 Z" fill="#c92a2a" />
      <path d="M4.3 -13 V-10.6 M3.1 -11.8 H5.5" stroke="#ffffff" strokeWidth="0.8" strokeLinecap="round" />
    </g>
  )
}

/** ひよこ。水色の浮き輪にすっぽり入った、まるいシルエット。 */
function Chick({ mood }: { mood: Mood }) {
  return (
    <g>
      <ellipse cx="0" cy="3.4" rx="9.6" ry="3.8" fill="#1c7ed6" />
      <circle cx="0" cy="-1.4" r="7" fill="url(#pukupuka-chick)" stroke="#d49a00" strokeWidth="0.6" />
      <path d="M-1.2 -8.2 Q-1.4 -11.4 0.6 -11.8 M0.4 -8.4 Q1.6 -10.8 3.8 -10.6" fill="none" stroke="#e0a800" strokeWidth="0.8" strokeLinecap="round" />
      <path d="M-5.2 -0.4 Q-7.6 0.4 -6.4 2.6" fill="none" stroke="#e0a800" strokeWidth="0.7" strokeLinecap="round" />
      <Eye x={0.6} y={-2.6} mood={mood} size={0.95} />
      <Eye x={4.4} y={-2.6} mood={mood} size={0.95} />
      <path d="M2.2 -1.2 L4.4 -0.2 L2.2 0.8 Z" fill="#ff8a2a" stroke="#c4540d" strokeWidth="0.35" strokeLinejoin="round" />
      <Blush x={-1} y={0.4} r={1} />
      <Blush x={5.8} y={0.4} r={0.8} />
      {/* 浮き輪の手前半分 */}
      <path d="M-9.6 3.4 Q-9.4 7.8 0 7.8 Q9.4 7.8 9.6 3.4 Q9 5.6 0 5.8 Q-9 5.6 -9.6 3.4 Z" fill="#4dabf7" stroke="#1864ab" strokeWidth="0.5" />
      <path d="M-6.4 5.5 Q-5.9 7.2 -4.8 7.6 M-0.8 5.9 V7.8 M4.8 5.6 Q5.4 7.2 6.4 7.5" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
    </g>
  )
}

/** 浮き輪+くま。赤白の輪っかから、くまが顔と手を出している。 */
function RingBear({ mood }: { mood: Mood }) {
  return (
    <g>
      <ellipse cx="0" cy="3.2" rx="9.4" ry="4" fill="#c92a2a" />
      <circle cx="-4.4" cy="-9" r="2.3" fill="url(#pukupuka-bear)" stroke="#7a4a24" strokeWidth="0.5" />
      <circle cx="4.4" cy="-9" r="2.3" fill="url(#pukupuka-bear)" stroke="#7a4a24" strokeWidth="0.5" />
      <circle cx="-4.4" cy="-9" r="1.1" fill="#f3c9a0" />
      <circle cx="4.4" cy="-9" r="1.1" fill="#f3c9a0" />
      <path d="M-5 3 Q-6 -2 -4.6 -4 L4.6 -4 Q6 -2 5 3 Z" fill="url(#pukupuka-bear)" stroke="#7a4a24" strokeWidth="0.5" />
      <circle cx="0" cy="-4.8" r="5.6" fill="url(#pukupuka-bear)" stroke="#7a4a24" strokeWidth="0.55" />
      <ellipse cx="1.1" cy="-3" rx="2.8" ry="2" fill="#f7dcc0" />
      <ellipse cx="1.7" cy="-3.8" rx="0.95" ry="0.7" fill={INK} />
      <path d="M1.7 -3.1 V-2.3 M0.7 -2 Q1.7 -1.4 2.7 -2" fill="none" stroke={INK} strokeWidth="0.4" strokeLinecap="round" />
      <Eye x={-1.4} y={-5.6} mood={mood} size={0.8} />
      <Eye x={3.4} y={-5.6} mood={mood} size={0.8} />
      <Blush x={-2.6} y={-3.2} r={0.9} />
      {/* 浮き輪の手前半分と、輪にかけた手 */}
      <path d="M-9.4 3.2 Q-9.2 8 0 8 Q9.2 8 9.4 3.2 Q8.8 5.8 0 6 Q-8.8 5.8 -9.4 3.2 Z" fill="#ff6b6b" stroke="#a51d1d" strokeWidth="0.5" />
      <path d="M-6.8 5.7 Q-6.2 7.4 -5 7.8 M4.2 6 Q4.8 7.6 5.8 7.7" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
      <ellipse cx="-3.4" cy="4.4" rx="1.6" ry="1.2" fill="url(#pukupuka-bear)" stroke="#7a4a24" strokeWidth="0.45" />
      <ellipse cx="3.4" cy="4.4" rx="1.6" ry="1.2" fill="url(#pukupuka-bear)" stroke="#7a4a24" strokeWidth="0.45" />
    </g>
  )
}

/** 木のボートに乗ったねこ。横に長い船体で、ほかの仲間と一目で見分けられる。 */
function CatBoat({ mood }: { mood: Mood }) {
  return (
    <g>
      <rect x="-9.6" y="-12.4" width="0.9" height="11" rx="0.45" fill="#8d6e4f" />
      <path d="M-8.7 -12.2 L-4.2 -10.6 L-8.7 -9 Z" fill="#ffd43b" stroke="#e67700" strokeWidth="0.35" />
      {/* ねこ */}
      <path d="M-3.4 -7.8 L-3 -12 L-0.2 -9.4 Z M3.2 -7.8 L3 -12 L0.2 -9.4 Z" fill="#ffa94d" stroke="#b35c00" strokeWidth="0.5" strokeLinejoin="round" />
      <path d="M-2.6 -9 L-2.4 -10.9 L-1.1 -9.7 Z M2.6 -9 L2.4 -10.9 L1.1 -9.7 Z" fill="#ffc9c9" />
      <ellipse cx="0" cy="-5.4" rx="5" ry="4.4" fill="url(#pukupuka-cat)" stroke="#b35c00" strokeWidth="0.55" />
      <path d="M-1 -9.6 L-0.6 -8 M0.8 -9.6 L0.6 -8" stroke="#d9480f" strokeWidth="0.6" strokeLinecap="round" />
      <Eye x={-1.6} y={-5.8} mood={mood} size={0.8} />
      <Eye x={2.4} y={-5.8} mood={mood} size={0.8} />
      <path d="M0.4 -4.4 L1 -3.8 L1.6 -4.4 Z" fill="#e8590c" />
      <path d="M1 -3.8 Q0.3 -3 -0.4 -3.5 M1 -3.8 Q1.7 -3 2.4 -3.5" fill="none" stroke={INK} strokeWidth="0.35" strokeLinecap="round" />
      <path d="M3.4 -4.2 H6.4 M3.4 -3.4 L6.2 -2.6 M-2.4 -4.2 H-5.2" stroke={INK} strokeWidth="0.3" opacity="0.7" />
      <Blush x={-2.6} y={-3.6} r={0.8} />
      {/* 船体 */}
      <path
        d="M-12.6 -1.6 L12.6 -1.6 Q13.8 3.6 7.6 7.6 L-7.6 7.6 Q-13.8 3.6 -12.6 -1.6 Z"
        fill="url(#pukupuka-boat-hull)"
        stroke="#5c3a1a"
        strokeWidth="0.65"
        strokeLinejoin="round"
      />
      <path d="M-11.8 1.8 H11.8 M-10 4.9 H10" stroke="#6b4423" strokeWidth="0.45" opacity="0.6" />
      <rect x="-13" y="-2.8" width="26" height="2" rx="1" fill="#e7b073" stroke="#5c3a1a" strokeWidth="0.5" />
      <circle cx="7.4" cy="2.8" r="1.4" fill="#e7f5ff" stroke="#5c3a1a" strokeWidth="0.45" />
      <path d="M-3.6 -1.2 Q-3 -3.4 -1.6 -2.6 M3.6 -1.2 Q3 -3.4 1.6 -2.6" fill="#ffa94d" stroke="#b35c00" strokeWidth="0.45" />
    </g>
  )
}

/** はっぱの上のかえる。 */
function Frog({ mood }: { mood: Mood }) {
  return (
    <g>
      <path d="M-11 4.6 Q-11 1.6 0 1.6 Q11 1.6 11 4.6 Q11 8 0 8 Q-11 8 -11 4.6 Z" fill="url(#pukupuka-leaf)" stroke="#2b8a3e" strokeWidth="0.55" />
      <path d="M8 3 L11.2 4.2 L7.6 5.4 Z" fill="#8fd694" />
      <path d="M-8 4.8 Q-2 3.6 5 4.4 M-4 6.6 Q0 5 3 3" fill="none" stroke="#2b8a3e" strokeWidth="0.4" opacity="0.6" />
      <ellipse cx="-4.8" cy="2.6" rx="2.6" ry="1.4" fill="#51cf66" stroke="#2b8a3e" strokeWidth="0.45" />
      <path d="M-6.4 -1 Q-7 -6.6 0 -6.8 Q7 -6.6 6.4 -1 Q6 3.4 0 3.4 Q-6 3.4 -6.4 -1 Z" fill="url(#pukupuka-frog)" stroke="#2b8a3e" strokeWidth="0.6" />
      <ellipse cx="0.6" cy="0.4" rx="3.6" ry="2.4" fill="#d3f9d8" />
      <circle cx="-2" cy="-6.4" r="2.6" fill="url(#pukupuka-frog)" stroke="#2b8a3e" strokeWidth="0.55" />
      <circle cx="3.4" cy="-6.4" r="2.6" fill="url(#pukupuka-frog)" stroke="#2b8a3e" strokeWidth="0.55" />
      <circle cx="-2" cy="-6.6" r="1.7" fill="#ffffff" />
      <circle cx="3.4" cy="-6.6" r="1.7" fill="#ffffff" />
      <Eye x={-1.6} y={-6.5} mood={mood} size={0.75} />
      <Eye x={3.8} y={-6.5} mood={mood} size={0.75} />
      <path d="M-2.2 -2.6 Q1 -0.4 4.6 -2.6" fill="none" stroke="#2b8a3e" strokeWidth="0.55" strokeLinecap="round" />
      <Blush x={-3.8} y={-2.4} r={0.9} />
      <Blush x={5.6} y={-2.4} r={0.8} />
      <ellipse cx="4.4" cy="2.8" rx="1.8" ry="1" fill="#51cf66" stroke="#2b8a3e" strokeWidth="0.4" />
    </g>
  )
}

/** 小さな氷のうきに乗ったペンギン。 */
function Penguin({ mood }: { mood: Mood }) {
  return (
    <g>
      <path d="M-10.4 2.4 L10 2.4 L8.6 8 L-9 8 Z" fill="url(#pukupuka-ice)" stroke="#4dabf7" strokeWidth="0.55" strokeLinejoin="round" />
      <path d="M-8 3.6 L-2 3.6 M2 5.6 L6.8 5.6" stroke="#ffffff" strokeWidth="0.8" strokeLinecap="round" />
      <ellipse cx="-2" cy="2.6" rx="2" ry="0.9" fill="#ff922b" stroke="#c4540d" strokeWidth="0.35" />
      <ellipse cx="2.6" cy="2.6" rx="2" ry="0.9" fill="#ff922b" stroke="#c4540d" strokeWidth="0.35" />
      <path d="M-5.6 -2 Q-6 -11.4 0.4 -11.4 Q6.4 -11.4 6 -2 Q5.8 3 0.2 3 Q-5.4 3 -5.6 -2 Z" fill="url(#pukupuka-penguin)" stroke="#111418" strokeWidth="0.5" />
      <path d="M-3.2 -1.2 Q-3.6 -7.6 1.2 -7.8 Q5.2 -7.6 4.6 -1.2 Q4.2 2.4 0.8 2.4 Q-2.8 2.4 -3.2 -1.2 Z" fill="#ffffff" />
      <path d="M-5.4 -3.6 Q-8.6 -1 -6.8 1.4 Q-5.4 -0.4 -4.8 -1.6 Z" fill="#343a40" />
      <Eye x={-0.2} y={-7.6} mood={mood} size={0.8} />
      <Eye x={3.4} y={-7.6} mood={mood} size={0.8} />
      <path d="M1.6 -6.6 L5.8 -5.6 L1.8 -4.6 Z" fill="#ff922b" stroke="#c4540d" strokeWidth="0.35" strokeLinejoin="round" />
      <Blush x={-1.2} y={-5} r={0.9} />
      <Blush x={4.8} y={-4.4} r={0.7} />
    </g>
  )
}

export function CharacterShape({ kind, mood }: { kind: FloaterKind; mood: Mood }) {
  if (kind === 'boat') return <CatBoat mood={mood} />
  if (kind === 'ringBear') return <RingBear mood={mood} />
  if (kind === 'chick') return <Chick mood={mood} />
  if (kind === 'frog') return <Frog mood={mood} />
  if (kind === 'penguin') return <Penguin mood={mood} />
  return <Duck mood={mood} />
}

/** 上部の「なかま」表示用の小さなアイコン。ステージSVGのグラデーション定義を共有する。 */
export function FriendIcon({ kind }: { kind: FloaterKind }) {
  return (
    <svg className={styles.friendIcon} viewBox="-14 -14 28 24" aria-hidden="true" focusable="false">
      <CharacterShape kind={kind} mood="happy" />
    </svg>
  )
}

/** キャラクター用のグラデーション。ステージSVGの<defs>に1回だけ置く。 */
export function CharacterDefs() {
  return (
    <>
      <radialGradient id="pukupuka-duck" cx="35%" cy="25%" r="80%">
        <stop offset="0%" stopColor="#fff8c2" />
        <stop offset="45%" stopColor="#ffd43b" />
        <stop offset="100%" stopColor="#f59f00" />
      </radialGradient>
      <radialGradient id="pukupuka-chick" cx="35%" cy="25%" r="80%">
        <stop offset="0%" stopColor="#fffde8" />
        <stop offset="55%" stopColor="#ffec80" />
        <stop offset="100%" stopColor="#fcc419" />
      </radialGradient>
      <linearGradient id="pukupuka-boat-hull" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#d9955a" />
        <stop offset="100%" stopColor="#8a5a2b" />
      </linearGradient>
      <radialGradient id="pukupuka-bear" cx="35%" cy="30%" r="80%">
        <stop offset="0%" stopColor="#e6b983" />
        <stop offset="100%" stopColor="#a0683c" />
      </radialGradient>
      <radialGradient id="pukupuka-cat" cx="35%" cy="30%" r="80%">
        <stop offset="0%" stopColor="#ffe8cc" />
        <stop offset="100%" stopColor="#ffa94d" />
      </radialGradient>
      <radialGradient id="pukupuka-frog" cx="35%" cy="25%" r="85%">
        <stop offset="0%" stopColor="#b2f2bb" />
        <stop offset="100%" stopColor="#37b24d" />
      </radialGradient>
      <linearGradient id="pukupuka-leaf" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#69db7c" />
        <stop offset="100%" stopColor="#2f9e44" />
      </linearGradient>
      <radialGradient id="pukupuka-penguin" cx="35%" cy="25%" r="85%">
        <stop offset="0%" stopColor="#5c6670" />
        <stop offset="100%" stopColor="#1b1f24" />
      </radialGradient>
      <linearGradient id="pukupuka-ice" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="100%" stopColor="#a5d8ff" />
      </linearGradient>
    </>
  )
}

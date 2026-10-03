import type { CSSProperties } from 'react'
import { COLORS, type AnimalId, type Card, type ColorId } from './onajiPonGame'
import styles from './OnajiPonPlay.module.css'

const INK = '#2b2d42'
const SHINE = 'rgba(255, 255, 255, 0.92)'
const SOFT = 'rgba(255, 255, 255, 0.55)'

type FaceProps = { animal: AnimalId; color: ColorId }

/**
 * どうぶつの かお。かお ぜんたいを カードの いろで ぬるので、
 * 「どうぶつ」と「いろ」の 2つが ひとめで わかる（えもじの もともとの いろに まどわされない）。
 */
export function AnimalFace({ animal, color }: FaceProps) {
  const { fill, dark } = COLORS[color]
  const line = { stroke: dark, strokeWidth: 3.5, strokeLinejoin: 'round' as const }
  const eyes = (y: number, gap = 11) => (
    <>
      <ellipse cx={50 - gap} cy={y} rx={4.2} ry={5} fill={INK} />
      <ellipse cx={50 + gap} cy={y} rx={4.2} ry={5} fill={INK} />
      <circle cx={50 - gap + 1.4} cy={y - 1.8} r={1.5} fill="#fff" />
      <circle cx={50 + gap + 1.4} cy={y - 1.8} r={1.5} fill="#fff" />
    </>
  )
  const cheeks = (y: number) => (
    <>
      <ellipse cx={27} cy={y} rx={6} ry={4} fill={SOFT} />
      <ellipse cx={73} cy={y} rx={6} ry={4} fill={SOFT} />
    </>
  )

  return (
    <svg className={styles.face} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      {animal === 'dog' ? (
        <>
          <circle cx={50} cy={55} r={31} fill={fill} {...line} />
          <ellipse cx={21} cy={52} rx={11} ry={23} transform="rotate(16 21 52)" fill={dark} />
          <ellipse cx={79} cy={52} rx={11} ry={23} transform="rotate(-16 79 52)" fill={dark} />
          {eyes(50)}
          {cheeks(64)}
          <ellipse cx={50} cy={69} rx={15} ry={11} fill={SHINE} />
          <ellipse cx={50} cy={63} rx={6} ry={4.5} fill={INK} />
          <path d="M43 70 Q50 77 57 70" fill="none" stroke={INK} strokeWidth={2.6} strokeLinecap="round" />
          <path d="M47 74 Q50 82 53 74 Z" fill="#ff8fa3" />
        </>
      ) : null}
      {animal === 'cat' ? (
        <>
          <polygon points="17,46 25,9 49,30" fill={fill} {...line} />
          <polygon points="83,46 75,9 51,30" fill={fill} {...line} />
          <polygon points="25,36 28,20 39,29" fill={SOFT} />
          <polygon points="75,36 72,20 61,29" fill={SOFT} />
          <ellipse cx={50} cy={58} rx={34} ry={29} fill={fill} {...line} />
          {eyes(55, 12)}
          {cheeks(67)}
          <polygon points="46,64 54,64 50,68.5" fill={INK} />
          <path d="M41 71 Q45.5 76 50 71 Q54.5 76 59 71" fill="none" stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
          <g stroke={INK} strokeWidth={1.8} strokeLinecap="round" opacity={0.75}>
            <line x1={29} y1={63} x2={11} y2={59} />
            <line x1={29} y1={68} x2={11} y2={70} />
            <line x1={71} y1={63} x2={89} y2={59} />
            <line x1={71} y1={68} x2={89} y2={70} />
          </g>
        </>
      ) : null}
      {animal === 'rabbit' ? (
        <>
          <ellipse cx={37} cy={25} rx={9.5} ry={23} transform="rotate(-9 37 25)" fill={fill} {...line} />
          <ellipse cx={63} cy={25} rx={9.5} ry={23} transform="rotate(9 63 25)" fill={fill} {...line} />
          <ellipse cx={37} cy={26} rx={4} ry={15} transform="rotate(-9 37 26)" fill={SOFT} />
          <ellipse cx={63} cy={26} rx={4} ry={15} transform="rotate(9 63 26)" fill={SOFT} />
          <circle cx={50} cy={64} r={29} fill={fill} {...line} />
          {eyes(60, 11)}
          {cheeks(72)}
          <ellipse cx={50} cy={69.5} rx={3.8} ry={2.8} fill={INK} />
          <path d="M50 72 L50 75.5 M50 75.5 Q45.5 80 42 76.5 M50 75.5 Q54.5 80 58 76.5" fill="none" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
        </>
      ) : null}
      {animal === 'bear' ? (
        <>
          <circle cx={25} cy={30} r={12.5} fill={fill} {...line} />
          <circle cx={75} cy={30} r={12.5} fill={fill} {...line} />
          <circle cx={25} cy={30} r={6} fill={SOFT} />
          <circle cx={75} cy={30} r={6} fill={SOFT} />
          <circle cx={50} cy={56} r={31} fill={fill} {...line} />
          {eyes(51, 12)}
          {cheeks(65)}
          <ellipse cx={50} cy={68} rx={14} ry={11} fill={SHINE} />
          <ellipse cx={50} cy={63} rx={6.5} ry={4.8} fill={INK} />
          <path d="M44.5 70.5 Q50 75.5 55.5 70.5" fill="none" stroke={INK} strokeWidth={2.6} strokeLinecap="round" />
        </>
      ) : null}
    </svg>
  )
}

function cardStyle(color: ColorId): CSSProperties {
  const { fill, dark, light } = COLORS[color]
  return { '--card-fill': fill, '--card-dark': dark, '--card-light': light } as CSSProperties
}

/** カードの おもて。すみの ちいさな かおは、かさなって したが かくれていても なにか わかるように する。 */
export function CardFront({ card }: { card: Pick<Card, 'color' | 'animal'> }) {
  return (
    <span className={styles.cardFront} style={cardStyle(card.color)}>
      <span className={styles.corner}>
        <AnimalFace animal={card.animal} color={card.color} />
      </span>
      <span className={styles.art}>
        <AnimalFace animal={card.animal} color={card.color} />
      </span>
    </span>
  )
}

/** カードの うら（やま）。 */
export function CardBack() {
  return (
    <span className={styles.cardBack} aria-hidden="true">
      <span className={styles.backEmblem}>
        <svg viewBox="0 0 100 100" focusable="false">
          {/* にくきゅう */}
          <ellipse cx={50} cy={62} rx={20} ry={16} fill="#fff" />
          <circle cx={27} cy={40} r={8.5} fill="#fff" />
          <circle cx={42} cy={29} r={8.5} fill="#fff" />
          <circle cx={58} cy={29} r={8.5} fill="#fff" />
          <circle cx={73} cy={40} r={8.5} fill="#fff" />
        </svg>
      </span>
    </span>
  )
}

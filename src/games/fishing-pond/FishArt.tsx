import { useId } from 'react'
import type { Fish } from './fishingGame'

/** 外部素材を使わない、輪郭と模様でも見分けられる魚のイラスト。 */
export default function FishArt({ fish }: { fish: Fish }) {
  const clipId = useId()
  const body = fish.shape === 'round'
    ? 'M30 50 C30 10 109 9 113 49 C115 88 31 93 30 50Z'
    : fish.shape === 'diamond'
      ? 'M27 50 Q57 3 76 13 Q91 23 112 50 Q87 76 76 86 Q56 96 27 50Z'
      : fish.shape === 'tall'
        ? 'M38 25 Q62 7 90 25 Q110 40 110 50 Q109 72 88 81 Q55 96 38 75 L32 62 L38 52 L32 40Z'
        : 'M27 50 C47 13 105 19 116 50 C106 82 48 88 27 50Z'
  return (
    <svg viewBox="0 0 140 100" aria-hidden="true" focusable="false">
      <defs><clipPath id={clipId}><path d={body} /></clipPath></defs>
      <g stroke="#28566c" strokeWidth="2.5" strokeLinejoin="round">
        {fish.shape === 'tall' ? (
          <>
            <path d="M59 25 Q47 -3 74 5 L83 28 M60 76 Q48 103 74 95 L84 76" fill={fish.color} />
            <path d="M42 34 L29 29 L23 49 L30 72 L43 65Z" fill={fish.accent} />
          </>
        ) : (
          <>
            <path d="M37 46 Q19 30 9 33 Q16 50 9 68 Q23 68 37 55Z" fill={fish.id === 'tang' ? fish.accent : fish.color} />
            <path d="M54 31 Q59 8 78 24 L84 33 M54 70 Q59 91 79 77 L85 66" fill={fish.color} />
          </>
        )}
        <path d={body} fill={fish.color} />
        <g clipPath={`url(#${clipId})`} stroke="none">
          <ellipse cx="78" cy="76" rx="46" ry="20" fill={fish.accent} opacity="0.5" />
          {fish.pattern === 'stripes' && <path d="M43 17 Q54 50 43 83 M78 13 Q68 50 80 87" fill="none" stroke={fish.accent} strokeWidth={fish.id === 'clownfish' ? 11 : 7} />}
          {fish.pattern === 'patch' && <path d="M38 47 Q59 16 92 32 L82 43 Q60 35 54 53 Q69 63 83 51 L81 66 Q53 76 38 47Z" fill="#28566c" />}
          {fish.pattern === 'dots' && [45, 62, 79].map((x, i) => <circle key={x} cx={x} cy={33 + (i % 2) * 10} r={fish.shape === 'round' ? 3 : 2} fill="#a36c45" opacity="0.65" />)}
        </g>
        <path d="M65 53 Q47 49 54 66 Q65 64 69 57" fill={fish.accent} strokeWidth="2" />
        <circle cx="96" cy="42" r="7" fill="white" strokeWidth="2" />
        <circle cx="98" cy="43" r="3.5" fill="#243c50" stroke="none" />
        <circle cx="99" cy="41" r="1.2" fill="white" stroke="none" />
        <path d="M102 57 Q108 63 112 56" fill="none" strokeWidth="2" strokeLinecap="round" />
      </g>
    </svg>
  )
}

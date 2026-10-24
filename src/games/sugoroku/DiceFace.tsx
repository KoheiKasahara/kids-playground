/** サイコロの めの てんの ばしょ（0〜100 の ます）。 */
const PIPS: Record<number, readonly (readonly [number, number])[]> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[26, 26], [50, 50], [74, 74]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[26, 26], [74, 26], [50, 50], [26, 74], [74, 74]],
  6: [[28, 24], [72, 24], [28, 50], [72, 50], [28, 76], [72, 76]],
}

function dicePips(value: number): readonly (readonly [number, number])[] {
  return PIPS[value] ?? PIPS[1]!
}

export default function DiceFace({ value, className }: { value: number; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden="true" data-dice={value}>
      <rect x={5} y={7} width={90} height={90} rx={20} fill="rgb(0 0 0 / .16)" />
      <rect x={4} y={3} width={90} height={90} rx={20} fill="#fffdf8" stroke="#4a3a33" strokeWidth={4} />
      {dicePips(value).map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x - 1} cy={y - 2} r={value === 1 ? 13 : 9} fill={value === 1 ? '#e0473f' : '#4a3a33'} />
      ))}
    </svg>
  )
}

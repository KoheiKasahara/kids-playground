/** Offsets and radii in road half-widths, shared by drawing and meteor contacts. */
export function formation(count: number, center: number) {
  const size = 0.118 / (1 + Math.max(0, count - 5) * 0.004)
  const stars = [{ x: center, depth: 0, radius: size }]
  for (let row = 0; stars.length < count; row++) {
    const members = Math.min(count - stars.length, 2 + row)
    const scale = 1 / (1.18 + row * 0.22)
    const spacing = size * 2.2 * scale
    const edge = Math.max(0, 1 - spacing * (members - 1) / 2 - size * scale)
    const mid = Math.max(-edge, Math.min(edge, center))
    for (let i = 0; i < members; i++) {
      stars.push({ x: mid + (i - (members - 1) / 2) * spacing,
        depth: (0.84 + row * 0.55) / (1 + row * 0.13), radius: size * 0.84 * scale })
    }
  }
  return stars
}

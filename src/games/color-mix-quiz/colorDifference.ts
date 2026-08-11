/**
 * Perceptual colour distance for quiz swatches.
 *
 * Plain RGB euclidean distance does not match how humans actually tell two colours apart:
 * two hues can be far apart in RGB numbers yet look almost identical, or close in RGB numbers
 * yet look obviously different (this is especially true for very dark or very light colours).
 * CIEDE2000 (ΔE2000) is the standard perceptual metric, so every "are these swatches easy enough
 * to tell apart" threshold in this game is expressed in ΔE2000, not RGB distance.
 */

export type Lab = { L: number; a: number; b: number }

const HEX_PATTERN = /^#([0-9a-f]{6})$/i

// sRGB D65 white point.
const WHITE_X = 95.047
const WHITE_Y = 100.0
const WHITE_Z = 108.883

function invCompand(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
}

const EPSILON = 216 / 24389
const KAPPA = 24389 / 27

function labF(t: number): number {
  return t > EPSILON ? Math.cbrt(t) : (KAPPA * t + 16) / 116
}

/** Parses `#rrggbb` (case-insensitive) into CIE Lab (D65). Returns undefined for malformed input. */
export function labFromHex(hex: string): Lab | undefined {
  const match = HEX_PATTERN.exec(hex)
  if (!match) return undefined
  const value = match[1]
  const r = invCompand(Number.parseInt(value.slice(0, 2), 16) / 255)
  const g = invCompand(Number.parseInt(value.slice(2, 4), 16) / 255)
  const b = invCompand(Number.parseInt(value.slice(4, 6), 16) / 255)

  const x = 100 * (r * 0.4124564 + g * 0.3575761 + b * 0.1804375)
  const y = 100 * (r * 0.2126729 + g * 0.7151522 + b * 0.072175)
  const z = 100 * (r * 0.0193339 + g * 0.119192 + b * 0.9503041)

  const fx = labF(x / WHITE_X)
  const fy = labF(y / WHITE_Y)
  const fz = labF(z / WHITE_Z)

  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) }
}

const DEG_TO_RAD = Math.PI / 180
const RAD_TO_DEG = 180 / Math.PI

function atanDeg(y: number, x: number): number {
  const degrees = Math.atan2(y, x) * RAD_TO_DEG
  return degrees < 0 ? degrees + 360 : degrees
}

/** CIEDE2000 colour difference between two Lab colours, with kL = kC = kH = 1 (Sharma/Westland formulation). */
export function deltaE2000Lab(first: Lab, second: Lab): number {
  const { L: L1, a: a1, b: b1 } = first
  const { L: L2, a: a2, b: b2 } = second

  const c1 = Math.hypot(a1, b1)
  const c2 = Math.hypot(a2, b2)
  const cBar = (c1 + c2) / 2
  const cBar7 = cBar ** 7
  const g = 0.5 * (1 - Math.sqrt(cBar7 / (cBar7 + 25 ** 7)))

  const a1p = a1 * (1 + g)
  const a2p = a2 * (1 + g)
  const c1p = Math.hypot(a1p, b1)
  const c2p = Math.hypot(a2p, b2)

  const h1p = a1p === 0 && b1 === 0 ? 0 : atanDeg(b1, a1p)
  const h2p = a2p === 0 && b2 === 0 ? 0 : atanDeg(b2, a2p)

  const deltaLp = L2 - L1
  const deltaCp = c2p - c1p

  let deltaHp: number
  if (c1p * c2p === 0) {
    deltaHp = 0
  } else if (Math.abs(h2p - h1p) <= 180) {
    deltaHp = h2p - h1p
  } else if (h2p - h1p > 180) {
    deltaHp = h2p - h1p - 360
  } else {
    deltaHp = h2p - h1p + 360
  }
  const deltaHCapp = 2 * Math.sqrt(c1p * c2p) * Math.sin((deltaHp * DEG_TO_RAD) / 2)

  const lBarp = (L1 + L2) / 2
  const cBarp = (c1p + c2p) / 2

  let hBarp: number
  if (c1p * c2p === 0) {
    hBarp = h1p + h2p
  } else if (Math.abs(h1p - h2p) <= 180) {
    hBarp = (h1p + h2p) / 2
  } else if (h1p + h2p < 360) {
    hBarp = (h1p + h2p + 360) / 2
  } else {
    hBarp = (h1p + h2p - 360) / 2
  }

  const t =
    1 -
    0.17 * Math.cos((hBarp - 30) * DEG_TO_RAD) +
    0.24 * Math.cos(2 * hBarp * DEG_TO_RAD) +
    0.32 * Math.cos((3 * hBarp + 6) * DEG_TO_RAD) -
    0.2 * Math.cos((4 * hBarp - 63) * DEG_TO_RAD)

  const deltaTheta = 30 * Math.exp(-(((hBarp - 275) / 25) ** 2))
  const cBarp7 = cBarp ** 7
  const rc = 2 * Math.sqrt(cBarp7 / (cBarp7 + 25 ** 7))
  const sl = 1 + (0.015 * (lBarp - 50) ** 2) / Math.sqrt(20 + (lBarp - 50) ** 2)
  const sc = 1 + 0.045 * cBarp
  const sh = 1 + 0.015 * cBarp * t
  const rt = -Math.sin(2 * deltaTheta * DEG_TO_RAD) * rc

  const termL = deltaLp / sl
  const termC = deltaCp / sc
  const termH = deltaHCapp / sh

  return Math.sqrt(termL ** 2 + termC ** 2 + termH ** 2 + rt * termC * termH)
}

/** Hex-string convenience wrapper around {@link deltaE2000Lab}. NaN if either hex is invalid. */
export function deltaE2000(first: string, second: string): number {
  const lab1 = labFromHex(first)
  const lab2 = labFromHex(second)
  if (!lab1 || !lab2) return Number.NaN
  return deltaE2000Lab(lab1, lab2)
}

import { oval, PALETTES, rect, type Season } from './art'
import type { Mood, Partner, Speaker } from './dialogue'

/**
 * Original pixel portraits for the conversation screen. Each face is built from the same
 * pixel shapes as the map art, on a 40×40 grid, and shares one set of eyes and mouths so
 * every character can smile, worry or gasp.
 */
export const PORTRAIT_SIZE = 40
export const SCENE_WIDTH = 320
export const SCENE_HEIGHT = 288
const SCALE = 4

type Paint = {
  rect(color: string, x: number, y: number, w: number, h: number): void
  oval(color: string, x: number, y: number, w: number, h: number): void
}

/** Whoever is listening steps back into the shade, like in a picture-book play. */
function shade(color: string): string {
  const value = Number.parseInt(color.slice(1), 16)
  const mix = (channel: number, toward: number) => Math.round(channel * 0.62 + toward * 0.38)
  const r = mix(value >> 16 & 255, 0x2e), g = mix(value >> 8 & 255, 0x38), b = mix(value & 255, 0x46)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

function painter(ctx: CanvasRenderingContext2D, dim: boolean): Paint {
  const tone = dim ? shade : (color: string) => color
  return {
    rect: (color, x, y, w, h) => rect(ctx, tone(color), x, y, w, h),
    oval: (color, x, y, w, h) => oval(ctx, tone(color), x, y, w, h),
  }
}

function blob(p: Paint, outline: string, fill: string, x: number, y: number, w: number, h: number) {
  p.oval(outline, x, y, w, h)
  p.oval(fill, x + 1, y + 1, w - 2, h - 2)
}

/** Top half of an ellipse: shoulders that sit flat on the bottom edge. */
function dome(p: Paint, color: string, x: number, y: number, w: number, h: number) {
  for (let row = 0; row < h; row++) {
    const dy = (row + 0.5) / (h * 2) * 2 - 1
    const inset = Math.round(w / 2 * (1 - Math.sqrt(1 - dy * dy)))
    p.rect(color, x + inset, y + row, w - inset * 2, 1)
  }
}

function shoulders(p: Paint, outline: string, fill: string, x: number, y: number, w: number) {
  dome(p, outline, x, y, w, PORTRAIT_SIZE - y)
  dome(p, fill, x + 1, y + 1, w - 2, PORTRAIT_SIZE - y - 1)
}

/** A pointed ear, one scanline at a time from the tip down. */
function pointedEar(p: Paint, outline: string, fill: string, inner: string, tipX: number, tipY: number, height: number, half: number, lean: number) {
  for (let row = 0; row < height; row++) {
    const t = row / (height - 1)
    const w = Math.round(half * t)
    const center = tipX + Math.round(lean * t)
    p.rect(outline, center - w - 1, tipY + row, w * 2 + 3, 1)
    if (row > 0) p.rect(row < 4 ? outline : fill, center - w, tipY + row, w * 2 + 1, 1)
    if (row > 4 && w > 2) p.rect(inner, center - w + 2, tipY + row, w * 2 - 3, 1)
  }
}

type Face = {
  outline: string
  eyes: { left: number; right: number; y: number }
  /** Where the two middle pixels of the mouth start; owls talk with their beak instead. */
  mouth: { x: number; y: number } | 'beak'
  cheeks: { left: number; right: number; y: number }
  base(p: Paint): void
}

const FACES: Record<Speaker, Face> = {
  fox: {
    outline: '#473b35',
    eyes: { left: 12, right: 25, y: 16 },
    mouth: { x: 19, y: 26 },
    cheeks: { left: 10, right: 27, y: 23 },
    base(p) {
      pointedEar(p, '#473b35', '#e6a15b', '#fff0d0', 9, 2, 13, 5, 2)
      pointedEar(p, '#473b35', '#e6a15b', '#fff0d0', 30, 2, 13, 5, -2)
      shoulders(p, '#473b35', '#e6a15b', 6, 30, 28)
      dome(p, '#fff0d0', 14, 33, 12, 7)
      blob(p, '#473b35', '#e6a15b', 4, 8, 32, 24)
      p.rect('#f4bd7c', 9, 11, 7, 2)
      p.oval('#fff0d0', 7, 19, 12, 11)
      p.oval('#fff0d0', 21, 19, 12, 11)
      p.oval('#fff0d0', 14, 21, 12, 9)
      p.rect('#473b35', 19, 23, 2, 2)
      // The courier's teal scarf, knotted at the side.
      p.rect('#3e8180', 10, 31, 20, 3)
      p.rect('#7ab2a0', 11, 31, 18, 1)
      p.rect('#3e8180', 23, 33, 4, 5)
      p.rect('#7ab2a0', 24, 33, 1, 4)
    },
  },
  owl: {
    outline: '#4a3b33',
    eyes: { left: 12, right: 25, y: 15 },
    mouth: 'beak',
    cheeks: { left: 8, right: 29, y: 20 },
    base(p) {
      pointedEar(p, '#4a3b33', '#9a7458', '#9a7458', 6, 4, 7, 2, 1)
      pointedEar(p, '#4a3b33', '#9a7458', '#9a7458', 33, 4, 7, 2, -1)
      shoulders(p, '#4a3b33', '#9a7458', 5, 29, 30)
      for (const [x, y] of [[13, 34], [19, 33], [25, 34], [16, 37], [22, 37]]) p.rect('#c4a07a', x, y, 2, 1)
      // Letter-bag strap across the chest.
      for (let i = 0; i < 10; i++) p.rect('#c4584c', 9 + i, 30 + i, 2, 1)
      blob(p, '#4a3b33', '#9a7458', 4, 7, 32, 25)
      p.oval('#f6e6c4', 7, 12, 14, 17)
      p.oval('#f6e6c4', 19, 12, 14, 17)
      p.oval('#fff8e6', 9, 13, 9, 9)
      p.oval('#fff8e6', 22, 13, 9, 9)
      // A postmaster's cap with an envelope badge.
      p.rect('#4a3b33', 9, 3, 22, 8)
      p.rect('#3f5872', 10, 4, 20, 6)
      p.rect('#5d7a96', 11, 4, 18, 1)
      p.rect('#4a3b33', 11, 10, 18, 2)
      p.rect('#2f4155', 12, 10, 16, 1)
      p.rect('#f2c75c', 18, 5, 4, 3)
      p.rect('#c4584c', 19, 6, 2, 1)
    },
  },
  squirrel: {
    outline: '#684637',
    eyes: { left: 12, right: 25, y: 15 },
    mouth: { x: 19, y: 24 },
    cheeks: { left: 9, right: 28, y: 21 },
    base(p) {
      blob(p, '#684637', '#956243', 26, 2, 14, 32)
      p.oval('#d39a64', 30, 5, 6, 20)
      shoulders(p, '#684637', '#819267', 6, 30, 28)
      p.rect('#a3b487', 14, 31, 12, 1)
      p.rect('#f4d5ac', 19, 34, 2, 2)
      blob(p, '#684637', '#bb7c4f', 6, 3, 9, 11)
      blob(p, '#684637', '#bb7c4f', 25, 3, 9, 11)
      p.rect('#684637', 9, 1, 3, 3)
      p.rect('#684637', 28, 1, 3, 3)
      p.oval('#f4d5ac', 8, 6, 5, 6)
      p.oval('#f4d5ac', 27, 6, 5, 6)
      blob(p, '#684637', '#bb7c4f', 5, 8, 30, 24)
      p.rect('#956243', 18, 9, 4, 4)
      p.rect('#d79a69', 9, 11, 6, 2)
      p.oval('#f4d5ac', 11, 19, 18, 12)
      p.rect('#5a3a2e', 19, 22, 2, 1)
    },
  },
  rabbit: {
    outline: '#756052',
    eyes: { left: 12, right: 25, y: 19 },
    mouth: { x: 19, y: 26 },
    cheeks: { left: 9, right: 28, y: 24 },
    base(p) {
      blob(p, '#756052', '#fff0cf', 9, 0, 8, 19)
      blob(p, '#756052', '#fff0cf', 23, 0, 8, 19)
      p.oval('#eab2a3', 11, 3, 4, 13)
      p.oval('#eab2a3', 25, 3, 4, 13)
      shoulders(p, '#756052', '#8ca793', 6, 31, 28)
      p.rect('#aec3b0', 13, 32, 14, 1)
      p.rect('#e57661', 17, 33, 6, 3)
      p.rect('#b65b54', 19, 34, 2, 1)
      blob(p, '#756052', '#fff0cf', 5, 11, 30, 22)
      p.rect('#ffffff', 9, 14, 6, 2)
      p.rect('#e2908a', 19, 24, 2, 1)
    },
  },
  bear: {
    outline: '#6b4c3d',
    eyes: { left: 12, right: 25, y: 16 },
    mouth: { x: 19, y: 24 },
    cheeks: { left: 8, right: 29, y: 22 },
    base(p) {
      blob(p, '#6b4c3d', '#d7a465', 3, 4, 11, 11)
      blob(p, '#6b4c3d', '#d7a465', 26, 4, 11, 11)
      p.oval('#b7814c', 6, 7, 5, 5)
      p.oval('#b7814c', 29, 7, 5, 5)
      shoulders(p, '#6b4c3d', '#d7a465', 4, 30, 32)
      blob(p, '#6b4c3d', '#d7a465', 3, 7, 34, 26)
      p.rect('#ebbe82', 8, 11, 8, 2)
      p.oval('#f7ddb0', 13, 20, 14, 10)
      p.rect('#6b4c3d', 18, 21, 4, 2)
      p.rect('#9b7a6a', 18, 21, 1, 1)
      p.rect('#bb7f77', 8, 31, 24, 3)
      p.rect('#d9a39b', 9, 31, 22, 1)
    },
  },
}

const INSIDE = '#7a3b30'
const TONGUE = '#e0787a'

function eye(p: Paint, ink: string, x: number, y: number, mood: Mood, blink: boolean, right: boolean) {
  if (mood === 'happy') {
    p.rect(ink, x, y + 2, 1, 2)
    p.rect(ink, x + 1, y + 1, 1, 1)
    p.rect(ink, x + 2, y + 2, 1, 2)
    return
  }
  if (blink) p.rect(ink, x, y + 2, 3, 1)
  else if (mood === 'surprised') {
    p.rect(ink, x, y - 1, 3, 5)
    p.rect('#ffffff', x, y - 1, 1, 2)
  } else {
    p.rect(ink, x, y, 3, 4)
    p.rect('#ffffff', x, y, 1, 1)
  }
  if (mood === 'surprised') p.rect(ink, x, y - 4, 3, 1)
  if (mood === 'worried') {
    // Inner ends raised; the right brow mirrors the left around the eye.
    for (const [dx, dy] of [[-1, -2], [0, -3], [1, -3], [2, -4]]) p.rect(ink, x + (right ? 2 - dx : dx), y + dy, 1, 1)
  }
}

function mouth(p: Paint, ink: string, x: number, y: number, mood: Mood, open: boolean) {
  switch (mood) {
    case 'happy':
      p.rect(ink, x - 2, y, 6, 1)
      if (open) {
        p.rect(ink, x - 2, y + 1, 1, 2)
        p.rect(ink, x + 3, y + 1, 1, 2)
        p.rect(INSIDE, x - 1, y + 1, 4, 1)
        p.rect(TONGUE, x - 1, y + 2, 4, 1)
        p.rect(ink, x - 1, y + 3, 4, 1)
      } else {
        p.rect(ink, x - 1, y + 1, 4, 1)
        p.rect(TONGUE, x, y + 1, 2, 1)
      }
      return
    case 'surprised': {
      const depth = open ? 3 : 2
      p.rect(ink, x, y, 2, 1)
      p.rect(ink, x - 1, y + 1, 1, depth)
      p.rect(ink, x + 2, y + 1, 1, depth)
      p.rect(INSIDE, x, y + 1, 2, depth)
      p.rect(ink, x, y + 1 + depth, 2, 1)
      return
    }
    case 'worried':
      p.rect(ink, x - 1, y + 1, 1, 1)
      p.rect(ink, x, y, 2, 1)
      p.rect(ink, x + 2, y + 1, 1, 1)
      if (open) {
        p.rect(INSIDE, x, y + 1, 2, 1)
        p.rect(ink, x, y + 2, 2, 1)
      }
      return
    case 'normal':
      if (open) {
        p.rect(ink, x - 1, y, 4, 1)
        p.rect(ink, x - 1, y + 1, 1, 1)
        p.rect(ink, x + 2, y + 1, 1, 1)
        p.rect(TONGUE, x, y + 1, 2, 1)
        p.rect(ink, x, y + 2, 2, 1)
      } else {
        p.rect(ink, x - 1, y, 1, 1)
        p.rect(ink, x, y + 1, 2, 1)
        p.rect(ink, x + 2, y, 1, 1)
      }
  }
}

function beak(p: Paint, open: boolean) {
  p.rect('#e8a24a', 18, 20, 4, 2)
  p.rect('#f6c27a', 18, 20, 2, 1)
  if (open) {
    p.rect(INSIDE, 18, 22, 4, 2)
    p.rect(TONGUE, 19, 23, 2, 1)
    p.rect('#e8a24a', 18, 24, 4, 1)
  } else p.rect('#e8a24a', 19, 22, 2, 2)
}

/** Little comic marks that make a feeling readable at a glance. */
function moodMark(p: Paint, mood: Mood, time: number) {
  const hop = Math.round(Math.max(0, Math.sin(time * 5)))
  if (mood === 'happy') {
    for (const [x, y, w] of [[1, 0, 1], [3, 0, 1], [0, 1, 5], [1, 2, 3], [2, 3, 1]]) p.rect('#ef8fa0', 33 + x, 3 + y - hop, w, 1)
    p.rect('#ffd0c7', 34, 4 - hop, 1, 1)
    p.rect('#f7d26b', 3, 6, 1, 3)
    p.rect('#f7d26b', 2, 7, 3, 1)
  } else if (mood === 'surprised') {
    p.rect('#c4772f', 34, 1 - hop, 4, 7)
    p.rect('#f6c04f', 35, 2 - hop, 2, 5)
    p.rect('#c4772f', 34, 8 - hop, 4, 3)
    p.rect('#f6c04f', 35, 9 - hop, 2, 1)
  } else if (mood === 'worried') {
    p.rect('#5c9fc0', 34, 9 + hop, 1, 1)
    p.rect('#5c9fc0', 33, 10 + hop, 3, 2)
    p.rect('#8fd0ea', 34, 10 + hop, 1, 2)
    p.rect('#5c9fc0', 34, 12 + hop, 1, 1)
  }
}

export type PortraitPose = { blink: boolean; talking: boolean; dim: boolean; time: number }

/** Draws one face at the current transform, on a PORTRAIT_SIZE grid. */
export function drawPortrait(ctx: CanvasRenderingContext2D, who: Speaker, mood: Mood, pose: PortraitPose) {
  const face = FACES[who]
  const p = painter(ctx, pose.dim)
  face.base(p)
  const { left, right, y } = face.eyes
  eye(p, face.outline, left, y, mood, pose.blink, false)
  eye(p, face.outline, right, y, mood, pose.blink, true)
  if (face.mouth === 'beak') beak(p, pose.talking)
  else mouth(p, face.outline, face.mouth.x, face.mouth.y, mood, pose.talking)
  if (mood === 'happy') for (const x of [face.cheeks.left, face.cheeks.right]) p.rect('#f4a9a0', x, face.cheeks.y, 3, 2)
  if (!pose.dim) moodMark(p, mood, pose.time)
}

const SKIES: Record<Season, readonly [string, string, string]> = {
  spring: ['#cfe8e4', '#e0f0de', '#f2f2d8'],
  summer: ['#9fd3e6', '#c0e3ea', '#e4f2e0'],
  dusk: ['#2f3557', '#46476e', '#6f6588'],
}

/** A chunky 80×72 meadow behind the faces, in the season's own colours. */
function backdrop(ctx: CanvasRenderingContext2D, season: Season, time: number, still: boolean) {
  const palette = PALETTES[season]
  const [high, middle, low] = SKIES[season]
  ctx.save()
  ctx.scale(4, 4)
  rect(ctx, high, 0, 0, 80, 14)
  rect(ctx, middle, 0, 14, 80, 10)
  rect(ctx, low, 0, 24, 80, 16)
  if (season === 'dusk') {
    oval(ctx, '#fff4cf', 62, 5, 9, 9)
    oval(ctx, high, 65, 4, 8, 8)
    for (const [x, y, phase] of [[8, 4, 0], [20, 9, 1.3], [33, 3, 2.1], [47, 11, 0.7], [55, 6, 2.9], [74, 15, 1.8], [14, 17, 2.4]]) {
      rect(ctx, still || Math.sin(time * 2 + phase) > -0.4 ? '#fff6d8' : middle, x, y, 1, 1)
    }
  } else {
    oval(ctx, season === 'summer' ? '#ffe08a' : '#fff3c4', 63, 4, 10, 10)
    for (const [x, y, w] of [[8, 7, 12], [12, 6, 6], [36, 11, 14], [40, 10, 6]]) rect(ctx, '#ffffff', x, y, w, 1)
  }
  for (let i = 0; i < 9; i++) oval(ctx, palette.leafDark, i * 10 - 4, 25 + (i % 2) * 3, 14, 16)
  for (let i = 0; i < 8; i++) oval(ctx, palette.leaf, i * 12 - 6, 31 + (i % 3) * 2, 16, 14)
  for (let i = 0; i < 8; i++) rect(ctx, palette.leafLight, i * 12 - 1, 33 + (i % 3) * 2, 4, 1)
  rect(ctx, palette.grass, 0, 41, 80, 31)
  rect(ctx, palette.grassLight, 0, 41, 80, 1)
  oval(ctx, palette.path, 16, 52, 48, 16)
  oval(ctx, palette.pathLight, 24, 54, 30, 6)
  for (const [x, y] of [[6, 46], [71, 48], [11, 58], [66, 60], [4, 66], [75, 68]]) {
    rect(ctx, palette.grassDeep, x, y, 1, 2)
    rect(ctx, palette.flower, x - 1, y - 1, 3, 1)
  }
  if (!still) {
    // Drifting petals by day, fireflies by night.
    for (let i = 0; i < 6; i++) {
      const x = (i * 17 + time * (season === 'dusk' ? 3 : 6)) % 84 - 2
      const y = 18 + i * 7 + Math.round(Math.sin(time * 1.5 + i) * 2)
      rect(ctx, season === 'dusk' ? '#e9ff9a' : season === 'summer' ? '#fff3b0' : '#f7c6cc', x, y, 1, 1)
    }
  }
  ctx.restore()
}

export type ConversationFrame = {
  season: Season
  partner: Partner
  speaker: Speaker
  moods: Record<Speaker, Mood>
  time: number
  /** The speaker's mouth moves while their words are still appearing. */
  talking: boolean
  reducedMotion: boolean
}

/** The whole conversation picture: meadow, the courier on the left, the partner on the right. */
export function drawConversation(ctx: CanvasRenderingContext2D, frame: ConversationFrame) {
  ctx.save()
  ctx.imageSmoothingEnabled = false
  backdrop(ctx, frame.season, frame.time, frame.reducedMotion)
  const cast: readonly [Speaker, number, number][] = [['fox', 0, 0], [frame.partner, 160, 1.7]]
  for (const [who, left, offset] of cast) {
    const active = who === frame.speaker
    const still = frame.reducedMotion
    const breathe = still ? 0 : Math.round(Math.sin(frame.time * 2.2 + offset))
    ctx.save()
    // The listener sinks back a little so the speaker clearly steps forward.
    ctx.translate(left, (active ? 30 : 44) + breathe)
    ctx.scale(SCALE, SCALE)
    drawPortrait(ctx, who, frame.moods[who], {
      blink: !still && (frame.time + offset) % 3.4 < 0.14,
      talking: active && frame.talking && !still && Math.floor(frame.time * 9) % 2 === 0,
      dim: !active,
      time: still ? 0 : frame.time,
    })
    ctx.restore()
  }
  ctx.restore()
}

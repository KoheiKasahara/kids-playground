const paths = {
  music: 'M9 17V6l11-2v11 M9 10l11-2 M9 17c0 1.7-1.8 3-4 3s-3-1.1-3-2.4 1.8-2.8 4-2.8c1.2 0 2.3.3 3 .9 M20 15c0 1.6-1.7 3-3.8 3s-3.1-1-3.1-2.3 1.6-2.7 3.8-2.7c1.2 0 2.3.3 3.1.9',
  sound: 'M11 4 6 8H3v8h3l5 4z M15 8a6 6 0 0 1 0 8 M18 5a10 10 0 0 1 0 14',
  mute: 'M11 4 6 8H3v8h3l5 4z M16 9l6 6 M22 9l-6 6',
  undo: 'M9 5 3 11l6 5 M4 11h10a6 6 0 0 1 0 12',
  tempo: 'M4 18a9 9 0 1 1 16 0z M12 15l4-6 M6.8 11l1.4.8 M11.7 7.7v1.5',
  check: 'm5 12 4.5 4.5L19 7',
  play: 'M7 4.5a.6.6 0 0 1 1-.5l12 7.5a.6.6 0 0 1 0 1L8 20a.6.6 0 0 1-1-.5z',
  stop: 'M6.5 5.5h11a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1z',
} as const

export default function PondIcon({ name }: { name: keyof typeof paths }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill={name === 'play' || name === 'stop' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[name]} />
    </svg>
  )
}

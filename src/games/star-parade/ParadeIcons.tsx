type IconName = 'star' | 'comet' | 'sound' | 'mute' | 'expand' | 'collapse' | 'pause' | 'play' | 'flag' | 'hand' | 'left' | 'right' | 'replay' | 'jump'

export function Icon({ name }: { name: IconName }) {
  if (name === 'star' || name === 'comet') {
    return <svg viewBox={name === 'comet' ? '0 0 46 32' : '12 0 34 32'} aria-hidden="true">
      {name === 'comet' && <g fill="none" stroke="#bea6ff" strokeWidth="2.8" strokeLinecap="round">
        <path d="M3 16h10M7 22h9M11 10h5" /><path d="M2 22h1" />
      </g>}
      <path d="m29 2 4.6 8.6 9.4 2-6.7 7.2.9 10-8.8-4.1-8.8 4.1.9-10-6.7-7.2 9.4-2z"
        fill="#ffcb59" stroke="#ffeab2" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="m29 2-.6 15.1-4.6-6.5zm-.6 15.1 7.9 2.7.9 10-8.8-4.1z" fill="#ffa83f" />
      <path d="m14.7 12.6 13.7 4.5-7 2.7z" fill="#ffe79e" />
    </svg>
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    {(name === 'sound' || name === 'mute') && <>
      <path d="M3 9h4l5-4v14l-5-4H3z" fill="currentColor" strokeWidth="1.4" />
      {name === 'sound' ? <><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" /></>
        : <path d="m16 9 5 6m0-6-5 6" />}
    </>}
    {name === 'expand' && <path d="M4 9V4h5m6 0h5v5m0 6v5h-5M9 20H4v-5" />}
    {name === 'collapse' && <path d="M9 4v5H4m16 0h-5V4m0 16v-5h5M4 15h5v5" />}
    {name === 'pause' && <path d="M8.5 5v14m7-14v14" strokeWidth="4" />}
    {name === 'play' && <path d="m7 4 13 8-13 8z" fill="currentColor" />}
    {name === 'flag' && <><path d="M4 21V4c5.5-4 10 3.5 16-.5v10c-6 4-10.5-3.5-16 .5" /><path d="M5 8c4-2 9 3 14.5 0M10 4.3v9M15 5.8v8.9" strokeWidth="1.3" /></>}
    {name === 'hand' && <><path d="M9.5 13.5V7.3a1.5 1.5 0 0 1 3 0v5l3.8.5c1.8.3 2.8 1.3 2.6 3.3l-.4 2.9c-.2 1.4-1.5 2.5-3 2.5h-3.2c-1.1 0-2.1-.5-2.8-1.4l-3.6-4.4a1.5 1.5 0 0 1 2.1-2z" /><path d="M2 6h4M4.3 4 2 6l2.3 2M16 6h6l-2.3-2m0 4L22 6" /></>}
    {name === 'left' && <path d="M20 12H4m7-7-7 7 7 7" strokeWidth="2.8" />}
    {name === 'right' && <path d="M4 12h16m-7-7 7 7-7 7" strokeWidth="2.8" />}
    {name === 'jump' && <><path d="M12 16V3m-6 6 6-6 6 6" strokeWidth="2.8" /><path d="M5 19h4m5 0h5M9 22h6" /></>}
    {name === 'replay' && <><path d="M4 10a8 8 0 1 1 1 7" /><path d="M4 4v6h6" /></>}
  </svg>
}

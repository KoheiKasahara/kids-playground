import type { PartKind } from './marbleModel'

export default function PartIcon({ kind }: { kind: PartKind }) {
  const path = kind === 'curve' ? 'M10 40H27Q45 40 45 21V10' : kind === 'branch' ? 'M8 28H22Q30 28 37 17L49 10M22 28Q30 28 37 39L49 46' : kind === 'slope' ? 'M7 16L49 40' : 'M7 28H49'
  return <svg viewBox="0 0 56 56" aria-hidden="true">
    <path d={path} fill="none" stroke="#29485b" strokeOpacity="0.13" strokeWidth="17" strokeLinecap="round" transform="translate(0 3)" />
    <path d={path} fill="none" stroke="currentColor" strokeWidth="16" strokeLinecap="round" />
    <path d={path} fill="none" stroke="#fff9df" strokeOpacity="0.7" strokeWidth="8" strokeLinecap="round" />
    {kind === 'goal' && <><ellipse cx="36" cy="30" rx="17" ry="18" fill="currentColor" /><ellipse cx="36" cy="27" rx="13" ry="13" fill="#fff2b5" /><ellipse cx="36" cy="28" rx="8" ry="8" fill="currentColor" opacity="0.7" /><path d="m35 20 2 5 5 1-4 3 1 5-4-3-4 2 1-5-3-3 5-1Z" fill="#fffdf0" /></>}
  </svg>
}

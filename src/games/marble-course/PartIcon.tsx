import type { PartKind } from './marbleModel'

export default function PartIcon({ kind }: { kind: PartKind }) {
  const path = kind === 'curve' ? 'M10 40H27Q45 40 45 21V10' : kind === 'branch' ? 'M8 28H22Q30 28 37 17L49 10M22 28Q30 28 37 39L49 46' : kind === 'slope' ? 'M7 16L49 40' : kind === 'jump' ? 'M7 36Q18 36 23 29M39 36H49' : kind === 'seesaw' ? 'M8 33L48 23' : 'M7 28H49'
  return <svg viewBox="0 0 56 56" aria-hidden="true">
    <path d={path} fill="none" stroke="#29485b" strokeOpacity="0.13" strokeWidth="17" strokeLinecap="round" transform="translate(0 3)" />
    <path d={path} fill="none" stroke="currentColor" strokeWidth="16" strokeLinecap="round" />
    <path d={path} fill="none" stroke="#fff9df" strokeOpacity="0.7" strokeWidth="8" strokeLinecap="round" />
    {kind === 'goal' && <><ellipse cx="36" cy="30" rx="17" ry="18" fill="currentColor" /><ellipse cx="36" cy="27" rx="13" ry="13" fill="#fff2b5" /><ellipse cx="36" cy="28" rx="8" ry="8" fill="currentColor" opacity="0.7" /><path d="m35 20 2 5 5 1-4 3 1 5-4-3-4 2 1-5-3-3 5-1Z" fill="#fffdf0" /></>}
    {kind === 'jump' && <><path d="M21 22Q31 3 43 24" fill="none" stroke="#8f6743" strokeWidth="2" strokeDasharray="3 3" /><circle cx="30" cy="15" r="4" fill="#3c9ca6" /><path d="m39 23 6 4 1-7" fill="none" stroke="#8f6743" strokeWidth="2" /></>}
    {kind === 'spinner' && <><ellipse cx="28" cy="30" rx="19" ry="16" fill="currentColor" /><ellipse cx="28" cy="27" rx="16" ry="13" fill="#fff4dc" /><path d="m15 19 26 16" stroke="currentColor" strokeWidth="8" strokeLinecap="round" /><path d="m16 18 1 6m22 3 1 6" stroke="#fff4dc" strokeWidth="2" /><circle cx="28" cy="27" r="4" fill="#826854" /><path d="M19 9q15-5 24 8l-1-7m1 7-8-1" fill="none" stroke="#826854" strokeWidth="2" strokeLinecap="round" /></>}
    {kind === 'funnel' && <><path d="M9 22q18 40 38 0" fill="currentColor" /><ellipse cx="28" cy="21" rx="21" ry="13" fill="currentColor" /><ellipse cx="28" cy="21" rx="17" ry="10" fill="#fff3de" /><path d="M16 18c12-11 28 3 16 9-10 5-18-3-11-6 5-2 11 1 7 4" fill="none" stroke="currentColor" strokeWidth="3" /><ellipse cx="28" cy="26" rx="4" ry="3" fill="#66567e" /><path d="M28 39v7h18" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" /></>}
    {kind === 'booster' && <path d="m16 22 7 6-7 6m12-12 7 6-7 6m12-12 7 6-7 6" fill="none" stroke="#39818b" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />}
    {kind === 'seesaw' && <><path d="m28 33-8 14h16Z" fill="#cba879" /><circle cx="36" cy="17" r="5" fill="#3c9ca6" /><path d="M9 13v10m-4-5 4 5 4-5m34 16v10m-4-5 4 5 4-5" fill="none" stroke="#6a8051" strokeWidth="2" strokeLinecap="round" /></>}
  </svg>
}

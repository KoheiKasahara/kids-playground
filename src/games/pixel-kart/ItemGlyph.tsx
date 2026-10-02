import type { ItemId } from './types'

/** Original pixel silhouettes, shared by the instructions and the one action button. */
export default function ItemGlyph({ item }: { item: ItemId | null }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" shapeRendering="crispEdges">
    {item === 'boost' && <><path fill="#754631" d="M4 3h13v3h-3v5h6v4h-4v4h-4v4H8v-9H3V9h1z" /><path fill="#ffe58a" d="M6 4h9v2h-3v7h6l-8 8v-9H5V9h1z" /><path fill="#fffce0" d="M7 5h4v5H7z" /></>}
    {item === 'jump' && <><path fill="#3b4576" d="M4 14h16v7H4zM8 3h8v3h3v4h-5v5h-4v-5H5V6h3z" /><path fill="#c1f5ff" d="M10 4h4v3h3v2h-5v5h-1V9H7V7h3zM6 15h12v2H6z" /><path fill="#78abd9" d="M7 18h10v2H7z" /></>}
    {item === 'star' && <><path fill="#b87539" d="M10 1h4v6h7v6h-4v4h2v5h-5v-3h-4v3H5v-5h2v-4H3V7h7z" /><path fill="#ffdf67" d="M11 3h2v6h7v3h-5v4h2v4h-3v-3h-4v3H7v-4h2v-4H4V9h7z" /><path fill="#664965" d="M9 10h2v3H9zM14 10h2v3h-2z" /><path fill="#fff8bd" d="M11 5h2v5h-2zM5 9h3v2H5z" /></>}
    {item === 'bomb' && <><path fill="#ffd977" d="M17 1h2v2h3v2h-4v2h-2V4h-2V2h3z" /><path fill="#67394f" d="M10 5h6v4h3v3h2v7h-3v3H6v-3H3v-7h3V9h4z" /><path fill="#f27384" d="M9 10h7v3h3v5h-3v2H7v-3H5v-4h4z" /><path fill="#ffcad0" d="M9 11h5v2H9z" /><path fill="#fff6d9" d="M13 15h2v2h-2zM17 14h2v2h-2z" /></>}
    {item === 'puddle' && <><path fill="#366177" d="M8 7h8v3h4v3h2v7H2v-7h2v-3h4z" /><path fill="#91ddae" d="M9 8h6v3h4v3h2v4H3v-4h2v-3h4z" /><path fill="#d7ffb9" d="M9 9h5v2H9zM6 12h3v2H6z" /><path fill="#385767" d="M9 14h2v2H9zM14 14h2v2h-2z" /></>}
    {!item && <><path fill="#e7d8b5" d="M6 3h12v3h3v6h-3v3h-4v3h-4v-6h5V7H9v3H4V6h2zM10 20h4v3h-4z" /></>}
  </svg>
}

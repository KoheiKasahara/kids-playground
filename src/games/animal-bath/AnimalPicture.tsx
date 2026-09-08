import type { Animal } from './bath'

/** Original vector artwork, shared by the selection cards and bath scene. */
export default function AnimalPicture({ animal, happy = false }: { animal: Animal; happy?: boolean }) {
  return <g stroke="#624638" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
    {animal.id === 'rabbit' ? <>
      <ellipse cx="151" cy="78" rx="25" ry="62" fill={animal.color} transform="rotate(-12 151 78)" />
      <ellipse cx="249" cy="78" rx="25" ry="62" fill={animal.color} transform="rotate(12 249 78)" />
      <ellipse cx="151" cy="73" rx="10" ry="40" fill={animal.cheek} stroke="none" />
      <ellipse cx="249" cy="73" rx="10" ry="40" fill={animal.cheek} stroke="none" />
    </> : <>
      <ellipse cx="117" cy="116" rx="34" ry={animal.id === 'dog' ? 58 : 35} fill={animal.dark} transform="rotate(20 117 116)" />
      <ellipse cx="283" cy="116" rx="34" ry={animal.id === 'dog' ? 58 : 35} fill={animal.dark} transform="rotate(-20 283 116)" />
      {animal.id === 'bear' && <><circle cx="117" cy="112" r="19" fill={animal.cheek} stroke="none" /><circle cx="283" cy="112" r="19" fill={animal.cheek} stroke="none" /></>}
    </>}
    <ellipse cx="200" cy="264" rx="90" ry="79" fill={animal.color} />
    <ellipse cx="200" cy="275" rx="51" ry="50" fill="#fff3de" stroke="none" />
    <ellipse cx="111" cy="264" rx="23" ry="40" fill={animal.color} transform="rotate(23 111 264)" />
    <ellipse cx="289" cy="264" rx="23" ry="40" fill={animal.color} transform="rotate(-23 289 264)" />
    <ellipse cx="149" cy="329" rx="32" ry="21" fill={animal.color} />
    <ellipse cx="251" cy="329" rx="32" ry="21" fill={animal.color} />
    <rect x="100" y="93" width="200" height="139" rx="65" fill={animal.color} />
    {animal.id === 'dog' && <ellipse cx="151" cy="151" rx="27" ry="33" fill={animal.dark} stroke="none" />}
    <ellipse cx="139" cy="185" rx="18" ry="10" fill={animal.cheek} stroke="none" />
    <ellipse cx="261" cy="185" rx="18" ry="10" fill={animal.cheek} stroke="none" />
    {happy ? <><path d="M145 163 Q156 148 167 163 M233 163 Q244 148 255 163" fill="none" /></>
      : <><ellipse cx="157" cy="161" rx="6" ry="9" fill="#44362e" stroke="none" /><ellipse cx="243" cy="161" rx="6" ry="9" fill="#44362e" stroke="none" /></>}
    <ellipse cx="200" cy="187" rx="29" ry="22" fill="#fff3de" stroke="none" />
    <path d="M190 177 Q200 172 210 177 Q207 187 200 187 Q193 187 190 177" fill="#624638" stroke="none" />
    <path d="M200 186 V193 M185 194 Q192 204 200 193 Q208 204 215 194" fill="none" />
  </g>
}

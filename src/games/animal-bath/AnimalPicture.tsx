import { useId } from 'react'
import { mix, type Animal } from './bath'

/** Organic mud splat with a wet highlight; `seed` varies the rotation so patches don't look stamped. */
export function Mud({ seed = 0 }: { seed?: number }) {
  return <g transform={`rotate(${seed * 67 % 360}) scale(${seed % 2 ? -0.85 : 0.85} 0.85)`} opacity=".92">
    <path d="M-22 -3 C-25 -15 -13 -21 -5 -17 C3 -24 17 -19 15 -9 C26 -8 27 4 18 8 C21 18 8 22 2 17 C-6 23 -19 18 -16 9 C-26 7 -27 -1 -22 -3 Z" fill="#8a5b3b" />
    <path d="M-15 -2 C-17 -10 -8 -13 -3 -10 C3 -15 11 -11 10 -5 C17 -4 17 3 11 5 C12 11 4 13 1 10 C-4 14 -12 10 -10 5 C-16 4 -17 0 -15 -2 Z" fill="#a0704a" />
    <path d="M1 17 C0 24 5 27 5 20 Z" fill="#8a5b3b" />
    <circle cx="24" cy="-13" r="3" fill="#8a5b3b" /><circle cx="-25" cy="14" r="2.2" fill="#8a5b3b" />
    <ellipse cx="-5" cy="-6" rx="5" ry="2.8" fill="#c99b72" opacity=".8" transform="rotate(-20 -5 -6)" />
  </g>
}

/** Original vector artwork, shared by the selection cards and bath scene. */
export default function AnimalPicture({ animal, happy = false }: { animal: Animal; happy?: boolean }) {
  const id = `ab${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const line = mix(animal.dark, '#3b2a22', 0.55)
  const fur = `url(#${id}-fur)`
  const shade = mix(animal.color, animal.dark, 0.45)
  const inner = animal.id === 'dog' ? mix(animal.dark, '#3b2a22', 0.15) : animal.cheek
  const bean = mix(animal.cheek, '#ffffff', 0.25)

  return <g>
    <defs>
      <radialGradient id={`${id}-fur`} cx=".38" cy=".3" r=".85">
        <stop offset="0" stopColor={mix(animal.color, '#ffffff', 0.42)} />
        <stop offset=".55" stopColor={animal.color} />
        <stop offset="1" stopColor={shade} />
      </radialGradient>
      <radialGradient id={`${id}-dark`} cx=".4" cy=".3" r=".8">
        <stop offset="0" stopColor={mix(animal.dark, '#ffffff', 0.2)} />
        <stop offset="1" stopColor={mix(animal.dark, '#3b2a22', 0.2)} />
      </radialGradient>
      <radialGradient id={`${id}-belly`} cx=".45" cy=".35" r=".7">
        <stop offset="0" stopColor="#fffaf0" />
        <stop offset="1" stopColor="#f6e2c6" />
      </radialGradient>
      <radialGradient id={`${id}-cheek`}>
        <stop offset="0" stopColor={animal.cheek} stopOpacity=".9" />
        <stop offset="1" stopColor={animal.cheek} stopOpacity="0" />
      </radialGradient>
    </defs>
    <g stroke={line} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
      {animal.id === 'rabbit' ? <>
        <path d="M137 132 C112 86 114 24 142 16 C168 10 176 70 170 128 Z" fill={fur} />
        <path d="M263 132 C288 86 286 24 258 16 C232 10 224 70 230 128 Z" fill={fur} />
        <path d="M146 116 C132 84 132 42 145 34 C157 30 161 74 158 114 Z" fill={inner} stroke="none" opacity=".85" />
        <path d="M254 116 C268 84 268 42 255 34 C243 30 239 74 242 114 Z" fill={inner} stroke="none" opacity=".85" />
      </> : animal.id === 'dog' ? <>
        <path d="M128 102 C96 84 70 110 76 158 C80 190 96 206 112 196 C126 186 124 156 136 132 Z" fill={`url(#${id}-dark)`} />
        <path d="M272 102 C304 84 330 110 324 158 C320 190 304 206 288 196 C274 186 276 156 264 132 Z" fill={`url(#${id}-dark)`} />
      </> : <>
        <circle cx="123" cy="104" r="34" fill={fur} /><circle cx="277" cy="104" r="34" fill={fur} />
        <circle cx="125" cy="107" r="19" fill={inner} stroke="none" /><circle cx="275" cy="107" r="19" fill={inner} stroke="none" />
      </>}
      {/* body, arms and feet */}
      <ellipse cx="200" cy="266" rx="90" ry="78" fill={fur} />
      <ellipse cx="200" cy="280" rx="52" ry="50" fill={`url(#${id}-belly)`} stroke="none" />
      <ellipse cx="200" cy="230" rx="78" ry="14" fill={animal.dark} stroke="none" opacity=".22" />
      <ellipse cx="114" cy="262" rx="24" ry="41" fill={fur} transform="rotate(20 114 262)" />
      <ellipse cx="286" cy="262" rx="24" ry="41" fill={fur} transform="rotate(-20 286 262)" />
      <ellipse cx="149" cy="330" rx="33" ry="21" fill={fur} />
      <ellipse cx="251" cy="330" rx="33" ry="21" fill={fur} />
      <g fill={bean} stroke="none"><ellipse cx="149" cy="334" rx="11" ry="8" /><ellipse cx="251" cy="334" rx="11" ry="8" />
        <circle cx="136" cy="321" r="4" /><circle cx="149" cy="317" r="4" /><circle cx="162" cy="321" r="4" />
        <circle cx="238" cy="321" r="4" /><circle cx="251" cy="317" r="4" /><circle cx="264" cy="321" r="4" /></g>
      {/* head */}
      <path d="M200 90 C270 90 304 122 304 166 C304 212 262 236 200 236 C138 236 96 212 96 166 C96 122 130 90 200 90 Z" fill={fur} />
      <path d="M150 108 C168 99 188 97 205 99" fill="none" stroke="#fff" strokeWidth="6" opacity=".45" />
      {animal.id === 'dog' && <path d="M126 130 C134 118 158 118 170 132 C180 146 176 172 160 178 C142 184 124 168 122 152 Z" fill={`url(#${id}-dark)`} stroke="none" />}
      {animal.id === 'bear' && <path d="M186 96 C192 104 200 106 208 97" fill="none" strokeWidth="3" />}
      <ellipse cx="140" cy="188" rx="22" ry="13" fill={`url(#${id}-cheek)`} stroke="none" />
      <ellipse cx="260" cy="188" rx="22" ry="13" fill={`url(#${id}-cheek)`} stroke="none" />
      {happy ? <path d="M144 164 Q156 149 168 164 M232 164 Q244 149 256 164" fill="none" strokeWidth="4.5" />
        : <g stroke="none"><ellipse cx="156" cy="161" rx="9" ry="12" fill="#3f2f27" /><ellipse cx="244" cy="161" rx="9" ry="12" fill="#3f2f27" />
          <circle cx="159" cy="156" r="3.8" fill="#fff" /><circle cx="247" cy="156" r="3.8" fill="#fff" />
          <circle cx="153" cy="166" r="1.6" fill="#fff" opacity=".8" /><circle cx="241" cy="166" r="1.6" fill="#fff" opacity=".8" /></g>}
      <ellipse cx="200" cy="190" rx="31" ry="23" fill={`url(#${id}-belly)`} stroke="none" />
      <path d="M188 178 Q200 172 212 178 Q209 190 200 190 Q191 190 188 178 Z" fill="#4a352c" stroke="none" />
      <ellipse cx="196" cy="178" rx="5" ry="2.4" fill="#fff" opacity=".6" stroke="none" />
      <path d="M200 189 V195 M186 196 Q193 205 200 195 Q207 205 214 196" fill="none" strokeWidth="3" />
    </g>
  </g>
}

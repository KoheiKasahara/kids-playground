// 手で うった ドット絵。1もじ＝1ドット、'.' は とうめい。
// 1まいの 絵に つかう 色を パレットで しぼって、むかしの ゲーム機の ような 見た目に する。

import type { Palette } from './pixel'

// ---------------- うさぎ（しゅじんこう） ----------------

/** りんかくは まっくろでは なく こい むらさき。 */
export const BUNNY: Palette = {
  o: '#3b2244',
  w: '#ffffff', W: '#e9e0f4', g: '#b8a6d4',
  p: '#ffb0c8', P: '#ff86ab', n: '#ff5a8c',
  e: '#2a1233', i: '#ffffff',
  r: '#ec3c52', R: '#a8203c', y: '#ff8a8a',
}

// 16 x 18。みぎ むき。あたまと からだを くみあわせて コマを つくる。
const EARS_UP = [
  '.....oo.oo......',
  '....oWgoowo.....',
  '....oWgoowpo....',
  '....oWgoowpo....',
  '....oWgoowpo....',
  '.....oWoowwo....',
]
const EARS_BACK = [
  '................',
  '..ooo...........',
  '.oWggoooo.......',
  '..ooWgowwpo.....',
  '....oowwwppo....',
  '.....oowwwwo....',
]
const EARS_DROOP = [
  '................',
  '................',
  '................',
  '...oooo..ooo....',
  '..oWggWoowppo...',
  '...ooooowwwwo...',
]
const FACE = [
  '....oowwwwwwoo..',
  '...owwwwwwwwwwo.',
  '..owwwwwwwweewo.',
  '..oWwwwwwwweewo.',
  '..oWwwwwwwweewwo',
  '..oWwwwwwwPPwwno',
  '...oWWwwwwwwwwo.',
]
const FACE_HAPPY = [
  '....oowwwwwwoo..',
  '...owwwwwwwwwwo.',
  '..owwwwwwwwwwwo.',
  '..oWwwwwwwweeewo',
  '..oWwwwwwwwewwwo',
  '..oWwwwwwwPPwwno',
  '...oWWwwwwwwwwo.',
]
const FACE_OUCH = [
  '....oowwwwwwoo..',
  '...owwwwwwwwwwo.',
  '..owwwwwwwewwwo.',
  '..oWwwwwwwweewo.',
  '..oWwwwwwwewwwwo',
  '..oWwwwwwwPPwwno',
  '...oWWwwwwwwwwo.',
]
const SCARF = [
  '.yrrRorrrrrrRo..',
]
const SCARF_FLAP = [
  'yyrR.orrrrrrRo..',
]
// からだと あし（4ぎょう）。
const LEGS_RUN = [
  [
    '..rRoWwwwwwgo...',
    '..R.oWwwwwwgo...',
    '...owwoooowwo...',
    '...ooo....ooo...',
  ],
  [
    '..rRoWwwwwwgo...',
    '....oWwwwwwgoo..',
    '....oWwwwgowwo..',
    '.....ooooo.ooo..',
  ],
  [
    '..rRoWwwwwwgo...',
    '..R.oWwwwwwgo...',
    '..owwoooooowwo..',
    '..ooo......ooo..',
  ],
  [
    '..rRoWwwwwwgo...',
    '..oooWwwwwwgo...',
    '..owwoWwwwgo....',
    '..ooo.ooooo.....',
  ],
]
const LEGS_STAND = [
  '..rRoWwwwwwgo...',
  '....oWwwwwwgo...',
  '....owwooowwo...',
  '....ooo..ooo....',
]
const LEGS_JUMP = [
  '.rRRoWwwwwwgo...',
  'rR..oWwwwwwgo...',
  '...owwoWwwgowwo.',
  '...ooo.oooo.ooo.',
]
const LEGS_FALL = [
  '..rRoWwwwwwgo...',
  '..R.oWwwwwwgo...',
  '....owwooowwo...',
  '....owo...owo...',
]
const LEGS_CHEER = [
  'owwoWwwwwwwgowwo',
  '.ooooWwwwwwgooo.',
  '....owwooowwo...',
  '....ooo..ooo....',
]

function frame(ears: string[], face: string[], scarf: string[], legs: string[]) {
  return [...ears, ...face, ...scarf, ...legs]
}

export type BunnyPose = 'run0' | 'run1' | 'run2' | 'run3' | 'stand' | 'blink' | 'jump' | 'fall' | 'hurt' | 'cheer'

const FACE_BLINK = FACE.map((row, i) => (i === 2 ? '..owwwwwwwwwwwo.' : i === 3 ? '..oWwwwwwwwwwwo.' : i === 4 ? '..oWwwwwwweeewwo' : row))

export const BUNNY_POSES: Record<BunnyPose, string[]> = {
  run0: frame(EARS_UP, FACE, SCARF_FLAP, LEGS_RUN[0]),
  run1: frame(EARS_BACK, FACE, SCARF, LEGS_RUN[1]),
  run2: frame(EARS_UP, FACE, SCARF_FLAP, LEGS_RUN[2]),
  run3: frame(EARS_BACK, FACE, SCARF, LEGS_RUN[3]),
  stand: frame(EARS_UP, FACE, SCARF, LEGS_STAND),
  blink: frame(EARS_UP, FACE_BLINK, SCARF, LEGS_STAND),
  jump: frame(EARS_BACK, FACE, SCARF_FLAP, LEGS_JUMP),
  fall: frame(EARS_UP, FACE, SCARF, LEGS_FALL),
  hurt: frame(EARS_DROOP, FACE_OUCH, SCARF, LEGS_FALL),
  cheer: frame(EARS_UP, FACE_HAPPY, SCARF, LEGS_CHEER),
}

// ---------------- にんじん・メダル ----------------

export const CARROT_PAL: Palette = {
  o: '#5a2410', O: '#ff8a1e', y: '#ffc070', q: '#d8560c',
  g: '#1f7a32', G: '#5ed05a',
}
export const CARROT = [
  '...g.G...',
  '..gGgGg..',
  '...gGg...',
  '..ooooo..',
  '.oyOOOOo.',
  '.oyOOqOo.',
  '..oyOOo..',
  '..oOqOo..',
  '...oOo...',
  '...oOo...',
  '....o....',
]

// ---------------- はてなブロック・ばね ----------------

export const BLOCK_PAL: Palette = {
  o: '#4a2408', y: '#fff0a0', Y: '#ffc43a', d: '#d27a10', D: '#9a4a06', w: '#ffffff', s: '#b85e08',
}
export const BLOCK = [
  '.oooooooooooooo.',
  'oyyyyyyyyyyyyyyo',
  'oyYYYYYYYYYYYYdo',
  'oyYsYYYYYYYYsYdo',
  'oyYYYYwwwwYYYYdo',
  'oyYYYwwsswwYYYdo',
  'oyYYYwwsYwwsYYdo',
  'oyYYYYssYwwsYYdo',
  'oyYYYYYYwwssYYdo',
  'oyYYYYYwwssYYYdo',
  'oyYYYYYwwsYYYYdo',
  'oyYYYYYYssYYYYdo',
  'oyYYYYYwwYYYYYdo',
  'oyYsYYYYssYYsYdo',
  'oddddddddddddddo',
  '.oooooooooooooo.',
]
export const BLOCK_USED_PAL: Palette = {
  o: '#3a1c10', y: '#c89060', Y: '#a86a3c', d: '#7a4424', D: '#5a2c14', w: '#a86a3c', s: '#7a4424',
}
export const BLOCK_USED = [
  '.oooooooooooooo.',
  'oyyyyyyyyyyyyyyo',
  'oyYYYYYYYYYYYYdo',
  'oyYsYYYYYYYYsYdo',
  'oyYYYYYYYYYYYYdo',
  'oyYYYYYYYYYYYYdo',
  'oyYYYYYYYYYYYYdo',
  'oyYYYYYYYYYYYYdo',
  'oyYYYYYYYYYYYYdo',
  'oyYYYYYYYYYYYYdo',
  'oyYYYYYYYYYYYYdo',
  'oyYYYYYYYYYYYYdo',
  'oyYYYYYYYYYYYYdo',
  'oyYsYYYYYYYYsYdo',
  'oddddddddddddddo',
  '.oooooooooooooo.',
]

export const SPRING_PAL: Palette = {
  o: '#2a1a30', r: '#ff4a5a', R: '#b8203a', y: '#ffa0a8', s: '#d8dce8', S: '#8a90a8', w: '#ffffff',
}
export const SPRING = [
  '................',
  '................',
  '................',
  '................',
  '..oooooooooooo..',
  '.oyyyrrrrrrrrRo.',
  '.orrrrrrrrrrRRo.',
  '..oooooooooooo..',
  '....osSSSSSSo...',
  '.....oSSSSSo....',
  '....osSSSSSSo...',
  '.....oSSSSSo....',
  '....osSSSSSSo...',
  '..oooooooooooo..',
  '.oSsssssssssSSo.',
  '..oooooooooooo..',
]
export const SPRING_SQUASH = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '..oooooooooooo..',
  '.oyyyrrrrrrrrRo.',
  '.orrrrrrrrrrRRo.',
  '..oooooooooooo..',
  '....osSSSSSSo...',
  '..oooooooooooo..',
  '.oSsssssssssSSo.',
  '..oooooooooooo..',
]

// ---------------- いきもの（2コマ。ひだり むき） ----------------

export const SNAIL_PAL: Palette = {
  o: '#3a2030', s: '#ffb040', S: '#e0701c', d: '#a8400c', y: '#ffe090',
  b: '#b8e070', B: '#78b040', e: '#2a1020', w: '#ffffff',
}
export const SNAIL = [
  [
    '................',
    '..o.o...........',
    '..e.e..oooo.....',
    '..o.o.oyssSo....',
    '.oboooysSSsSo...',
    '.obbboyssddsSo..',
    'oewbboySdyysSo..',
    'obbbbosSdsSsSo..',
    '.obbboSsSSssdo..',
    '.obbbooSSSSdo...',
    '.obbbbboooooBbo.',
    '..obbbbbbbbbbBo.',
    '...ooooooooooo..',
  ],
  [
    '................',
    '...o.o..........',
    '...e.e.oooo.....',
    '...o.ooyssSo....',
    '..oboooysSSsSo..',
    '..obbboyssddsSo.',
    '.oewbboySdyysSo.',
    '.obbbbosSdsSsSo.',
    '.obbbboSsSSssdo.',
    '..obbbooSSSSdo..',
    '.obbbbbboooooBbo',
    'obbbbbbbbbbbbBo.',
    '.ooooooooooooo..',
  ],
]

export const CRAB_PAL: Palette = {
  o: '#4a1018', r: '#ff5040', R: '#c02a2a', y: '#ff9a7a', e: '#1a0810', w: '#ffffff',
}
export const CRAB = [
  [
    '.oo..........oo.',
    'oyro........oyro',
    'orRo..o..o..orRo',
    '.oRo.owoowo.oRo.',
    '..oRooeooeooRo..',
    '...oyyrrrrrRo...',
    '..oyrrrrrrrrRo..',
    '..orrrrrrrrrRo..',
    '...oRRRRRRRRo...',
    '..ororo..ororo..',
    '..o.o......o.o..',
  ],
  [
    '................',
    '.oo..........oo.',
    'oyro..o..o..oyro',
    'orRo.owoowo.orRo',
    '.oRooeooeooRRo..',
    '..ooyyrrrrrRo...',
    '..oyrrrrrrrrRo..',
    '..orrrrrrrrrRo..',
    '...oRRRRRRRRo...',
    '...oro.oo.oro...',
    '...o.o....o.o...',
  ],
]

export const PENGUIN_PAL: Palette = {
  o: '#10142a', k: '#2a3050', K: '#46507a', w: '#ffffff', W: '#d0e0f4', y: '#ffb020', Y: '#e07a10', e: '#10142a', r: '#ff5a6a',
}
export const PENGUIN = [
  [
    '.....oooo.....',
    '....oKKKko....',
    '...oKwwKKko...',
    '..oyywewKkko..',
    '..oYywwwKkko..',
    '...owwWwKko...',
    '..okwwwWWkko..',
    '.okkwwwwWkkko.',
    '.okowwwwWkoko.',
    '...owwwwWko...',
    '...oWWWWWko...',
    '...oyyo.oyyo..',
    '...ooo..ooo...',
  ],
  [
    '.....oooo.....',
    '....oKKKko....',
    '...oKwwKKko...',
    '..oyywewKkko..',
    '..oYywwwKkko..',
    '...owwWwKko...',
    '..okwwwWWkko..',
    '.okkwwwwWkkko.',
    '.okowwwwWkoko.',
    '...owwwwWko...',
    '...oWWWWWko...',
    '....oyyooyyo..',
    '....ooo.ooo...',
  ],
]

export const BEE_PAL: Palette = {
  o: '#2a1a10', y: '#ffd83a', Y: '#e0a010', k: '#3a2a1a', w: '#ffffff', W: '#bfe8ff', e: '#1a1008', r: '#ff8a8a',
}
export const BEE = [
  [
    '......ooo.oo..',
    '.....oWWWoWWo.',
    '.....oWwWoWWo.',
    '..oooooWooWo..',
    '.oyyykyykoo...',
    'oeyyykyykyyo..',
    'oyryykyykyyko.',
    '.oyyykyykyyo..',
    '..oookooooo...',
  ],
  [
    '..............',
    '..............',
    '....oooo.ooo..',
    '..oooWWWoWWWo.',
    '.oyyykyykooo..',
    'oeyyykyykyyo..',
    'oyryykyykyyko.',
    '.oyyykyykyyo..',
    '..oookooooo...',
  ],
]

export const GULL_PAL: Palette = {
  o: '#2a2438', w: '#ffffff', W: '#d8d4ec', g: '#8a86a8', y: '#ffb020', e: '#1a1428',
}
export const GULL = [
  [
    '.......oo.......',
    '......owWo..oo..',
    '......owWgoowWo.',
    '.......owWWwWo..',
    '..ooo...owwWo...',
    '.owwwo.owwwo....',
    'yyewwwwwwwwWoo..',
    '.oowwwwwwwwWWgoo',
    '...ooWWWWWWoooo.',
    '.....oooooo.....',
    '................',
  ],
  [
    '................',
    '................',
    '................',
    '..ooo...........',
    '.owwwo..........',
    'yyewwwwwwwwWoo..',
    '.oowwwwwwwwWWgoo',
    '...owWWWWWWgoo..',
    '....owWWgWgo....',
    '.....owgogo.....',
    '......ooo.......',
  ],
]

export const OWL_PAL: Palette = {
  o: '#2a1a2a', b: '#8a6a9a', B: '#b89ac8', w: '#fff4e0', y: '#ffc83a', e: '#1a101a', d: '#5a4270',
}
export const OWL = [
  [
    '...o......o...',
    '..obo....obo..',
    '..obbooooobo..',
    '.obwwwbbwwwbo.',
    '.obweyobyewbo.',
    'dobwwwyywwwbod',
    'ddobbbyybbbodd',
    '.dobBBBBBBbod.',
    '..obBbBbBbbo..',
    '...obBBBBbo...',
    '....oyooyo....',
  ],
  [
    '...o......o...',
    '..obo....obo..',
    '..obbooooobo..',
    '.obwwwbbwwwbo.',
    '.obweyobyewbo.',
    '.obwwwyywwwbo.',
    '.oobbbyybbboo.',
    'ddobBBBBBBbodd',
    'ddobBbBbBbbodd',
    '.d.obBBBBbo.d.',
    '....oyooyo....',
  ],
]

// ---------------- いわ（とびこえる もの） ----------------

export const ROCK = [
  '................',
  '......oooo......',
  '....ooLLlloo....',
  '...oLLllllmmo...',
  '..oLLlllllmmmo..',
  '..oLllllmmmmmo..',
  '.oLlllllmmmmmdo.',
  '.oLllllmmmmmmdo.',
  '.olllllmmmmmddo.',
  'oLllllmmmmmmddmo',
  'olllllmmmmmdddmo',
  'olllmmmmmmmddmmo',
  'ommmmmmmmddddmdo',
  '.odmmmmdddddddo.',
  '..oddddddddddo..',
  '...oooooooooo...',
]

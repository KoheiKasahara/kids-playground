// ステージの 地図と ようす。地図は 1もじ＝1マス（16ドット）。
//
// じめん: '.' くさ（ゆきの ステージでは ゆき）  ',' はなばたけ（きらきら）  ':' ふかい くさ  '=' つちの みち  's' すなはま（こおり）  'o' いしだたみ
//         '~' みず  '#' はし  'L' はすのは（みず）  'h' かいがら（すな）
// もの:   'T' 大きな 木  'P' ヤシの木  'b' しげみ  'r' いわ  'I' はしら  'i' おれた はしら  'f' たいまつ
// ほか:   '*' ほしの かけら  'm' なかまに なる いきもの  'C' たからばこが でる ところ  '@' スタート
// しかけ: 'G' とおせんぼ（いわ・きれた はし・いしの とびら・こおりの かべ）  'k' ふむ スイッチ  'u' ひの きえた たいまつ

export type Theme = 'day' | 'sunset' | 'night' | 'snow'
export type FriendKind = 'slime' | 'crab' | 'penguin'
export type FriendDef = { kind: FriendKind; name: string; color: 'blue' | 'pink' | 'gold' | 'purple' | 'mint' | 'red' | 'ice' }

/**
 * ステージに ひとつ ある しかけ。'G' の マスは しかけを とくまで とおれない。
 * - boulder: なかまを need にん つれて いくと みんなで おして どかせる おおきな いわ
 * - bridge: 'k' の スイッチを ふむと きれた はしが のびる
 * - torch: 'u' の たいまつ ぜんぶに ひを ともすと いしの とびらが ひらく
 * - ice: ペンギンの なかまを つれて いくと こおりの かべを つついて わる
 */
export type GimmickDef = { kind: 'boulder'; need: number } | { kind: 'bridge' } | { kind: 'torch' } | { kind: 'ice' }

export type StageDef = {
  id: string
  name: string
  lead: string
  theme: Theme
  map: readonly string[]
  friends: readonly FriendDef[]
  treasure: string
  /** 岸に なみが よせては かえす。 */
  waves?: boolean
  gimmick: GimmickDef
}

export const STAGES: readonly StageDef[] = [
  {
    id: 'forest',
    name: 'みどりの もり',
    lead: 'こもれびの さす しずかな もり',
    theme: 'day',
    treasure: 'みどりの ほうせき',
    gimmick: { kind: 'boulder', need: 2 },
    friends: [
      { kind: 'slime', name: 'ぷるる', color: 'blue' },
      { kind: 'slime', name: 'ももち', color: 'pink' },
    ],
    map: [
      'TTTTTTTTTTTTTTTTTTTTTTT~~~TTTTTTTTTTTTTT',
      'TT:T:T:T:T:T:T:T:T:T:T:T~~~T:T:T:T:T:T:T',
      'T::::::::.::.:.::::.:.::~~~:.:....:.:.TT',
      'TT........T..............~~~.........::T',
      'T::.~~~~~........T.......~~~......r*.:TT',
      'TT.~~~~L~~r.,,,,,........~~~T........::T',
      'T::~~L~~~~,,=,,,,,,......~~~.........:TT',
      'TT:~~~~~~~,,=*,,,,,......~~~........T::T',
      'T::.~~~~~.,,=,,,,,,......~~~bbbbGbbbbbTT',
      'TT:.........=,,,,..T....~~~...........:T',
      'T::...b..T..=...........~~~...........TT',
      'TT..........=....Cb....~~~..m.......b.:T',
      'T::.........=.........~~~............:TT',
      'TT=@==================###=========....:T',
      'T:...................~~~.........=...:TT',
      'TT.......m.....b.....r~~......b..=.T.::T',
      'T:..b...............r~~~...T.....=...:TT',
      'TT:.....T............~~~......,,,=...::T',
      'T:.............T.....~~~....,,,,,=,...TT',
      'TT:..r............*..~~~...,r,,*,=,,..:T',
      'T::.*.................~~~...,,,,,=,..:TT',
      'TT:.T...............T.~~~....T,,,.....:T',
      'T:.....................~~~...........:TT',
      'TT::.:..:.:::::::::.:..:~~~:::.::.::.::T',
      'T:T:T:T:T:T:T:T:T:T:T:T:~~~:T:T:T:T:T:TT',
      'TTTTTTTTTTTTTTTTTTTTTTTTT~~~TTTTTTTTTTTT',
    ],
  },
  {
    id: 'beach',
    name: 'ゆうやけの はまべ',
    lead: 'なみの おとが きこえる オレンジいろの うみ',
    theme: 'sunset',
    waves: true,
    treasure: 'にじいろの かいがら',
    gimmick: { kind: 'bridge' },
    friends: [
      { kind: 'crab', name: 'カニタ', color: 'red' },
      { kind: 'slime', name: 'ぴかりん', color: 'gold' },
    ],
    map: [
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      ':T:T:T:T:T:T:T:T:T:T:T:T:T:T:T:T:T:T:T:T',
      'rr....:....:.:..:::..:.:.::.::..:...:...',
      'r.................P..............P......',
      'rr..........P........*....P...........P.',
      'rsssPsssssssssssssssssssssssssshsssrssss',
      'rrsss@ssssssssssssssssssssssssssssP~~~~~',
      'rsssssssssssssssssshsssssssssssssss~~~~~',
      'rrsssssPsssssssssssssssssssss~~~s*ss~~~~',
      'rssrsssss~ssssssrsssCsssssshssssssss~~~~',
      'rrssssss~~~sssssssssssssssssssssrsss~~~~',
      'rssssssss~ssshssmssssssssssssssssssss~~~',
      'rrsssshsssssssssssssssssrssssPsssssss~~~',
      'rssssss*ssssrssssssssssssssmsssssssss~~~',
      'rrs*sssssssssssks~~~~shssssssssssssss~~~',
      'r~~~~hssssss~~#~~~~~~~~~sssssssssssss~~~',
      'rr~~~~~~~~~~~~#~~~~~~~~~~~sssssssssss~~~',
      'r~~~~~~~~~~~~~#~~~~~~~~~~~~~sssssssss~~~',
      'rr~~~~~~~~~~~~#~~~~~~~~~~~~~~~~sssss~~~~',
      'r~~~~~~~~~~~~~#~~~~~~~~~~~~~~~~~~~~~~~~~',
      'rr~~~~~~~~~~~~#GGGGGGsss~~~~~~~~~~~~~~~~',
      'r~~~~~~~~~~~~~~~~~~sssP*ss~~~~~~~~~~~~~~',
      'rr~~~~~~~~~~~~~~~~~sssssss~~~~~~~~~~~~~~',
      'r~~~~~~~~~~~~~~~~~~~~sss~~~~~~~~~~~~~~~~',
      'rr~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
      'r~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    ],
  },
  {
    id: 'ruins',
    name: 'ほしぞらの いせき',
    lead: 'たいまつの ひかりが ゆれる よるの いせき',
    theme: 'night',
    treasure: 'ほしの かんむり',
    gimmick: { kind: 'torch' },
    friends: [
      { kind: 'slime', name: 'よるる', color: 'purple' },
      { kind: 'slime', name: 'ほたりん', color: 'mint' },
    ],
    map: [
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      'TT:T:T:T:T:T:T:T:T:T:T:T:T:T:T:T:T:T:T:T',
      'T:::.:.::.::.::::...::::::.::::.:.::.:TT',
      'TT:.::.::.:.::...:..:::::.:.::.::.:::.:T',
      'T:::.:.::::.:::::::.:::.::.:.:.::r:.::TT',
      'TT.::T:::ooooooooooffoooooooooo.:::::.:T',
      'T:::::..:oIoooioooIoooIoooIoooo.::T::.TT',
      'TT::::m::ooooooooooooooooooo.oo:.::::::T',
      'T:.:.:...ooo..ooooooCoooooo*ooo..:::::TT',
      'TT:r:::.:oIooooooooooooooooooIo:urrrrrrT',
      'T:::.::::oooooofoooooooofoooooo::roooorT',
      'TT.:.::T:ooooooo~~~~~~~~ooooooo.:Goo*orT',
      'T::.*::::ooooooo~L~~~~~~ooooooo::roooorT',
      'TT..:.:::oiooooo~~~~~~~~oooooIo::rrrrrrT',
      'T::..::::ooooooo~~~~~~L~ooooooo:::::.:TT',
      'TT::::::.ooooooo~~~~~~~~ooooooo..:..:.:T',
      'T:::::.::oooooofoooooooofoooooo:::.:::TT',
      'TT::T::.:ooo*ooooooooooooo..ooo::m.::::T',
      'T::..:::.oo.ooooooooooooooooooo::.::::TT',
      'TT..:.:::oIoooIoooIoooIoooioooo::.:T..:T',
      'T:::..r.:oooooooooo@ooooooooooo.:....:TT',
      'TT.:u:.:.:::::.:..oooo:::::::..::::::::T',
      'T:.::::...:::::::foooof::::::.:.::*:::TT',
      'TT:.::::....::.:::oooo.::..:.:::...::.:T',
      'T:T:T:T:T:T:T:T:T:ooooT:T:T:T:T:T:T:T:TT',
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    ],
  },
  {
    id: 'snow',
    name: 'しろい ゆきのはら',
    lead: 'ゆきが しんしん ふる まっしろな はら',
    theme: 'snow',
    treasure: 'ゆきの けっしょう',
    gimmick: { kind: 'ice' },
    friends: [
      { kind: 'penguin', name: 'ペンタ', color: 'blue' },
      { kind: 'slime', name: 'ゆきぷる', color: 'ice' },
    ],
    map: [
      'TTTTTTTTTTTTTTTTTTTTTTTTTTT~~~TTTTTTTTTT',
      'T:T:T:T:T:T:T:T:T:T:T:T:T:T~~~T:T:T:T:TT',
      'T::::::::::::::.:::.::.:.::~~~:::::G::TT',
      'TT:....:.s:....:.T..:.:....~~~.foooof:*T',
      'T::..sssssssss........T....~~~.oooooorTT',
      'TT:.ssss*ssssss....,.......~~~.oooooo::T',
      'T::sssssssssssss..,,,.......~~~ooCooo.TT',
      'TT:sssssssssssss...,........~~~oooooo.:T',
      'T::.sssssssssrs.............~~~oooooo.TT',
      'TT...sssssssss..........T...~~~..=..:::T',
      'T::....sssssm...............~~~..=...:TT',
      'TT:r...........r....b.......~~~r.=.T:::T',
      'T:::.......................~~~...=..::TT',
      'TT=@=======================###====...::T',
      'T::........................~~~.......:TT',
      'TT.............b...........~~~......b.:T',
      'T::...T...............T....~~~.T....::TT',
      'TT::...............,,,....~~~.......:::T',
      'T:::..............,*,,,...~~~....,,,::TT',
      'TT:........T.......,,,....~~~....,,,:.:T',
      'T:::b...................r.~~~....,,,*:TT',
      'TT::*............T........~~~.m.......:T',
      'T::.::.:.r:..:.:....:.:...~~~....T:..:TT',
      'TT::::.:...::::::..::.::..~~~.:..::.:::T',
      'TT:T:T:T:T:T:T:T:T:T:T:T:T~~~T:T:T:T:T:T',
      'TTTTTTTTTTTTTTTTTTTTTTTTTT~~~TTTTTTTTTTT',
    ],
  },
]

export const GROUND_CHARS = '.,:=so~#'
export const OBJECT_CHARS = 'TPbrIifu'
/** ひとが とおれない じめん。 */
export const WATER_CHARS = '~L'

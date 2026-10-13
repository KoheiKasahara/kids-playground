export type HabitatId = 'reef' | 'forest' | 'desert'
export type SpriteKind = 'octopus' | 'stonefish' | 'lionfish' | 'frog' | 'snake' | 'scorpion' | 'lizard'

export const HABITATS = [
  { id: 'reef', name: 'サンゴのうみ', icon: '◈', subtitle: 'あたたかい海の、いわとサンゴ', description: 'インド洋・太平洋の あさい海に くらす なかまたち。', number: '01' },
  { id: 'forest', name: 'あめのもり', icon: '♧', subtitle: 'しっとりした森の、おちばの上', description: '中南米の 熱帯の森に くらす カエルたち。国や地域は それぞれ ちがうよ。', number: '02' },
  { id: 'desert', name: 'ソノラのさばく', icon: '☀', subtitle: 'かわいた大地と、いわのかげ', description: 'アメリカ南西部・メキシコの ソノラ砂漠に くらす なかまたち。', number: '03' },
] as const

export type Species = {
  id: string
  name: string
  scientific: string
  habitat: HabitatId
  sprite: SpriteKind
  colors: readonly [string, string, string]
  motion: 'swim' | 'crawl' | 'hop' | 'still'
  level: 3 | 4 | 5
  delivery: string
  home: string
  food: string
  fact: string
  venom: string
  clue: string
  source: { label: string; url: string }
}

const frogSource = { label: 'サンディエゴ動物園：Poison Frog', url: 'https://animals.sandiegozoo.org/animals/poison-frog' }

// Levels are authored game categories, NOT LD50 measurements or an interspecies scientific ranking.
// No level means safe. Facts and provenance are kept with the animal, available offline except source links.
export const SPECIES: readonly Species[] = [
  {
    id: 'blue-ring', name: 'ヒョウモンダコのなかま', scientific: 'Hapalochlaena spp.', habitat: 'reef',
    sprite: 'octopus', colors: ['#f4c967', '#a67b42', '#4c9bff'], motion: 'crawl', level: 5,
    delivery: 'かんで つかう', home: 'インド洋・太平洋の あさい海', food: '小さなカニや エビなど',
    fact: '小さな体に あおい輪のもよう。おどろくと 輪が はっきり 見えるよ。',
    venom: 'テトロドトキシンという 強い毒をもつよ。かまれると 体を動かす神経の はたらきが さまたげられる。',
    clue: 'あおい輪のもようを みつけよう',
    source: { label: 'オーストラリア海洋科学研究所：Blue ringed octopus', url: 'https://www.aims.gov.au/docs/projectnet/blue-ringed-octopus.html' },
  },
  {
    id: 'stonefish', name: 'オニダルマオコゼ', scientific: 'Synanceia verrucosa', habitat: 'reef',
    sprite: 'stonefish', colors: ['#ab937f', '#6c635f', '#ccaa91'], motion: 'still', level: 5,
    delivery: 'とげで さす', home: 'インド洋・太平洋の サンゴや いわの海底', food: '魚や エビなど',
    fact: 'いわに そっくりな かくれんぼ名人。海の底で じっと えものを 待つよ。',
    venom: 'せびれの 13本の とげに 強い毒があるよ。ふんでしまうと とても危険。いわに見えても さわらないでね。',
    clue: 'いわに そっくりな魚を みつけよう',
    source: { label: 'オーストラリア博物館：Reef Stonefish', url: 'https://australian.museum/learn/animals/fishes/reef-stonefish-synanceia-verrucosa-bloch-schneider-1801/' },
  },
  {
    id: 'lionfish', name: 'ハナミノカサゴ', scientific: 'Pterois volitans', habitat: 'reef',
    sprite: 'lionfish', colors: ['#e88973', '#8d4357', '#ffe6ba'], motion: 'swim', level: 3,
    delivery: 'とげで さす', home: 'インド洋・太平洋の あたたかい海', food: '小さな魚や エビなど',
    fact: 'しましまの体に 大きなひれ。ゆっくり 泳いで、ひれを ひろげるよ。',
    venom: 'せびれなどの とげに 毒があるよ。大きくひろがる 胸びれには 毒のとげが ないんだ。',
    clue: 'しましまの 大きなひれを みつけよう',
    source: { label: 'オーストラリア博物館：Common Lionfish', url: 'https://australian.museum/learn/animals/fishes/common-lionfish-pterois-volitans/' },
  },
  {
    id: 'golden-frog', name: 'モウドクフキヤガエル', scientific: 'Phyllobates terribilis', habitat: 'forest',
    sprite: 'frog', colors: ['#ffdb58', '#d39732', '#fff29b'], motion: 'hop', level: 5,
    delivery: '皮ふで まもる', home: 'コロンビアの 熱帯の森', food: 'アリなどの 小さな虫',
    fact: 'あざやかな色は「食べないで」の しるし。小さな体を 皮ふの毒で まもるよ。',
    venom: '野生では とても強い毒を 皮ふにもつよ。ヤドクガエルの毒は 食べものに由来し、飼育下では 毒を失うことがあるよ。',
    clue: 'きんいろの カエルを みつけよう', source: frogSource,
  },
  {
    id: 'blue-frog', name: 'コバルトヤドクガエル', scientific: "Dendrobates tinctorius ‘azureus’", habitat: 'forest',
    sprite: 'frog', colors: ['#65b4ff', '#275cba', '#142e59'], motion: 'hop', level: 3,
    delivery: '皮ふで まもる', home: 'スリナムと ブラジル北部の 一部の森', food: 'アリなどの 小さな虫',
    fact: 'あおい体に 黒い点々。アイゾメヤドクガエルの 色ちがいのなかまだよ。',
    venom: '食べた虫に由来する 毒を 皮ふにたくわえるよ。飼育下では 食べものがちがうので 毒性もかわるよ。',
    clue: 'あおい体の 黒い点々を みつけよう',
    source: { label: '太平洋水族館：Blue Poison Dart Frog', url: 'https://www.aquariumofpacific.org/onlinelearningcenter/species/blue_poison_dart_frog' },
  },
  {
    id: 'strawberry-frog', name: 'イチゴヤドクガエル', scientific: 'Oophaga pumilio', habitat: 'forest',
    sprite: 'frog', colors: ['#f87565', '#34488a', '#b52f40'], motion: 'hop', level: 3,
    delivery: '皮ふで まもる', home: '中央アメリカの 熱帯の森', food: 'アリや ダニなど',
    fact: 'いちごのような 赤い体。地域によって 色や もようが いろいろ ちがうよ。',
    venom: '皮ふの毒で 敵から 身をまもるよ。毒の成分や量は 食べものや すむ場所で かわるんだ。',
    clue: 'いちご色の カエルを みつけよう', source: frogSource,
  },
  {
    id: 'rattlesnake', name: 'ニシダイヤガラガラヘビ', scientific: 'Crotalus atrox', habitat: 'desert',
    sprite: 'snake', colors: ['#e0b978', '#8b6348', '#fff0bf'], motion: 'crawl', level: 4,
    delivery: 'きばで かむ', home: 'アメリカ南西部・メキシコの かわいた土地', food: 'ネズミなどの 小さな動物',
    fact: 'しっぽの先を ふるわせて 音を出すよ。体の ダイヤ形のもようも 目じるし。',
    venom: 'きばから 毒を入れて えものをつかまえるよ。毒には いろいろな成分が まざっているんだ。',
    clue: 'しっぽの先と ダイヤ形を みつけよう',
    source: { label: 'アリゾナ・ソノラ砂漠博物館：Western Diamondback Rattlesnake', url: 'https://www.desertmuseum.org/kids/facts/print.php?animal=Western+Diamondback+Rattlesnake' },
  },
  {
    id: 'bark-scorpion', name: 'アリゾナバークスコーピオン', scientific: 'Centruroides sculpturatus', habitat: 'desert',
    sprite: 'scorpion', colors: ['#eed08c', '#b58551', '#fff0b5'], motion: 'crawl', level: 4,
    delivery: 'しっぽで さす', home: 'ソノラ砂漠の いわや 木のかげ', food: '虫や クモなど',
    fact: 'あつい昼をさけて 夜に活動する サソリ。はさみで えものを つかまえるよ。',
    venom: 'しっぽの先の はりから 毒を入れるよ。小さな体でも 人に危険な毒を もつんだ。',
    clue: 'まがった しっぽを みつけよう',
    source: { label: 'アリゾナ・ソノラ砂漠博物館：Arizona Bark Scorpion', url: 'https://www.desertmuseum.org/kids/facts/?animal=Arizona+Bark+Scorpion' },
  },
  {
    id: 'gila', name: 'アメリカドクトカゲ', scientific: 'Heloderma suspectum', habitat: 'desert',
    sprite: 'lizard', colors: ['#f5a38b', '#343244', '#ffc0a0'], motion: 'crawl', level: 3,
    delivery: 'かんで つかう', home: 'ソノラ砂漠などの かわいた土地', food: '鳥や は虫類の たまごなど',
    fact: 'つぶつぶの うろこと 太いしっぽ。地面の下で すごす時間が 長い トカゲだよ。',
    venom: '下あごでつくられる 毒が 歯のみぞを通るよ。ゆっくり動いていても 近づいたり さわったり しないでね。',
    clue: 'ピンクと黒の うろこを みつけよう',
    source: { label: '米国国立公園局：Gila Monster', url: 'https://www.nps.gov/sagu/learn/nature/gila-monster.htm' },
  },
]

export const MAX_RESIDENTS = 9
export type Resident = { id: number; speciesId: string; slot: number }
export type Exhibits = Record<HabitatId, Resident[]>

export function createExhibits(): Exhibits {
  return Object.fromEntries(HABITATS.map(habitat => [habitat.id,
    SPECIES.filter(s => s.habitat === habitat.id).map((s, index) => ({ id: SPECIES.indexOf(s) + 1, speciesId: s.id, slot: [3, 7, 2][index] })),
  ])) as Exhibits
}

export function addResident(exhibits: Exhibits, habitat: HabitatId, speciesId: string): Exhibits {
  if (!SPECIES.some(s => s.id === speciesId && s.habitat === habitat) || exhibits[habitat].length >= MAX_RESIDENTS) return exhibits
  const slot = Array.from({ length: MAX_RESIDENTS }, (_, i) => i).find(i => !exhibits[habitat].some(r => r.slot === i))!
  const id = Math.max(0, ...Object.values(exhibits).flat().map(r => r.id)) + 1
  return { ...exhibits, [habitat]: [...exhibits[habitat], { id, speciesId, slot }] }
}

export const RANKING = [5, 4, 3].map(level => ({ level, species: SPECIES.filter(s => s.level === level) }))
export const LEVEL_LABELS: Record<number, string> = { 5: 'とても つよい', 4: 'つよい', 3: '毒がある' }
export const RANKING_NOTE = 'ゲーム内のめやすです。毒の成分・量・入り方で影響はかわり、ちがう生き物の毒を同じ条件で比べた科学的な順位ではありません。同じ段階は同順位です。低い段階でも安全ではありません。'

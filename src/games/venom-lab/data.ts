export type HabitatId = 'reef' | 'forest' | 'desert' | 'satoyama' | 'ryukyu' | 'australia' | 'africa' | 'asia'
export type SpriteKind = 'octopus' | 'stonefish' | 'lionfish' | 'frog' | 'snake' | 'scorpion' | 'lizard' | 'serpent' | 'viper' | 'cobra' | 'sea-snake' | 'spider' | 'hornet' | 'centipede' | 'newt' | 'toad' | 'cone' | 'starfish' | 'urchin'

export const HABITATS = [
  { id: 'reef', name: 'サンゴのうみ', icon: '◈', subtitle: 'あたたかい海の、いわとサンゴ', description: 'インド洋・太平洋の あさい海に くらす なかまたち。', number: '01' },
  { id: 'forest', name: 'あめのもり', icon: '♧', subtitle: 'しっとりした森の、おちばの上', description: '中南米の 熱帯の森の なかまたち。国や地域は それぞれ ちがうよ。', number: '02' },
  { id: 'desert', name: '世界のさばく', icon: '☀', subtitle: 'かわいた大地と、いわのかげ', description: '北アメリカ・北アフリカなどの かわいた土地。にた環境の なかまを 集めたよ。', number: '03' },
  { id: 'satoyama', name: '日本のさとやま', icon: '♧', subtitle: 'ぞうき林と、小さな池のほとり', description: '日本の 森・草むら・水辺の なかまたち。陸と水辺を いっしょに 観察しよう。', number: '04' },
  { id: 'ryukyu', name: '南西諸島のもり', icon: '❧', subtitle: 'あたたかい島の、森の中', description: '奄美・沖縄・八重山の ヘビたち。すんでいる島は 種類ごとに ちがうよ。', number: '05' },
  { id: 'australia', name: '豪州のやぶ', icon: '☀', subtitle: '草地と、かわいた かくれが', description: 'オーストラリアの 草地や やぶ、半砂漠。地域のちがう なかまも 集めたよ。', number: '06' },
  { id: 'africa', name: 'アフリカの草地', icon: '♧', subtitle: '草原にひろがる、木といわ', description: 'アフリカの サバンナや 木のある草地。地面も 木の上も のぞいてみよう。', number: '07' },
  { id: 'asia', name: 'アジアのもり', icon: '❧', subtitle: 'あたたかい森と、水辺の木々', description: '南アジア・東南アジアの 森や 水辺のヘビたち。すむ国や場所は それぞれ ちがうよ。', number: '08' },
] as const

export type Species = {
  id: string
  name: string
  scientific: string
  habitat: HabitatId
  /** Wild presence in Japan, including introduced populations; not a native-species label. */
  inJapan?: boolean
  sprite: SpriteKind
  colors: readonly [string, string, string]
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
const adw = (scientific: string) => ({ label: `ミシガン大学 ADW：${scientific}`, url: `https://animaldiversity.org/accounts/${scientific.replaceAll(' ', '_')}/` })
const habuSource = { label: '沖縄県：ハブの種類と分布', url: 'https://www.pref.okinawa.jp/kurashikankyo/petgaiju/1018721/1005049/1005057.html' }
const seaSource = { label: '沖縄県：海のキケン生物', url: 'https://www.pref.okinawa.lg.jp/kurashikankyo/petgaiju/1018721/1005068/1005069.html' }
const japanSnakeSource = { label: '神戸市：マムシ・ヤマカガシ', url: 'https://www.city.kobe.lg.jp/a66324/kurashi/recycle/biodiversity/mamushi_tyuui.html' }

// Levels are authored game categories, NOT LD50 measurements or an interspecies scientific ranking.
// No level means safe. Facts and provenance are kept with the animal, available offline except source links.
export const SPECIES: readonly Species[] = [
  {
    id: 'blue-ring', name: 'ヒョウモンダコのなかま', scientific: 'Hapalochlaena spp.', habitat: 'reef', inJapan: true,
    sprite: 'octopus', colors: ['#f4c967', '#a67b42', '#4c9bff'], level: 5,
    delivery: 'かんで つかう', home: 'インド洋・太平洋の あさい海', food: '小さなカニや エビなど',
    fact: '小さな体に あおい輪のもよう。おどろくと 輪が はっきり 見えるよ。',
    venom: 'テトロドトキシンという 強い毒をもつよ。かまれると 体を動かす神経の はたらきが さまたげられる。',
    clue: 'あおい輪のもようを みつけよう',
    source: { label: 'オーストラリア海洋科学研究所：Blue ringed octopus', url: 'https://www.aims.gov.au/docs/projectnet/blue-ringed-octopus.html' },
  },
  {
    id: 'stonefish', name: 'オニダルマオコゼ', scientific: 'Synanceia verrucosa', habitat: 'reef', inJapan: true,
    sprite: 'stonefish', colors: ['#ab937f', '#6c635f', '#ccaa91'], level: 5,
    delivery: 'とげで さす', home: 'インド洋・太平洋の サンゴや いわの海底', food: '魚や エビなど',
    fact: 'いわに そっくりな かくれんぼ名人。海の底で じっと えものを 待つよ。',
    venom: 'せびれの 13本の とげに 強い毒があるよ。ふんでしまうと とても危険。いわに見えても さわらないでね。',
    clue: 'いわに そっくりな魚を みつけよう',
    source: { label: 'オーストラリア博物館：Reef Stonefish', url: 'https://australian.museum/learn/animals/fishes/reef-stonefish-synanceia-verrucosa-bloch-schneider-1801/' },
  },
  {
    id: 'lionfish', name: 'ハナミノカサゴ', scientific: 'Pterois volitans', habitat: 'reef', inJapan: true,
    sprite: 'lionfish', colors: ['#e88973', '#8d4357', '#ffe6ba'], level: 3,
    delivery: 'とげで さす', home: 'インド洋・太平洋の あたたかい海', food: '小さな魚や エビなど',
    fact: 'しましまの体に 大きなひれ。ゆっくり 泳いで、ひれを ひろげるよ。',
    venom: 'せびれなどの とげに 毒があるよ。大きくひろがる 胸びれには 毒のとげが ないんだ。',
    clue: 'しましまの 大きなひれを みつけよう',
    source: { label: 'オーストラリア博物館：Common Lionfish', url: 'https://australian.museum/learn/animals/fishes/common-lionfish-pterois-volitans/' },
  },
  {
    id: 'golden-frog', name: 'モウドクフキヤガエル', scientific: 'Phyllobates terribilis', habitat: 'forest',
    sprite: 'frog', colors: ['#ffdb58', '#d39732', '#fff29b'], level: 5,
    delivery: '皮ふで まもる', home: 'コロンビアの 熱帯の森', food: 'アリなどの 小さな虫',
    fact: 'あざやかな色は「食べないで」の しるし。小さな体を 皮ふの毒で まもるよ。',
    venom: '野生では とても強い毒を 皮ふにもつよ。ヤドクガエルの毒は 食べものに由来し、飼育下では 毒を失うことがあるよ。',
    clue: 'きんいろの カエルを みつけよう', source: frogSource,
  },
  {
    id: 'blue-frog', name: 'コバルトヤドクガエル', scientific: "Dendrobates tinctorius ‘azureus’", habitat: 'forest',
    sprite: 'frog', colors: ['#65b4ff', '#275cba', '#142e59'], level: 3,
    delivery: '皮ふで まもる', home: 'スリナムと ブラジル北部の 一部の森', food: 'アリなどの 小さな虫',
    fact: 'あおい体に 黒い点々。アイゾメヤドクガエルの 色ちがいのなかまだよ。',
    venom: '食べた虫に由来する 毒を 皮ふにたくわえるよ。飼育下では 食べものがちがうので 毒性もかわるよ。',
    clue: 'あおい体の 黒い点々を みつけよう',
    source: { label: '太平洋水族館：Blue Poison Dart Frog', url: 'https://www.aquariumofpacific.org/onlinelearningcenter/species/blue_poison_dart_frog' },
  },
  {
    id: 'strawberry-frog', name: 'イチゴヤドクガエル', scientific: 'Oophaga pumilio', habitat: 'forest',
    sprite: 'frog', colors: ['#f87565', '#34488a', '#b52f40'], level: 3,
    delivery: '皮ふで まもる', home: '中央アメリカの 熱帯の森', food: 'アリや ダニなど',
    fact: 'いちごのような 赤い体。地域によって 色や もようが いろいろ ちがうよ。',
    venom: '皮ふの毒で 敵から 身をまもるよ。毒の成分や量は 食べものや すむ場所で かわるんだ。',
    clue: 'いちご色の カエルを みつけよう', source: frogSource,
  },
  {
    id: 'rattlesnake', name: 'ニシダイヤガラガラヘビ', scientific: 'Crotalus atrox', habitat: 'desert',
    sprite: 'snake', colors: ['#e0b978', '#8b6348', '#fff0bf'], level: 4,
    delivery: 'きばで かむ', home: 'アメリカ南西部・メキシコの かわいた土地', food: 'ネズミなどの 小さな動物',
    fact: 'しっぽの先を ふるわせて 音を出すよ。体の ダイヤ形のもようも 目じるし。',
    venom: 'きばから 毒を入れて えものをつかまえるよ。毒には いろいろな成分が まざっているんだ。',
    clue: 'しっぽの先と ダイヤ形を みつけよう',
    source: { label: 'アリゾナ・ソノラ砂漠博物館：Western Diamondback Rattlesnake', url: 'https://www.desertmuseum.org/kids/facts/print.php?animal=Western+Diamondback+Rattlesnake' },
  },
  {
    id: 'bark-scorpion', name: 'アリゾナバークスコーピオン', scientific: 'Centruroides sculpturatus', habitat: 'desert',
    sprite: 'scorpion', colors: ['#eed08c', '#b58551', '#fff0b5'], level: 4,
    delivery: 'しっぽで さす', home: 'ソノラ砂漠の いわや 木のかげ', food: '虫や クモなど',
    fact: 'あつい昼をさけて 夜に活動する サソリ。はさみで えものを つかまえるよ。',
    venom: 'しっぽの先の はりから 毒を入れるよ。小さな体でも 人に危険な毒を もつんだ。',
    clue: 'まがった しっぽを みつけよう',
    source: { label: 'アリゾナ・ソノラ砂漠博物館：Arizona Bark Scorpion', url: 'https://www.desertmuseum.org/kids/facts/?animal=Arizona+Bark+Scorpion' },
  },
  {
    id: 'gila', name: 'アメリカドクトカゲ', scientific: 'Heloderma suspectum', habitat: 'desert',
    sprite: 'lizard', colors: ['#f5a38b', '#343244', '#ffc0a0'], level: 3,
    delivery: 'かんで つかう', home: 'ソノラ砂漠などの かわいた土地', food: '鳥や は虫類の たまごなど',
    fact: 'つぶつぶの うろこと 太いしっぽ。地面の下で すごす時間が 長い トカゲだよ。',
    venom: '下あごでつくられる 毒が 歯のみぞを通るよ。ゆっくり動いていても 近づいたり さわったり しないでね。',
    clue: 'ピンクと黒の うろこを みつけよう',
    source: { label: '米国国立公園局：Gila Monster', url: 'https://www.nps.gov/sagu/learn/nature/gila-monster.htm' },
  },
  {
    id: 'sea-krait', name: 'アオマダラウミヘビ', scientific: 'Laticauda colubrina', habitat: 'reef', inJapan: true,
    sprite: 'sea-snake', colors: ['#9ad3de', '#263c57', '#ffe28a'], level: 5,
    delivery: 'きばで かむ', home: '南西諸島など インド洋・太平洋の サンゴの海', food: 'ウツボなどの 魚',
    fact: '黒い帯と 黄色い口もとが 目じるし。平たいしっぽで 泳ぎ、陸にも あがるよ。',
    venom: 'きばから 神経に作用する 毒を入れて 魚をつかまえるよ。海のヘビにも 強い毒があるんだ。',
    clue: 'しましまの 平たいしっぽを さがそう', source: adw('Laticauda colubrina'),
  },
  {
    id: 'geography-cone', name: 'アンボイナ', scientific: 'Conus geographus', habitat: 'reef', inJapan: true,
    sprite: 'cone', colors: ['#edcca0', '#975f45', '#fff0d1'], level: 5,
    delivery: 'はりのような歯で さす', home: '沖縄などの あたたかい サンゴの海', food: '小さな魚',
    fact: '地図のような もようの 貝がら。きれいな貝でも 生きていると 毒の武器をもつよ。',
    venom: 'イモガイのなかまで、はりのような歯から 毒を入れるよ。貝がらをひろうつもりでも さわらないでね。',
    clue: '地図もようの 貝を さがそう', source: seaSource,
  },
  {
    id: 'crown-of-thorns', name: 'オニヒトデのなかま', scientific: 'Acanthaster spp.', habitat: 'reef', inJapan: true,
    sprite: 'starfish', colors: ['#ab7fac', '#634f80', '#e7b4a6'], level: 3,
    delivery: 'とげで さす', home: '沖縄など インド洋・太平洋の サンゴ礁', food: 'サンゴの やわらかい部分',
    fact: 'うでが たくさんある 大きなヒトデ。体じゅうに 長いとげが 生えているよ。',
    venom: '体をおおう とげには 毒があるよ。サンゴの上にいても 素手で さわってはいけないんだ。',
    clue: 'たくさんの うでと とげを かぞえよう', source: seaSource,
  },
  {
    id: 'long-spined-urchin', name: 'ガンガゼ', scientific: 'Diadema setosum', habitat: 'reef', inJapan: true,
    sprite: 'urchin', colors: ['#464768', '#242939', '#f0a961'], level: 3,
    delivery: 'とげで さす', home: '日本の あたたかい海などの いわ場', food: '海そうなど',
    fact: '細くて とても長い とげをもつウニ。いわのすきまに 集まっていることも あるよ。',
    venom: '細いとげには 毒があり、ささると 折れやすいよ。水の中でも 足もとを よく見よう。',
    clue: '長いとげの ウニを みつけよう', source: seaSource,
  },
  {
    id: 'eyelash-viper', name: 'マツゲハブのなかま', scientific: 'Bothriechis spp.', habitat: 'forest',
    sprite: 'viper', colors: ['#f8d44f', '#c39631', '#fff193'], level: 4,
    delivery: 'きばで かむ', home: '中南米の 熱帯の森', food: '小さな鳥・トカゲ・カエルなど',
    fact: '目の上のうろこが まつげのよう。木の枝に つかまるのが 上手な ヘビのなかまだよ。',
    venom: '長いきばで 毒を入れるよ。黄色や緑など 色がちがうものがいて、見た目だけで 安全とは わからないよ。',
    clue: '黄色い ヘビを さがそう', source: adw('Bothriechis schlegelii'),
  },
  {
    id: 'bushmaster', name: 'ブッシュマスター', scientific: 'Lachesis muta', habitat: 'forest',
    sprite: 'viper', colors: ['#dbae7e', '#4b3b42', '#efd8ae'], level: 5,
    delivery: 'きばで かむ', home: '南アメリカの 雨の多い森', food: 'ネズミなどの 小さなほ乳類',
    fact: '大きな体に 黒いひし形もよう。森の地面に かくれて、えものを 待つよ。',
    venom: '大きなきばと 強い毒をもつよ。しっぽをふるわせることは あるけれど、ガラガラの器官は ないんだ。',
    clue: '黒いひし形の 太いヘビを みつけよう', source: adw('Lachesis muta'),
  },
  {
    id: 'wandering-spider', name: 'ドクシボグモのなかま', scientific: 'Phoneutria spp.', habitat: 'forest',
    sprite: 'spider', colors: ['#a98770', '#4b3940', '#d58b65'], level: 5,
    delivery: 'きばで かむ', home: '南アメリカなどの 熱帯の森', food: '虫などの 小さな動物',
    fact: 'あみで えものを待つ代わりに、歩きまわって 狩りをする クモのなかまだよ。',
    venom: 'かみついて 毒を入れるよ。神経に作用する成分をもち、人にも危険な 種類がいるんだ。',
    clue: '長い8本の足を さがそう',
    source: { label: 'オーストラリア博物館：Spider facts', url: 'https://australian.museum/learn/animals/spiders/spider-facts/' },
  },
  {
    id: 'mojave-rattlesnake', name: 'モハベガラガラヘビ', scientific: 'Crotalus scutulatus', habitat: 'desert',
    sprite: 'snake', colors: ['#b9bf83', '#626b49', '#fff1bc'], level: 5,
    delivery: 'きばで かむ', home: 'アメリカ南西部・メキシコの 砂漠や草地', food: 'ネズミなど',
    fact: '緑がかった体のものもいる ガラガラヘビ。ニシダイヤと もようを 見くらべよう。',
    venom: '強い毒をもつけれど、同じ種類でも 地域によって 毒の成分がちがうよ。毒はひとつの物質では ないんだ。',
    clue: '緑がかった ガラガラヘビを みつけよう',
    source: { label: 'アリゾナ・ソノラ砂漠博物館：Rattlesnakes', url: 'https://www.desertmuseum.org/books/nhsd_rattlesnakes.php' },
  },
  {
    id: 'deathstalker', name: 'デスストーカー', scientific: 'Leiurus quinquestriatus', habitat: 'desert',
    sprite: 'scorpion', colors: ['#efd966', '#9d7537', '#faffb0'], level: 5,
    delivery: 'しっぽで さす', home: '北アフリカなどの かわいた土地', food: '虫や クモなど',
    fact: '黄色い体と 細いはさみの サソリ。石の下などに かくれて くらしているよ。',
    venom: 'しっぽのはりから 強い毒を入れるよ。体の大きさや はさみの大きさだけで 毒の強さは 決まらないよ。',
    clue: '明るい黄色の サソリを さがそう', source: adw('Leiurus quinquestriatus'),
  },
  {
    id: 'hairy-scorpion', name: 'デザートヘアリースコーピオン', scientific: 'Hadrurus arizonensis', habitat: 'desert',
    sprite: 'scorpion', colors: ['#ddc686', '#53554a', '#fff1bb'], level: 3,
    delivery: 'しっぽで さす', home: 'アメリカ南西部・メキシコの 砂漠', food: '虫・クモ・ほかのサソリなど',
    fact: '砂漠にすむ 大きなサソリ。体の細かい毛で まわりの動きなどを 感じとるよ。',
    venom: 'えものをつかまえる 毒をもっているよ。ほかのサソリより 毒性が低いとされても、さして 痛みを起こすよ。',
    clue: '黒っぽい背中の サソリを さがそう', source: adw('Hadrurus arizonensis'),
  },
  {
    id: 'mamushi', name: 'ニホンマムシ', scientific: 'Gloydius blomhoffii', habitat: 'satoyama', inJapan: true,
    sprite: 'viper', colors: ['#b68c71', '#5e3d39', '#e0c397'], level: 4,
    delivery: 'きばで かむ', home: '北海道・本州・四国・九州の 草むらや水辺', food: 'カエルや ネズミなど',
    fact: '太めの体に 丸いもようが 並ぶよ。おちばに まぎれる色なので 見つけにくいんだ。',
    venom: 'きばから 毒を入れる 日本の毒ヘビ。小さな子どものヘビも 毒をもっているよ。',
    clue: '茶色い まるもようの ヘビを さがそう', source: japanSnakeSource,
  },
  {
    id: 'tiger-keelback', name: 'ヤマカガシ', scientific: 'Rhabdophis tigrinus', habitat: 'satoyama', inJapan: true,
    sprite: 'serpent', colors: ['#839765', '#e78156', '#384638'], level: 5,
    delivery: '奥のきば・首の毒', home: '本州・四国・九州などの 田んぼや水辺', food: 'カエルなど',
    fact: '体の色やもようは 地域でさまざま。カエルのいる 水辺で よくくらす ヘビだよ。',
    venom: '口の奥に 毒を入れるきばがあるよ。首にも 毒をたくわえる部分があり、かむ毒とは 由来がちがうんだ。',
    clue: '赤みのある もようの ヘビを さがそう', source: japanSnakeSource,
  },
  {
    id: 'japanese-toad', name: 'ニホンヒキガエル', scientific: 'Bufo japonicus', habitat: 'satoyama', inJapan: true,
    sprite: 'toad', colors: ['#b39570', '#715540', '#ddc296'], level: 3,
    delivery: '皮ふで まもる', home: '日本の 森や草地、庭など', food: '虫や ミミズなど',
    fact: 'でこぼこした皮ふの 大きなカエル。水の外で すごす時間が 長いんだ。',
    venom: '目のうしろの ふくらみなどに 毒があるよ。毒を出して 敵に食べられるのを ふせぐんだ。',
    clue: 'でこぼこの 茶色いカエルを さがそう',
    source: { label: '到津の森公園：ニホンヒキガエル', url: 'https://www.itozu-zoo.jp/friends/entry/67.php' },
  },
  {
    id: 'fire-bellied-newt', name: 'アカハライモリ', scientific: 'Cynops pyrrhogaster', habitat: 'satoyama', inJapan: true,
    sprite: 'newt', colors: ['#414e50', '#253135', '#f77959'], level: 4,
    delivery: '皮ふで まもる', home: '本州・四国・九州の 池や田んぼなど', food: '水の中の小さな虫や ミミズなど',
    fact: '黒っぽい背中に 赤いおなか。トカゲに似ているけれど カエルに近い 両生類だよ。',
    venom: '皮ふに 毒をもつよ。赤いおなかは 敵への警告にもなるんだ。この絵では おなかの赤も 見せているよ。',
    clue: '赤いおなかと 長いしっぽを さがそう',
    source: { label: '鹿児島県立博物館：キケンないきもの', url: 'https://www.pref.kagoshima.jp/bc05/hakubutsukan/event/exhibition/2022kikenten.html' },
  },
  {
    id: 'giant-hornet', name: 'オオスズメバチ', scientific: 'Vespa mandarinia', habitat: 'satoyama', inJapan: true,
    sprite: 'hornet', colors: ['#f5ad4d', '#393b42', '#dbe9e2'], level: 4,
    delivery: 'はりで さす', home: '日本など 東アジアの 森や里山', food: '樹液、幼虫のえさには ほかの虫',
    fact: '日本のハチで 最大級。大きなオレンジ色の頭と 黒いしましまが 目じるしだよ。',
    venom: 'メスは おしりのはりで 毒を入れるよ。巣をまもるために さすこともあるので、近づかないでね。',
    clue: 'しましまの おなかと はねを さがそう',
    source: { label: '高尾599ミュージアム：オオスズメバチ', url: 'https://www.takao599museum.jp/treasures/selected/2764/?lang=ja' },
  },
  {
    id: 'red-headed-centipede', name: 'トビズムカデ', scientific: 'Scolopendra mutilans', habitat: 'satoyama', inJapan: true,
    sprite: 'centipede', colors: ['#4c6260', '#e6be64', '#dc7555'], level: 3,
    delivery: '毒のつめで はさむ', home: '日本など 東アジアの 石やおちばの下', food: '虫や クモなど',
    fact: '赤い頭に たくさんの黄色い足。昼は しめった場所にかくれ、夜に活動するよ。',
    venom: '頭のすぐうしろに 毒を入れるつめがあるよ。これは 足が変化したもので、ヘビの歯とは ちがうんだ。',
    clue: '赤い頭と たくさんの足を さがそう',
    source: { label: 'アース製薬：トビズムカデの生態', url: 'https://www.earth.jp/mushicare/mushi08/' },
  },
  {
    id: 'habu', name: 'ハブ', scientific: 'Protobothrops flavoviridis', habitat: 'ryukyu', inJapan: true,
    sprite: 'viper', colors: ['#cfbe68', '#4d5140', '#efe0a0'], level: 4,
    delivery: 'きばで かむ', home: '奄美大島・沖縄本島などの 一部の島', food: 'ネズミや 鳥など',
    fact: '黄色みのある体に 黒っぽいもよう。地面だけでなく 木にのぼることもあるよ。',
    venom: '長いきばから 毒を入れるよ。同じ南西諸島でも ハブがいる島と いない島があるんだ。',
    clue: '黄色と黒の ヘビを さがそう', source: habuSource,
  },
  {
    id: 'hime-habu', name: 'ヒメハブ', scientific: 'Ovophis okinavensis', habitat: 'ryukyu', inJapan: true,
    sprite: 'viper', colors: ['#987c65', '#514142', '#c3ab89'], level: 3,
    delivery: 'きばで かむ', home: '奄美大島・沖縄本島などの 森や水辺', food: 'カエルなど',
    fact: 'ハブより 短くて 太めの体。森のおちばの色に よくとけこむよ。',
    venom: '小さくても 毒をもつヘビだよ。「ヒメ」という名前や おとなしく見える様子で 安全とは 決められないよ。',
    clue: '茶色の 太いヘビを みつけよう', source: habuSource,
  },
  {
    id: 'sakishima-habu', name: 'サキシマハブ', scientific: 'Protobothrops elegans', habitat: 'ryukyu', inJapan: true,
    sprite: 'viper', colors: ['#b6a380', '#746350', '#e2d4af'], level: 4,
    delivery: 'きばで かむ', home: '石垣島・西表島などの 八重山諸島', food: 'カエルや トカゲなど',
    fact: '八重山の島々にすむ ハブのなかま。ほかのハブと 体の色やもようを 見くらべてみよう。',
    venom: 'きばから 毒を入れるよ。もともとの生息地以外に 持ちこまれた地域もあるんだ。',
    clue: 'うす茶色の ヘビを さがそう', source: habuSource,
  },
  {
    id: 'inland-taipan', name: 'ナイリクタイパン', scientific: 'Oxyuranus microlepidotus', habitat: 'australia',
    sprite: 'serpent', colors: ['#bfa46f', '#514837', '#dfcda0'], level: 5,
    delivery: 'きばで かむ', home: 'オーストラリア内陸の かわいた平原', food: 'ネズミなどの ほ乳類',
    fact: '地面のわれ目を かくれがにするよ。季節によって 体の色のこさが 変わるんだ。',
    venom: '実験では とても強い毒性が 知られているよ。でも毒の強さと 人が出会う多さは 別のことなんだ。',
    clue: '茶色い頭の 細長いヘビを さがそう',
    source: { label: 'オーストラリア博物館：Inland Taipan', url: 'https://australian.museum/learn/animals/reptiles/inland-taipan/' },
  },
  {
    id: 'eastern-brown', name: 'イースタンブラウンスネーク', scientific: 'Pseudonaja textilis', habitat: 'australia',
    sprite: 'serpent', colors: ['#ac8159', '#82623f', '#e7cda0'], level: 5,
    delivery: 'きばで かむ', home: 'オーストラリア東部などの 草地や林', food: 'ネズミや トカゲなど',
    fact: '名前は「茶色」でも 体の色はさまざま。子どものころには 帯もようがあるものも いるよ。',
    venom: '血液や 神経にはたらく 強い毒をもつよ。細い体でも 毒の強さは 見た目でわからないんだ。',
    clue: '茶色の 細いヘビを みつけよう',
    source: { label: 'オーストラリア博物館：Eastern Brown Snake', url: 'https://australian.museum/learn/animals/reptiles/eastern-brown-snake/' },
  },
  {
    id: 'death-adder', name: 'デスアダー', scientific: 'Acanthophis antarcticus', habitat: 'australia',
    sprite: 'viper', colors: ['#be967c', '#73574e', '#e2c5a0'], level: 5,
    delivery: 'きばで かむ', home: 'オーストラリアの 森・やぶ・草地', food: '小さなほ乳類や 鳥など',
    fact: '太い体と 細いしっぽ。しっぽの先を 虫のように動かして えものを さそうよ。',
    venom: '神経にはたらく 強い毒をもつよ。おちばにかくれて 待つので、動かなくても 危険なんだ。',
    clue: 'じっとしている 太いヘビを みつけよう',
    source: { label: 'オーストラリア博物館：Common Death Adder', url: 'https://australian.museum/learn/animals/reptiles/common-death-adder/' },
  },
  {
    id: 'redback', name: 'セアカゴケグモ', scientific: 'Latrodectus hasselti', habitat: 'australia', inJapan: true,
    sprite: 'spider', colors: ['#323841', '#1d2733', '#f16d5d'], level: 4,
    delivery: 'きばで かむ', home: 'オーストラリア原産。日本にも 定着', food: 'あみにかかった 虫など',
    fact: 'メスは 黒い丸いおなかに 赤いすじ。雨のかかりにくい ものかげに あみをつくるよ。',
    venom: 'メスは 神経にはたらく 毒をもつよ。オスはずっと小さく、この絵は メスのすがただよ。',
    clue: '黒い体の 赤いすじを さがそう',
    source: { label: '環境省：セアカゴケグモ', url: 'https://www.env.go.jp/nature/intro/2outline/attention/gokegumo.html' },
  },
  {
    id: 'black-mamba', name: 'ブラックマンバ', scientific: 'Dendroaspis polylepis', habitat: 'africa',
    sprite: 'serpent', colors: ['#9eaa9d', '#687875', '#dce0bc'], level: 5,
    delivery: 'きばで かむ', home: 'アフリカ東部・南部の 草地や木のある土地', food: '小さなほ乳類や 鳥',
    fact: '「ブラック」は 体の色ではなく 口の中の黒さから。体は 灰色や オリーブ色だよ。',
    venom: '神経にはたらく 強い毒をもつよ。長い体で 地面を進み、木にのぼることも できるんだ。',
    clue: '灰色がかった 細長いヘビを さがそう', source: adw('Dendroaspis polylepis'),
  },
  {
    id: 'puff-adder', name: 'パフアダー', scientific: 'Bitis arietans', habitat: 'africa',
    sprite: 'viper', colors: ['#c6ae70', '#544b39', '#eee0a2'], level: 4,
    delivery: 'きばで かむ', home: 'アフリカの 草地や ひらけた林など', food: 'ネズミなどの 小さな動物',
    fact: 'ずんぐりした体に 山形のもよう。じっと待ち、まわりの色に まぎれて えものをねらうよ。',
    venom: '長いきばと 毒をもつよ。草にかくれていて 気づかず近づくことがあるので、足もとにも注意。',
    clue: '山形もようの 太いヘビを さがそう', source: adw('Bitis arietans'),
  },
  {
    id: 'boomslang', name: 'ブームスラング', scientific: 'Dispholidus typus', habitat: 'africa',
    sprite: 'serpent', colors: ['#80bd65', '#3e7651', '#d3e89e'], level: 5,
    delivery: '奥のきばで かむ', home: 'サハラ砂漠より南の 木のある草地や林', food: 'トカゲや 鳥など',
    fact: '大きな目と 細い体で 木の上を移動するよ。緑色のものや 茶色のものがいるんだ。',
    venom: '口の奥のきばから 毒を入れるよ。血液のはたらきに影響する 強い毒なので、細いヘビでも 危険だよ。',
    clue: '緑色の 細いヘビを みつけよう', source: adw('Dispholidus typus'),
  },
  {
    id: 'spitting-cobra', name: 'モザンビークドクハキコブラ', scientific: 'Naja mossambica', habitat: 'africa',
    sprite: 'cobra', colors: ['#ad947e', '#624f47', '#e5ae91'], level: 4,
    delivery: 'きば・毒をとばす', home: 'アフリカ南東部の サバンナなど', food: 'カエルや 小さなほ乳類など',
    fact: '首をひろげて 大きく見せるよ。身をまもるために 毒をとばす コブラのなかま。',
    venom: 'かむだけでなく 敵にむけて 毒をとばすよ。目に入るのも危険。毒は 狩りにも 防御にも使うんだ。',
    clue: 'うす茶色の 首をひろげたヘビを さがそう',
    source: { label: 'パフォス動物園：Mozambique Spitting Cobra', url: 'https://www.pafoszoo.com/reptiles/mozambique-spitting-cobra' },
  },
  {
    id: 'king-cobra', name: 'キングコブラのなかま', scientific: 'Ophiophagus spp.', habitat: 'asia',
    sprite: 'cobra', colors: ['#a89b5b', '#595d3d', '#e9d290'], level: 5,
    delivery: 'きばで かむ', home: '南アジア・東南アジアの 森など', food: 'ほかのヘビなど',
    fact: 'とても長くなる 毒ヘビのなかま。メスは おちばを集めて たまごの巣をつくるよ。',
    venom: '神経にはたらく 毒をもつよ。ほかのヘビを食べることが多く、学名にも「ヘビを食べる」という意味があるんだ。',
    clue: '首を大きくひろげた 黄色みのヘビを さがそう',
    source: { label: 'サンディエゴ動物園：King Cobra', url: 'https://zoo.sandiegozoo.org/animals/king-cobra' },
  },
  {
    id: 'monocled-cobra', name: 'タイコブラ', scientific: 'Naja kaouthia', habitat: 'asia',
    sprite: 'cobra', colors: ['#b49b7c', '#68574a', '#f5e3b4'], level: 5,
    delivery: 'きばで かむ', home: '南アジア・東南アジアの 林や水辺など', food: 'ネズミや カエルなど',
    fact: '首のうしろの 丸いもようが 名前の由来。「ひとつの眼鏡」の コブラとも よばれるよ。',
    venom: 'きばから 強い毒を入れるよ。首のもようや色には 個体差があるので、もようだけでは 見分けきれないよ。',
    clue: '丸い首もようの コブラを さがそう',
    source: { label: 'トロント動物園：Monocled Cobra', url: 'https://www.torontozoo.com/animals/Monocled%20Cobra' },
  },
  {
    id: 'banded-krait', name: 'ガンガサヘビ', scientific: 'Bungarus fasciatus', habitat: 'asia',
    sprite: 'serpent', colors: ['#efd570', '#303c44', '#fff0a3'], level: 5,
    delivery: 'きばで かむ', home: '南アジア・東南アジアの 森や水辺', food: 'ほかのヘビなど',
    fact: '黄色と黒の 太いしまもよう。主に夜に活動し、ほかのヘビを さがして食べるよ。',
    venom: '神経にはたらく 強い毒をもつよ。昼におとなしく見えても 近づいて よいわけではないよ。',
    clue: '黄色と黒の 帯もようを さがそう',
    source: { label: 'チェンマイ動物園：Banded Krait', url: 'https://chiangmai.zoothailand.org/en/animal_view.php?c_id=&detail_id=220' },
  },
  {
    id: 'mangrove-viper', name: 'マングローブクサリヘビ', scientific: 'Trimeresurus purpureomaculatus', habitat: 'asia',
    sprite: 'viper', colors: ['#807c65', '#464d40', '#c6bd8b'], level: 4,
    delivery: 'きばで かむ', home: '東南アジアなどの マングローブ林', food: 'カエルや トカゲなど',
    fact: '海辺のマングローブの 枝でくらすよ。黒っぽい体が 木のかげに とけこむんだ。',
    venom: '長いきばから 毒を入れるよ。地面だけでなく 枝の上にも 毒のあるヘビが いるんだね。',
    clue: '木の色に似た 黒っぽいヘビを さがそう',
    source: { label: 'シンガポール国立公園局：Wetlands', url: 'https://www.nparks.gov.sg/docs/default-source/sbwr-wetlands-newsletter/wetlands-newsletter--vol-10-no-1.pdf' },
  },
]

export const MAX_RESIDENTS = 9
export type Resident = { id: number; speciesId: string; slot: number }
export type Exhibits = Record<HabitatId, Resident[]>

export function createExhibits(): Exhibits {
  return Object.fromEntries(HABITATS.map(habitat => [habitat.id,
    SPECIES.filter(s => s.habitat === habitat.id).slice(0, 3).map((s, index) => ({ id: SPECIES.indexOf(s) + 1, speciesId: s.id, slot: [3, 7, 2][index] })),
  ])) as Exhibits
}

export function addResident(exhibits: Exhibits, habitat: HabitatId, speciesId: string): Exhibits {
  if (!SPECIES.some(s => s.id === speciesId && s.habitat === habitat) || exhibits[habitat].length >= MAX_RESIDENTS) return exhibits
  const slot = Array.from({ length: MAX_RESIDENTS }, (_, i) => i).find(i => !exhibits[habitat].some(r => r.slot === i))!
  const id = Math.max(0, ...Object.values(exhibits).flat().map(r => r.id)) + 1
  return { ...exhibits, [habitat]: [...exhibits[habitat], { id, speciesId, slot }] }
}

export const RANKING = [5, 4, 3].map(level => ({ level, species: SPECIES.filter(s => s.level === level) }))
export const RANK_FILTERS = [
  { id: 'all', label: 'ぜんぶ' }, { id: 'japan', label: '日本にもいる' },
  { id: 'snake', label: 'ヘビ' }, { id: 'scorpion', label: 'サソリ' },
  { id: 'frog', label: 'カエル・イモリ' }, { id: 'sea', label: '海のなかま' },
] as const
export type RankFilter = typeof RANK_FILTERS[number]['id']
export function matchesRankFilter(species: Species, filter: RankFilter) {
  switch (filter) {
    case 'japan': return !!species.inJapan
    case 'snake': return ['snake', 'serpent', 'viper', 'cobra', 'sea-snake'].includes(species.sprite)
    case 'scorpion': return species.sprite === 'scorpion'
    case 'frog': return ['frog', 'toad', 'newt'].includes(species.sprite)
    case 'sea': return species.habitat === 'reef'
    default: return true
  }
}
export const LEVEL_LABELS: Record<number, string> = { 5: 'とても つよい', 4: 'つよい', 3: '毒がある' }
export const RANKING_NOTE = 'ゲーム内のめやすです。毒の成分・量・入り方で影響はかわり、ちがう生き物の毒を同じ条件で比べた科学的な順位ではありません。同じ段階は同順位です。低い段階でも安全ではありません。'

import type { CelestialBodyId, FeatureSpot } from '../types'

/**
 * 11天体の「特徴スポット」。タップすると説明カードが出る対象を、天体ごとの配列として持つ。
 *
 * 経緯度は `celestialBodies.ts` の模様(月の海・クレーター・火星の地形・大赤斑・大陸など)と
 * 同じ値をそのまま使う。これにより「テクスチャに描かれた模様の位置」と「タップで反応する3D位置」が
 * `three/planetCoords.ts` の変換式1本を経由して常に一致する(ズレたら `featureSpots.test.ts` の
 * 回帰テストで検出できる)。
 *
 * 太陽・水星・金星・天王星・海王星・冥王星は月・火星・木星・土星と同じく2〜3個。
 * 地球だけは大陸・海・極・大気を扱うため例外的に多め(Phase 4の仕様どおり)。
 * 地球の大陸・海のように「一点ではなく広い範囲」を指すスポットは、他天体より大きい
 * `hitRadiusPx`(代表点＋大きな当たり判定)にして、幼児が正確な一点を押さなくても反応するようにする。
 */
export const featureSpotsByBodyId: Record<CelestialBodyId, readonly FeatureSpot[]> = {
  sun: [
    {
      id: 'sun-self-lit',
      displayName: 'ひかる ほし',
      description: 'じぶんで ひかる、たいようけいの こうせいだよ。',
      target: { kind: 'surface', lonDeg: 0, latDeg: 5 },
      hitRadiusPx: 36,
      accentColor: '#ffe3a0',
    },
    {
      id: 'sun-center',
      displayName: 'たいようけいの ちゅうしん',
      description: 'わくせいたちは たいようの まわりを まわっているよ。',
      target: { kind: 'surface', lonDeg: -100, latDeg: 25 },
      hitRadiusPx: 36,
      accentColor: '#ffe3a0',
    },
    {
      id: 'sun-sunspot',
      displayName: 'たいようの くろい もよう',
      description: 'たいように ある、すこし くらい ところだよ。',
      target: { kind: 'surface', lonDeg: 20, latDeg: 12 },
      hitRadiusPx: 34,
      accentColor: '#ffe3a0',
    },
  ],
  mercury: [
    {
      id: 'mercury-closest',
      displayName: 'たいように いちばん ちかい',
      description: 'たいように いちばん ちかい わくせいだよ。',
      target: { kind: 'surface', lonDeg: 0, latDeg: 10 },
      hitRadiusPx: 34,
      accentColor: '#e0c9ab',
    },
    {
      id: 'mercury-craters',
      displayName: 'クレーター',
      description: 'いんせきが ぶつかって できた あなが たくさん あるよ。',
      target: { kind: 'surface', lonDeg: -30, latDeg: 10 },
      hitRadiusPx: 34,
      accentColor: '#e0c9ab',
    },
    {
      id: 'mercury-caloris',
      displayName: 'カロリスぼんち',
      description: 'おおきな いんせきが ぶつかって できた ちけいだよ。',
      target: { kind: 'surface', lonDeg: 165, latDeg: 30 },
      hitRadiusPx: 38,
      accentColor: '#e0c9ab',
    },
  ],
  venus: [
    {
      id: 'venus-clouds',
      displayName: 'あつい くも',
      description: 'きんせいは あつい くもに つつまれているよ。',
      target: { kind: 'surface', lonDeg: 0, latDeg: 10 },
      hitRadiusPx: 38,
      accentColor: '#f3dfae',
    },
    {
      id: 'venus-hottest',
      displayName: 'いちばん あつい わくせい',
      description: 'たいようけいで いちばん あつい わくせいだよ。',
      target: { kind: 'surface', lonDeg: -60, latDeg: -20 },
      hitRadiusPx: 34,
      accentColor: '#f3dfae',
    },
    {
      id: 'venus-volcano',
      displayName: 'かざんと こうち',
      description: 'くもの したには かざんや やまが あるみたいだよ。',
      target: { kind: 'surface', lonDeg: 90, latDeg: 0 },
      hitRadiusPx: 34,
      accentColor: '#f3dfae',
    },
  ],
  earth: [
    {
      id: 'continent-asia',
      displayName: 'アジア',
      description: 'せかいで いちばん おおきい たいりくだよ。',
      target: { kind: 'surface', lonDeg: 100, latDeg: 45 },
      hitRadiusPx: 52,
      accentColor: '#bfe0a0',
    },
    {
      id: 'continent-africa',
      displayName: 'アフリカ',
      description: 'あつい くにが おおい、おおきな たいりくだよ。',
      target: { kind: 'surface', lonDeg: 20, latDeg: 5 },
      hitRadiusPx: 50,
      accentColor: '#e6c98a',
    },
    {
      id: 'continent-europe',
      displayName: 'ヨーロッパ',
      description: 'たくさんの くにが あつまる ちいさめの たいりくだよ。',
      target: { kind: 'surface', lonDeg: 15, latDeg: 50 },
      hitRadiusPx: 46,
      accentColor: '#bfe0a0',
    },
    {
      id: 'continent-north-america',
      displayName: 'きたアメリカ',
      description: 'アメリカが ある、きたがわの たいりくだよ。',
      target: { kind: 'surface', lonDeg: -100, latDeg: 45 },
      hitRadiusPx: 50,
      accentColor: '#bfe0a0',
    },
    {
      id: 'continent-south-america',
      displayName: 'みなみアメリカ',
      description: 'ジャングルが ひろがる、みなみの たいりくだよ。',
      target: { kind: 'surface', lonDeg: -60, latDeg: -15 },
      hitRadiusPx: 48,
      accentColor: '#bfe0a0',
    },
    {
      id: 'continent-oceania',
      displayName: 'オーストラリア',
      description: 'みなみはんきゅうに ある、しまの たいりくだよ。',
      target: { kind: 'surface', lonDeg: 135, latDeg: -25 },
      hitRadiusPx: 44,
      accentColor: '#e6c98a',
    },
    {
      id: 'continent-antarctica',
      displayName: 'なんきょくたいりく',
      description: 'いちねんじゅう こおりに おおわれた たいりくだよ。',
      target: { kind: 'surface', lonDeg: 0, latDeg: -82 },
      hitRadiusPx: 44,
      accentColor: '#eef3f6',
    },
    {
      id: 'ocean-pacific',
      displayName: 'たいへいよう',
      description: 'せかいで いちばん おおきい うみだよ。',
      target: { kind: 'surface', lonDeg: -170, latDeg: 0 },
      hitRadiusPx: 52,
      accentColor: '#bfe0f0',
    },
    {
      id: 'ocean-atlantic',
      displayName: 'たいせいよう',
      description: 'アメリカと ヨーロッパの あいだに ある うみだよ。',
      target: { kind: 'surface', lonDeg: -30, latDeg: 0 },
      hitRadiusPx: 48,
      accentColor: '#bfe0f0',
    },
    {
      id: 'ocean-indian',
      displayName: 'インドよう',
      description: 'アジアと アフリカの みなみに ひろがる うみだよ。',
      target: { kind: 'surface', lonDeg: 75, latDeg: -10 },
      hitRadiusPx: 46,
      accentColor: '#bfe0f0',
    },
    {
      id: 'earth-north-pole',
      displayName: 'ほっきょく',
      description: 'きたの はしっこ。こおりの うみだよ。',
      target: { kind: 'surface', lonDeg: 60, latDeg: 87 },
      hitRadiusPx: 36,
      accentColor: '#eef3f6',
    },
    {
      id: 'earth-south-pole',
      displayName: 'なんきょく',
      description: 'みなみの はしっこ。とても さむい ばしょだよ。',
      target: { kind: 'surface', lonDeg: 150, latDeg: -87 },
      hitRadiusPx: 36,
      accentColor: '#eef3f6',
    },
    {
      id: 'earth-clouds',
      displayName: 'くもと たいき',
      description: 'ちきゅうは うすい くうきと くもに つつまれているよ。',
      target: { kind: 'surface', lonDeg: -30, latDeg: 20 },
      hitRadiusPx: 40,
      accentColor: '#ffffff',
    },
  ],
  moon: [
    {
      id: 'moon-mare',
      displayName: 'つきの うみ',
      description: 'くろく みえる たいらな ところだよ。うみと よばれるけど、みずは ないんだ。',
      target: { kind: 'surface', lonDeg: 31, latDeg: 8 },
      hitRadiusPx: 36,
      accentColor: '#ffe9b8',
    },
    {
      id: 'moon-crater',
      displayName: 'クレーター',
      description: 'いしが ぶつかって できた、まるい あなだよ。',
      target: { kind: 'surface', lonDeg: -11, latDeg: -43 },
      hitRadiusPx: 34,
      accentColor: '#ffe9b8',
    },
    {
      id: 'moon-far-side',
      displayName: 'つきの うらがわ',
      description: 'ちきゅうからは みえない がわだよ。クレーターが たくさん あるんだ。',
      target: { kind: 'surface', lonDeg: 180, latDeg: 0 },
      hitRadiusPx: 36,
      accentColor: '#ffe9b8',
    },
  ],
  mars: [
    {
      id: 'mars-olympus-mons',
      displayName: 'オリンポスさん',
      description: 'かせいに ある、とても おおきな やまだよ。ふじさんより ずっと たかいんだ。',
      target: { kind: 'surface', lonDeg: -134, latDeg: 18 },
      hitRadiusPx: 34,
      accentColor: '#ffd9a8',
    },
    {
      id: 'mars-valles-marineris',
      displayName: 'マリネリスきょうこく',
      spokenName: 'マリネリス きょうこく',
      description: 'とても ながくて ふかい たにだよ。',
      target: { kind: 'surface', lonDeg: -70, latDeg: -9 },
      hitRadiusPx: 40,
      accentColor: '#ffd9a8',
    },
    {
      id: 'mars-polar-cap',
      displayName: 'きょくの こおり',
      description: 'かせいの きたと みなみの はしに ある、しろい こおりだよ。',
      target: { kind: 'surface', lonDeg: -85, latDeg: 81 },
      hitRadiusPx: 34,
      accentColor: '#eaf4ff',
    },
  ],
  jupiter: [
    {
      id: 'jupiter-great-red-spot',
      displayName: 'だいせきはん',
      description: 'もくせいに ある、とても おおきな あらしだよ。ちきゅうより おおきいんだ。',
      target: { kind: 'surface', lonDeg: 0, latDeg: -22 },
      hitRadiusPx: 38,
      accentColor: '#ffd2b0',
    },
    {
      id: 'jupiter-belts',
      displayName: 'しまもよう',
      description: 'ながれる くもが、よこじまの もように みえるんだよ。',
      // 経度-60だと初期表示で惑星の縁に乗ってしまい、マーカーが球から浮いて見えるうえ、
      // 縞が潰れて見える位置になる。-10にすると円盤の内側(縁まで6割ほど)に入り、
      // 縞がいちばん読み取りやすい面へ来る(大赤斑とは画面上130px以上離れる)。
      target: { kind: 'surface', lonDeg: -10, latDeg: 20 },
      hitRadiusPx: 34,
      accentColor: '#ffe6c2',
    },
    {
      id: 'jupiter-gas',
      displayName: 'ガスの ほし',
      description: 'もくせいは ガスで できていて、たてる じめんが ないんだ。',
      target: { kind: 'surface', lonDeg: 70, latDeg: 4 },
      hitRadiusPx: 34,
      accentColor: '#ffe6c2',
    },
  ],
  saturn: [
    {
      id: 'saturn-rings',
      displayName: 'どせいの わ',
      description: 'こおりや いわの つぶが たくさん あつまって できているよ。',
      target: {
        kind: 'ring',
        radiusRatio: 1.74,
        angleDeg: 25,
        highlightSegmentIds: ['c-ring', 'b-ring', 'a-ring', 'f-ring'],
      },
      hitRadiusPx: 44,
      accentColor: '#fff2d0',
    },
    {
      id: 'saturn-ring-gap',
      displayName: 'わの すきま',
      description: 'わと わの あいだに ある、おおきな すきまだよ。',
      target: {
        kind: 'ring',
        radiusRatio: 1.985,
        angleDeg: 115,
        highlightRadiusBand: { innerRatio: 1.95, outerRatio: 2.02 },
      },
      hitRadiusPx: 32,
      accentColor: '#fff2d0',
    },
    {
      id: 'saturn-belts',
      displayName: 'どせいの しまもよう',
      description: 'どせいにも、うすい よこじまの もようが あるよ。',
      target: { kind: 'surface', lonDeg: 0, latDeg: 30 },
      hitRadiusPx: 34,
      accentColor: '#fff2d0',
    },
  ],
  uranus: [
    {
      id: 'uranus-tilt',
      displayName: 'よこだおれの じてん',
      description: 'てんのうせいは、よこに たおれたまま まわっているよ。',
      target: { kind: 'surface', lonDeg: 0, latDeg: 0 },
      hitRadiusPx: 36,
      accentColor: '#cfe9e2',
    },
    {
      id: 'uranus-ring',
      displayName: 'わ',
      description: 'うすくて みえにくい、わが あるんだよ。',
      target: {
        kind: 'ring',
        radiusRatio: 1.56,
        angleDeg: 30,
        highlightSegmentIds: ['epsilon-ring'],
      },
      hitRadiusPx: 40,
      accentColor: '#cfe9e2',
    },
    {
      id: 'uranus-atmosphere',
      displayName: 'あおみどりの たいき',
      description: 'メタンと いう ガスが、あおみどりに みせているよ。',
      target: { kind: 'surface', lonDeg: 40, latDeg: 20 },
      hitRadiusPx: 34,
      accentColor: '#cfe9e2',
    },
  ],
  neptune: [
    {
      id: 'neptune-storm',
      displayName: 'おおきな くろい しみ',
      description: 'だいあんてんと よばれる、おおきな あらしだよ。',
      target: { kind: 'surface', lonDeg: -20, latDeg: -22 },
      hitRadiusPx: 36,
      accentColor: '#aec4f2',
    },
    {
      id: 'neptune-winds',
      displayName: 'つよい かぜ',
      description: 'たいようけいで いちばん かぜが つよい わくせいだよ。',
      target: { kind: 'surface', lonDeg: 60, latDeg: 10 },
      hitRadiusPx: 34,
      accentColor: '#aec4f2',
    },
    {
      id: 'neptune-blue',
      displayName: 'こい あお',
      description: 'てんのうせいより こく みえる、あおい わくせいだよ。',
      target: { kind: 'surface', lonDeg: 150, latDeg: 30 },
      hitRadiusPx: 34,
      accentColor: '#aec4f2',
    },
  ],
  pluto: [
    {
      id: 'pluto-tombaugh',
      displayName: 'トンボーちいき',
      description: 'ハートの かたちに みえる、あかるい ちいきだよ。',
      target: { kind: 'surface', lonDeg: 20, latDeg: -5 },
      hitRadiusPx: 38,
      accentColor: '#f3e7d0',
    },
    {
      id: 'pluto-sputnik',
      displayName: 'スプートニクへいげん',
      description: 'こおりで できた、なめらかな ひろい だいちだよ。',
      target: { kind: 'surface', lonDeg: 30, latDeg: -8 },
      hitRadiusPx: 36,
      accentColor: '#f3e7d0',
    },
    {
      id: 'pluto-dwarf',
      displayName: 'じゅんわくせい',
      description: 'めいおうせいは、わくせいより ちいさい じゅんわくせいだよ。',
      target: { kind: 'surface', lonDeg: 15, latDeg: -20 },
      hitRadiusPx: 34,
      accentColor: '#f3e7d0',
    },
  ],
} as const

/** id から特徴スポットを引く。同じ天体には常に同じ配列インスタンスを返す(参照等価)。 */
export function featureSpotsFor(id: CelestialBodyId): readonly FeatureSpot[] {
  return featureSpotsByBodyId[id]
}

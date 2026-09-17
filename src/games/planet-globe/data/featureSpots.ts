import type { CelestialBodyId, FeatureSpot } from '../types'

/**
 * 11天体の「特徴スポット」。タップすると説明カードが出る対象を、天体ごとの配列として持つ。
 *
 * 経緯度は `celestialBodies.ts` の模様(月の海・クレーター・火星の地形・大赤斑・大陸など)と
 * 同じ値をそのまま使う。これにより「テクスチャに描かれた模様の位置」と「タップで反応する3D位置」が
 * `three/planetCoords.ts` の変換式1本を経由して常に一致する(ズレたら `featureSpots.test.ts` の
 * 回帰テストで検出できる)。
 *
 * 文面の方針:
 * - 1スポット＝「見えているもの1つ」＋「その理由か数量」。名前の言い換えで終わらせない。
 * - 天体ぜんたいの事実(大きさ・自転・温度)は、画面で見えている動きや形に結びつける。
 *   金星の逆回転・木星の扁平・天王星の横倒しは実際に描画しているので、押した子が見て確かめられる。
 * - 指しているものが描かれていない場所へマーカーを置かない。模様が無い天体(太陽・金星など)で
 *   天体ぜんたいの話をするときだけ、模様から離れた無地の面に置く。
 *
 * 配置の方針:
 * - 同一天体のスポットどうしは球面角で30°以上あける。これを下回るとデフォルトズームの画面上で
 *   `hitRadiusPx` どうしが重なり、幼児が狙って押し分けられなくなる(`featureSpots.test.ts` で検証)。
 * - 太陽・水星・金星・火星・木星・土星・天王星・海王星・冥王星・月は5〜6個。
 *   地球だけは大陸・海・極・大気を扱うため例外的に多め。
 * - 地球の大陸・海のように「一点ではなく広い範囲」を指すスポットは、他天体より大きい
 *   `hitRadiusPx`(代表点＋大きな当たり判定)にして、幼児が正確な一点を押さなくても反応するようにする。
 */
export const featureSpotsByBodyId: Record<CelestialBodyId, readonly FeatureSpot[]> = {
  sun: [
    {
      id: 'sun-self-lit',
      displayName: 'じぶんで ひかる ほし',
      description: 'じぶんで ひかって、ねつを だして いる ほしだよ。',
      target: { kind: 'surface', lonDeg: -25, latDeg: 35 },
      hitRadiusPx: 36,
      accentColor: '#ffe3a0',
    },
    {
      id: 'sun-heat',
      displayName: 'もえる ひょうめん',
      description: 'ひょうめんは やく 6000ど。とても あついよ。',
      target: { kind: 'surface', lonDeg: -140, latDeg: -8 },
      hitRadiusPx: 34,
      accentColor: '#ffe3a0',
    },
    {
      // 黒点は周りより2000度ほど温度が低く、その差で暗く見える。「暗い場所」ではなく理由を言う。
      id: 'sun-sunspot',
      displayName: 'くろてん',
      description: 'まわりより つめたいので、くろく みえる ところだよ。',
      target: { kind: 'surface', lonDeg: 20, latDeg: 12 },
      hitRadiusPx: 34,
      accentColor: '#ffe3a0',
    },
    {
      id: 'sun-sunspot-b',
      displayName: 'くろてんは かわる',
      description: 'くろてんは ふえたり へったり するんだよ。',
      target: { kind: 'surface', lonDeg: -55, latDeg: -18 },
      hitRadiusPx: 34,
      accentColor: '#ffe3a0',
    },
    {
      id: 'sun-size',
      displayName: 'ちきゅう 100こぶん',
      spokenName: 'ちきゅう ひゃっこぶん',
      description: 'よこに ちきゅうを 100こ ならべた くらい おおきいよ。',
      target: { kind: 'surface', lonDeg: -100, latDeg: 25 },
      hitRadiusPx: 34,
      accentColor: '#ffe3a0',
    },
    {
      id: 'sun-center',
      displayName: 'たいようけいの ちゅうしん',
      description: 'わくせいは みんな、たいようの まわりを まわって いるよ。',
      target: { kind: 'surface', lonDeg: 110, latDeg: -5 },
      hitRadiusPx: 36,
      accentColor: '#ffe3a0',
    },
  ],
  mercury: [
    {
      id: 'mercury-closest',
      displayName: 'たいように いちばん ちかい',
      description: 'たいように いちばん ちかくて、いちばん ちいさい わくせいだよ。',
      target: { kind: 'surface', lonDeg: 20, latDeg: -20 },
      hitRadiusPx: 34,
      accentColor: '#e0c9ab',
    },
    {
      // `mercury-crater-a` は光条(rays)付きで描いているので、説明でも白い筋に触れる。
      id: 'mercury-craters',
      displayName: 'クレーター',
      description: 'いんせきが ぶつかった あと。しろい すじも みえるね。',
      target: { kind: 'surface', lonDeg: -30, latDeg: 10 },
      hitRadiusPx: 34,
      accentColor: '#e0c9ab',
    },
    {
      id: 'mercury-caloris',
      displayName: 'カロリスぼんち',
      spokenName: 'カロリス ぼんち',
      description: 'とても おおきな いんせきが ぶつかって できた くぼみだよ。',
      target: { kind: 'surface', lonDeg: 165, latDeg: 30 },
      hitRadiusPx: 38,
      accentColor: '#e0c9ab',
    },
    {
      id: 'mercury-no-air',
      displayName: 'くうきが ない',
      description: 'くうきが ないから、クレーターが ずっと きえないんだ。',
      target: { kind: 'surface', lonDeg: -95, latDeg: -12 },
      hitRadiusPx: 34,
      accentColor: '#e0c9ab',
    },
    {
      id: 'mercury-hot-cold',
      displayName: 'あつい ひる、さむい よる',
      description: 'ひるは やけるほど あつく、よるは こおるほど さむいよ。',
      target: { kind: 'surface', lonDeg: 60, latDeg: -35 },
      hitRadiusPx: 34,
      accentColor: '#e0c9ab',
    },
  ],
  venus: [
    {
      id: 'venus-clouds',
      displayName: 'ぶあつい くも',
      description: 'ほし ぜんたいが ぶあつい くもに つつまれて いるよ。',
      target: { kind: 'surface', lonDeg: 0, latDeg: 10 },
      hitRadiusPx: 38,
      accentColor: '#f3dfae',
    },
    {
      id: 'venus-hottest',
      displayName: 'いちばん あつい わくせい',
      description: 'くもが ねつを とじこめて、450どより あつく なるよ。',
      target: { kind: 'surface', lonDeg: -60, latDeg: -20 },
      hitRadiusPx: 34,
      accentColor: '#f3dfae',
    },
    {
      // 金星だけ`spinSpeed`が負(逆回転)。押した子が画面の回り方で確かめられる事実にする。
      id: 'venus-backspin',
      displayName: 'ぎゃくむきに まわる',
      description: 'ほかの わくせいと ぎゃくむきに、ゆっくり まわって いるよ。',
      target: { kind: 'surface', lonDeg: 140, latDeg: -5 },
      hitRadiusPx: 34,
      accentColor: '#f3dfae',
    },
    {
      id: 'venus-twin',
      displayName: 'ちきゅうと おなじくらい',
      description: 'おおきさが ちきゅうと そっくりな わくせいだよ。',
      target: { kind: 'surface', lonDeg: -150, latDeg: 25 },
      hitRadiusPx: 34,
      accentColor: '#f3dfae',
    },
    {
      id: 'venus-evening-star',
      displayName: 'よいの みょうじょう',
      description: 'ゆうがたの そらで いちばん あかるく ひかる ほしだよ。',
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
      // 南極大陸と南極点は幼児にとって同じ場所で、球面上でも10°ほどしか離れず
      // マーカーが重なって押し分けられなかった。1つに統合し、南極点は説明文で触れる。
      id: 'continent-antarctica',
      displayName: 'なんきょくたいりく',
      description: 'こおりに おおわれた たいりく。みなみの はしっこだよ。',
      target: { kind: 'surface', lonDeg: 150, latDeg: -87 },
      hitRadiusPx: 44,
      accentColor: '#eef3f6',
    },
    {
      id: 'ocean-pacific',
      displayName: 'たいへいよう',
      description: 'ちきゅうの ほとんどは うみ。いちばん おおきいのが ここだよ。',
      target: { kind: 'surface', lonDeg: -170, latDeg: 0 },
      hitRadiusPx: 52,
      accentColor: '#bfe0f0',
    },
    {
      // 経度-30・緯度0だと`earth-clouds`(雲パッチ)と20°しか離れず重なっていたため、
      // 同じ大西洋の中で南へ寄せる。南アメリカ・アフリカ・雲のどれとも30°以上あく。
      id: 'ocean-atlantic',
      displayName: 'たいせいよう',
      description: 'アメリカと ヨーロッパの あいだに ある うみだよ。',
      target: { kind: 'surface', lonDeg: -28, latDeg: -25 },
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
      // 北極は大陸ではなく氷の海なので、南極とちがって大陸スポットと重複しない。
      id: 'earth-north-pole',
      displayName: 'ほっきょく',
      description: 'きたの はしっこ。こおりの うみだよ。',
      target: { kind: 'surface', lonDeg: 60, latDeg: 87 },
      hitRadiusPx: 36,
      accentColor: '#eef3f6',
    },
    {
      id: 'earth-clouds',
      displayName: 'くもと たいき',
      description: 'くうきが あるから、いきものが いきて いけるんだよ。',
      target: { kind: 'surface', lonDeg: -30, latDeg: 20 },
      hitRadiusPx: 40,
      accentColor: '#ffffff',
    },
  ],
  moon: [
    {
      // `mare-tranquillitatis`(静かの海)＝アポロ11号の着陸地点。座標はそのまま使える。
      id: 'moon-mare',
      displayName: 'つきの うみ',
      description: 'くろく みえる たいらな ところ。ここに ひとが おりたよ。',
      target: { kind: 'surface', lonDeg: 31, latDeg: 8 },
      hitRadiusPx: 36,
      accentColor: '#ffe9b8',
    },
    {
      id: 'moon-procellarum',
      displayName: 'あらしの おおよう',
      description: 'いちばん ひろい くろい ところ。みずは ないんだよ。',
      target: { kind: 'surface', lonDeg: -57, latDeg: 19 },
      hitRadiusPx: 38,
      accentColor: '#ffe9b8',
    },
    {
      // ティコは光条(rays)付きで描いているので、説明でも白い筋に触れる。
      id: 'moon-crater',
      displayName: 'ティコ クレーター',
      description: 'いんせきの あと。しろい すじが まわりに のびて いるよ。',
      target: { kind: 'surface', lonDeg: -11, latDeg: -43 },
      hitRadiusPx: 34,
      accentColor: '#ffe9b8',
    },
    {
      id: 'moon-far-side',
      displayName: 'つきの うらがわ',
      description: 'つきは いつも おなじ めんを ちきゅうに むけて いるよ。',
      target: { kind: 'surface', lonDeg: 165, latDeg: 5 },
      hitRadiusPx: 36,
      accentColor: '#ffe9b8',
    },
    {
      id: 'moon-no-air',
      displayName: 'くうきが ない',
      description: 'かぜも あめも ないから、あしあとが きえないんだ。',
      target: { kind: 'surface', lonDeg: -9, latDeg: 51 },
      hitRadiusPx: 34,
      accentColor: '#ffe9b8',
    },
    {
      // 重力は指せる模様が無い「天体ぜんたいの話」なので、海やクレーターから離れた
      // 無地の高地に置く(いちばん近い模様まで46°)。
      id: 'moon-gravity',
      displayName: 'からだが かるく なる',
      description: 'つきでは からだが 6ぶんの1の おもさに なるよ。',
      target: { kind: 'surface', lonDeg: 75, latDeg: -45 },
      hitRadiusPx: 34,
      accentColor: '#ffe9b8',
    },
  ],
  mars: [
    {
      id: 'mars-red',
      displayName: 'あかい りゆう',
      description: 'じめんの てつが さびて、あかく みえて いるんだよ。',
      target: { kind: 'surface', lonDeg: 20, latDeg: 20 },
      hitRadiusPx: 38,
      accentColor: '#ffd9a8',
    },
    {
      id: 'mars-olympus-mons',
      displayName: 'オリンポスさん',
      description: 'たいようけいで いちばん たかい やま。ふじさんの 6ばい だよ。',
      target: { kind: 'surface', lonDeg: -134, latDeg: 18 },
      hitRadiusPx: 34,
      accentColor: '#ffd9a8',
    },
    {
      id: 'mars-valles-marineris',
      displayName: 'マリネリスきょうこく',
      spokenName: 'マリネリス きょうこく',
      description: '4000キロも つづく たに。ふじさんが すっぽり はいる ふかさだよ。',
      target: { kind: 'surface', lonDeg: -70, latDeg: -9 },
      hitRadiusPx: 40,
      accentColor: '#ffd9a8',
    },
    {
      id: 'mars-syrtis',
      displayName: 'シルチス',
      description: 'かぜで すなが とばされて、くろい いわが みえて いるよ。',
      target: { kind: 'surface', lonDeg: 70, latDeg: 8 },
      hitRadiusPx: 38,
      accentColor: '#ffd9a8',
    },
    {
      id: 'mars-hellas',
      displayName: 'ヘラスぼんち',
      spokenName: 'ヘラス ぼんち',
      description: 'おおきな いんせきが ぶつかって できた、ふかい くぼみだよ。',
      target: { kind: 'surface', lonDeg: 70, latDeg: -42 },
      hitRadiusPx: 38,
      accentColor: '#ffd9a8',
    },
    {
      id: 'mars-polar-cap',
      displayName: 'きょくの こおり',
      description: 'みずと ドライアイスの こおり。きせつで おおきさが かわるよ。',
      target: { kind: 'surface', lonDeg: -85, latDeg: 81 },
      hitRadiusPx: 34,
      accentColor: '#eaf4ff',
    },
  ],
  jupiter: [
    {
      id: 'jupiter-largest',
      displayName: 'いちばん おおきい わくせい',
      description: 'ちきゅうが 1300こも はいる、いちばん おおきい わくせいだよ。',
      target: { kind: 'surface', lonDeg: 70, latDeg: 4 },
      hitRadiusPx: 38,
      accentColor: '#ffe6c2',
    },
    {
      id: 'jupiter-great-red-spot',
      displayName: 'だいせきはん',
      description: 'ちきゅうが すっぽり はいる おおきな あらしだよ。',
      target: { kind: 'surface', lonDeg: 0, latDeg: -22 },
      hitRadiusPx: 38,
      accentColor: '#ffd2b0',
    },
    {
      id: 'jupiter-belts',
      displayName: 'しまもよう',
      // 経度-60だと初期表示で惑星の縁に乗ってしまい、マーカーが球から浮いて見えるうえ、
      // 縞が潰れて見える位置になる。-10にすると円盤の内側(縁まで6割ほど)に入り、
      // 縞がいちばん読み取りやすい面へ来る(大赤斑とは画面上130px以上離れる)。
      description: 'ながれる くもが、よこじまの もように みえるんだよ。',
      target: { kind: 'surface', lonDeg: -10, latDeg: 20 },
      hitRadiusPx: 34,
      accentColor: '#ffe6c2',
    },
    {
      id: 'jupiter-white-oval',
      displayName: 'しろい うずまき',
      description: 'だいせきはんより ちいさい、しろい あらしだよ。',
      target: { kind: 'surface', lonDeg: 52, latDeg: -33 },
      hitRadiusPx: 34,
      accentColor: '#ffe6c2',
    },
    {
      id: 'jupiter-gas',
      displayName: 'ガスの ほし',
      description: 'ガスで できて いて、たてる じめんが ないんだ。',
      target: { kind: 'surface', lonDeg: -160, latDeg: 0 },
      hitRadiusPx: 34,
      accentColor: '#ffe6c2',
    },
    {
      // `flattening: 0.065` で実際に少しつぶれた形を描いているので、その理由を説明する。
      id: 'jupiter-fast-spin',
      displayName: 'はやい じてん',
      description: '10じかんで 1かい まわるから、すこし つぶれて いるよ。',
      target: { kind: 'surface', lonDeg: -120, latDeg: 16 },
      hitRadiusPx: 34,
      accentColor: '#ffe6c2',
    },
  ],
  saturn: [
    {
      id: 'saturn-rings',
      displayName: 'どせいの わ',
      description: 'こおりや いわの つぶが たくさん あつまって できて いるよ。',
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
      displayName: 'カッシーニの すきま',
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
      // 輪の幅は何十万kmもあるのに厚みは数十m〜1km程度。外側のA環・F環を光らせて、
      // `saturn-rings`(輪ぜんたい)とハイライトが同じにならないようにする。
      id: 'saturn-ring-thin',
      displayName: 'わは とても うすい',
      description: 'よこから みると きえそうなほど うすい わなんだよ。',
      target: {
        kind: 'ring',
        radiusRatio: 2.2,
        angleDeg: 200,
        highlightSegmentIds: ['a-ring', 'f-ring'],
      },
      hitRadiusPx: 36,
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
    {
      id: 'saturn-float',
      displayName: 'みずに うかぶ ほし',
      description: 'とても かるいので、おおきな みずに うかぶほどだよ。',
      target: { kind: 'surface', lonDeg: -120, latDeg: -10 },
      hitRadiusPx: 34,
      accentColor: '#fff2d0',
    },
  ],
  uranus: [
    {
      // `axialTiltDegrees: 97.77` で実際に横倒しに描いているので、見たままを説明する。
      id: 'uranus-tilt',
      displayName: 'よこだおれの じてん',
      description: 'よこに たおれた まま、ころがる ように まわって いるよ。',
      target: { kind: 'surface', lonDeg: 0, latDeg: 0 },
      hitRadiusPx: 36,
      accentColor: '#cfe9e2',
    },
    {
      id: 'uranus-ring',
      displayName: 'てんのうせいの わ',
      description: 'ほそくて くらい わが、たてむきに ならんで いるよ。',
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
      // `uranus-storm`(白い雲の渦)の真上。以前はここに大気の色の説明を置いていて、
      // 「見えているもの」と「説明」がずれていた。
      id: 'uranus-storm',
      displayName: 'しろい くも',
      description: 'たまに あらわれる、しろい くもの かたまりだよ。',
      target: { kind: 'surface', lonDeg: 40, latDeg: 20 },
      hitRadiusPx: 34,
      accentColor: '#cfe9e2',
    },
    {
      id: 'uranus-atmosphere',
      displayName: 'あおみどりの たいき',
      description: 'メタンと いう ガスが、あおみどりに みせて いるよ。',
      target: { kind: 'surface', lonDeg: -70, latDeg: -10 },
      hitRadiusPx: 34,
      accentColor: '#cfe9e2',
    },
    {
      id: 'uranus-cold',
      displayName: 'いちばん つめたい',
      description: 'たいようけいで いちばん つめたい たいきを もつ わくせいだよ。',
      target: { kind: 'surface', lonDeg: 130, latDeg: 25 },
      hitRadiusPx: 34,
      accentColor: '#cfe9e2',
    },
  ],
  neptune: [
    {
      id: 'neptune-farthest',
      displayName: 'いちばん とおい わくせい',
      description: 'たいようから いちばん とおい わくせいだよ。',
      target: { kind: 'surface', lonDeg: 150, latDeg: 30 },
      hitRadiusPx: 34,
      accentColor: '#aec4f2',
    },
    {
      id: 'neptune-storm',
      displayName: 'だいあんてん',
      description: 'おおきな あらし。きえたり あらわれたり するんだよ。',
      target: { kind: 'surface', lonDeg: -20, latDeg: -22 },
      hitRadiusPx: 36,
      accentColor: '#aec4f2',
    },
    {
      id: 'neptune-winds',
      displayName: 'つよい かぜ',
      description: 'しんかんせんの 7ばい はやい かぜが ふいて いるよ。',
      target: { kind: 'surface', lonDeg: 60, latDeg: 10 },
      hitRadiusPx: 34,
      accentColor: '#aec4f2',
    },
    {
      id: 'neptune-blue',
      displayName: 'こい あお',
      description: 'メタンの ガスが、てんのうせいより こい あおに みせて いるよ。',
      target: { kind: 'surface', lonDeg: -110, latDeg: 15 },
      hitRadiusPx: 34,
      accentColor: '#aec4f2',
    },
    {
      id: 'neptune-year',
      displayName: '1ねんが 165ねん',
      spokenName: 'いちねんが ひゃくろくじゅうごねん',
      description: 'たいようを 1しゅう するのに 165ねんも かかるよ。',
      target: { kind: 'surface', lonDeg: 100, latDeg: -35 },
      hitRadiusPx: 34,
      accentColor: '#aec4f2',
    },
  ],
  pluto: [
    {
      // トンボー地域(ハート)とスプートニク平原(その中の氷の平原)は球面上で10°しか離れず、
      // マーカーが完全に重なって押し分けられなかったので1つに統合する。
      id: 'pluto-tombaugh',
      displayName: 'ハートの もよう',
      description: 'ハートに みえる、ちっそが こおった あかるい だいちだよ。',
      target: { kind: 'surface', lonDeg: 20, latDeg: -5 },
      hitRadiusPx: 38,
      accentColor: '#f3e7d0',
    },
    {
      id: 'pluto-dark',
      displayName: 'くろい もよう',
      description: 'ハートの となりに ある、くろっぽい ちいきだよ。',
      target: { kind: 'surface', lonDeg: -120, latDeg: 0 },
      hitRadiusPx: 36,
      accentColor: '#f3e7d0',
    },
    {
      id: 'pluto-dwarf',
      displayName: 'むかしは わくせいだった',
      description: 'いまは じゅんわくせいと よばれて いるよ。',
      target: { kind: 'surface', lonDeg: -60, latDeg: 30 },
      hitRadiusPx: 34,
      accentColor: '#f3e7d0',
    },
    {
      id: 'pluto-cold',
      displayName: 'とても さむい',
      description: 'とおくて さむく、たいようも ちいさく みえるよ。',
      target: { kind: 'surface', lonDeg: 140, latDeg: 20 },
      hitRadiusPx: 34,
      accentColor: '#f3e7d0',
    },
    {
      id: 'pluto-small',
      displayName: 'つきより ちいさい',
      description: 'ちきゅうの つきより ちいさい、こおりの ほしだよ。',
      target: { kind: 'surface', lonDeg: -170, latDeg: -45 },
      hitRadiusPx: 34,
      accentColor: '#f3e7d0',
    },
  ],
} as const

/** id から特徴スポットを引く。同じ天体には常に同じ配列インスタンスを返す(参照等価)。 */
export function featureSpotsFor(id: CelestialBodyId): readonly FeatureSpot[] {
  return featureSpotsByBodyId[id]
}

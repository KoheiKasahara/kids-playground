import type { CelestialBodyId, FeatureSpot } from '../types'

/**
 * 4天体・各3個の「特徴スポット」。タップすると説明カードが出る対象を、天体ごとの配列として持つ。
 *
 * 経緯度は Phase 2 の `celestialBodies.ts` の模様(月の海・クレーター・火星の地形・大赤斑)と
 * 同じ値をそのまま使う。これにより「テクスチャに描かれた模様の位置」と「タップで反応する3D位置」が
 * `three/planetCoords.ts` の変換式1本を経由して常に一致する(ズレたら `featureSpots.test.ts` の
 * 回帰テストで検出できる)。
 *
 * 角度・経緯度・当たり判定半径の値は、各天体の既定視点・軸傾き・扁平・カメラ距離から
 * 実際に遮蔽計算を行って確定した値なので、見た目の都合だけで変更しないこと
 * (初期表示で12個中11個が見え、`moon-far-side`だけは回して見つける裏側という設計)。
 */
export const featureSpotsByBodyId: Record<CelestialBodyId, readonly FeatureSpot[]> = {
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
} as const

/** id から特徴スポットを引く。同じ天体には常に同じ配列インスタンスを返す(参照等価)。 */
export function featureSpotsFor(id: CelestialBodyId): readonly FeatureSpot[] {
  return featureSpotsByBodyId[id]
}

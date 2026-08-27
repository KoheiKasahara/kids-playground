# たいようけい 設計

## 目的

4〜5歳の子どもが、クイズを解くのではなく、太陽系の天体をさわって回しながら「天体ごとに見た目がちがう」ことに興味を持つためのミニゲームです。画面を開くとすぐに天体を操作でき、下部のボタンで別の天体へ切り替えられます。

Phase 1のゴールは見た目の作り込みではなく、操作・天体切り替え・データ構造・3D表示基盤をきれいに成立させることでした。Phase 2では、そのデータ駆動構造を保ったまま4天体（月・火星・木星・土星）の見た目を高品質化しました。Phase 3では、天体上の「特徴スポット」をタップすると説明カードが出て、よみあげと軽い効果音で応える遊びを足しました。Phase 4（本書が対象）では、ゲーム名を「わくせいぎ」から**「たいようけい」**へ変更し、太陽・水星・金星・地球・天王星・海王星・冥王星の7天体を追加して、合計11天体を個別観察できるようにしました。太陽系全体表示・公転・実距離実サイズ再現・クイズはPhase 5（見た目の仕上げ）・Phase 6（全体表示）以降に残します。

## データ

- 11天体の定義は `src/games/planet-globe/data/celestialBodies.ts` の `celestialBodies` を使う。表示順は太陽から外側へ向かう実際の並び `sun, mercury, venus, earth, moon, mars, jupiter, saturn, uranus, neptune, pluto`（月だけは衛星として地球の直後）で固定する。
- 各天体は `CelestialBody`（`src/games/planet-globe/types.ts`）として、**分類（`kind: 'star' | 'planet' | 'moon' | 'dwarf-planet'`）**・表示半径・扁平・自転軸の傾き・自転速度・表面模様・素材・ライティング・ズーム倍率・視点上書き・（土星・天王星のみ）輪を1つのオブジェクトにまとめて持つ。太陽は恒星、月は衛星、冥王星は準惑星として`kind`を持ち、「全部わくせい」として扱わない。
- **天体ごとの `if (id === 'saturn')` のような分岐は画面にも3Dエンジンにも書かない。** 唯一の例外は `SurfaceSpec` の `style: 'rocky' | 'gas'` という判別可能ユニオンで、岩石天体(月・火星・水星・地球・冥王星)とガス/雲の天体(木星・土星・太陽・金星・天王星・海王星)は生成アルゴリズムが本質的に別物なので「2つの生成器」として実装している。Phase 4で追加した7天体も、この2生成器の流用だけで表現しており、新しい生成器は追加していない。輪の有無は `body.ring` が定義されているかどうかで決まる(Phase 4で天王星にも簡易的な1本の輪を追加し、土星専用の構造ではないことを確認した)。
- 太陽の発光感だけは、`material` に追加した任意フィールド `emissive` / `emissiveIntensity` で表現する。恒星は影側でも真っ暗にならないようにするための最小限の拡張で、`usePlanetEngine.ts` は値がある天体だけ `MeshStandardMaterial.emissive` を設定する(データ駆動のままで、天体別分岐は増やしていない)。
- 表面の模様(月の海・クレーター・火星の暗色域や極冠・木星土星の帯や大赤斑)はすべて経度・緯度(度)で定義する。Phase 3の特徴スポット(後述)のタップ判定も、この経緯度と`id`をそのまま使っている。
- 天体の選択状態とズーム段階は `PlanetGlobePlay` が持ち、3Dエンジンへ `UsePlanetEngineOptions` として渡す。

## 操作

- 天体本体をドラッグして回す（`OrbitControls`、回転のみ）。指が少し動いただけで暴れないよう`rotateSpeed`は0.5、縦方向は上下68度で止めて天体がひっくり返らないようにする。
- 右下の `＋` で近づき、`−` ではなれる。ズームは0〜3の4段階で、範囲外には進まない。
- 画面下の天体選択バーで別の天体をタップすると、その場でモデルを差し替え、ズームは必ず0（全体表示）へ戻る。
- 左上の「もどる」でホーム画面へ戻る。

## URL

```text
/games/planet-globe
```

開始画面や結果画面は設けず、URLから直接ビューワーを表示する。天体ごとにルートを分けず、1画面の中で天体を切り替える。three.jsを含むため、ルートでは遅延読み込みを使う。

## レイアウト

`earth-globe`のフルブリード＋オーバーレイ構成とは変えて、**下部に天体選択バーを持つ縦積み**にする。

```text
┌─────────────────────────┐
│         (header)         │  ← 3D領域にオーバーレイ、pointer-events:none
│                          │
│      3D表示領域(stage)    │  ← ドラッグ操作を受け取る
│                     [+]  │
│                     [-]  │
├─────────────────────────┤
│ たいよう すいせい きんせい ちきゅう… →│  ← 天体選択バー(bottom bar、横スクロール)
└─────────────────────────┘
```

3D領域と選択バーをbodyの`flex-direction: column`で縦に並べ、重ならないことを構造で保証する（`earth-globe`のように全面オーバーレイにすると、選択バーがタップ操作の邪魔になりやすいため）。`100dvh`とsafe-area用トークンを使い、320px程度の狭い画面や低い横画面でも操作ボタンが画面外へ出ないようにする。`prefers-reduced-motion`が有効な場合はCSSのtransitionを止める。3Dエンジン側も初期化時に同じメディアクエリを一度だけ読み、自転とズームのアニメーションを止める（他の3Dゲームと同じ方式で、変更の購読はしない）。背景の宇宙グラデーション(CSS)には星を点描せず、星はWebGL側(`three/starField.ts`)に置く(理由は「星」節を参照)。

Phase 4で4天体から11天体へ増えたため、選択バー(`ui/BodySelector.tsx`)は横一列を均等分割する方式から**横スクロール**へ変更した。ボタン1個の大きさ(`--tap-target-min`基準)と1行ぶんの高さは天体数に関わらず一定に保ち、天体が増えても縦画面のレイアウト予算(ヘッダー・3D領域・選択バーの高さ配分)を圧迫しないようにしている。カテゴリ分け(太陽・惑星・月・準惑星)によるタブ切り替えは、操作をかえって複雑にすると判断して採用せず、表示順そのものを太陽から外側への実際の並びにすることで分類の手がかりにしている。

## 3D実装

- `three`（生のAPI、React Three Fiberは使わない）だけを使い、`src/games/planet-globe/three/usePlanetEngine.ts` でカメラ・レンダラー・シーン・`OrbitControls`を組み立てる。`domino-flag`・`earth-globe`と同じ「hookがThree.jsのライフサイクルを完結させ、`registerContainer`でDOM要素を受け取る」構成に揃えている。
- シーン構成は次の1本の階層だけ:
  ```text
  scene
  ├─ AmbientLight / HemisphereLight / DirectionalLight(主光) / DirectionalLight(補助光)  ← 初期化時に1回だけ作る
  ├─ StarField: Points                       ← 初期化時に1回だけ作る。天体切り替えでは作り直さない
  └─ bodyRoot: Group                          ← 天体を差し替える器
       └─ tiltGroup: Group                    ← 自転軸の傾き
            ├─ spinGroup: Group               ← 自転
            │    └─ sphere: Mesh（共有ジオメトリ・天体ごとのマテリアル）
            └─ ringMesh[]?: Mesh              ← 輪は複数セグメント、自転させない
  ```
- 球のジオメトリ（`SphereGeometry(1, 64, 48)`）はエンジンで1つだけ作って全天体で共有し、`mesh.scale`で大きさ(と扁平)を表現する。天体を切り替えるたびに作り直すのはマテリアルだけで、共有ジオメトリはunmount時のみdisposeする。
- ズームは`three/planetCamera.ts`の`cameraDistanceForZoom`で、「天体（輪を含む）がちょうど画面に収まる距離」の倍率（`zoom.outMargin`→`zoom.inMargin`）として持つ。絶対距離ではなく倍率にすることで、縦画面・横画面のどちらでも天体全体が切れずに収まる。土星は輪の最外周セグメントまで含めた半径(`planetRing.ringOuterRadiusRatio`)を使うため、輪が画面から見切れることはない（`planetCamera.test.ts`で全天体・縦横2アスペクトを回帰テストしている）。
- カメラの初期方向は`planetCamera.ts`の`viewDirectionOf(body)`で決まる。既定は`DEFAULT_VIEW_DIRECTION`だが、`body.viewDirection`を持つ天体(土星)はそれを使う。**天体を切り替えるたびにこの向きへ戻す**。真正面(0,0,1)から見ると、Z軸まわりで表している軸傾き（`planetRing.axialTiltRotationZ`）の輪の平面に視線が含まれてしまい、土星の輪が線に潰れて見えるため、土星だけ輪をより開いて見せる角度を個別に指定している。この視点で輪が潰れないことは`planetRing.test.ts`で回帰テストしている。

## 座標規約

`three/planetCoords.ts` に、経緯度とテクスチャUV・自転角の変換を一本化してある。

- `lonToU(lonDeg)`: 経度(-180..180) → テクスチャU(0..1)。lon=0がu=0.5(テクスチャ中央)。周期的な変換で、-180と180は同じ点(u=0)を指す。
- `latToV(latDeg)`: 緯度(+90..-90) → テクスチャV(0..1)。北極(+90)がv=0(Canvasの上端)。
- `rotationYFacing(u)`: テクスチャU上の点をカメラ正面(+Z)へ向けるための`spinGroup.rotation.y`。`SphereGeometry(phiStart=0)`ではu=0が-X、u=0.25が+Zを向くため`θ = π/2 - 2πu`。

`celestialBodies.ts`の`initialRotationY`は、この式を使って「その天体の特徴的な地形が最初から見える経度」から逆算して書く(生の数値をハードコードしない)。Phase 3の特徴スポット(後述)の3D位置も、`surfaceDirection`としてこの式から導いている。

## テクスチャ

新規画像・バイナリ素材は追加せず、すべてCanvas 2Dへ手続き的に描いてから`THREE.CanvasTexture`にする。解像度は表面が1024×512(バンプも同じ)、輪が512×2で固定し、これ以上は上げない。ピクセルループは`ImageData`の`Uint8ClampedArray`へ直接書き込み、1pxずつの`fillRect`は使わない。

### 岩石天体(月・火星): `three/planetSurface.ts`のrocky生成器

1. `ImageData`を1パスで埋める: 緯度プロファイル(`latitudeStops`)の色に、`three/noise.ts`の決定的な値ノイズ(`fbm2D`)を`noise.amount`の重みで混ぜる。fbmは各オクターブの平均のため値が0.5付近へ集まりやすく、そのままでは地表が「のっぺりしたプラスチック」に見える。`noise.contrast`で0.5を中心に広げてから使う。
2. 経度0度をまたぐ図形は反対側にも複製して描く(継ぎ目でクレーターが半分だけ表示される見た目を防ぐ)。
3. `patches`(月の海、火星の暗色域・オリンポス山・マリネリス峡谷)を楕円のグラデーションで重ねる。
4. `polarCaps`(火星の極冠)は、縁を`polarCapEdgeLatDeg`(経度の低い周波数の正弦波の和)で大きくうねらせた形に塗る。経度ごとに独立した乱数でギザギザにすると、極付近ほどテクスチャの横方向が球面上で圧縮されるため放射状のトゲ(太陽のフレアのような見た目)になってしまうため、揺らぎは必ず低周波にする。さらに、縁を少しずつ外へ広げた薄い層を重ねて境界を霜のようにぼかす(層が少ないと等高線のような段が見える)。
5. `craters`(名前付き。ティコは光条`rays`付き)と`scatteredCraters`(seedから決定的に散らす小クレーター)を、明るい縁→暗い底の同心円グラデーション+薄いエジェクタハロで描く。
6. バンプマップ(同解像度)には、全体の弱いざらつき+`patches[].relief`+クレーターの凹凸を描く。ガス惑星ではバンプマップを作らない(岩石質感になってしまうため)。

### ガス惑星(木星・土星): `three/planetSurface.ts`のgas生成器

1. `ImageData`を1パスで埋める: 緯度方向の`belts`をX方向に長く伸びたfbm(`turbulence`)で波打たせ(帯の境界が横に流れるガスの筋に見える)、さらに細かい`mottle`で明暗のむらを足す。
2. `spots`(大赤斑、白斑、NEBの樽状模様)を楕円グラデーション+渦の螺旋(`swirl`)で重ねる。
3. バンプマップは作らない。

### 輪(土星): `three/planetRing.ts`

- 輪は1本の帯ではなく、C環・B環・A環・F環の**セグメント**(`RingSegment`)に分け、セグメントごとに1枚の`RingGeometry`+512×2のテクスチャを作る。カッシーニ間隙・エンケ間隙のうち、カッシーニ間隙は**セグメント間の実際の幾何的すき間**(inner/outerRadiusRatioの差)として、エンケ間隙は帯の中のopacityの落ち込みとして表現する。
- テクスチャは`createLinearGradient`ではなく`ImageData`へ直接書く。径方向の帯の色(`sampleRingBands`)に、`ringlets`(細いリングレットの濃淡)をノイズで変調して重ねるため。

### 共通

- jsdomのように`getContext('2d')`が使えない環境では、例外を投げず`null`を返す(呼び出し側は地色・帯の代表色の単色マテリアルへフォールバックする)。

## ライティング・影

- `three/planetLighting.ts`に、アンビエント・半球光・主光(`DirectionalLight`)・補助光をまとめた`createPlanetLights()`がある。**ライトは初期化時に1回だけ作り、天体切り替えでは`applyLighting`で強度だけを差し替える**(`CelestialBody.lighting`)。
- 主光の向き(`KEY_LIGHT_DIRECTION`)は左斜め前からのやや浅い角度にしている。真正面に近いと陰影が消えて平面的になり、月のクレーターのバンプも起伏として読めない。逆に真横へ寄せすぎると暗部が広がりすぎて幼児には見づらい。この角度は、土星本体の影を輪の横側(カメラから見える位置)へ落とす役目も兼ねている。
- 補助光は淡い青灰色にしている。青が強いと、月や土星の暗部が青い汚れのように見えてしまう。
- 土星本体の影が輪に落ちることが立体感の決め手になるため、`body.ring`を持つ天体だけ主光の`castShadow`を有効にする(`configureKeyLightShadow`)。輪自体は半透明マスクを影として正しく扱えず不自然になるため、輪は影を落とさない(`castShadow=false`、`receiveShadow=true`)。球は逆に影を落とす側(`castShadow=true`)。

## 星

- 背景の星は、Phase 1のCSS `radial-gradient`点描をやめ、`three/starField.ts`のWebGL `Points`に置き換えた。カメラの向きに応じて星も一緒に回ることで宇宙の中にいる感覚を出す。球面上に一様分布させ、初期化時に1回だけ作って天体切り替えでは作り直さない。数・輝度は控えめにして主役(天体)の邪魔をしないようにし、瞬く・流れるといった演出は入れていない。

## テクスチャ・輪テクスチャのキャッシュ

- `usePlanetEngine.ts`のeffectスコープに天体ID単位のキャッシュ(表面用・輪用)を持ち、**天体を何度切り替えても、1天体につきCanvas 2Dのピクセルループ(テクスチャ生成)は1回しか走らせない**。天体切り替え時に破棄するのはマテリアル・輪のジオメトリだけで、キャッシュ済みテクスチャは`release()`(hook全体のunmount)まで保持する。

## パフォーマンス

- DPRの上限は`three/renderQuality.ts`で2に抑える（`earth-globe`と同じ方針。ゲーム間でファイルを共有せず、ローカルに複製してコメントで方針の出典を明記している）。
- ポリゴン: 球は`SphereGeometry(1,64,48)`のまま、輪は最大4セグメント×192分割、星は`Points`520点。ポストプロセス・独自ShaderMaterialは使わない。
- 天体1つあたりの表示物は球1つ(＋土星のみ輪セグメント数枚)で、`three-globe`のような国境ポリゴンやRaycasterによる当たり判定は持たない。

## 特徴スポット(Phase 3)

天体上の「特徴スポット」(月の海・クレーター、火星のオリンポス山・マリネリス峡谷・極冠、木星の大赤斑・縞、土星の輪・輪のすきま、など)をタップすると、説明カードが出てよみあげと軽い効果音で応える。

### データ

- `src/games/planet-globe/data/featureSpots.ts`の`featureSpotsByBodyId`に、天体ごとの`FeatureSpot[]`を持つ(`types.ts`)。`id`・`displayName`・`description`(1〜2文の短文)・`target`(球面`surface`か輪`ring`)・当たり判定半径`hitRadiusPx`・`accentColor`を1件ずつ持つ。
- `target.kind === 'surface'`の`lonDeg`/`latDeg`は、**Phase 2の`celestialBodies.ts`の模様(`patches`/`craters`/`spots`)と同じ値をそのまま使う**。これにより「textureに描かれた模様の位置」と「タップ判定の3D位置」が`three/planetCoords.ts`の変換式1本を経由して常に一致する(`featureSpots.test.ts`が両者の一致を回帰テストしている)。
- `target.kind === 'ring'`は、輪の半径比(`radiusRatio`)と中心角(`angleDeg`)でマーカー位置を、`highlightSegmentIds`(`RingSegment.id`)または`highlightRadiusBand`で光らせる帯を指定する。

### 3D位置と可視判定

- `three/planetCoords.ts`に`surfaceDirection(lonDeg, latDeg)`を追加した。`lonToU`/`latToV`と同じ変換式から導いた、天体ローカル(spinGroup基準)の単位方向ベクトルで、`THREE.SphereGeometry(1,64,48)`の実頂点・実UVと最大誤差8e-8(float32の丸めのみ)で一致する。three(`THREE.Vector3`)には依存させず、プレーンなオブジェクトを返す。
- マーカーの実座標は`three/spotMarkers.ts`の`surfaceSpotLocalPosition`/`ringSpotLocalPosition`が持つ。球面スポットは`surfaceDirection`の単位ベクトルへ、扁平(Y方向のみ)と表面から浮かせる分(`MARKER_SURFACE_OFFSET_RATIO`)を反映した半径をかけて求める。
- 可視判定(天体本体に隠れていないか)は「楕円体を単位球にした正規化空間」で行う(`three/spotPicking.ts`)。tiltGroupローカルへ変換したカメラ位置を`(r, r*(1-f), r)`で割ると、扁平した天体でも単位球に対する遮蔽判定の式がそのまま正しく使える(アフィン変換は直線・交差関係を保つため)。
  - 球面: 単位球上の点pがカメラcから見える条件は`dot(p, c) > 1`(厳密解)。`SURFACE_VISIBILITY_MARGIN`を足し、輪郭ぎりぎりの押しにくい点を拾わないようにする。
  - 輪: カメラと点を結ぶ線分が単位球と交わるか(＝原点への最短距離が`1 + margin`未満か)で、天体本体に隠れているかを判定する。
- `usePlanetEngine.ts`は`tick`の中で、天体ごとに1回だけ正規化したカメラ位置を求め、各スポットの可視状態→表示強度(フェード)→マーカー/パルス/輪ハイライトの見た目、の順に毎frame更新する。

### 当たり判定

- 見た目のマーカー(直径はごく小さい)と当たり判定は意図的に分離している。`hitRadiusPx`(30px以上)は幼児が指で押しても反応する大きさに広げてあり、見た目は控えめなまま押しやすさを確保する。
- タップ判定はRaycasterを使わず、「見えているマーカーをカメラで画面座標へ投影し、ポインタ位置との画面上の距離が近いものを選ぶ」方式にした(`three/spotPicking.ts`の`pickNearestSpot`)。マーカーがSprite(小さい板)であるため、Raycasterによるピンポイント判定より画面距離判定のほうが幼児には確実に押せる。
- ドラッグ(天体回転)とタップの判別は、pointerdownからの移動量が閾値(`POINTER_TAP_MOVE_PX`)を一度でも超えたら「動いた」と記録し続ける方式にした。指が元の位置へ戻ってきても回転操作として扱うため、離した位置との距離だけを見る方式より誤タップに強い。2本目以降の指が触れたときはタップ判定自体をやめる(マルチタッチは常に回転操作)。

### 輪ハイライト(土星)

- `resolveRingHighlightBands`が、`highlightSegmentIds`(`body.ring.segments`から半径比を引く)と`highlightRadiusBand`(直接指定、カッシーニ間隙など帯だけのすき間用)を1つの帯リストへ解決する。
- 帯ごとに`RingGeometry`を1枚作り、赤道面へ寝かせてtiltGroup直下に置く。加算合成(`AdditiveBlending`)・最大不透明度0.22程度に抑え、輪の模様が消える単色べた塗りにしないようにしている。選択時にフェードイン、解除時にフェードアウトしてから非表示にする。

### 説明UI・よみあげ・効果音

- `ui/FeatureCard.tsx`は`earth-globe`の`CountryCard`と同じデザイン言語(画面左下・カード全体がボタン・タップで閉じる)にそろえた。
- よみあげは既存の`useQuestionSpeech`をそのまま使う(`${spot.spokenName ?? spot.displayName}。${spot.description}`)。よみあげON/OFF・スポット切り替え・画面離脱への追従はhook側の保証に乗るだけで済む。
- 選択時の効果音は`src/utils/quizSound.ts`の`playPlanetSpotSelectSound`(軽い「キラッ」、正解音のような達成感は出さない)。

## Phase 4で追加した7天体の実装方針

- **太陽**: `gas`スタイルを流用し、緯度による色差を弱めた黄白色の帯＋高周波のturbulence/mottleで「粒状の対流」を表現、`sunspot-a`/`sunspot-b`という2つの`GasSpot`で黒点を置いた。恒星らしい発光感は`material.emissive`(Phase 4で追加した任意フィールド)で表し、影側でも真っ暗にならないようlighting(ambient/fill)も他天体よりだいぶ高くしている。
- **水星**: `rocky`スタイルを流用。月と完全に同じ見た目にならないよう、地色・noiseの明暗色を茶色寄りにし、`caloris-basin`パッチと複数のクレーターを持つ。
- **金星**: `gas`スタイルを流用。木星のような縞のコントラストは付けず、大きな振幅のturbulenceで「厚い雲がうねる」見た目にした。自転は実際の金星と同じ逆向き(`spinSpeed`を負の値にするだけで表現でき、天体別の特別なコードは不要)。
- **地球**: `rocky`スタイルを流用。既存「ちきゅうぎ」の国境ポリゴン・国選択機能は一切持ち込まず、7大陸を`SurfacePatch`で塗り分け、白い雲は低opacityの`SurfacePatch`3枚で簡易的に表現した(Phase 5で専用の雲レイヤーへ仕上げる前提)。極域は`polarCaps`をそのまま流用している。
- **天王星**: `gas`スタイルを流用。`axialTiltDegrees`に実際の値(97.77度)を入れるだけで、既存の`tiltGroup`回転式がそのまま「横倒しに近い自転」を表現する(天王星専用の回転ロジックは追加していない)。輪も土星と同じ`RingSpec`を1セグメントだけ使う簡易表示。
- **海王星**: `gas`スタイルを流用。天王星より濃い青の地色・強めのturbulence/mottleに加え、大暗斑(`great-dark-spot`)を`GasSpot`の`swirl`付きで表現し、色違い球で終わらせないようにした。
- **冥王星**: `rocky`スタイルを流用。準惑星として`kind: 'dwarf-planet'`を持ち、トンボー地域(2つの`SurfacePatch`の重なりでハート形の輪郭を近似)・スプートニク平原・暗い地形・氷の山を複数のpatchesで表現した。

いずれも新しいテクスチャ生成器・新しい画面分岐は追加せず、Phase 1〜3の`rocky`/`gas`2生成器とデータだけで表現している。

## Phase 5・6へ残したもの

- **見た目の本格的な仕上げ**: 太陽の表面の粒状感・黒点・プロミネンス、金星の雲/地表切り替え、天王星・海王星のリングや大気の質感、冥王星のトンボー地域周辺の氷の山など、Phase 4は「一目で天体が違うと分かる」最低限の品質までに留めている。
- **地球のスポットの当たり判定の高度化**: 大陸・海は現状「代表点＋大きな`hitRadiusPx`」で当たり判定しており、実際の海岸線に沿った領域判定ではない。
- **太陽系全体表示・公転・実距離実サイズ再現**: 本ゲームは天体を1つずつ個別に観察するビューワーのままで、Phase 6で複数天体を同時に配置する全体表示を追加する際に、この`CelestialBody`データをそのまま再利用する想定。

`earth-globe`から引き継がなかった仕組みと、その理由(Phase 1〜3から変わらない):

- **three-globe / 国境ポリゴン / world-atlas国データ**: たいようけいは国や地形の当たり判定を必要とせず、球＋輪という単純な形状で十分なため採用しない(地球も含む)。
- **RaycasterによるタップNode選択**: マーカーがSpriteで見た目が小さく、ピンポイント判定になってしまうため、Phase 3では「画面上の距離」で判定する方式(上記)を採用し、Raycasterは使っていない。
- **OrbitControlsの内部APIへの介入(`earth-globe/three/rotationControls.ts`相当)**: earth-globeはズーム段階に応じて回転速度を細かく変える演出のために内部実装へ踏み込んでいたが、素の`rotateSpeed`固定値で十分と判断し、内部APIには触れていない。

このほか、次のような作り込みは意図的に範囲外にしている: 特徴スポットを使ったクイズ・スコア・図鑑化、ポストプロセス・カスタムシェーダーによる質感表現のさらなる作り込み。

# 「こっきコロコロぼうけん」基本設計

## 概要とこの文書の範囲

「こっきコロコロぼうけん」は、選んだ国旗ボールが自動で転がる様子を見守るミニゲームです。プレイヤーはコースを操作せず、物理的にどちらの出口へ入ったかによって、次のエリアと冒険の見え方が変わります。

この文書と実装は Phase 2（6エリアの分岐・合流とコース差別化）までを扱います。Phase 1で作った国旗選択、単一のMatter.js物理世界、CSS仮背景、固定カメラ、ゴールカップを引き継ぎ、Phase 2で次を追加しています。

- sky → forestで進み、forestでcaveまたはriverへ左右分岐する。
- caveとriverはcloudで合流し、cloud → goalへ進む。
- 各エリアの`wall` / `pin`の配置を変え、背景色だけでなくコース形状も差別化する。
- 画像素材、操作ギミック、新しい物理挙動は追加しない。

大砲、逆重力、風、ぐるぐるレール、大量の動く障害物、本番背景画像、派手な演出は Phase 3 以降の範囲であり、この実装には含めません。

## 画面と進行

| 画面 | URL |
| --- | --- |
| 国旗選択 | `/games/flag-roll-adventure` |
| プレイ | `/games/flag-roll-adventure/play` |
| ゴール | `/games/flag-roll-adventure/goal` |

```text
ホーム → 国旗選択 → プレイ
              sky
               ↓
            forest
           ↙      ↘
        cave      river
           ↘      ↙
             cloud
               ↓
             goal
```

プレイ画面は`key={location.key}`を付けた内部コンポーネントで構成し、「もういっかい」で物理世界、カメラ、訪問履歴、ゴールタイマーを作り直します。matter-jsを含むプレイ画面は、他の軽い画面へ物理エンジンを混ぜないため遅延読み込みします。

## ワールド座標と6エリアの配置

1エリアの論理座標は`AREA_WIDTH=480`×`AREA_HEIGHT=720`です。各エリアはローカル座標（0..480, 0..720）で定義し、ワールド上の`origin`を明示します。横並びの列間には`AREA_COLUMN_GAP=60`を置き、`AREA_COLUMN_STEP=540`とします。隣のエリアの外壁同士がボールへ干渉しないための余白です。

| エリア | id | theme | 列 | 行 | origin |
| --- | --- | --- | ---: | ---: | --- |
| そら | `sky` | `sky` | 1 | 0 | `{ x: 540, y: 0 }` |
| もり | `forest` | `forest` | 1 | 1 | `{ x: 540, y: 720 }` |
| どうくつ | `cave` | `cave` | 0 | 2 | `{ x: 0, y: 1440 }` |
| かわ | `river` | `river` | 2 | 2 | `{ x: 1080, y: 1440 }` |
| くも | `cloud` | `cloud` | 1 | 3 | `{ x: 540, y: 2160 }` |
| ゴール | `goal` | `goal` | 1 | 4 | `{ x: 540, y: 2880 }` |

`worldSize(AREAS)`はoriginの最大値からワールド矩形を求め、現在のワールドサイズは`1560×3600`です。カメラは現在エリア内では固定し、エリア遷移時だけ現在originから次originへ補間します。横方向の分岐でも`cameraPositionForArea`がoriginをそのまま使うため、X方向の遷移を同じ方式で扱えます。

## エリアデータと接続

`AdventureArea`は次のデータを持ちます。

```ts
type AdventureArea = {
  id: string
  nameJa: string
  theme: AreaTheme
  origin: { x: number; y: number }
  objects: readonly AreaObject[]
  entries: readonly AreaEntry[]
  exits: readonly AreaExit[]
  cup?: AreaCup
}
```

`AreaExit`は出口センサーと見た目の寸法、接続先エリア、接続先入口をまとめます。`to`と`toEntry`を分けることで、caveとriverが同じcloudへ別々の入口から合流できます。

```ts
type AreaExit = {
  id: string
  kind: PortalKind
  x: number
  y: number
  width: number
  height: number
  to: string
  toEntry: string
}
```

`AreaEntry`は次エリアへボールを置くローカル座標です。cloudの2入口だけは`velocity`を持ち、左入口は`{ x: 2.2, y: 0.2 }`、右入口は`{ x: -2.2, y: 0.2 }`で中央へ寄せます。省略時は出口へ入ったときの速度を引き継ぎます。

```ts
type AreaEntry = {
  id: string
  kind: PortalKind
  x: number
  y: number
  velocity?: { x: number; y: number }
}
```

`AreaCup`はゴールのカップ口の中心Xとリム上端Yだけを持ちます。カップの壁、底、内部センサー、手前ふちは`adventureGeometry.ts`の共通矩形から物理・描画へ生成します。

```ts
type AreaCup = {
  id: string
  x: number
  rimY: number
}
```

出口の接続は次の通りです。

| 出口 | 接続先 |
| --- | --- |
| `sky-to-forest` | `forest-entry` |
| `forest-to-cave` | `cave-entry` |
| `forest-to-river` | `river-entry` |
| `cave-to-cloud` | `cloud-entry-left` |
| `river-to-cloud` | `cloud-entry-right` |
| `cloud-to-goal` | `goal-entry` |

通常の出口幅は`EXIT_WIDTH=140`、高さは`EXIT_SENSOR_HEIGHT=40`です。cloudも出口幅140を使い、広すぎる開口で詰まりを隠さないようにしています。

## 遷移の状態機械

物理側とヘッドレス測定側は同じ意味の状態を持ちます。

```text
running
  └─出口センサー衝突→ exiting
                       └─吸い込み完了→ moving
                                      └─カメラ遷移・入口出現完了→ running
```

ゴールでは`running → cup-in → goal`へ進みます。出口を検出したときは`exitLatched`を立て、同じフレームや複数センサーの衝突で多重発火しないようにします。`exiting`中はボールを止めて`EXIT_SWALLOW_MS=260ms`、`moving`中はカメラを`CAMERA_TRANSITION_MS=600ms`で補間し、`CAMERA_SETTLE_MS=120ms`の着地待ち後に物理を再開します。

物理と描画で共有する床・カップ矩形は`adventureGeometry.ts`から取得します。複数出口のエリアでは出口をX順に並べ、両端と開口の間に床を作ります。幅0以下の退化矩形は同関数内で除外し、物理側と`AdventureStage`側で別々のフィルタを持たない構造を保ちます。

## 分岐の決め方

forestの通常時の分岐は、ボールが`forest-to-cave`または`forest-to-river`の出口センサーへ実際に入った結果で決まります。タイムアウト・範囲外救済時だけ`pickExitForBallX(area, localX)`を使い、開口内を優先し、開口外では出口中心との距離が最も近い出口を選びます。

この決定に乱数は使いません。開始位置・初速のシード付き揺らぎは物理軌道を変えますが、ルートを直接選ぶ処理ではありません。24シードの再実行で同じ`visitedAreaIds`になることをテストで固定しています。

forestには、分岐前の左右対称な丸太2枚と小さなキノコ、中央やや上の大きなキノコ風バンパー、中央が高い屋根形の板2枚、出口間の帯にある尾根を置きます。出口は左X=100、右X=380、幅140で、間には正の幅の地面帯を残します。

## 各エリアのコース形状

### sky — シンプルな導入

幅300pxの長い斜面をY=170/360/550へ3枚置き、素直に落ちる流れを作ります。左右端の雲風ピンを1〜2回の目印として使い、6エリアの基準になる見やすい構造にします。

### forest — 通過してから左右へ分岐

分岐前に左右の丸太風板と小さなキノコを置き、中央の大きなバンパーへ進みます。その下に中央が高い屋根形の板2枚を置き、左半分をcave、右半分をriverへ送ります。出口間の帯には半径32pxの尾根を置き、ボールが帯で静止しない構造にします。

### cave — 狭いジグザグ

幅220pxの板をX=140/340、Y=130/380/640へ左右交互に置き、各段が中央を越える狭いジグザグにします。中央の岩風ピン（X=240、Y=255/505）で縦一直線の抜け道をなくし、短い板の連続で洞窟らしい密度を出します。

### river — 横へ大きく渡る

幅340pxの長い板をY=140/360/610へ3枚置き、角度は±0.3radで反転させます。板を減らして滞在を伸ばしすぎず、上下の落差より左右の移動が目立つ構成にします。

### cloud — 広いV字から合流

X=110/370、Y=590に幅200pxの板を±0.36radで置き、出口側へ下がる大きなV字を作ります。左右の入口初速で中央へ寄せたボールをV字の下端からX=240の通常幅出口へ導き、広く軽快に転がる時間を確保します。

### goal — V字からカップへ

上段・下段のV字板と中央ピンでカップへ集める既存の流れを維持します。カップ周辺の物理・幾何、センサー位置、手前ふちはTask Aの数値から変更していません。

## ゴールのカップイン仕様

ゴールのカップは`rimY=590px`、`CUP_INNER_DEPTH=96px`、`CUP_INNER_WIDTH=104px`です。ボール半径は22pxなので、リムへ接触する中心位置は`rimY + BALL_RADIUS = 612px`です。

内部センサーは`CUP_SENSOR_INSET=48px`とボール半径から、`CUP_SENSOR_TOP_OFFSET=70px`、つまり`rimY + 70 = 660px`へ置きます。リム接触時のボール下端は`612 + 22 = 634px`で、センサー上端660pxへ届かないため、リムに触れただけではカップインになりません。センサー接触後は`CUP_SETTLE_MS=520ms`かけて底へ沈む様子を見せます。

`CUP_FRONT_LIP_TOP_OFFSET=48px`の手前ふちは、センサー判定を隠さず、ボールが内側へ沈んでから下半分を覆う位置です。吸引力やゴール専用の新しい物理挙動は使いません。

## 物理・テンポ定数

### 共通物理

| 定数 | 値 | 意図 |
| --- | ---: | --- |
| `STEP_MS` | `1000 / 60` | 端末差を抑える固定タイムステップ |
| `GRAVITY` | `{ x: 0, y: 0.35 }` | 見守れる弱めの重力 |
| `BALL_RADIUS` | `22` | 国旗を見分けやすく、狭い通路も通れる半径 |
| `BALL_RESTITUTION` | `0.45` | 跳ねすぎず転がる反発 |
| `BALL_FRICTION` | `0.02` | 斜面で止まりすぎない摩擦 |
| `BALL_FRICTION_AIR` | `0.012` | ゆっくり減速する空気抵抗 |
| `WALL_RESTITUTION` | `0.3` | 壁からの穏やかな反発 |
| `PIN_RESTITUTION` | `0.7` | ピンへ触れたことが分かる反応 |
| `WALL_FRICTION` | `0.06` | 壁沿いの減速 |
| `PIN_FRICTION` | `0.02` | ピン後に横へ流れる摩擦 |
| `MAX_SPEED` | `14` | すり抜けと速すぎを防ぐ上限 |
| `MAX_ANGULAR_VELOCITY` | `0.22` | 国旗を読める回転上限 |

### コース形状

| エリア | 主な定数と現在値 |
| --- | --- |
| sky | 長さ`300px`、角度`0.36rad`、Y=`170/360/550`、ピン半径`16px` |
| forest | 進入丸太幅`140px`・角度`±0.28rad`、分岐屋根幅`120px`・角度`±0.55rad`、尾根半径`32px` |
| cave | ジグザグ板幅`220px`・角度`±0.32rad`、板X=`140/340`・Y=`130/380/640`、岩半径`16px` |
| river | 板幅`340px`、角度`±0.3rad`、板Y=`140/360/610` |
| cloud | V字板幅`200px`・角度`±0.36rad`、板X=`110/370`・Y=`590`、出口幅`EXIT_WIDTH=140px` |
| goal | 上段V字幅`160px`・角度`±0.35rad`、下段幅`180px`・角度`±0.55rad` |

### 出入口・カメラ・詰まり対策

| 定数 | 値 |
| --- | ---: |
| `AREA_WIDTH` / `AREA_HEIGHT` | `480` / `720` |
| `AREA_COLUMN_GAP` / `AREA_COLUMN_STEP` | `60` / `540` |
| `EXIT_WIDTH` / `EXIT_SENSOR_HEIGHT` | `140` / `40` |
| `EXIT_SWALLOW_MS` | `260ms` |
| `ENTRY_EMERGE_MS` | `220ms` |
| `CAMERA_TRANSITION_MS` / `CAMERA_SETTLE_MS` | `600ms` / `120ms` |
| `AREA_ENTRY_CLEARANCE` | `60px` |
| `STALL_SPEED_THRESHOLD` / `STALL_DURATION_MS` | `0.35` / `1200ms` |
| `STALL_NUDGE_SPEED` | `1.8px/step` |
| `AREA_TIMEOUT_MS` | `12000ms` |
| `OUT_OF_BOUNDS_MARGIN_X` / `OUT_OF_BOUNDS_MARGIN_Y` | `80px` / `200px` |

### カップ

| 定数 | 値 |
| --- | ---: |
| `CUP_INNER_WIDTH` / `CUP_INNER_DEPTH` | `104px` / `96px` |
| `CUP_WALL_THICKNESS` | `16px` |
| `CUP_SENSOR_INSET` / `CUP_SENSOR_HEIGHT` | `48px` / `24px` |
| `CUP_SENSOR_TOP_OFFSET` | `70px` |
| `CUP_FRONT_LIP_TOP_OFFSET` | `48px` |
| `CUP_SETTLE_MS` | `520ms` |
| `GOAL_RESCUE_DROP_LIMIT` | `2` |

## 背景とコースの見た目

背景は画像ではなく、`AreaBackground.module.css`の`layerBase`、`layerFar`、`layerDecor`の3レイヤーです。skyは水色、forestは黄緑と木の緑、caveは暗い紫、riverは水色〜青緑、cloudは白〜薄紫、goalは明るい金色で分けています。

`AdventureStage.module.css`でも、wall、pin、portalFloorをthemeごとに色分けします。洞窟は暗い岩色、川は青緑、雲は淡い紫、森は木色にし、背景とコースの両方でエリアを識別できるようにします。背景アニメーションは追加しておらず、`prefers-reduced-motion`で動きが増えることもありません。

## プレイ時間の実測

`adventureSimulation.ts`は画面サイズやCSS scaleを参照せず、`areas.ts`と`adventurePhysics.ts`を共有してMatter.jsを固定ステップで実行します。24シードでの最新実測値は次の通りです。

| 試行数 | min | median | mean | max |
| ---: | ---: | ---: | ---: | ---: |
| 24 | 24.917秒 | 29.142秒 | 29.065秒 | 32.333秒 |

エリア別滞在時間は、分岐の影響が分かるように全run平均と、そのエリアを実際に通ったrunだけの平均を併記します。

| エリア | 全run平均 | 通過runのみの平均 |
| --- | ---: | ---: |
| `sky` | 5.612秒 | 5.612秒 |
| `forest` | 4.360秒 | 4.360秒 |
| `cave` | 2.281秒 | 6.083秒 |
| `river` | 3.701秒 | 5.922秒 |
| `cloud` | 4.346秒 | 4.346秒 |
| `goal` | 4.764秒 | 4.764秒 |

24シードの経路はcaveが9回、riverが15回です。全エリアを含む合計時間の通過run平均は、caveルートが28.774秒、riverルートが29.239秒で、差は0.465秒です。合計時間は23種類で、開始揺らぎによる自然な差を残しています。中央値は29.142秒です。

## 詰まり対策と終了保証

通常時の24シードで次をすべて0にしています。

- `stallNudgeCount`
- `stallNudgeCountByArea`の全エリア値
- `areaTimeoutCount`
- `rescueCount`
- `goalRescueDropCount`

停滞検知の`STALL_SPEED_THRESHOLD=0.35`、`STALL_DURATION_MS=1200ms`、エリア上限の`AREA_TIMEOUT_MS=12000ms`は緩めていません。コース形状の板の長さ・角度・間隔、出口位置と幅だけを調整し、障害物間には「ボール直径44px＋16px」以上のテスト上の余白を残しています。入口上端の`AREA_ENTRY_CLEARANCE=60px`と、回転後のエリア内収まりもデータテストで固定しています。

救済はあくまで終了保証です。停滞時の軽いナッジ、タイムアウト時の出口選択、範囲外復帰を持ちますが、通常の24シードでは発動しません。ゴールでは内部センサーと`CUP_SETTLE_MS`によってカップインを完了します。

## テストと品質ゲート

エリアデータテストでは、接続グラフ、world矩形、origin重複、入口余白、出口幅、障害物間隔、カップ矩形を検証します。`areaGroundRects`は物理生成と描画の両方から共有します。シミュレーションテストでは、全シードの完了、経路、決定性、分岐回数、時間範囲、安全カウンタを検証します。

変更時は次の4コマンドを通します。

```text
npm run lint
npm run test
npm run build
npm run build:pages
```

## 今後のフェーズ

- **Phase 3：ギミック検討** — 大砲、逆重力、風、ぐるぐるレール、動く障害物などを、操作なしでも詰まらない設計として個別に検討する。Phase 2の状態機械と共有矩形を壊さないことを前提にする。
- **Phase 4：本番の世界観と素材** — 権利を確認した背景素材や装飾を追加する。画像1枚へ物理形状を依存させず、CSS・DOMの責務を保つ。
- **Phase 5：実機調整** — 端末別の見え方、音の間隔、エリア滞在時間、カメラの追従感を確認する。得点やランキングを追加するフェーズではない。

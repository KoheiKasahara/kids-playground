# 「こっきコロコロぼうけん」基本設計

## 概要とこの文書の範囲

「こっきコロコロぼうけん」は、選んだ国旗ボールが自動で転がる様子を見守るミニゲームです。プレイヤーはコースを操作せず、物理的にどちらの出口へ入ったかによって、次のエリアと冒険の見え方が変わります。

この文書と実装は、Phase 3（コース密度改善＋大砲・ジャンプ台・加速レーン）までを扱います。Phase 1で作った国旗選択、単一のMatter.js物理世界、CSS仮背景、固定カメラ、ゴールカップを引き継ぎ、Phase 2の分岐・合流とコース差別化に加えて、Phase 3で次を追加しています。

- sky → forestで進み、forestでcaveまたはriverへ左右分岐する。
- caveとriverはcloudで合流し、cloud → goalへ進む。
- skyの中央出口と左右ミラーの板、forestの左右対称な分岐、caveの対称ジグザグなど、自由落下の空白を減らすコース密度を固定する。
- 各エリアの`wall` / `pin`の配置を変え、背景色だけでなくコース形状も差別化する。
- caveに大砲、riverに加速レーンとジャンプ台を配置し、左右ルートの物理体験を分ける。
- `AreaFloatZone`を含むギミックの型・物理処理・見た目・測定を実装する。floatゾーンはcloudへはまだ配置していない。

大砲、ジャンプ台、加速レーンはPhase 3で実装・コース統合済みです。大砲の溜め演出、ジャンプ台の反発、加速レーンの速度更新は実機とシミュレーションで共有しています。逆重力、風、ぐるぐるレール、大量の動く障害物、本番背景画像、派手な演出は後続フェーズの範囲です。

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
  objects: readonly AreaObject[]      // wall | pin | jump（ソリッド）
  zones?: readonly AreaZone[]        // cannon | boost | float（センサー）
  entries: readonly AreaEntry[]
  exits: readonly AreaExit[]
  cup?: AreaCup
}
```

`AreaExit`は出口センサーと見た目の寸法、接続先エリア、接続先入口をまとめます。`to`と`toEntry`を分けることで、caveとriverが同じcloudへ別々の入口から合流できます。

`objects`には衝突する板・ピン・ジャンプ台を置き、既存の障害物間隔テストの対象にします。`zones`にはソリッドな障害物と重なってもよいセンサーを置きます。大砲は円形センサー、加速レーンとfloatゾーンは回転矩形センサーです。

```ts
type AreaCannon = {
  kind: 'cannon'
  id: string
  x: number; y: number; radius: number
  angle: number; power: number; holdMs?: number
}

type AreaJumpPad = {
  kind: 'jump'
  id: string
  x: number; y: number; width: number; height: number
  angle: number; launchAngle: number; power: number
}

type AreaBoostLane = {
  kind: 'boost'
  id: string
  x: number; y: number; width: number; height: number
  angle: number; force?: number; maxSpeed?: number
}

type AreaFloatZone = {
  kind: 'float'
  id: string
  x: number; y: number; width: number; height: number
  gravityScale: number
}
```

`AreaObject`は`AreaWall | AreaPin | AreaJumpPad`、`AreaZone`は`AreaCannon | AreaBoostLane | AreaFloatZone`です。

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
  ├─大砲センサー衝突→ cannon
  │                    └─溜め完了・砲口から射出→ running
  └─出口センサー衝突→ exiting
                       └─吸い込み完了→ moving
                                      └─カメラ遷移・入口出現完了→ running
```

ゴールでは`running → cup-in → goal`へ進みます。出口を検出したときは`exitLatched`を立て、同じフレームや複数センサーの衝突で多重発火しないようにします。`exiting`中はボールを止めて`EXIT_SWALLOW_MS=260ms`、`moving`中はカメラを`CAMERA_TRANSITION_MS=600ms`で補間し、`CAMERA_SETTLE_MS=120ms`の着地待ち後に物理を再開します。

大砲中は`Engine.update`を止め、ボールを装填室へ固定して`holdMs`だけ溜めます。射出時は`CANNON_MUZZLE_OFFSET`だけ砲口側へ移し、`angle`方向の速度を`MAX_SPEED`以下にクランプしてから`running`へ戻します。捕獲中・射出直後の再捕獲を状態判定と`CANNON_RECAPTURE_COOLDOWN_MS`で防ぎ、ジャンプ台にもクールダウンと同一台の連続発火防止を設けています。上向きの射出やジャンプで画面外へ出ないよう、上側外壁は全エリアに生成しています。

加速レーンとfloatゾーンの効果は`beforeUpdate`で毎ステップ適用します。加速はレーンの角度方向へ速度を更新して上限を clamp し、floatはゾーン内だけ重力の`1 - gravityScale`を上向きの力で打ち消します。

物理と描画で共有する床・カップ矩形は`adventureGeometry.ts`から取得します。複数出口のエリアでは出口をX順に並べ、両端と開口の間に床を作ります。幅0以下の退化矩形は同関数内で除外し、物理側と`AdventureStage`側で別々のフィルタを持たない構造を保ちます。

## 分岐の決め方

forestの通常時の分岐は、ボールが`forest-to-cave`または`forest-to-river`の出口センサーへ実際に入った結果で決まります。タイムアウト・範囲外救済時だけ`pickExitForBallX(area, localX)`を使い、開口内を優先し、開口外では出口中心との距離が最も近い出口を選びます。

この決定に乱数は使いません。開始位置・初速のシード付き揺らぎは物理軌道を変えますが、ルートを直接選ぶ処理ではありません。24シードの再実行で同じ`visitedAreaIds`になることをテストで固定しています。

skyの出口は`SKY_EXIT_X=AREA_WIDTH / 2=240`に置き、最下段を中央へ向かう左右ミラーの板一対にします。左右どちらから中央の穴へ入るかで、穴へ入る瞬間の横速度の符号がシードごとに変わります。

forestは中央の頂点（`x=240`）を持つ分岐起点と、そこから左右へ対称に落ちる屋根・板を置きます。中央の頂点へ当たったときに引き継いだ横速度の符号を使い、正ならriver側、負ならcave側へ進む流れになります。出口は左`x=130`、右`x=350`、幅180で、間には正の幅の地面帯を残します。

分岐後の体験も意図的に分けています。caveは上段の共通導線から大砲へ入り、斜め上へ射出されたボールを着地ピンと岩ピン群へ戻し、左下の別砲へ渡す「ポンポン跳ねる」ルートです。riverは長い坂に沿う加速レーンから終端のジャンプ台へつなぎ、普通の着地ピンを経て出口へ向かう「速く横へ進む」ルートです。skyとforestにはギミックを置かず、分岐の再現性を維持しています。

## 各エリアのコース形状

Issue #140 で、全エリアを「上から下へ落ちるコース」から「縦に進む巨大ピンボール」へ寄せました。
コースの骨組みは全エリア共通で、その上にエリアごとの主役ギミックと反発係数で差を付けます。

### 共通の骨組み（80pxピッチの千鳥格子）

Y=152から80px間隔で、次の2種類の行を交互に重ねます。

- **蹴り出し行**: 左右の蹴り出し板 ＋ 半径9pxのピン（X=156 / 234 / 312）
- **ずらし行**: 半径9pxのピン（X=117 / 195 / 273 / 351）

ピッチ78〜80pxはボール直径44px＋余白16pxのちょうど境界で、隣り合うピンのすき間が60pxになります。
1行だけでは16px幅の抜け道が残りますが、次の行を半ピッチずらすことでその抜け道が塞がります。

### 蹴り出し板（wallKicker）

外壁の内面はX=14／X=466です。ここへピンを近づけると、**ボールが入れないのに隙間としては存在する**
中途半端な切り欠きができ、ボールがそこで止まります（実測で停滞ナッジが大きく増えました）。
そのため壁ぎわは、幅84px・厚さ12px・角度±0.34radの板を**外壁へ端をめり込ませて**置きます。
角度は必ず「壁側が高く、中央側が低い」向きにします。逆向きにすると壁との谷にボールが溜まります。

### 床スロープ（floorRamp）

障害物を増やすとボールは床へ着くころに勢いを失い、**出口開口の横の平らな床の上でそのまま止まります**。
実測では、停滞ナッジのほぼ全部が「床の上面 − ボール半径」の高さで起きていました。
そこで出口開口の左右に、外壁から開口の縁へ下る板を床の上へ重ね、最後は必ず開口へ転がり込ませます。
ゴールも同じ理由で、カップのリムの高さに同じスロープを置きます。

### sky — 軽快に細かく跳ねる

千鳥格子に、常時回転する羽根を2枚（「風のしかけ」X=235 / Y=390 / 半径30、「プロペラ」X=240 / Y=560 / 半径39、
互いに逆回転）置きます。ピンの反発は0.85と高めで、小さく速く跳ねる感触にします。

### forest — 上下運動のあるアスレチック

押し上げToy「きのこスプリング」（X=240 / Y=560 / 半径33 / 上向き初速10.5px/step）が主役です。
重力0.35での上昇量は約158pxで、打ち上げられた球は上の行のピンへ当たってから再び落ちます。
左右2つの出口（cave / river）は維持し、床スロープを開口ごとに置きます。ピンの反発は0.82。

### cave — 一番激しい

既存の大砲2基に、回転Toy「回転岩」（X=240 / Y=390 / 半径28）を足します。
大砲の装填半径は40→56pxへ広げ（砲口距離も42→64pxへ追従）、密度を上げても確実に捕獲されるようにしました。
ピンの反発は0.78。実測でピン接触が全エリア最多（1エリアあたり平均15.3回）になります。

### river — 下＋横の流れ

回転Toy「水車」（X=240 / Y=392 / 半径28）と押し上げToy「水しぶき」（X=240 / Y=632 / 半径24）が主役です。
既存のジャンプ台2枚と加速レーンは維持します。加速レーンは**センサーなので障害物の余白制約を受けない**ため、
上下2本を幅380px・高さ56pxへ広げ、全試行が水の流れに乗るようにしました。ピンの反発は0.65と低めで、
跳ねるより流れる感触にします。

### cloud — 柔らかい見た目・賑やかな挙動

押し上げToy「ふわふわ」（X=240 / Y=540 / 半径30 / 上向き初速11px/step）が主役です。
ピンの反発は0.95と全エリアで最も高く、見た目のやわらかさに対して挙動はよく跳ねます。

### goal — 小型ピンボール盤

上部から千鳥格子で受け、回転Toy（X=240 / Y=380 / 半径22）を通してからカップへ集めます。
カップ口の真上（X=176〜304 / Y=528〜590）には障害物を置かず、最後の吸い込みを邪魔しません。

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
| `PIN_FRICTION` | `0` | ピン上で減速しすぎず横へ流す設定 |
| `MAX_SPEED` | `14` | すり抜けと速すぎを防ぐ上限 |
| `MAX_ANGULAR_VELOCITY` | `0.22` | 国旗を読める回転上限 |

### ギミック

| 定数 | 値 | 意図 |
| --- | ---: | --- |
| `CANNON_HOLD_MS` | `520ms` | 捕獲後に方向を見せる溜め時間 |
| `CANNON_POWER` / `CAVE_CANNON_POWER` | `9.5` / `8px/step` | 標準値と、洞窟の着地導線へ合わせた威力 |
| `CANNON_SENSOR_RADIUS` | `30px` | 標準の捕獲円 |
| `CANNON_MUZZLE_OFFSET` | `42px` | センサー半径より外へ出す砲口距離 |
| `CANNON_RECAPTURE_COOLDOWN_MS` | `700ms` | 射出直後の再捕獲防止 |
| `JUMP_POWER` / `RIVER_JUMP_POWER` | `8` / `9px/step` | 標準値と、river終端の上向きジャンプ速度 |
| `JUMP_COOLDOWN_MS` | `250ms` | 同じジャンプ台の連続発火防止 |
| `BOOST_ACCELERATION` / `BOOST_MAX_SPEED` | `0.35` / `11px/step` | 加速レーンの標準加速度と上限。riverは実配置で`0.1`を使用 |
| `BOOST_SOUND_COOLDOWN_MS` | `500ms` | 加速音の連続再生防止 |
| `FLOAT_GRAVITY_SCALE` | `0.45` | float内に残す重力の割合。現時点では未配置 |

### コース形状

| エリア | 主な定数と現在値 |
| --- | --- |
| sky | 坂幅`120px`・高さ`18px`・角度`±0.4rad`、上段X/Y=`150/330,170`、中段=`120/360,400`、下段=`120/360,630`、出口X=`240`、雲ピン半径`12/14/10px` |
| forest | 進入丸太幅`140px`・角度`±0.28rad`、中央ピンX=`240`・半径`8px`、サイドピンX=`160/320`・半径`10px`、屋根幅`100px`・角度`±0.55rad`、出口ランプ幅`60px` |
| cave | ジグザグ板幅`120px`（下段`180px`）・高さ`18px`・角度`±0.4rad`、板X=`150/330`・`80/400`・Y=`150/380/600`、チャンネルX=`90/390`・Y=`485`・幅`32px`・角度`±0.35rad`、岩ピンX/Y/半径=`240/260/10`・`150/265/20`・`210/360/6`・`240/460/8`、大砲2基X/Y=`120/540`・`240/230`、角度`-0.8/-2.34rad`、砲威力`8px/step` |
| river | 長板幅`240/120px`・高さ`18px`・角度`±0.28rad`、板X/Y=`240/120`・`360/380`、加速レーン`240×80px`・X/Y=`340/400`・角度`-0.28rad`・実加速度`0.1`、終端ジャンプ板`60×6px`・X/Y=`440/610`・発射角`-2.2rad`・威力`9px/step`、着地ピンX/Y=`220/470`、出口X/Y=`320/520` |
| cloud | V字板幅`200px`・角度`±0.36rad`・X=`110/370`・Y=`590`、バンパー半径`30/32px`、出口X=`240`・幅`EXIT_WIDTH=140px` |
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
| `AREA_TIMEOUT_MS` | `15000ms` |
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

## プレイ時間と密度の実測

`adventureSimulation.test.ts` が24シードの固定ステップ再生で計測します。
Issue #140 の改修前後の実測値：

| 指標 | 改修前 | 改修後 |
|---|---|---|
| プレイ時間 中央値 | 32.5s | 48.0s |
| プレイ時間 最大 | 36.5s | 68.0s |
| 1プレイのピン接触 中央値 | 10回 | 49回 |
| 最長の無接触落下 | 335px | 280px |
| エリア別の無接触落下 | 170〜335px | 146〜280px |
| エリア別ピン接触 平均 | 1.0〜3.7回 | 6.2〜15.3回 |

エリア高さは720pxなので、改修前は画面の46%を何にも触れずに落ちていました。

## 詰まり対策と終了保証

通常時の24シードで次をすべて0にしています。

- `stallNudgeCount`
- `stallNudgeCountByArea`の全エリア値
- `areaTimeoutCount`
- `rescueCount`
- `goalRescueDropCount`

停滞検知の`STALL_SPEED_THRESHOLD=0.35`、`STALL_DURATION_MS=1200ms`、エリア上限の`AREA_TIMEOUT_MS=15000ms`は維持しています。コース形状の板の長さ・角度・間隔、ギミックの着地点、出口位置と幅だけを調整し、障害物間には「ボール直径44px＋16px」以上のテスト上の余白を残しています。入口上端の`AREA_ENTRY_CLEARANCE=60px`と、回転後のエリア内収まりもデータテストで固定しています。大砲の射出速度、砲口距離、射出直線と出口の距離、ジャンプ台の速度上限、ゾーンの矩形内収まりもデータテストで確認します。

救済はあくまで終了保証です。停滞時の軽いナッジ、タイムアウト時の出口選択、範囲外復帰を持ちますが、通常の24シードでは発動しません。ゴールでは内部センサーと`CUP_SETTLE_MS`によってカップインを完了します。

## テストと品質ゲート

エリアデータテストでは、接続グラフ、world矩形、origin重複、入口余白、出口幅、障害物間隔、カップ矩形、ギミックの速度・射出方向・ゾーン境界を検証します。`areaGroundRects`は物理生成と描画の両方から共有します。シミュレーションテストでは、全シードの完了、経路、決定性、分岐回数、ギミック作動、時間範囲、安全カウンタを検証します。

変更時は次のコマンドを通します。

```text
npx vitest run src/games/flag-roll-adventure/
npm run lint
npm run build
```

## 今後のフェーズ

- **Phase 3：完了** — コース密度を改善し、caveへ大砲、riverへ加速レーンとジャンプ台を統合した。型・物理処理・実機／シミュレーション共有・測定・安全カウンタまで固定済み。
- **Phase 4：本番の世界観と素材** — 権利を確認した背景素材や装飾を追加する。画像1枚へ物理形状を依存させず、CSS・DOMの責務を保つ。
- **Phase 5：実機調整** — 端末別の見え方、ギミックの音と溜め演出、エリア滞在時間、カメラの追従感を確認する。floatゾーンの配置はcloudの時間を見ながら判断する。
- **Phase 6以降：拡張** — 風、ぐるぐるレール、動く障害物などを、操作なしでも詰まらない設計として追加検討する。得点やランキングを追加するフェーズではない。

/**
 * 1エリアの論理座標。
 * 画面の向きと見通しを優先した縦長の480×720を全エリアで共有し、端末の大きさによる
 * 物理挙動の差をなくす。表示時の拡縮は useAreaScale に閉じ込める。
 */
export const AREA_WIDTH = 480
export const AREA_HEIGHT = 720

/**
 * 横にエリアを並べるときの隙間。隣のエリアの外壁とボールが接触すると、別ルートの物理へ力が伝わるため余白を置く。
 */
export const AREA_COLUMN_GAP = 60
export const AREA_COLUMN_STEP = AREA_WIDTH + AREA_COLUMN_GAP

/** 端の出口を外壁から少し離し、出口の左右にボールを受ける床を残す。 */
export const SIDE_EXIT_INSET = 80

/** そらは長い坂の合間へ雲風ピンを置き、板の端から次の反射へつなぐ軽快な導入にする。 */
export const SKY_SLOPE_LEFT_X = 150
export const SKY_SLOPE_RIGHT_X = AREA_WIDTH - SKY_SLOPE_LEFT_X
export const SKY_SLOPE_TOP_WIDTH = 120
export const SKY_SLOPE_MIDDLE_LEFT_X = 120
export const SKY_SLOPE_MIDDLE_RIGHT_X = AREA_WIDTH - SKY_SLOPE_MIDDLE_LEFT_X
export const SKY_SLOPE_MIDDLE_WIDTH = 120
export const SKY_SLOPE_BOTTOM_LEFT_X = 120
export const SKY_SLOPE_BOTTOM_RIGHT_X = AREA_WIDTH - SKY_SLOPE_BOTTOM_LEFT_X
export const SKY_SLOPE_BOTTOM_WIDTH = 120
export const SKY_SLOPE_HEIGHT = 18
export const SKY_SLOPE_TOP_Y = 170
export const SKY_SLOPE_MIDDLE_Y = 400
export const SKY_SLOPE_BOTTOM_Y = 630
export const SKY_SLOPE_ANGLE = 0.4
/** 坂の端で横へ逃げた球を、次の坂や雲風バンパーへ戻す少数の目印。 */
/** 最後の坂の先を空白にせず、出口へ向かう落下を大きく受け止める雲風バンパー。 */
export const SKY_CLOUD_PIN_LEFT_X = 28
export const SKY_CLOUD_PIN_RIGHT_X = AREA_WIDTH - SKY_CLOUD_PIN_LEFT_X
export const SKY_CLOUD_PIN_LEFT_Y = 260
export const SKY_CLOUD_PIN_RIGHT_Y = SKY_CLOUD_PIN_LEFT_Y
export const SKY_CLOUD_PIN_RADIUS = 12
export const SKY_CLOUD_SIDE_LEFT_X = 24
export const SKY_CLOUD_SIDE_RIGHT_X = AREA_WIDTH - SKY_CLOUD_SIDE_LEFT_X
export const SKY_CLOUD_SIDE_Y = 500
export const SKY_CLOUD_SIDE_RADIUS = 10
export const SKY_CLOUD_BUMPER_X = AREA_WIDTH / 2
export const SKY_CLOUD_BUMPER_Y = 300
export const SKY_CLOUD_BUMPER_RADIUS = 14
export const SKY_CLOUD_CATCHER_Y = 515
export const SKY_CLOUD_CATCHER_WIDTH = 140
export const SKY_CLOUD_CATCHER_ANGLE = 0.2

/** 分岐後の入口で左右から中央へ寄せる初速。出口へ入ったときの速度をそのまま引き継がず、合流を見せる。 */
export const MERGE_ENTRY_SPEED = 2.2
export const MERGE_ENTRY_VERTICAL_SPEED = 0.2

/** 森の分岐前は左右の丸太を短い受け板にし、その下へ3段の千鳥ピン群をつなぐ。 */
export const FOREST_APPROACH_LOG_LEFT_X = 130
export const FOREST_APPROACH_LOG_RIGHT_X = AREA_WIDTH - FOREST_APPROACH_LOG_LEFT_X
export const FOREST_APPROACH_LOG_Y = 90
export const FOREST_APPROACH_LOG_WIDTH = 140
export const FOREST_APPROACH_LOG_HEIGHT = 18
export const FOREST_APPROACH_LOG_ANGLE = 0.28
export const FOREST_APPROACH_RAMP_X = AREA_WIDTH / 2
export const FOREST_APPROACH_RAMP_Y = 130
export const FOREST_APPROACH_RAMP_WIDTH = 100
export const FOREST_APPROACH_RAMP_HEIGHT = 18
export const FOREST_APPROACH_RAMP_ANGLE = 0.05
export const FOREST_PIN_ROW_TOP_Y = 200
export const FOREST_PIN_ROW_MIDDLE_Y = 550
export const FOREST_PIN_ROW_BOTTOM_Y = 600
export const FOREST_PIN_RADIUS = 12
/** 入口の中央を少しずつ左右へ渡す2段の木の実で、乗り上げない分岐起点にする。 */
export const FOREST_BRANCH_PIN_TOP_X = AREA_WIDTH / 2
export const FOREST_BRANCH_PIN_TOP_Y = 282
export const FOREST_BRANCH_PIN_RADIUS = 8
export const FOREST_BRANCH_PIN_SIDE_LEFT_X = 160
export const FOREST_BRANCH_PIN_SIDE_RIGHT_X = AREA_WIDTH - FOREST_BRANCH_PIN_SIDE_LEFT_X
export const FOREST_BRANCH_PIN_SIDE_RADIUS = 10
export const FOREST_PIN_MIDDLE_LEFT_X = 140
export const FOREST_PIN_MIDDLE_RIGHT_X = AREA_WIDTH - FOREST_PIN_MIDDLE_LEFT_X
export const FOREST_PIN_BOTTOM_LEFT_X = 50
export const FOREST_PIN_BOTTOM_RIGHT_X = AREA_WIDTH - FOREST_PIN_BOTTOM_LEFT_X
/** 下流の中央尾根は左右の出口へ落ちる直前の向きを変え、中央帯での静止を防ぐ。 */
export const FOREST_BRANCH_RIDGE_X = AREA_WIDTH / 2
export const FOREST_BRANCH_RIDGE_Y = 620
export const FOREST_BRANCH_RIDGE_RADIUS = 12

/** 森の左右出口へピン群の結果を送り、最後の短い屋根で左右の出口へ分ける。 */
export const FOREST_LEFT_EXIT_X = 130
export const FOREST_RIGHT_EXIT_X = AREA_WIDTH - FOREST_LEFT_EXIT_X
export const FOREST_EXIT_WIDTH = 180
export const FOREST_BRANCH_ROOF_LEFT_X = 160
export const FOREST_BRANCH_ROOF_RIGHT_X = AREA_WIDTH - FOREST_BRANCH_ROOF_LEFT_X
export const FOREST_BRANCH_ROOF_Y = 430
export const FOREST_BRANCH_ROOF_WIDTH = 100
export const FOREST_BRANCH_ROOF_HEIGHT = 18
export const FOREST_BRANCH_ROOF_ANGLE = 0.55
export const FOREST_EXIT_RAMP_LEFT_X = 35
export const FOREST_EXIT_RAMP_RIGHT_X = AREA_WIDTH - FOREST_EXIT_RAMP_LEFT_X
export const FOREST_EXIT_RAMP_Y = 568
export const FOREST_EXIT_RAMP_WIDTH = 60
export const FOREST_EXIT_RAMP_HEIGHT = 18
export const FOREST_EXIT_RAMP_ANGLE = FOREST_BRANCH_ROOF_ANGLE
export const FOREST_EXIT_GUIDE_LEFT_X = 70
export const FOREST_EXIT_GUIDE_RIGHT_X = AREA_WIDTH - FOREST_EXIT_GUIDE_LEFT_X
export const FOREST_EXIT_GUIDE_Y = 610
export const FOREST_EXIT_GUIDE_WIDTH = 80
export const FOREST_EXIT_GUIDE_HEIGHT = 18

/** 洞窟は短い板を左右交互に突き出し、2段の岩群を避ける狭いジグザグにする。 */
export const CAVE_ZIGZAG_LEFT_X = 150
export const CAVE_ZIGZAG_RIGHT_X = AREA_WIDTH - CAVE_ZIGZAG_LEFT_X
export const CAVE_ZIGZAG_WALL_WIDTH = 120
export const CAVE_ZIGZAG_SECOND_LEFT_X = 80
export const CAVE_ZIGZAG_SECOND_RIGHT_X = AREA_WIDTH - CAVE_ZIGZAG_SECOND_LEFT_X
export const CAVE_ZIGZAG_BOTTOM_LEFT_X = 120
export const CAVE_ZIGZAG_BOTTOM_RIGHT_X = AREA_WIDTH - CAVE_ZIGZAG_BOTTOM_LEFT_X
export const CAVE_ZIGZAG_BOTTOM_WIDTH = 180
export const CAVE_CHANNEL_LEFT_X = 90
export const CAVE_CHANNEL_RIGHT_X = AREA_WIDTH - CAVE_CHANNEL_LEFT_X
export const CAVE_CHANNEL_Y = 485
export const CAVE_CHANNEL_WIDTH = 32
export const CAVE_CHANNEL_HEIGHT = 8
export const CAVE_CHANNEL_ANGLE = 0.35
export const CAVE_ZIGZAG_WALL_HEIGHT = 18
export const CAVE_ZIGZAG_ANGLE = 0.4
export const CAVE_ZIGZAG_TOP_Y = 150
export const CAVE_ZIGZAG_SECOND_Y = 380
export const CAVE_ZIGZAG_BOTTOM_Y = 600
export const CAVE_ROCK_RADIUS = 12
/** 入口側の岩は板際でボールを止めず、下段だけ少し大きくして次の板へ受け渡す。 */
export const CAVE_TOP_ROCK_RADIUS = 10
export const CAVE_ROCK_TOP_Y = 260
export const CAVE_ROCK_BOTTOM_Y = 460
export const CAVE_ROCK_TOP_CENTER_X = AREA_WIDTH / 2
export const CAVE_ROCK_BOTTOM_RIGHT_X = AREA_WIDTH / 2
export const CAVE_BOTTOM_ROCK_RADIUS = 8
export const CAVE_BOTTOM_ROCK_RESTITUTION = 0.55
export const CAVE_ROCK_MIDDLE_LEFT_X = 210
export const CAVE_ROCK_MIDDLE_LEFT_Y = 360
export const CAVE_ROCK_MIDDLE_LEFT_RADIUS = 6
export const CAVE_ROCK_MIDDLE_LEFT_RESTITUTION = 0.55
/** 洞窟上段の共通導線へ置く大砲の装填室。分岐前の球を確実に受ける。 */
export const CAVE_CANNON_APPROACH_X = AREA_WIDTH / 2
export const CAVE_CANNON_APPROACH_Y = 230
export const CAVE_CANNON_APPROACH_RADIUS = 56
/** 上段砲の射出後に戻る帯を受け、次の岩ピンへ渡す着地ピン。 */
export const CAVE_CANNON_LANDING_X = 150
export const CAVE_CANNON_LANDING_Y = 265
export const CAVE_CANNON_LANDING_RADIUS = 20
/** 射出直後の着地ピンは少しだけ弾みを抑え、次の岩群へ滞在を渡す反発係数。 */
export const CAVE_CANNON_LANDING_RESTITUTION = 0.5

/** 川は長い板を左右へ渡し、板の端で向きを変える少数のピンを置いて横移動を主役にする。 */
export const RIVER_SWEEP_WIDTH = 240
export const RIVER_SWEEP_BOTTOM_WIDTH = 200
export const RIVER_SWEEP_HEIGHT = 18
export const RIVER_SWEEP_TOP_Y = 120
export const RIVER_SWEEP_SECOND_Y = 380
export const RIVER_SWEEP_SECOND_X = AREA_WIDTH - 120
export const RIVER_SWEEP_SECOND_WIDTH = 120
export const RIVER_SWEEP_BOTTOM_Y = 610
export const RIVER_SWEEP_ANGLE = 0.28
export const RIVER_PIN_TOP_RIGHT_X = AREA_WIDTH - 96
export const RIVER_PIN_TOP_Y = 250
export const RIVER_PIN_RADIUS = 14

/** 雲の入口は左右に離し、V字と3個の大きな雲バンパーでふわっと中央へ寄せる。 */
export const CLOUD_ENTRY_LEFT_X = 120
export const CLOUD_ENTRY_RIGHT_X = AREA_WIDTH - CLOUD_ENTRY_LEFT_X
export const CLOUD_EXIT_X = AREA_WIDTH / 2
export const CLOUD_V_LEFT_X = 110
export const CLOUD_V_RIGHT_X = AREA_WIDTH - CLOUD_V_LEFT_X
export const CLOUD_V_Y = 590
export const CLOUD_V_WIDTH = 200
export const CLOUD_V_HEIGHT = 18
export const CLOUD_V_ANGLE = 0.36
export const CLOUD_BUMPER_LEFT_X = 180
export const CLOUD_BUMPER_LEFT_Y = 180
export const CLOUD_BUMPER_RIGHT_X = 300
export const CLOUD_BUMPER_RIGHT_Y = 220
export const CLOUD_BUMPER_CENTER_X = AREA_WIDTH / 2
export const CLOUD_BUMPER_CENTER_Y = 450
export const CLOUD_BUMPER_SIDE_RADIUS = 30
export const CLOUD_BUMPER_CENTER_RADIUS = 32

/** ゴールは既存のV字と中央ピンを保ち、カップ周辺の物理・幾何はTask Aの数値を変えない。 */
export const GOAL_FUNNEL_TOP_LEFT_X = 110
export const GOAL_FUNNEL_TOP_RIGHT_X = AREA_WIDTH - GOAL_FUNNEL_TOP_LEFT_X
export const GOAL_FUNNEL_TOP_Y = 250
export const GOAL_FUNNEL_TOP_WIDTH = 160
export const GOAL_FUNNEL_LOWER_LEFT_X = 106
export const GOAL_FUNNEL_LOWER_RIGHT_X = AREA_WIDTH - GOAL_FUNNEL_LOWER_LEFT_X
export const GOAL_FUNNEL_LOWER_Y = 505
export const GOAL_FUNNEL_LOWER_WIDTH = 180
export const GOAL_FUNNEL_TOP_ANGLE = 0.35
export const GOAL_FUNNEL_LOWER_ANGLE = 0.55
export const GOAL_FUNNEL_WALL_HEIGHT = 18
export const GOAL_SPARK_X = AREA_WIDTH / 2
export const GOAL_SPARK_Y = 370
export const GOAL_SPARK_RADIUS = 18
export const GOAL_CUP_BOTTOM_MARGIN = 34

/**
 * 物理演算とヘッドレス測定で共用する固定タイムステップ。
 * 可変フレームレートのまま Engine.update へ渡すと、端末ごとに反発や落下のテンポが
 * 変わってしまうため、ピンボールと同じ60fpsの論理時間で進める。
 */
export const STEP_MS = 1000 / 60

/**
 * ピンボールの0.55より弱い重力。
 * 長い縦コースで待ち時間が出ないよう、従来の0.35から少しだけ強める。
 * エリアごとの細かな違いは AdventureArea.gravityScale で調整する。
 */
export const GRAVITY = { x: 0, y: 0.39 } as const

/**
 * スタート時の位置と初速の揺らぎ。
 * 毎回まったく同じ映像にならず、「今回はこっちへ行った」と感じられるように、
 * 入口を塞がない範囲で開始位置と初速を少しだけ変える。
 */
export const START = {
  x: AREA_WIDTH / 2,
  jitterX: 40,
  minVx: -1.2,
  maxVx: 1.2,
  minVy: 0,
  maxVy: 1.2,
} as const

/**
 * 国旗の模様を見分けながら、狭い通路も通れる半径。
 * 480px幅の約9%にあたり、直径44pxを入口の余白設計にも使う。
 */
export const BALL_RADIUS = 22

/** 跳ね返りを残しつつ、ピンボールのように高く飛び続けないためのボール反発係数。 */
export const BALL_RESTITUTION = 0.45
/** 斜面の上を滑りすぎず、転がりが止まりすぎない中間の接触摩擦。 */
export const BALL_FRICTION = 0.02
/** 空気抵抗を小さくして、重力でゆっくり加速する感触を残す。 */
export const BALL_FRICTION_AIR = 0.012
/** Matter.jsで重さを極端に変えず、既存ピンボールと同じ桁で安定させる密度。 */
export const BALL_DENSITY = 0.002

/** 壁の反発。斜面から少し戻るが、跳ね上がってコースを逆走しない値。 */
export const WALL_RESTITUTION = 0.3
/** ピンは壁より少しだけ強く反射し、触れたことが見た目にも分かる値。 */
export const PIN_RESTITUTION = 0.7
/** 壁に沿って落ちるときの減速を残すための接触摩擦。 */
export const WALL_FRICTION = 0.06
/** ピンに当たったあと横へ流れやすくするが、急加速はさせない摩擦。 */
export const PIN_FRICTION = 0

/** 薄い壁を1ステップで飛び越えないための速度上限(px/step)。 */
export const MAX_SPEED = 14
/** 国旗の模様が読めなくなるほど回転しないための角速度上限(rad/step)。 */
export const MAX_ANGULAR_VELOCITY = 0.22

/** 冒険側の羽根をピンより少し太くし、触れたことが見た目にも分かるサイズにする(px)。 */
export const SPINNER_BLADE_THICKNESS = 16
/** MAX_SPEEDの約8割に抑え、回転Toyでボールをコース外へ飛ばしにくくする(px/step)。 */
export const SPINNER_BALL_SPEED_CAP = 11
/** 羽根の反発を壁より強め、回転方向への接線速度を感じやすくする。 */
export const SPINNER_RESTITUTION = 0.6
/** ピンボール側と同じ停滞判定にし、止まりかけた球だけを軽く動かす(px/step)。 */
export const SPINNER_STALL_SPEED = 0.35
/** 次の接触を生むための小さな一押しに留め、瞬間的なワープに見せない(px/step)。 */
export const SPINNER_NUDGE_SPEED = 2.4
/** 同じボールを連続して押さず、回転Toyの周囲で速度が積み上がるのを防ぐ(ms)。 */
export const SPINNER_NUDGE_COOLDOWN_MS = 200

/** ピンボール側より少し長い待ち時間にし、同じ場所での無限バウンドを防ぐ(ms)。 */
export const LIFTER_COOLDOWN_MS = 900
/** 上向き速度の直接設定に加える反発を控えめにし、落下コースへ戻しやすくする。 */
export const LIFTER_RESTITUTION = 0.5
/** 横方向の散らしを強くしすぎず、エリアの外壁へ届く前に次の接触を作る上限(px/step)。 */
export const LIFTER_MAX_HORIZONTAL_SPEED = 5.5
/** 真上へ固定せず左右どちらかへ見える最小の散らし(px/step)。 */
export const LIFTER_RANDOM_HORIZONTAL_MIN = 1.6
/** シード差による変化を残しつつ、横移動が主役になりすぎない最大の散らし(px/step)。 */
export const LIFTER_RANDOM_HORIZONTAL_MAX = 3.4
/** 直前の横速度を少しだけ残し、接触前の流れを完全には消さない割合。 */
export const LIFTER_HORIZONTAL_RETENTION = 0.3
/** MAX_SPEEDより少し下にし、打ち上げ直後の速度が過大にならないようにする(px/step)。 */
export const LIFTER_SPEED_CAP = 12

/** 大砲へ入ったボールを子どもが見てから射出できる中間の溜め時間(ms)。 */
export const CANNON_HOLD_MS = 520
/** 大砲は重力から離れた動きを見せつつ、速度上限まで余裕を残す初期値(px/step)。 */
export const CANNON_POWER = 9.5
/** 洞窟の短い導線では、射出先の板へ確実に届きつつ川の加速感を残す威力(px/step)。 */
export const CAVE_CANNON_POWER = 8
/** 大砲の捕獲円。砲身の見た目と入口の狙いやすさを両立する半径(px)。 */
export const CANNON_SENSOR_RADIUS = 30
/** 射出直後に捕獲センサーへ戻らないよう、センサー半径より外へ出す距離(px)。 */
export const CANNON_MUZZLE_OFFSET = 64
/** 射出直後の同じ大砲への再捕獲を防ぐ待ち時間(ms)。 */
export const CANNON_RECAPTURE_COOLDOWN_MS = 700
/** ジャンプ台は大砲より低く跳ね、コースの流れを読みやすく保つ初期値(px/step)。 */
export const JUMP_POWER = 8
/** 川の長い坂の終端でスピード感を出し、MAX_SPEEDを超えない範囲で上向きに跳ねる速度(px/step)。 */
export const RIVER_JUMP_POWER = 9
/** ジャンプ台が同じ接触で連続発火しないための短い待ち時間(ms)。 */
export const JUMP_COOLDOWN_MS = 250
/** 加速レーンの1ステップ加速度。触れたことが分かるが急加速しすぎない値(px/step)。 */
export const BOOST_ACCELERATION = 0.35
/** 加速レーン内でも既存の速度感を壊さない上限(px/step)。 */
export const BOOST_MAX_SPEED = 11
/** 加速レーンの通知音を再入場時に鳴らしすぎない待ち時間(ms)。 */
export const BOOST_SOUND_COOLDOWN_MS = 500
/** ふわふわゾーンで残す重力の割合。落下感を保ちながら滞空を見せる値。 */
export const FLOAT_GRAVITY_SCALE = 0.45

/** タブ復帰直後に実時間の大きな差分をそのまま物理へ渡さないための上限(ms)。 */
export const MAX_FRAME_DELTA_MS = 100
/** 復帰直後に一度に進める固定ステップ数の上限。残った累積時間は捨てて暴走を防ぐ。 */
export const MAX_SUBSTEPS = 5

/** 同じピンへ連続して当たったときの演出通知を間引く時間(ms)。 */
export const PIN_HIT_COOLDOWN_MS = 120
/** 別のピンへ連続衝突しても音が重なり続けない全体クールダウン(ms)。 */
export const PIN_SOUND_GLOBAL_COOLDOWN_MS = 70

/** これ未満の速さ(px/step)を「ほとんど止まった」と判定する閾値。 */
export const STALL_SPEED_THRESHOLD = 0.35
/** 停滞がこの時間続いたら、まず一度だけ軽いナッジを入れる(ms)。 */
export const STALL_DURATION_MS = 1200
/** 停滞ナッジの横速度。ワープではなく、次の接触を生むための小さな押し出しに留める。 */
export const STALL_NUDGE_SPEED = 1.8

/** 同じエリアで偶発的に止まり続けても、密度を味わえる時間を確保してから進める保険(ms)。 */
export const AREA_TIMEOUT_MS = 15_000
/** 左右へこの距離以上はみ出したら、現在エリアの入口へ戻す救済マージン(px)。 */
export const OUT_OF_BOUNDS_MARGIN_X = 80
/** 上へこの距離以上はみ出したら、コースから外れたとみなす救済マージン(px)。 */
export const OUT_OF_BOUNDS_MARGIN_Y = 200

/** 出口から次エリアへカメラを移す時間。動きの変化を子どもが追える600msにする。 */
export const CAMERA_TRANSITION_MS = 600
/** カメラが止まった直後に物理を再開するまでの短い待ち時間(ms)。視線の着地を待つ。 */
export const CAMERA_SETTLE_MS = 120
/** 次エリアへ入ったボールの上側に確保する障害物なしの余白(px)。 */
export const AREA_ENTRY_CLEARANCE = 60

/** 外壁をデータから省き、全エリアへ自動生成する板の厚み。すり抜け防止のため少し厚めにする。 */
export const OUTER_WALL_THICKNESS = 28
/** 穴を「下端全体」ではなく、ボールが狙える開口として見せる幅。 */
export const EXIT_WIDTH = 140
/** 出口センサーと見た目のポータルを揃える高さ。 */
export const EXIT_SENSOR_HEIGHT = 40
/** 出口中心を床の少し上へ置き、ボールが穴へ落ちる途中で検知できるようにする距離。 */
export const EXIT_CENTER_OFFSET_FROM_BOTTOM = 52
/** 出口の左右に残す受け皿の板厚。開口以外から下へ抜けないようにする。 */
export const PORTAL_FLOOR_HEIGHT = 28

/** 出口へ吸い込まれる時間。物理を止めてもワープに見えない最小限の間を取る(ms)。 */
export const EXIT_SWALLOW_MS = 260
/** 入口から出てくるとき、透明状態から通常サイズへ戻る時間(ms)。 */
export const ENTRY_EMERGE_MS = 220
/** 40px高のポータルの下側60%を前景で覆い、吸い込みの最後だけを隠す高さ(px)。 */
export const PORTAL_FRONT_LIP_HEIGHT = 24

/** カップの内側。ボール直径より十分広く、斜めに入っても底へ落ちる幅を残す。 */
export const CUP_INNER_WIDTH = 104
/** リムから底までの深さ。センサーをリム接触より十分下へ置くための余白も含む。 */
export const CUP_INNER_DEPTH = 96
/** 薄すぎてボールが抜けないようにするカップ壁・底の厚み。 */
export const CUP_WALL_THICKNESS = 16
/** ボール中心がこの深さまで下がるまでは、リム接触をカップインとみなさない距離(px)。 */
export const CUP_SENSOR_INSET = 48
/** センサーはボール半径ぶん下げ、衝突開始時点で中心が判定線を越えるようにする高さ。 */
export const CUP_SENSOR_HEIGHT = 24
/** センサー矩形の上端。先に定めた中心判定線へ球が届いてから接触を始める位置。 */
export const CUP_SENSOR_TOP_OFFSET = CUP_SENSOR_INSET + BALL_RADIUS
/**
 * リムから48px下の638pxを前景上端にする。センサー上端は660pxなので、判定時は
 * ボールの上端（616px）がまだ見え、底で静止する上端642pxは638pxより下へ入るため、
 * 沈み込みを見せてから完全に隠せる（rimY=590px、深さ96px、半径22pxの場合）。
 */
export const CUP_FRONT_LIP_TOP_OFFSET = 48
/** カップ壁・底はほぼ跳ねず、内側へ落ち着きやすい接触にする。 */
export const CUP_RESTITUTION = 0.05
export const CUP_FRICTION = 0.3
/** カップイン後も底へ沈む様子を見せる時間(ms)。 */
export const CUP_SETTLE_MS = 520
/** 範囲外・タイムアウト時にカップ口の真上へ置き直す高さ(px)。 */
export const CUP_RESCUE_DROP_HEIGHT = 120
/** ゴールでの救済を繰り返し続けず、2回目だけ底への最終保険を使う。 */
export const GOAL_RESCUE_DROP_LIMIT = 2

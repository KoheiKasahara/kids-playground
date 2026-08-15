/**
 * 1エリアの論理座標。
 * 画面の向きと見通しを優先した縦長の480×720を全エリアで共有し、端末の大きさによる
 * 物理挙動の差をなくす。表示時の拡縮は useAreaScale に閉じ込める。
 */
export const AREA_WIDTH = 480
export const AREA_HEIGHT = 720

/**
 * 物理演算とヘッドレス測定で共用する固定タイムステップ。
 * 可変フレームレートのまま Engine.update へ渡すと、端末ごとに反発や落下のテンポが
 * 変わってしまうため、ピンボールと同じ60fpsの論理時間で進める。
 */
export const STEP_MS = 1000 / 60

/**
 * ピンボールの0.55より弱い重力。
 * ボールを速く落とすよりも、斜面やピンに当たる様子を子どもが見守れる時間を優先する。
 */
export const GRAVITY = { x: 0, y: 0.35 } as const

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
export const PIN_FRICTION = 0.02

/** 薄い壁を1ステップで飛び越えないための速度上限(px/step)。 */
export const MAX_SPEED = 14
/** 国旗の模様が読めなくなるほど回転しないための角速度上限(rad/step)。 */
export const MAX_ANGULAR_VELOCITY = 0.22

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

/** 同じエリアで偶発的に止まり続けても、必ず次へ進めるための上限滞在時間(ms)。 */
export const AREA_TIMEOUT_MS = 12_000
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

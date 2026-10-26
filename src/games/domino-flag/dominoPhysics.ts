import { DOMINO_HEIGHT } from './dominoLayout'

/** 重力を強め、1ユニットのドミノが幼児向けのテンポで倒れるようにする。 */
export const GRAVITY_Y = -24

/** 厚さ0.14の接触を安定させるため、表示フレームより細かい120Hzで積分する。 */
export const PHYSICS_TIMESTEP = 1 / 120

/** 1フレームでの物理計算を4回までに抑え、低速端末の負荷が連鎖的に増えないようにする。 */
export const MAX_PHYSICS_SUBSTEPS = 4

/** タブ復帰や一時停止から戻ったときに、巨大な時間跳躍を物理へ渡さない。 */
export const MAX_FRAME_DELTA_MS = 100

/** 通常のドミノは体積に対して素直な質量になる密度1.0を使う。 */
export const DOMINO_DENSITY = 1.0

/** 跳ね返りをなくし、倒れたドミノが連鎖を乱さないようにする。 */
export const DOMINO_RESTITUTION = 0

/** ドミノ同士が滑りすぎず、接触の勢いも残る中間的な摩擦係数にする。 */
export const DOMINO_FRICTION = 0.5

/** 地面の摩擦を高め、倒れたドミノが横滑りして連鎖から離れないようにする。 */
export const GROUND_FRICTION = 0.85

/** 小さな減衰だけを加え、倒れる速さを保ちながら微振動は sleep へ収束させる。 */
export const LINEAR_DAMPING = 0.05
export const ANGULAR_DAMPING = 0.08

/** 地面は全レイアウトと倒れた後の余裕を覆う固定キューブにする。 */
export const GROUND_SIZE = 40
export const GROUND_THICKNESS = 0.1

/** スタートが「上端を押して倒れ始めた」と見える最小限の+Zインパルス。 */
export const START_IMPULSE_Z = 0.06

/** 補助インパルスの基準値。通常の物理連鎖を置き換えず、止まったときだけ使う。 */
export const SHEPHERD_IMPULSE_Z = 0.035

/** 補助点を上端近くに置き、同じ力でも自然な回転が生まれるようにする。 */
export const IMPULSE_POINT_Y = DOMINO_HEIGHT * 0.43

/** 100〜250msの範囲で物理判定と補助判定をまとめ、毎フレームの計算を増やさない。 */
export const INSPECTION_INTERVAL_MS = 160

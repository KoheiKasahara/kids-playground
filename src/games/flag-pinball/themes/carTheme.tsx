import type { ReactNode } from 'react'
import type { PinballThemeDefinition } from './types'
import { CAR_ROAD_YS } from '../boardConfigs/carBoard'
import type { ToyKind, ToyPlacement } from '../toyLayout'
import CarToyArt from './CarToyArt'
import styles from './carTheme.module.css'

/**
 * 道路の帯。当たり判定を持たない純粋な装飾で、車toyが往復する高さ（CAR_ROAD_YS）に
 * 1本ずつ敷く。座標は盤面の論理座標（480×1000）のpxそのまま。
 */
function renderCarBackdrop(): ReactNode {
  return (
    <div className={styles.carBackdrop}>
      {CAR_ROAD_YS.map((y) => (
        <div key={y} className={styles.carRoad} style={{ top: y - ROAD_ABOVE_CAR_CENTER }} />
      ))}
    </div>
  )
}

/** 車の中心yから道路の上端までの距離。タイヤ（中心y+28付近）が下側の車線に乗るよう少し下へずらす。 */
const ROAD_ABOVE_CAR_CENTER = 44

function renderCarToy(kind: ToyKind, toy?: ToyPlacement): ReactNode {
  if (kind === 'car') {
    // 物理Collider（carToy.tsの胴体＋円形キャビン）は車種によらず共通。
    // 見た目だけを配置データの車種（car.variant）で描き分ける。
    return <CarToyArt variant={toy?.car?.variant} />
  }

  if (kind === 'spinner') {
    return (
      <span className={styles.carSpinnerMark}>
        <span className={`${styles.carSpinnerBlade} ${styles.carSpinnerBladeNorth}`} />
        <span className={`${styles.carSpinnerBlade} ${styles.carSpinnerBladeEast}`} />
        <span className={`${styles.carSpinnerBlade} ${styles.carSpinnerBladeSouth}`} />
        <span className={`${styles.carSpinnerBlade} ${styles.carSpinnerBladeWest}`} />
        <span className={styles.carSpinnerHub} />
      </span>
    )
  }

  if (kind === 'jumppad') {
    // Phase F時点ではくるまの盤面にジャンプ台は置かれないが、テーマ定義としては
    // 全おもちゃ種別の見た目を返す必要があるため、簡素なパッドにしておく。
    return (
      <span className={styles.carJumppadMark}>
        <span className={styles.carJumppadPad} />
        <span className={styles.carJumppadRing} />
      </span>
    )
  }

  if (kind === 'seesaw') {
    // Phase F時点ではくるまの盤面にシーソーは置かれないが、テーマ定義としては
    // 全おもちゃ種別の見た目を返す必要があるため、簡素な板にしておく。
    return (
      <span className={styles.carSeesawMark}>
        <span className={styles.carSeesawPivot} />
        <span className={styles.carSeesawPlank} />
      </span>
    )
  }

  if (kind === 'wind') {
    // Phase F時点ではくるまの盤面に風toyは置かれないが、テーマ定義としては
    // 全おもちゃ種別の見た目を返す必要があるため、簡素な矢印3本にしておく。
    return (
      <span className={styles.carWindMark}>
        <span className={styles.carWindArrow} />
        <span className={styles.carWindArrow} />
        <span className={styles.carWindArrow} />
      </span>
    )
  }

  if (kind === 'hammer') {
    // Phase F時点ではくるまの盤面にハンマーは置かれないが、テーマ定義としては
    // 全おもちゃ種別の見た目を返す必要があるため、簡素な棒＋ヘッドにしておく。
    return (
      <span className={styles.carHammerMark}>
        <span className={styles.carHammerHandle} />
        <span className={styles.carHammerHead} />
      </span>
    )
  }

  return (
    <span className={styles.carLauncherMark}>
      <span className={styles.carLauncherBase} />
      <span className={styles.carLauncherSpring} />
      <span className={styles.carLauncherCap} />
      <span className={styles.carLauncherPop} />
    </span>
  )
}

export const carTheme: PinballThemeDefinition = {
  id: 'car',
  labelJa: 'くるま',
  emoji: '🚗',
  boardClassName: styles.carBoard,
  toyClassName: styles.carToy,
  renderBackdrop: renderCarBackdrop,
  renderToy: renderCarToy,
}

import type { AreaTheme } from './types'
import styles from './AreaBackground.module.css'
import { ADVENTURE_LAYER_Z_INDEX } from './layerOrder'

/**
 * 背景レイヤーのz-indexをここだけで管理する。
 * 遠景→装飾→前景の順に積むと、将来前景へ素材を足してもコース・ボールを隠さず、
 * レイヤーの意味と見た目の順序がCSSの複数箇所へ分散しない。
 */
const themeClass: Record<AreaTheme, string> = {
  sky: styles.themeSky,
  forest: styles.themeForest,
  cave: styles.themeCave,
  goal: styles.themeGoal,
  river: styles.themeRiver,
  cloud: styles.themeCloud,
}

type AreaBackgroundProps = { theme: AreaTheme }

/**
 * 1エリア分の仮背景。
 * Phase 2では画像を使わず、6テーマの仮背景をlayerBase/layerFar/layerDecorの
 * 役割ごとに差し替えられるよう、背景3枚の概念レイヤーをDOMに用意しておく。
 */
export default function AreaBackground({ theme }: AreaBackgroundProps) {
  return (
    <div className={[styles.background, themeClass[theme]].join(' ')} aria-hidden="true">
      <div className={styles.layerBase} style={{ zIndex: ADVENTURE_LAYER_Z_INDEX.backgroundBase }} />
      <div className={styles.layerFar} style={{ zIndex: ADVENTURE_LAYER_Z_INDEX.backgroundFar }}>
        <span className={styles.farShape} />
        <span className={styles.farShapeSecondary} />
      </div>
      <div className={styles.layerDecor} style={{ zIndex: ADVENTURE_LAYER_Z_INDEX.backgroundDecor }}>
        <span className={styles.decorShape} />
        <span className={styles.decorShapeSecondary} />
      </div>
    </div>
  )
}

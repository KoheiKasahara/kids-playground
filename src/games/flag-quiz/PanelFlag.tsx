import { memo, useMemo } from 'react'
import type { Country } from './types'
import styles from './PanelFlag.module.css'

/** パネルの総数（4列×4行）。テストや得点計算からも参照する */
export const PANEL_COUNT = 16
/** パネルの列数 */
export const PANEL_COLUMNS = 4

type PanelFlagProps = {
  country: Country
  /** 現在開いている（めくった）パネルの index (0〜PANEL_COUNT-1) の集合。重複があっても問題ない */
  openedPanels: Iterable<number>
  /** true のとき、openedPanels に関わらず全パネルを開いた状態で表示する（国旗全体を見せるため） */
  revealAll?: boolean
}

/**
 * 国旗画像の上に PANEL_COUNT 枚のパネルを CSS Grid で重ねて表示する。
 * 国旗画像そのものは1枚だけを表示し、画像自体の分割生成は行わない
 * （パネルはあくまで画像の上に重ねた装飾要素）。
 *
 * パネルは答えを左右しない純粋な演出要素のため、各パネルに aria-hidden="true" を付けて
 * スクリーンリーダーの読み上げを妨げないようにする。パネル自体はタップ操作を受け付けない
 * （めくる操作は「もう1まい めくる！」ボタンに一本化している）。開閉状態は data-open 属性で持ち、
 * data-testid="panel-<index>" と合わせてテストから直接検証できる。
 *
 * 1マスは「セル（枠・レイアウト）」と「フタ（lid、めくれる見た目）」の2層構造にする。
 * めくるアニメーションは lid だけが担当するので、セルのレイアウトと見た目のアニメーションを分離できる。
 *
 * 回答判定とは無関係な演出要素の再レンダリングを抑えるため React.memo 化している
 * （正解後は revealedPanels が1枚ずつ増え、16回近く再レンダリングされるため）。
 */
function PanelFlag({ country, openedPanels, revealAll = false }: PanelFlagProps) {
  const openedSet = useMemo(
    () => (openedPanels instanceof Set ? openedPanels : new Set(openedPanels)),
    [openedPanels],
  )

  return (
    <div className={styles.frame}>
      <img
        className={styles.flag}
        src={import.meta.env.BASE_URL + country.flag}
        alt=""
        draggable={false}
      />
      <div className={styles.grid}>
        {Array.from({ length: PANEL_COUNT }, (_, index) => {
          const isOpen = revealAll || openedSet.has(index)
          return (
            <span
              key={index}
              data-testid={`panel-${index}`}
              data-open={isOpen ? 'true' : 'false'}
              aria-hidden="true"
              className={styles.cell}
            >
              <span className={isOpen ? `${styles.lid} ${styles.lidOpen}` : styles.lid} />
            </span>
          )
        })}
      </div>
    </div>
  )
}

export default memo(PanelFlag)

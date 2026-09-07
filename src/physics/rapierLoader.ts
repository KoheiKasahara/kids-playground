import RAPIER from '@dimforge/rapier3d-compat'

let initialization: Promise<void> | undefined

/** Lazyゲームからのみ参照する。worldの所有・破棄は呼び出し側で行う。
 * 失敗したPromiseは保持せず、次の入場で再試行できるようにする。
 */
export function initializeRapier(): Promise<void> {
  initialization ??= Promise.resolve().then(() => RAPIER.init()).catch((error: unknown) => {
    initialization = undefined
    throw error
  })
  return initialization
}

/**
 * `virtual:pwa-register/react` は vite-plugin-pwa がビルド時に生成する仮想モジュールで、
 * vitest（jsdom 環境）では解決できない。
 * vite.config.ts の test.alias でこのスタブに差し替えることで、
 * PwaStatus をレンダリングするテストが SW 登録処理なしに動作するようにする。
 */
export function useRegisterSW() {
  return {
    needRefresh: [false, () => {}] as [boolean, (value: boolean) => void],
    offlineReady: [false, () => {}] as [boolean, (value: boolean) => void],
    updateServiceWorker: async () => {},
  }
}

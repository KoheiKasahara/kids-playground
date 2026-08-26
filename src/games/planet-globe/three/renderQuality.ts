/**
 * iPhoneなどの高DPR画面でも天体の輪郭・輪・斑点を滑らかに描く。
 * DPR 3以上をそのまま使うとピクセル数とGPU負荷が急増するため、上限は2にする。
 * `earth-globe/three/renderQuality.ts` と同じ方針だが、ゲーム間import はせずローカルに複製する。
 */
export const MAX_RENDER_PIXEL_RATIO = 2

export function renderPixelRatioForDevice(devicePixelRatio: number): number {
  if (!Number.isFinite(devicePixelRatio) || devicePixelRatio <= 0) return 1
  return Math.min(devicePixelRatio, MAX_RENDER_PIXEL_RATIO)
}

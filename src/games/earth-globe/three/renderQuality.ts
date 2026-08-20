/**
 * iPhoneなどの高DPR画面でも地球外周・海岸線・国境線を滑らかに描く。
 * DPR 3以上をそのまま使うとピクセル数とGPU負荷が急増するため、上限は2にする。
 */
export const MAX_RENDER_PIXEL_RATIO = 2

export function renderPixelRatioForDevice(devicePixelRatio: number): number {
  if (!Number.isFinite(devicePixelRatio) || devicePixelRatio <= 0) return 1
  return Math.min(devicePixelRatio, MAX_RENDER_PIXEL_RATIO)
}

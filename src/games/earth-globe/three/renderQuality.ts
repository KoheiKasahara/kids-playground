/**
 * iPhoneなどの高DPR画面でも地球外周・海岸線・国境線を滑らかに描く。
 * DPR 3以上をそのまま使うとピクセル数とGPU負荷が急増するため、上限は2にする。
 */
export const MAX_RENDER_PIXEL_RATIO = 2

type GlobeRenderActivity = {
  ready: boolean
  renderRequested: boolean
  renderThrough: number
  now: number
  controlsChanged: boolean
  animationsActive: boolean
}

export function renderPixelRatioForDevice(devicePixelRatio: number): number {
  if (!Number.isFinite(devicePixelRatio) || devicePixelRatio <= 0) return 1
  return Math.min(devicePixelRatio, MAX_RENDER_PIXEL_RATIO)
}

/**
 * 重い地球儀は、静止中まで毎フレームGPU描画すると回転後のUI操作を妨げる。
 * 初期生成・操作・アニメーション中だけ描画し、静止中はRAFの監視だけに留める。
 */
export function shouldRenderGlobeFrame(activity: GlobeRenderActivity): boolean {
  return !activity.ready
    || activity.renderRequested
    || activity.now < activity.renderThrough
    || activity.controlsChanged
    || activity.animationsActive
}

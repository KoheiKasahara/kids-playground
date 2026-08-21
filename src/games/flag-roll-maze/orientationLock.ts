export type OrientationController = {
  type?: string
  lock?: (orientation: string) => Promise<unknown>
  unlock?: () => void
}

/** 非対応ブラウザでは何もしない、画面向き固定のbest-effortラッパー。 */
export async function lockCurrentScreenOrientation(
  controller: OrientationController | undefined,
): Promise<boolean> {
  if (controller?.lock === undefined || controller.type === undefined) return false
  try {
    await controller.lock(controller.type)
    return true
  } catch {
    return false
  }
}

export function unlockScreenOrientation(controller: OrientationController | undefined): void {
  controller?.unlock?.()
}

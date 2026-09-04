import type { Page } from '@playwright/test'

/**
 * Collect uncaught browser exceptions for the duration of a smoke test.
 *
 * Playwright reports uncaught page exceptions through `pageerror`. Console
 * warnings/errors are intentionally not collected because the smoke tests
 * should fail only for runtime failures that can prevent a screen from
 * rendering.
 */
export function capturePageErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  return errors
}

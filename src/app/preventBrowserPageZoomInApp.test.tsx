import { describe, expect, test } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from './App'

// App.tsxがinstallBrowserPageZoomSuppression()を実際にマウントし、
// アンマウント時に後始末していることを検証する（Issue #166）。
describe('App経由のブラウザページズーム抑制(Issue #166)', () => {
  test('AppをマウントするとgesturestartがpreventDefaultされ、アンマウントすると効かなくなる', () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )

    const mountedEvent = new Event('gesturestart', { cancelable: true })
    document.dispatchEvent(mountedEvent)
    expect(mountedEvent.defaultPrevented).toBe(true)

    unmount()

    const unmountedEvent = new Event('gesturestart', { cancelable: true })
    document.dispatchEvent(unmountedEvent)
    expect(unmountedEvent.defaultPrevented).toBe(false)
  })
})

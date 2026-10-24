import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers'
import 'vitest'

// Vitest 5 no longer imports matcher types from the global Jest namespace.
declare module 'vitest' {
  interface Matchers<R, T> extends TestingLibraryMatchers<T, R> {}
}

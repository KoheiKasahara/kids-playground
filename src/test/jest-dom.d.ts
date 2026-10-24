import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers'
import 'vitest'

// Vitest 5 no longer imports matcher types from the global Jest namespace.
declare module 'vitest' {
  // Declaration merging requires an interface rather than a type alias.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Matchers<R, T> extends TestingLibraryMatchers<T, R> {}
}

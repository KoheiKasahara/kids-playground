import { defineConfig } from '@playwright/test'
import base from './playwright.config'

export default defineConfig({
  ...base,
  testMatch: 'crane-native-diagnostic.spec.ts',
  workers: 1,
  retries: 0,
  timeout: 90_000,
  reporter: 'list',
  // Native application clock in both cohorts. No altered browser launch flags.
  projects: [
    { name: 'native-current-trace', use: { ...base.projects![0]!.use, trace: base.use!.trace } },
    { name: 'native-trace-off', grep: /native baseline/, use: { ...base.projects![0]!.use, trace: 'off' } },
  ],
})

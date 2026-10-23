import { createStageProgressStore } from '../shared/progress/stageProgress'
import { COURSES, normalizeBuild } from './data'
import type { Build } from './types'

const BUILD_KEY = 'mini-4wd:build:v1'

export function readBuild(): Build {
  try {
    return normalizeBuild(JSON.parse(localStorage.getItem(BUILD_KEY) ?? 'null'))
  } catch {
    return normalizeBuild(null)
  }
}

export function writeBuild(build: Build): void {
  try {
    localStorage.setItem(BUILD_KEY, JSON.stringify(normalizeBuild(build)))
  } catch {
    // Storage may be unavailable. The current car remains playable in memory.
  }
}

export const progressStore = createStageProgressStore('mini-4wd:progress:v1', id => COURSES.some(course => course.id === id))

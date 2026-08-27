import { describe, expect, it } from 'vitest'
import { TRAIN_TYPES } from './railFleetModel'
import {
  E5_LEAD_SHELL_SECTIONS,
  TRAIN_VISUAL_PROFILES,
  getTrainCarVisualProfile,
  getE5LeadShellAccentBand,
  resolveTrainVisualProfile,
} from './railTrainVisuals'

describe('railTrainVisuals', () => {
  it('keeps a complete visual profile for every registered train type', () => {
    for (const trainType of TRAIN_TYPES) {
      const profile = resolveTrainVisualProfile(trainType)
      expect(profile).toBe(TRAIN_VISUAL_PROFILES[trainType])
      expect(profile.lead.role).toBe('lead')
      expect(profile.middle.role).toBe('middle')
      expect(profile.window.sideXs.length).toBeGreaterThan(0)
    }
  })

  it('defines E5 as a constrained low-nose lead with a no-nose middle car', () => {
    const e5 = resolveTrainVisualProfile('e5')
    const lead = getTrainCarVisualProfile('e5', 'lead')
    const middle = getTrainCarVisualProfile('e5', 'middle')

    expect(e5.silhouette).toBe('e5-rounded-shoulder')
    expect(e5.accent.color).toBe('#ec5a93')
    expect(e5.window.color).toBe('#173246')
    expect(e5.noseLength).toBeGreaterThan(1)
    expect(e5.frontExtent).toBeLessThanOrEqual(1.38)
    expect(e5.rearExtent).toBeGreaterThanOrEqual(-1.1)
    expect(e5.maxHalfWidth).toBeLessThanOrEqual(0.5)
    expect(lead.noseLength).toBeGreaterThan(0)
    expect(lead.noseTipX).toBeLessThanOrEqual(1.38)
    expect(lead.noseTipTopY).toBeLessThanOrEqual(1.39)
    expect(lead.bodyCenterX - lead.bodyLength / 2).toBeGreaterThanOrEqual(-1.1)
    expect(middle.noseLength).toBe(0)
    expect(middle.hasFrontWindow).toBe(false)
    expect(middle.hasHeadlights).toBe(false)
    expect(middle.bodyWidth).toBe(lead.bodyWidth)
    expect(middle.sideWindowXs).toEqual(lead.sideWindowXs)
  })

  it('keeps E5 proportions and detail placements deliberately slender', () => {
    const e5 = resolveTrainVisualProfile('e5')
    const lead = e5.lead

    expect(lead.bodyLength / lead.bodyHeight).toBeGreaterThan(3)
    expect(lead.bodyHeight).toBeLessThan(0.62)
    expect(lead.bodyWidth).toBeLessThan(0.9)
    expect(lead.noseBaseX).toBeLessThan(lead.bodyCenterX + lead.bodyLength / 2)
    expect(lead.noseTipX - lead.noseBaseX).toBeGreaterThan(1)
    expect(lead.noseTipWidth).toBeLessThan(lead.noseBaseWidth)
    expect(lead.noseTipWidth).toBeGreaterThan(0.3)
    expect(lead.sideWindowWidth).toBeLessThan(0.3)
    expect(lead.sideWindowHeight).toBeLessThan(0.2)
    expect(lead.sideWindowXs[1]! - lead.sideWindowXs[0]!).toBeGreaterThan(0.4)
    expect(lead.frontWindowWidth).toBeLessThan(0.4)
    expect(lead.frontWindowX).toBeGreaterThan(0.4)
    expect(e5.bodyColor).toMatch(/^#f/i)
    expect(e5.roofColor).toMatch(/^#(?:2|3)/i)
    expect(e5.accent.height).toBeLessThan(0.1)
    expect(lead.couplerPositions).toEqual([-1.25, 1.25])
  })

  it('defines one continuous E5 lead shell from the cabin rear to the long nose tip', () => {
    expect(E5_LEAD_SHELL_SECTIONS).toHaveLength(12)
    expect(E5_LEAD_SHELL_SECTIONS[0]).toEqual({ x: -1.04, top: 1.22, bottom: 0.49, width: 0.88 })
    expect(E5_LEAD_SHELL_SECTIONS.at(-1)).toEqual({ x: 1.34, top: 0.82, bottom: 0.64, width: 0.42 })

    for (let index = 1; index < E5_LEAD_SHELL_SECTIONS.length; index += 1) {
      const previous = E5_LEAD_SHELL_SECTIONS[index - 1]!
      const current = E5_LEAD_SHELL_SECTIONS[index]!
      expect(current.x).toBeGreaterThan(previous.x)
      expect(current.bottom).toBeGreaterThanOrEqual(previous.bottom)
      expect(current.top).toBeLessThanOrEqual(previous.top)
      expect(current.width).toBeLessThanOrEqual(previous.width)
      expect(current.width / 2).toBeLessThanOrEqual(0.5)
      expect(current.top).toBeLessThanOrEqual(1.39)
    }

    const e5 = resolveTrainVisualProfile('e5')
    let previousBandHeight = Number.POSITIVE_INFINITY
    for (const section of E5_LEAD_SHELL_SECTIONS) {
      const band = getE5LeadShellAccentBand(section, e5.accent.height, e5.accent.y)
      expect(band.lowerY).toBeGreaterThanOrEqual(band.sideLower - 1e-7)
      expect(band.upperY).toBeLessThanOrEqual(band.sideUpper + 1e-7)
      expect(band.height).toBeLessThanOrEqual(previousBandHeight + 1e-7)
      previousBandHeight = band.height
    }
  })

  it('gives each new train a dedicated silhouette, nose, and color treatment', () => {
    const profiles = TRAIN_TYPES.map((trainType) => resolveTrainVisualProfile(trainType))
    expect(new Set(profiles.map((profile) => profile.silhouette)).size).toBe(TRAIN_TYPES.length)

    const e5 = resolveTrainVisualProfile('e5')
    const e6 = resolveTrainVisualProfile('e6')
    const n700s = resolveTrainVisualProfile('n700s')
    const doctorYellow = resolveTrainVisualProfile('doctorYellow')
    expect(e6.silhouette).toBe('e6-sharp-shoulder')
    expect(n700s.silhouette).toBe('n700s-rounded-shoulder')
    expect(doctorYellow.silhouette).toBe('doctor-yellow-thick-shoulder')
    expect(e6.lead.noseStyle).toBe('e6-spear')
    expect(n700s.lead.noseStyle).toBe('n700s-winged')
    expect(doctorYellow.lead.noseStyle).toBe('doctor-yellow-duck')
    expect(e6.bodyWidth).toBeLessThan(e5.bodyWidth)
    expect(n700s.noseLength).toBeLessThan(e5.noseLength)
    expect(new Set([
      e5.lead.noseTipWidth,
      e6.lead.noseTipWidth,
      n700s.lead.noseTipWidth,
      doctorYellow.lead.noseTipWidth,
    ]).size).toBe(4)
    expect(e6.lead.sideWindowXs.length).toBe(2)
    expect(n700s.lead.sideWindowXs.length).toBe(3)
    expect(doctorYellow.lead.sideWindowXs.length).toBe(1)
    expect(e6.accent.color).toBe('#b8bdc4')
    expect(n700s.accent.color).toBe('#2e64cb')
    expect(doctorYellow.accent.color).toBe('#19457a')
    expect(new Set([e5.bodyColor, e6.bodyColor, n700s.bodyColor, doctorYellow.bodyColor]).size).toBe(4)
  })

  it('keeps every profile inside the shared toy-train envelope', () => {
    for (const trainType of TRAIN_TYPES) {
      const profile = resolveTrainVisualProfile(trainType)
      const lead = profile.lead
      const roofTop = lead.roofCenterY + lead.roofHeight / 2
      const bodyRear = lead.bodyCenterX - lead.bodyLength / 2
      expect(profile.frontExtent).toBeLessThanOrEqual(1.38)
      expect(profile.rearExtent).toBeGreaterThanOrEqual(-1.1)
      expect(lead.noseTipX).toBeLessThanOrEqual(1.38)
      expect(roofTop).toBeLessThanOrEqual(1.39 + 1e-7)
      expect(lead.noseTipTopY).toBeLessThanOrEqual(1.39 + 1e-7)
      expect(bodyRear).toBeGreaterThanOrEqual(-1.1)
      expect(profile.bodyWidth / 2).toBeLessThanOrEqual(0.5)
      expect(profile.maxHalfWidth).toBeLessThanOrEqual(0.5)
    }
  })
})

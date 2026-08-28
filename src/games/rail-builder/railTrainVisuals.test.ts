import { describe, expect, it } from 'vitest'
import { TRAIN_TYPES } from './railFleetModel'
import {
  E5_FRONT_WINDSHIELD_SECTIONS,
  E5_LEAD_SHELL_SECTIONS,
  TRAIN_VISUAL_PROFILES,
  getTrainCarVisualYaw,
  getTrainCarVisualProfile,
  getTrainFormationRoles,
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
    expect(e5.frontExtent).toBeGreaterThan(1.64)
    expect(e5.frontExtent).toBeLessThanOrEqual(1.67)
    expect(e5.rearExtent).toBeGreaterThanOrEqual(-1.1)
    expect(e5.maxHalfWidth).toBeLessThanOrEqual(0.5)
    expect(lead.noseLength).toBeGreaterThan(0)
    expect(lead.noseTipX).toBeGreaterThan(1.64)
    expect(lead.noseTipX).toBeLessThanOrEqual(1.67)
    expect(lead.noseTipTopY).toBeGreaterThanOrEqual(0.76)
    expect(lead.noseTipTopY).toBeLessThanOrEqual(0.78)
    expect(lead.noseTipWidth).toBeGreaterThanOrEqual(0.34)
    expect(lead.noseTipWidth).toBeLessThanOrEqual(0.37)
    expect(lead.bodyCenterX - lead.bodyLength / 2).toBeGreaterThanOrEqual(-1.1)
    expect(middle.noseLength).toBe(0)
    expect(middle.hasFrontWindow).toBe(false)
    expect(middle.hasHeadlights).toBe(false)
    expect(middle.bodyWidth).toBe(lead.bodyWidth)
    expect(middle.sideWindowXs).toEqual(lead.sideWindowXs)
  })

  it('uses a three-car E5 formation with the lead shell facing outward at both ends', () => {
    expect(getTrainFormationRoles('e5')).toEqual(['lead', 'middle', 'rear'])
    for (const trainType of TRAIN_TYPES.filter((candidate) => candidate !== 'e5')) {
      expect(getTrainFormationRoles(trainType)).toEqual(['lead', 'middle'])
    }

    const lead = getTrainCarVisualProfile('e5', 'lead')
    const rear = getTrainCarVisualProfile('e5', 'rear')
    expect(rear).toBe(lead)
    expect(rear).toMatchObject({
      bodyLength: lead.bodyLength,
      bodyHeight: lead.bodyHeight,
      bodyWidth: lead.bodyWidth,
      noseLength: lead.noseLength,
      noseTipX: lead.noseTipX,
      frontWindowWidth: lead.frontWindowWidth,
      hasFrontWindow: true,
      hasHeadlights: true,
    })
    expect(getTrainCarVisualYaw('lead')).toBe(0)
    expect(getTrainCarVisualYaw('middle')).toBe(0)
    expect(getTrainCarVisualYaw('rear')).toBe(Math.PI)
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
    expect(lead.frontWindowWidth).toBeGreaterThan(0.5)
    expect(lead.frontWindowWidth).toBeLessThan(0.74)
    expect(lead.frontWindowX).toBeGreaterThan(0.4)
    expect(e5.bodyColor).toMatch(/^#f/i)
    expect(e5.roofColor).toMatch(/^#(?:2|3)/i)
    expect(e5.accent.height).toBeLessThan(0.1)
    expect(lead.couplerPositions).toEqual([-1.25, 1.25])
  })

  it('defines one continuous E5 lead shell from the cabin rear to the long nose tip', () => {
    expect(E5_LEAD_SHELL_SECTIONS.length).toBeGreaterThanOrEqual(16)
    expect(E5_LEAD_SHELL_SECTIONS[0]!.x).toBe(-1.04)
    expect(E5_LEAD_SHELL_SECTIONS.at(-1)!.x).toBeGreaterThan(1.64)
    expect(E5_LEAD_SHELL_SECTIONS.at(-1)!.x).toBeLessThanOrEqual(1.67)
    expect(E5_LEAD_SHELL_SECTIONS.at(-1)!.top).toBeGreaterThanOrEqual(0.76)
    expect(E5_LEAD_SHELL_SECTIONS.at(-1)!.top).toBeLessThanOrEqual(0.78)
    expect(E5_LEAD_SHELL_SECTIONS.at(-1)!.width).toBeGreaterThanOrEqual(0.34)
    expect(E5_LEAD_SHELL_SECTIONS.at(-1)!.width).toBeLessThanOrEqual(0.37)
    expect(E5_LEAD_SHELL_SECTIONS.at(-1)!.bottom).toBeGreaterThanOrEqual(0.6)
    expect(E5_LEAD_SHELL_SECTIONS.at(-1)!.x - E5_LEAD_SHELL_SECTIONS[0]!.x).toBeGreaterThan(2.5)

    const xSteps = E5_LEAD_SHELL_SECTIONS.slice(1).map((section, index) => section.x - E5_LEAD_SHELL_SECTIONS[index]!.x)
    expect(Math.max(...xSteps) - Math.min(...xSteps)).toBeLessThan(1e-6)

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

    const firstTaperIndex = E5_LEAD_SHELL_SECTIONS.findIndex((section, index) => index > 0 && section.top < E5_LEAD_SHELL_SECTIONS[index - 1]!.top)
    expect(firstTaperIndex).toBeGreaterThan(0)
    expect(E5_LEAD_SHELL_SECTIONS[firstTaperIndex]!.x).toBeLessThanOrEqual(0.24)

    const topSteps: number[] = []
    const bottomSteps: number[] = []
    const widthSteps: number[] = []
    for (let index = 1; index < E5_LEAD_SHELL_SECTIONS.length; index += 1) {
      const previous = E5_LEAD_SHELL_SECTIONS[index - 1]!
      const current = E5_LEAD_SHELL_SECTIONS[index]!
      topSteps.push(previous.top - current.top)
      bottomSteps.push(current.bottom - previous.bottom)
      widthSteps.push(previous.width - current.width)
    }
    expect(Math.max(...topSteps)).toBeLessThanOrEqual(0.1)
    expect(Math.max(...bottomSteps)).toBeLessThanOrEqual(0.03)
    expect(Math.max(...widthSteps)).toBeLessThanOrEqual(0.1)
    for (let index = 1; index < topSteps.length; index += 1) {
      expect(Math.abs(topSteps[index]! - topSteps[index - 1]!)).toBeLessThanOrEqual(0.03)
      expect(Math.abs(bottomSteps[index]! - bottomSteps[index - 1]!)).toBeLessThanOrEqual(0.02)
      expect(Math.abs(widthSteps[index]! - widthSteps[index - 1]!)).toBeLessThanOrEqual(0.03)
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
    expect(previousBandHeight).toBeGreaterThan(0)
    expect(previousBandHeight).toBeLessThan(e5.accent.height)
  })

  it('places a tapered front windshield on the sloping E5 shell', () => {
    expect(E5_FRONT_WINDSHIELD_SECTIONS).toHaveLength(4)
    expect(E5_FRONT_WINDSHIELD_SECTIONS[0]!.x).toBeGreaterThanOrEqual(0.32)
    expect(E5_FRONT_WINDSHIELD_SECTIONS[0]!.x).toBeLessThanOrEqual(0.38)
    expect(E5_FRONT_WINDSHIELD_SECTIONS.at(-1)!.x).toBeGreaterThanOrEqual(0.82)
    expect(E5_FRONT_WINDSHIELD_SECTIONS.at(-1)!.x).toBeLessThanOrEqual(0.86)
    expect(E5_FRONT_WINDSHIELD_SECTIONS.at(-1)!.x - E5_FRONT_WINDSHIELD_SECTIONS[0]!.x).toBeGreaterThan(0.45)
    expect(E5_FRONT_WINDSHIELD_SECTIONS.every((section) => section.width >= 0.5)).toBe(true)
    expect(E5_FRONT_WINDSHIELD_SECTIONS[1]!.width).toBeGreaterThan(E5_FRONT_WINDSHIELD_SECTIONS[0]!.width)

    for (let index = 1; index < E5_FRONT_WINDSHIELD_SECTIONS.length; index += 1) {
      const previous = E5_FRONT_WINDSHIELD_SECTIONS[index - 1]!
      const current = E5_FRONT_WINDSHIELD_SECTIONS[index]!
      expect(current.x).toBeGreaterThan(previous.x)
      if (index > 1) expect(current.width).toBeLessThan(previous.width)

      let shellWidth = E5_LEAD_SHELL_SECTIONS[0]!.width
      for (let shellIndex = 1; shellIndex < E5_LEAD_SHELL_SECTIONS.length; shellIndex += 1) {
        const shellPrevious = E5_LEAD_SHELL_SECTIONS[shellIndex - 1]!
        const shellCurrent = E5_LEAD_SHELL_SECTIONS[shellIndex]!
        if (current.x <= shellCurrent.x) {
          const amount = (current.x - shellPrevious.x) / (shellCurrent.x - shellPrevious.x)
          shellWidth = shellPrevious.width + (shellCurrent.width - shellPrevious.width) * amount
          break
        }
      }
      expect(current.width).toBeLessThan(shellWidth)
      expect(current.width).toBeGreaterThanOrEqual(shellWidth * 0.65)
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
    ]).size).toBeGreaterThanOrEqual(3)
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
      const frontExtentLimit = trainType === 'e5' ? 1.67 : 1.38
      expect(profile.frontExtent).toBeLessThanOrEqual(frontExtentLimit)
      expect(profile.rearExtent).toBeGreaterThanOrEqual(-1.1)
      expect(lead.noseTipX).toBeLessThanOrEqual(frontExtentLimit)
      expect(roofTop).toBeLessThanOrEqual(1.39 + 1e-7)
      expect(lead.noseTipTopY).toBeLessThanOrEqual(1.39 + 1e-7)
      expect(bodyRear).toBeGreaterThanOrEqual(-1.1)
      expect(profile.bodyWidth / 2).toBeLessThanOrEqual(0.5)
      expect(profile.maxHalfWidth).toBeLessThanOrEqual(0.5)
    }
  })
})

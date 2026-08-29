import { describe, expect, it } from 'vitest'
import { TRAIN_TYPES } from './railFleetModel'
import {
  E5_GANGWAY_SPEC,
  E5_FRONT_WINDSHIELD_SECTIONS,
  E5_LEAD_SHELL_SECTIONS,
  DOCTOR_YELLOW_FRONT_WINDSHIELD_SECTIONS,
  DOCTOR_YELLOW_GANGWAY_SPEC,
  DOCTOR_YELLOW_LEAD_SHELL_SECTIONS,
  E7W7_FRONT_WINDSHIELD_SECTIONS,
  E7W7_GANGWAY_SPEC,
  E7W7_LEAD_SHELL_SECTIONS,
  N700S_FRONT_WINDSHIELD_SECTIONS,
  N700S_GANGWAY_SPEC,
  N700S_LEAD_SHELL_SECTIONS,
  TRAIN_SPECS,
  TRAIN_VISUAL_PROFILES,
  getTrainCarVisualYaw,
  getTrainCarVisualProfile,
  getTrainFormationRoles,
  getE5LeadShellAccentBand,
  resolveTrainSpec,
  resolveTrainVisualProfile,
} from './railTrainVisuals'

describe('railTrainVisuals', () => {
  it('exposes E5 through the canonical TrainSpec table while retaining the legacy alias', () => {
    const e5 = resolveTrainSpec('e5')
    expect(e5).toBe(TRAIN_SPECS.e5)
    expect(resolveTrainVisualProfile('e5')).toBe(e5)
    expect(TRAIN_VISUAL_PROFILES.e5).toBe(e5)
    expect(e5.formation).toEqual(['lead', 'middle', 'rear'])
    expect(e5.gangway).toEqual(E5_GANGWAY_SPEC)
    expect(e5.lead.doorX).toBeCloseTo(-0.7232, 8)
    expect(e5.middle.doorX).toBeCloseTo(-0.6664, 8)
  })

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
    expect(lead.sideWindowXs).toHaveLength(2)
    expect(middle.sideWindowXs).toHaveLength(3)
    expect(middle.sideWindowXs[0]!).toBeGreaterThan(-middle.bodyLength / 2)
    expect(middle.sideWindowXs.at(-1)!).toBeLessThan(middle.bodyLength / 2)
    expect(middle.sideWindowWidth).toBeLessThanOrEqual(lead.sideWindowWidth)
  })

  it('uses three-car formations for E5, N700S, Doctor Yellow, and E7/W7 with lead shells facing outward at both ends', () => {
    expect(getTrainFormationRoles('e5')).toEqual(['lead', 'middle', 'rear'])
    expect(getTrainFormationRoles('n700s')).toEqual(['lead', 'middle', 'rear'])
    expect(getTrainFormationRoles('doctorYellow')).toEqual(['lead', 'middle', 'rear'])
    expect(getTrainFormationRoles('e7w7')).toEqual(['lead', 'middle', 'rear'])
    for (const trainType of TRAIN_TYPES.filter((candidate) => !['e5', 'n700s', 'doctorYellow', 'e7w7'].includes(candidate))) {
      expect(getTrainFormationRoles(trainType)).toEqual(['lead', 'middle'])
    }

    for (const trainType of ['e5', 'n700s', 'doctorYellow', 'e7w7'] as const) {
      const lead = getTrainCarVisualProfile(trainType, 'lead')
      const rear = getTrainCarVisualProfile(trainType, 'rear')
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
    }
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

  it('keeps the E5 gangway as a lightweight half-span connection', () => {
    expect(E5_GANGWAY_SPEC.length).toBeGreaterThan(0.2)
    expect(E5_GANGWAY_SPEC.length).toBeLessThan(0.3)
    expect(E5_GANGWAY_SPEC.height).toBeGreaterThanOrEqual(0.44)
    expect(E5_GANGWAY_SPEC.height).toBeLessThanOrEqual(0.48)
    expect(E5_GANGWAY_SPEC.width).toBeGreaterThanOrEqual(0.56)
    expect(E5_GANGWAY_SPEC.width).toBeLessThanOrEqual(0.6)
    expect(E5_GANGWAY_SPEC.centerY).toBeGreaterThanOrEqual(0.75)
    expect(E5_GANGWAY_SPEC.centerY).toBeLessThanOrEqual(0.78)
    expect(E5_GANGWAY_SPEC.positionOffset).toBeCloseTo(E5_GANGWAY_SPEC.length / 2, 8)
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
    expect(n700s.lead.sideWindowXs.length).toBe(2)
    expect(doctorYellow.lead.sideWindowXs.length).toBe(2)
    expect(e6.accent.color).toBe('#b8bdc4')
    expect(n700s.accent.color).toBe('#2e64cb')
    expect(doctorYellow.accent.color).toBe('#19457a')
    expect(new Set([e5.bodyColor, e6.bodyColor, n700s.bodyColor, doctorYellow.bodyColor]).size).toBe(4)
  })

  it('defines N700S as a broad white three-car shell with connected windshield and gangway data', () => {
    const n700s = resolveTrainSpec('n700s')
    expect(n700s.formation).toEqual(['lead', 'middle', 'rear'])
    expect(n700s.gangway).toEqual(N700S_GANGWAY_SPEC)
    expect(n700s.leadShellSections).toEqual(N700S_LEAD_SHELL_SECTIONS)
    expect(n700s.frontWindshieldSections).toEqual(N700S_FRONT_WINDSHIELD_SECTIONS)
    expect(n700s.windshieldCenterDivider).toBe(true)
    expect(n700s.bodyColor).toBe('#f8faf9')
    expect(n700s.roofColor).toBe('#ffffff')
    expect(n700s.lead.bodyWidth).toBeGreaterThanOrEqual(0.94)
    expect(n700s.lead.bodyWidth).toBeLessThanOrEqual(0.96)
    expect(n700s.lead.sideWindowXs).toHaveLength(2)
    expect(n700s.middle.sideWindowXs).toHaveLength(3)
    expect(n700s.lead.noseLength).toBeLessThan(resolveTrainSpec('e5').noseLength)
    expect(N700S_LEAD_SHELL_SECTIONS.length).toBeGreaterThanOrEqual(16)
    expect(N700S_LEAD_SHELL_SECTIONS[0]!.x).toBe(-1.04)
    expect(N700S_LEAD_SHELL_SECTIONS.at(-1)!.x).toBeGreaterThanOrEqual(1.35)
    expect(N700S_LEAD_SHELL_SECTIONS.at(-1)!.x).toBeLessThanOrEqual(1.38)

    const xSteps = N700S_LEAD_SHELL_SECTIONS.slice(1).map((section, index) => section.x - N700S_LEAD_SHELL_SECTIONS[index]!.x)
    expect(Math.max(...xSteps) - Math.min(...xSteps)).toBeLessThan(1e-6)
    for (let index = 1; index < N700S_LEAD_SHELL_SECTIONS.length; index += 1) {
      const previous = N700S_LEAD_SHELL_SECTIONS[index - 1]!
      const current = N700S_LEAD_SHELL_SECTIONS[index]!
      expect(current.x).toBeGreaterThan(previous.x)
      expect(current.top).toBeLessThanOrEqual(previous.top)
      expect(current.bottom).toBeGreaterThanOrEqual(previous.bottom)
      expect(current.width).toBeLessThanOrEqual(previous.width)
      expect(current.width / 2).toBeLessThanOrEqual(0.5)
    }

    const shellWidthAt = (x: number): number => {
      for (let index = 1; index < N700S_LEAD_SHELL_SECTIONS.length; index += 1) {
        const previous = N700S_LEAD_SHELL_SECTIONS[index - 1]!
        const current = N700S_LEAD_SHELL_SECTIONS[index]!
        if (x <= current.x) {
          const amount = (x - previous.x) / (current.x - previous.x)
          return previous.width + (current.width - previous.width) * amount
        }
      }
      return N700S_LEAD_SHELL_SECTIONS.at(-1)!.width
    }
    for (const [index, section] of N700S_FRONT_WINDSHIELD_SECTIONS.entries()) {
      expect(section.width).toBeLessThan(shellWidthAt(section.x))
      expect(section.width).toBeGreaterThanOrEqual(shellWidthAt(section.x) * 0.65)
      if (index > 1) expect(section.width).toBeLessThan(N700S_FRONT_WINDSHIELD_SECTIONS[index - 1]!.width)
    }

    const doorFrameHalfWidth = 0.22
    for (const profile of [n700s.lead, n700s.middle]) {
      for (const windowX of profile.sideWindowXs) {
        expect(Math.abs(windowX - profile.doorX)).toBeGreaterThanOrEqual(
          doorFrameHalfWidth + profile.sideWindowWidth / 2,
        )
      }
    }
  })

  it('defines Doctor Yellow as a clearly distinct three-car visual spec', () => {
    const doctorYellow = resolveTrainSpec('doctorYellow')
    expect(doctorYellow.formation).toEqual(['lead', 'middle', 'rear'])
    expect(doctorYellow.silhouette).toBe('doctor-yellow-thick-shoulder')
    expect(doctorYellow.lead.noseStyle).toBe('doctor-yellow-duck')
    expect(doctorYellow.bodyColor).toBe('#f5c928')
    expect(doctorYellow.roofColor).toBe('#f3e5a3')
    expect(doctorYellow.accent.color).toBe('#19457a')
    expect(doctorYellow.lead.bodyHeight).toBeGreaterThan(0.65)
    expect(doctorYellow.lead.noseLength).toBeGreaterThan(1)
    expect(doctorYellow.lead.sideWindowXs).toHaveLength(2)
    expect(doctorYellow.middle.noseLength).toBe(0)
    expect(doctorYellow.middle.sideWindowXs).toHaveLength(3)
    expect(doctorYellow.gangway).toEqual(DOCTOR_YELLOW_GANGWAY_SPEC)
    expect(doctorYellow.leadShellSections).toEqual(DOCTOR_YELLOW_LEAD_SHELL_SECTIONS)
    expect(doctorYellow.frontWindshieldSections).toEqual(DOCTOR_YELLOW_FRONT_WINDSHIELD_SECTIONS)
  })

  it('defines Doctor Yellow as a continuous, smoothly tapered lead shell', () => {
    expect(DOCTOR_YELLOW_LEAD_SHELL_SECTIONS.length).toBeGreaterThanOrEqual(14)
    expect(DOCTOR_YELLOW_LEAD_SHELL_SECTIONS[0]!.x).toBe(-1.04)
    expect(DOCTOR_YELLOW_LEAD_SHELL_SECTIONS.at(-1)!.x).toBe(1.36)
    expect(DOCTOR_YELLOW_LEAD_SHELL_SECTIONS.at(-1)!.x - DOCTOR_YELLOW_LEAD_SHELL_SECTIONS[0]!.x).toBeGreaterThan(2.3)
    for (let index = 1; index < DOCTOR_YELLOW_LEAD_SHELL_SECTIONS.length; index += 1) {
      const previous = DOCTOR_YELLOW_LEAD_SHELL_SECTIONS[index - 1]!
      const current = DOCTOR_YELLOW_LEAD_SHELL_SECTIONS[index]!
      expect(current.x).toBeGreaterThan(previous.x)
      expect(current.top).toBeLessThanOrEqual(previous.top)
      expect(current.bottom).toBeGreaterThanOrEqual(previous.bottom)
      expect(current.width).toBeLessThanOrEqual(previous.width)
      expect(current.width / 2).toBeLessThanOrEqual(0.5)
      expect(current.top).toBeLessThanOrEqual(1.39)
    }
    const xSteps = DOCTOR_YELLOW_LEAD_SHELL_SECTIONS.slice(1).map((section, index) => section.x - DOCTOR_YELLOW_LEAD_SHELL_SECTIONS[index]!.x)
    expect(Math.max(...xSteps) - Math.min(...xSteps)).toBeLessThan(1e-6)
    const topSteps = DOCTOR_YELLOW_LEAD_SHELL_SECTIONS.slice(1).map((section, index) => DOCTOR_YELLOW_LEAD_SHELL_SECTIONS[index]!.top - section.top)
    const widthSteps = DOCTOR_YELLOW_LEAD_SHELL_SECTIONS.slice(1).map((section, index) => DOCTOR_YELLOW_LEAD_SHELL_SECTIONS[index]!.width - section.width)
    expect(Math.max(...topSteps)).toBeLessThanOrEqual(0.12)
    expect(Math.max(...widthSteps)).toBeLessThanOrEqual(0.1)
    for (let index = 1; index < topSteps.length; index += 1) {
      expect(Math.abs(topSteps[index]! - topSteps[index - 1]!)).toBeLessThanOrEqual(0.04)
      expect(Math.abs(widthSteps[index]! - widthSteps[index - 1]!)).toBeLessThanOrEqual(0.04)
    }
  })

  it('keeps Doctor Yellow windshield stations inside the lead shell envelope', () => {
    expect(DOCTOR_YELLOW_FRONT_WINDSHIELD_SECTIONS.length).toBeGreaterThanOrEqual(4)
    expect(DOCTOR_YELLOW_FRONT_WINDSHIELD_SECTIONS[0]!.x).toBeGreaterThan(0.2)
    expect(DOCTOR_YELLOW_FRONT_WINDSHIELD_SECTIONS.at(-1)!.x).toBeLessThan(1.1)
    for (let index = 1; index < DOCTOR_YELLOW_FRONT_WINDSHIELD_SECTIONS.length; index += 1) {
      const previous = DOCTOR_YELLOW_FRONT_WINDSHIELD_SECTIONS[index - 1]!
      const current = DOCTOR_YELLOW_FRONT_WINDSHIELD_SECTIONS[index]!
      expect(current.x).toBeGreaterThan(previous.x)
      if (index > 1) expect(current.width).toBeLessThan(previous.width)
      let shellWidth = DOCTOR_YELLOW_LEAD_SHELL_SECTIONS[0]!.width
      for (let shellIndex = 1; shellIndex < DOCTOR_YELLOW_LEAD_SHELL_SECTIONS.length; shellIndex += 1) {
        const shellPrevious = DOCTOR_YELLOW_LEAD_SHELL_SECTIONS[shellIndex - 1]!
        const shellCurrent = DOCTOR_YELLOW_LEAD_SHELL_SECTIONS[shellIndex]!
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

  it('defines E7/W7 as a dignified white-blue-gold three-car shell', () => {
    const e7w7 = resolveTrainSpec('e7w7')
    const lead = e7w7.lead
    expect(e7w7.formation).toEqual(['lead', 'middle', 'rear'])
    expect(e7w7.silhouette).toBe('e7w7-dignified-shoulder')
    expect(lead.noseStyle).toBe('e7w7-dignified')
    expect(e7w7.bodyColor).toMatch(/^#f/i)
    expect(e7w7.frontColor).toMatch(/^#1/i)
    expect(e7w7.roofColor).toMatch(/^#0/i)
    expect(e7w7.accent.color).toBe('#bd954e')
    expect(e7w7.accent.height).toBeGreaterThanOrEqual(0.08)
    expect(e7w7.accent.height).toBeLessThanOrEqual(0.1)
    expect(e7w7.gangway).toEqual(E7W7_GANGWAY_SPEC)
    expect(e7w7.leadShellSections).toEqual(E7W7_LEAD_SHELL_SECTIONS)
    expect(e7w7.frontWindshieldSections).toEqual(E7W7_FRONT_WINDSHIELD_SECTIONS)
    expect(e7w7.windshieldCenterDivider).toBe(true)
    expect(lead.sideWindowXs).toHaveLength(2)
    expect(e7w7.middle.sideWindowXs).toHaveLength(3)
    for (const profile of [lead, e7w7.middle]) {
      for (const windowX of profile.sideWindowXs) {
        expect(Math.abs(windowX - profile.doorX)).toBeGreaterThanOrEqual(
          0.22 + profile.sideWindowWidth / 2,
        )
      }
    }
  })

  it('keeps the E7/W7 lead loft monotonic and smoothly tapered', () => {
    expect(E7W7_LEAD_SHELL_SECTIONS.length).toBeGreaterThanOrEqual(16)
    expect(E7W7_LEAD_SHELL_SECTIONS[0]!.x).toBe(-1.04)
    expect(E7W7_LEAD_SHELL_SECTIONS.at(-1)!.x).toBeGreaterThanOrEqual(1.30)
    expect(E7W7_LEAD_SHELL_SECTIONS.at(-1)!.x).toBeLessThanOrEqual(1.34)
    expect(E7W7_LEAD_SHELL_SECTIONS.at(-1)!.width).toBeGreaterThanOrEqual(0.40)
    expect(E7W7_LEAD_SHELL_SECTIONS.at(-1)!.width).toBeLessThanOrEqual(0.44)
    expect(E7W7_LEAD_SHELL_SECTIONS.at(-1)!.top).toBeGreaterThanOrEqual(0.88)
    expect(E7W7_LEAD_SHELL_SECTIONS.at(-1)!.top).toBeLessThanOrEqual(0.92)
    expect(E7W7_LEAD_SHELL_SECTIONS.at(-1)!.bottom).toBeGreaterThanOrEqual(0.61)
    expect(E7W7_LEAD_SHELL_SECTIONS.at(-1)!.bottom).toBeLessThanOrEqual(0.63)
    const xSteps = E7W7_LEAD_SHELL_SECTIONS.slice(1).map((section, index) => section.x - E7W7_LEAD_SHELL_SECTIONS[index]!.x)
    expect(Math.max(...xSteps) - Math.min(...xSteps)).toBeLessThan(1e-6)
    const topSteps: number[] = []
    const bottomSteps: number[] = []
    const widthSteps: number[] = []
    for (let index = 1; index < E7W7_LEAD_SHELL_SECTIONS.length; index += 1) {
      const previous = E7W7_LEAD_SHELL_SECTIONS[index - 1]!
      const current = E7W7_LEAD_SHELL_SECTIONS[index]!
      expect(current.x).toBeGreaterThan(previous.x)
      expect(current.top).toBeLessThanOrEqual(previous.top)
      expect(current.bottom).toBeGreaterThanOrEqual(previous.bottom)
      expect(current.width).toBeLessThanOrEqual(previous.width)
      topSteps.push(previous.top - current.top)
      bottomSteps.push(current.bottom - previous.bottom)
      widthSteps.push(previous.width - current.width)
    }
    expect(Math.max(...topSteps)).toBeLessThanOrEqual(0.08)
    expect(Math.max(...bottomSteps)).toBeLessThanOrEqual(0.03)
    expect(Math.max(...widthSteps)).toBeLessThanOrEqual(0.1)
    for (let index = 1; index < topSteps.length; index += 1) {
      expect(Math.abs(topSteps[index]! - topSteps[index - 1]!)).toBeLessThanOrEqual(0.03)
      expect(Math.abs(bottomSteps[index]! - bottomSteps[index - 1]!)).toBeLessThanOrEqual(0.02)
      expect(Math.abs(widthSteps[index]! - widthSteps[index - 1]!)).toBeLessThanOrEqual(0.04)
    }
  })

  it('keeps the broad E7/W7 windshield inside its shallower shell envelope', () => {
    expect(E7W7_FRONT_WINDSHIELD_SECTIONS.length).toBeGreaterThanOrEqual(4)
    const shellWidthAt = (x: number): number => {
      for (let index = 1; index < E7W7_LEAD_SHELL_SECTIONS.length; index += 1) {
        const previous = E7W7_LEAD_SHELL_SECTIONS[index - 1]!
        const current = E7W7_LEAD_SHELL_SECTIONS[index]!
        if (x <= current.x) {
          const amount = (x - previous.x) / (current.x - previous.x)
          return previous.width + (current.width - previous.width) * amount
        }
      }
      return E7W7_LEAD_SHELL_SECTIONS.at(-1)!.width
    }
    for (const [index, section] of E7W7_FRONT_WINDSHIELD_SECTIONS.entries()) {
      expect(section.width).toBeLessThan(shellWidthAt(section.x))
      expect(section.width).toBeGreaterThanOrEqual(shellWidthAt(section.x) * 0.65)
      if (index > 1) expect(section.width).toBeLessThan(E7W7_FRONT_WINDSHIELD_SECTIONS[index - 1]!.width)
    }
  })

  it('keeps Doctor Yellow doors clear of side windows on every car', () => {
    const doctorYellow = resolveTrainSpec('doctorYellow')
    // trainDoorFrameGeometry is 0.44 wide in the shared renderer; leave the
    // full frame plus a window half-width between the visual centers.
    const doorFrameHalfWidth = 0.22
    for (const profile of [doctorYellow.lead, doctorYellow.middle]) {
      for (const windowX of profile.sideWindowXs) {
        expect(Math.abs(windowX - profile.doorX)).toBeGreaterThanOrEqual(
          doorFrameHalfWidth + profile.sideWindowWidth / 2,
        )
      }
    }
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

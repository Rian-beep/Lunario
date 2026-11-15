export type AudienceMode = 'public' | 'teach' | 'plan';
export const AUDIENCE_GUIDES = {
  public: {
    name: 'Public', title: 'Lunar Landing Site Navigator',
    intro: 'Lunar Landing Site Navigator, using JPL Horizons and LOLA terrain to compare sunlight and Earth view at the south pole.',
    steps: [
      ['Pick a site', 'Choose a pin on the 2D map or enter coordinates. Switch to 3D to walk the measured terrain around it.'],
      ['Move the date', 'Drag the UTC timeline. The amber track shows sunlight; the blue track shows whether Earth clears the hills.'],
      ['Compare', 'Open Compare to try another place or date side by side. Horizon analysis stays one click away in the inspector.'],
    ],
    limits: 'Sunlight is a chance to generate power. Seeing Earth is a chance to communicate. A spacecraft still needs the right equipment.',
    action: 'Pick a site',
  },
  teach: {
    name: 'Educator', title: 'Make a prediction. Test it on the Moon.',
    intro: 'Use a real site and a shared UTC time to connect geometry, energy and communication. The teaching experiments guide a prediction before revealing the result.',
    steps: [
      ['Start with a question', 'Open Teaching studio in the header. Predict whether raising an antenna or changing one input helps, then capture the actual selected scenario.'],
      ['Read the evidence', 'Charts label direction in degrees, elevation above the local horizontal, and time in UTC. The horizon is the terrain angle in that direction.'],
      ['Compare and explain', 'Change one input, inspect its measured response and derivative units, and save your explanation in the notebook. Illustrative examples are separate; populate them explicitly from the captured scenario.'],
    ],
    limits: 'Hourly samples can miss short events. A nearby grid horizon for a custom point is an approximation; check the stated distance and coverage.',
    action: 'Open teaching workspace',
  },
  plan: {
    name: 'Planner', title: 'Screen a site against your mission assumptions',
    intro: 'Compare locations and dates using terrain visibility, an explicit power-and-storage model, a free-space radio estimate, and a configurable lunar flight preview.',
    steps: [
      ['Define the scenario', 'Set landing UTC, duration, observer height, array orientation, load, battery and reserve. Radio results require your frequency, gains, losses and receiver threshold.'],
      ['Inspect constraints', 'Review longest darkness and contact gaps, energy below reserve, unmet load, and overlap windows. Hover ⓘ for equations, frames and limits. A visibility window is not a scheduled ground-station link.'],
      ['Compare and preserve', 'Open Replan mission to synchronize a reference and candidate, inspect the first failure and compare held inputs. Engineering evidence adds bounded stability and dated station/link/allocation calculations; missing evidence stays unknown.'],
    ],
    limits: 'Screening and a generic 3-DoF preview only. No validated guidance, navigation, landing hazards, thermal qualification, DSN scheduling or operational flight solution. Apply vehicle-specific limits; there is no universal safe landing threshold.',
    action: 'Open mission workspace',
  },
} as const;

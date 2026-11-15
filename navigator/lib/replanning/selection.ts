import type { ReplanningCase } from './model';

export type CaseSelection = { reference: ReplanningCase; candidate: ReplanningCase };
export type SelectionAction = { target: keyof CaseSelection; item: ReplanningCase };

/** Captured selections survive parent playhead/open/save updates and subsequent draft edits. */
export function selectCase(state: CaseSelection, action: SelectionAction): CaseSelection {
  return { ...state, [action.target]: structuredClone(action.item) };
}
export function initialSelection(reference: ReplanningCase, candidate: ReplanningCase): CaseSelection {
  return { reference: structuredClone(reference), candidate: structuredClone(candidate) };
}

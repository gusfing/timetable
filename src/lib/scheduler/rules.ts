export interface TimetableRules {
  antiBurnoutLimit: number;
  dayTeacherBreak: number;
  schoolBreakPeriod: number;
  minDailyPeriods: number;
  maxDailyPeriods: number;
  wingIsolation: boolean;
  blossomSupervision: boolean;
  subjectBurnoutLimit: number;
  doublePeriodSupport: boolean;
  fairnessIndex: boolean;
  workloadCapSub: number;
  sameWingSubstitute: boolean;
}

// Alias for backward compatibility
export type TimetableRulesConfig = TimetableRules;

export const DEFAULT_RULES: TimetableRules = {
  antiBurnoutLimit: 3,
  dayTeacherBreak: 1,
  schoolBreakPeriod: 3,
  minDailyPeriods: 6,
  maxDailyPeriods: 8,
  wingIsolation: false,
  blossomSupervision: true,
  subjectBurnoutLimit: 4,
  doublePeriodSupport: false,
  fairnessIndex: true,
  workloadCapSub: 10,
  sameWingSubstitute: false,
};

export const RULE_METADATA: Record<keyof TimetableRules, {
  label: string;
  description: string;
  type: 'number' | 'boolean';
  min?: number;
  max?: number;
}> = {
  antiBurnoutLimit:    { label: 'Anti-Burnout Limit',       description: 'Max consecutive teaching periods before mandatory rest', type: 'number', min: 1, max: 6 },
  dayTeacherBreak:     { label: 'Day Teacher Break',         description: 'Extra personal breaks per teacher per day', type: 'number', min: 0, max: 3 },
  schoolBreakPeriod:   { label: 'School Break Period',       description: 'Fixed period index for school-wide break (0-6)', type: 'number', min: 0, max: 6 },
  minDailyPeriods:     { label: 'Min Daily Periods',         description: 'Minimum teaching periods each teacher must have per day', type: 'number', min: 1, max: 8 },
  maxDailyPeriods:     { label: 'Max Daily Periods',         description: 'Maximum teaching periods per teacher per day', type: 'number', min: 4, max: 10 },
  wingIsolation:       { label: 'Wing Isolation',            description: 'Teachers stay in their assigned wing', type: 'boolean' },
  blossomSupervision:  { label: 'Blossom Supervision',       description: 'Nursery/Primary classes must never be unattended', type: 'boolean' },
  subjectBurnoutLimit: { label: 'Subject Burnout Limit',     description: 'Max times same subject taught consecutively in a week', type: 'number', min: 1, max: 10 },
  doublePeriodSupport: { label: 'Double Period Support',     description: 'Allow 90-min double periods for Master wing labs', type: 'boolean' },
  fairnessIndex:       { label: 'Fairness Index',            description: 'Prioritize lowest workload teachers for substitutions', type: 'boolean' },
  workloadCapSub:      { label: 'Workload Cap (Sub)',        description: 'Max periods a substitute can take in a single day', type: 'number', min: 1, max: 10 },
  sameWingSubstitute:  { label: 'Same-Wing Substitute',     description: 'Prefer same-wing substitutes before falling back', type: 'boolean' },
};

import { Teacher, TimetableEntry } from '@/types/database';
import { TimetableRulesConfig, DEFAULT_RULES } from './rules';
import { isForbiddenZone, validateMove } from './engine';

export { isForbiddenZone, validateMove };
export type { TimetableRulesConfig };
export { DEFAULT_RULES };

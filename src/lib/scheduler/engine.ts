import { Teacher, TimetableEntry, Wing } from '@/types/database';
import { TimetableRulesConfig, DEFAULT_RULES } from './rules';

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

/**
 * Validates a teacher's daily schedule against the configured rules.
 * Rules applied:
 * - Rule 1: Anti-Burnout (max consecutive teaching periods)
 * - Rule 6: Wing Isolation
 * - Rule 4/5: Min/Max daily periods
 */
export function validateSchedule(
    teacher: Teacher,
    daySchedule: TimetableEntry[],
    rules: TimetableRulesConfig = DEFAULT_RULES
): ValidationResult {
    const result: ValidationResult = { isValid: true, errors: [], warnings: [] };

    const teachingPeriods = daySchedule.filter(p => p.period_type === 'teaching');
    const teachingCount = teachingPeriods.length;

    let consecutiveCount = 0;
    let lastPeriod = -2;
    let lastSubject = '';
    let consecutiveSubjectCount = 0;

    for (const period of teachingPeriods) {
        // Rule 1 Logic
        if (period.period_number === lastPeriod + 1) {
            consecutiveCount++;
        } else {
            consecutiveCount = 1;
        }

        // Rule 8: Subject Burnout — max consecutive sessions of same subject
        if (period.subject === lastSubject && period.period_number === lastPeriod + 1) {
            consecutiveSubjectCount++;
        } else {
            consecutiveSubjectCount = 1;
        }

        lastPeriod = period.period_number;
        lastSubject = period.subject;

        // Rule 9: Double Period Support (Exception for Rule 1 and Rule 8 in Master Wing)
        const isMasterDouble = teacher.wing === 'Master' && rules.doublePeriodSupport && consecutiveSubjectCount === 2;
        
        if (!isMasterDouble) {
            if (consecutiveCount === rules.antiBurnoutLimit) {
                result.warnings.push(`Burnout Zone: ${teacher.name} has ${rules.antiBurnoutLimit} consecutive periods.`);
            }
            if (consecutiveCount > rules.antiBurnoutLimit) {
                result.isValid = false;
                result.errors.push(`Burnout Violation: ${teacher.name} cannot teach more than ${rules.antiBurnoutLimit} consecutive periods.`);
            }
        }

        if (consecutiveSubjectCount > rules.subjectBurnoutLimit) {
            result.isValid = false;
            result.errors.push(`Subject Burnout: ${teacher.name} has taught ${period.subject} for ${consecutiveSubjectCount} periods consecutively.`);
        }
    }

    // Rule 2: Teacher Break — check if teacher has enough breaks
    const totalPeriods = 8; // System standard
    const nonTeachingCount = totalPeriods - teachingCount;
    if (nonTeachingCount < rules.dayTeacherBreak) {
        result.isValid = false;
        result.errors.push(`${teacher.name} does not have enough scheduled breaks (${nonTeachingCount}/${rules.dayTeacherBreak}).`);
    }

    // Rule 4/5: Min/Max daily teaching periods
    if (teachingCount < rules.minDailyPeriods) {
        result.warnings.push(`${teacher.name} has only ${teachingCount} periods (minimum: ${rules.minDailyPeriods}).`);
    }
    if (teachingCount > rules.maxDailyPeriods) {
        result.isValid = false;
        result.errors.push(`${teacher.name} has ${teachingCount} periods — exceeds maximum of ${rules.maxDailyPeriods}.`);
    }

    // Rule 6: Wing Isolation
    if (rules.wingIsolation && teacher.wing) {
        const wingMismatches = daySchedule.filter(p =>
            p.class_name && !isClassInWing(p.class_name, teacher.wing!)
        );
        if (wingMismatches.length > 0) {
            result.isValid = false;
            result.errors.push(`${teacher.name} is assigned to classes outside their wing (${teacher.wing}).`);
        }
    }

    return result;
}

/**
 * Rule 7: Blossom Guard — ensures Nursery/Primary classes are never unattended.
 */
export function validateBlossomCoverage(
    allPeriods: TimetableEntry[],
    dayOfWeek: number
): { isSecure: boolean; gaps: number[] } {
    const gaps: number[] = [];
    const blossomPeriods = allPeriods.filter(p => 
        p.day_of_week === dayOfWeek && 
        p.class_name && 
        isClassInWing(p.class_name, 'Blossom') &&
        p.period_type === 'teaching'
    );

    // Group by class inside Blossom wing
    const classes = [...new Set(blossomPeriods.map(p => p.class_name))];
    
    for (const className of classes) {
        for (let pNum = 1; pNum <= 8; pNum++) {
            if (pNum === 3) continue; // School break
            const hasTeacher = blossomPeriods.some(p => p.class_name === className && p.period_number === pNum && p.teacher_id);
            if (!hasTeacher) gaps.push(pNum);
        }
    }

    return { isSecure: gaps.length === 0, gaps: [...new Set(gaps)] };
}

/**
 * Fairness-Index Substitution Logic
 * Returns optimal substitute teachers for a given absent teacher's period.
 * Respects Rules 10, 11, 12 (fairness, workload cap, same-wing preference).
 * Prioritizes teachers who are free in period 0 (non-class teachers).
 */
export function findTopSubstitutes(
    allTeachers: Teacher[],
    unavailableTeacherIds: string[],
    targetWing: Wing,
    dayOfWeek: number,
    periodNumber: number,
    existingTimetable: TimetableEntry[],
    rules: TimetableRulesConfig = DEFAULT_RULES,
    count: number = 3
): Teacher[] {
    // Step 1: Get teachers who are not absent
    let eligibleTeachers = allTeachers.filter(t =>
        !unavailableTeacherIds.includes(t.id)
    );

    // Step 2: Filter out teachers already teaching this period
    const currentlyTeachingIds = existingTimetable
        .filter(p => p.day_of_week === dayOfWeek && p.period_number === periodNumber && p.period_type === 'teaching')
        .map(p => p.teacher_id);

    eligibleTeachers = eligibleTeachers.filter(t => !currentlyTeachingIds.includes(t.id));

    // Step 3: Apply same-wing preference (Rule 12)
    const sameWingTeachers = eligibleTeachers.filter(t => t.wing === targetWing);
    const otherWingTeachers = eligibleTeachers.filter(t => t.wing !== targetWing);

    // If sameWingSubstitutePreferred and we have enough from same wing, use those first
    let candidates = (rules.sameWingSubstitute || false) && sameWingTeachers.length >= count
        ? sameWingTeachers
        : [...sameWingTeachers, ...otherWingTeachers]; // fallback to all

    // Step 4: Apply substitute workload cap (Rule 11)
    // Step 4: Apply substitute workload cap (Rule 11)
    candidates = candidates.filter(t => {
        const periodsToday = existingTimetable.filter(
            p => p.teacher_id === t.id && p.day_of_week === dayOfWeek && p.period_type === 'teaching'
        ).length;
        return periodsToday < (rules.workloadCapSub || 8);
    });

    // Step 5: Sort by priority
    return candidates
        .map(t => {
            const periodsToday = existingTimetable.filter(
                p => p.teacher_id === t.id && p.day_of_week === dayOfWeek && p.period_type === 'teaching'
            ).length;
            
            // Check if teacher is free in period 0 (not a class teacher)
            const hasPeriod0 = existingTimetable.some(
                p => p.teacher_id === t.id && p.day_of_week === dayOfWeek && p.period_number === 0
            );
            const isFreeInPeriod0 = !hasPeriod0;
            
            return { teacher: t, periodsToday, isFreeInPeriod0 };
        })
        .sort((a, b) => {
            // Priority 0: Prefer teachers who are free in period 0 (non-class teachers)
            if (a.isFreeInPeriod0 && !b.isFreeInPeriod0) return -1;
            if (!a.isFreeInPeriod0 && b.isFreeInPeriod0) return 1;
            
            if (!rules.fairnessIndex) return 0;
            
            // Priority 1: Prefer teachers with fewer periods today
            if (a.periodsToday < rules.minDailyPeriods && b.periodsToday >= rules.minDailyPeriods) return -1;
            if (b.periodsToday < rules.minDailyPeriods && a.periodsToday >= rules.minDailyPeriods) return 1;
            
            // Priority 2: Sort by workload score (fairness index)
            const scoreA = a.teacher.workload_score ?? 0;
            const scoreB = b.teacher.workload_score ?? 0;
            return scoreA - scoreB;
        })
        .map(item => item.teacher)
        .slice(0, count);
}

/**
 * Check if a period cell is a "forbidden zone" (would cause burnout if filled).
 */
export function isForbiddenZone(
    teacher: Teacher,
    day: string,
    periodIndex: number,
    timetable: TimetableEntry[],
    rules: TimetableRulesConfig = DEFAULT_RULES
): boolean {
    const dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(day);
    const dayPeriods = timetable
        .filter(p => p.teacher_id === teacher.id && p.day_of_week === dayOfWeek && p.period_type === 'teaching')
        .map(p => p.period_number)
        .sort((a, b) => a - b);

    // Check if adding a period at periodIndex would create > maxConsecutivePeriods consecutive
    const withNew = [...dayPeriods, periodIndex].sort((a, b) => a - b);
    let consecutive = 1;
    for (let i = 1; i < withNew.length; i++) {
        if (withNew[i] === withNew[i - 1] + 1) {
            consecutive++;
            if (consecutive > rules.antiBurnoutLimit) return true;
        } else {
            consecutive = 1;
        }
    }
    return false;
}

/**
 * Check if a drag-and-drop move is valid.
 */
export function validateMove(
    teacher: Teacher,
    day: string,
    newTimetable: TimetableEntry[],
    rules: TimetableRulesConfig = DEFAULT_RULES
): { isValid: boolean; message?: string } {
    const dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(day);
    const daySchedule = newTimetable.filter(p => p.teacher_id === teacher.id && p.day_of_week === dayOfWeek);
    const result = validateSchedule(teacher, daySchedule, rules);

    if (!result.isValid) {
        return { isValid: false, message: result.errors[0] || 'Schedule violation detected.' };
    }
    if (result.warnings.length > 0) {
        return { isValid: true, message: result.warnings[0] };
    }
    return { isValid: true };
}

/**
 * Determine if a period is the school break period (Rule 3).
 */
export function isSchoolBreakPeriod(periodNumber: number, rules: TimetableRulesConfig = DEFAULT_RULES): boolean {
    // periodNumber is 1-indexed (1-8)
    return periodNumber === rules.schoolBreakPeriod;
}

/**
 * Get which period should be the teacher's personal break (Rule 2).
 * Returns the period number (1-8) that should be the teacher's break period.
 */
export function getTeacherBreakPeriod(
    teacherId: string,
    daySchedule: TimetableEntry[],
    rules: TimetableRulesConfig = DEFAULT_RULES
): number | null {
    if (rules.dayTeacherBreak === 0) return null;
    // The teacher's break should be adjacent to school break but not the same
    const schoolBreak = rules.schoolBreakPeriod;
    const candidate = schoolBreak > 1 ? schoolBreak - 1 : schoolBreak + 1;
    return candidate;
}

/**
 * Helper: check if a class name belongs to a specific wing.
 */
export function isClassInWing(className: string, wing: Wing): boolean {
    if (['Break', 'Lunch', 'Rest', 'Free', 'Prep'].includes(className)) return true;

    const numericPart = className.match(/\d+/);
    if (!numericPart) {
        if (wing === 'Blossom' &&
            (className.toLowerCase().includes('nur') ||
             className.toLowerCase().includes('kg') ||
             className.toLowerCase().includes('pre') ||
             className.toLowerCase().includes('pri'))) return true;
        return false;
    }

    const num = parseInt(numericPart[0]);
    if (wing === 'Blossom' && num < 1) return true;
    if (wing === 'Scholar' && num >= 1 && num <= 10) return true;
    if (wing === 'Master' && num >= 11 && num <= 12) return true;
    return false;
}

/**
 * Build a human-readable summary of a teacher's day for AI context.
 */
export function buildTeacherDaySummary(
    teacher: Teacher,
    daySchedule: TimetableEntry[],
    rules: TimetableRulesConfig = DEFAULT_RULES
): string {
    const validation = validateSchedule(teacher, daySchedule, rules);
    const periods = daySchedule
        .sort((a, b) => a.period_number - b.period_number)
        .map(p => `P${p.period_number}(${p.class_name || p.subject})`)
        .join(', ');

    return `${teacher.name} [${teacher.wing}]: ${periods} | Errors: ${validation.errors.length} | Warnings: ${validation.warnings.length}`;
}

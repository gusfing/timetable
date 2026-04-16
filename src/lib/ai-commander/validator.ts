// Constraint validator for AI Commander operations

import type { SupabaseClient } from '@supabase/supabase-js';
import type { DatabaseOperation, ValidationResult, CommandContext } from './types';

export class ConstraintValidator {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Validate operation against database constraints
   */
  async validateOperation(
    operation: DatabaseOperation,
    context: CommandContext
  ): Promise<ValidationResult> {
    // CLARIFY and QUERY operations don't need validation
    if (operation.operation === 'CLARIFY' || operation.operation === 'QUERY') {
      return { valid: true };
    }

    // Validate based on table and operation type
    if (operation.table === 'periods') {
      return this.validatePeriodOperation(operation);
    }

    if (operation.table === 'substitution_requests') {
      return this.validateSubstitutionOperation(operation);
    }

    // Default: allow operation
    return { valid: true };
  }

  /**
   * Validate period operations
   */
  private async validatePeriodOperation(
    operation: DatabaseOperation
  ): Promise<ValidationResult> {
    if (operation.operation === 'INSERT' || operation.operation === 'UPDATE') {
      const data = operation.data;

      if (!data) {
        return {
          valid: false,
          reason: 'Missing operation data',
        };
      }

      // Validate required fields for INSERT
      if (operation.operation === 'INSERT') {
        const required = ['teacher_id', 'class_id', 'subject', 'day_of_week', 'period_number'];
        for (const field of required) {
          if (data[field] === undefined) {
            return {
              valid: false,
              reason: `Missing required field: ${field}`,
            };
          }
        }
      }

      // Validate day_of_week range
      if (data.day_of_week !== undefined) {
        if (data.day_of_week < 0 || data.day_of_week > 6) {
          return {
            valid: false,
            reason: 'day_of_week must be between 0 (Sunday) and 6 (Saturday)',
          };
        }
      }

      // Validate period_number range
      if (data.period_number !== undefined) {
        if (data.period_number < 0 || data.period_number > 10) {
          return {
            valid: false,
            reason: 'period_number must be between 0 (Period Zero) and 10',
          };
        }
      }

      // Check consecutive period limit
      if (data.teacher_id && data.day_of_week !== undefined && data.period_number !== undefined) {
        const consecutiveCheck = await this.checkConsecutivePeriods(
          data.teacher_id,
          data.day_of_week,
          data.period_number
        );
        
        if (!consecutiveCheck.valid) {
          return consecutiveCheck;
        }
      }

      // Check double-booking
      if (data.teacher_id && data.day_of_week !== undefined && data.period_number !== undefined) {
        const doubleBookCheck = await this.checkDoubleBooking(
          data.teacher_id,
          data.day_of_week,
          data.period_number,
          operation.operation === 'UPDATE' ? data.id : undefined
        );
        
        if (!doubleBookCheck.valid) {
          return doubleBookCheck;
        }
      }

      // Validate time format if provided
      if (data.start_time && data.end_time) {
        if (!this.isValidTimeFormat(data.start_time) || !this.isValidTimeFormat(data.end_time)) {
          return {
            valid: false,
            reason: 'Invalid time format. Use HH:MM format (e.g., 09:00)',
          };
        }

        if (data.start_time >= data.end_time) {
          return {
            valid: false,
            reason: 'End time must be after start time',
          };
        }
      }
    }

    return { valid: true };
  }

  /**
   * Check if adding this period would violate consecutive period limit
   */
  private async checkConsecutivePeriods(
    teacherId: string,
    dayOfWeek: number,
    periodNumber: number
  ): Promise<ValidationResult> {
    // Query existing teaching periods for this teacher on this day
    const { data: existingPeriods, error } = await this.supabase
      .from('periods')
      .select('period_number, period_type')
      .eq('teacher_id', teacherId)
      .eq('day_of_week', dayOfWeek)
      .eq('period_type', 'teaching')
      .order('period_number');

    if (error) {
      console.error('Error checking consecutive periods:', error);
      return { valid: true }; // Allow operation if check fails
    }

    // Count consecutive teaching periods before this one
    let consecutiveCount = 0;
    for (let i = periodNumber - 1; i >= periodNumber - 3 && i >= 0; i--) {
      const hasPeriod = existingPeriods?.some(p => p.period_number === i);
      if (hasPeriod) {
        consecutiveCount++;
      } else {
        break; // Break on first gap
      }
    }

    // If this would be the 4th consecutive period, reject
    if (consecutiveCount >= 3) {
      return {
        valid: false,
        reason: 'Cannot assign fourth consecutive teaching period. Teacher needs rest after 3 consecutive periods (burnout protection rule).',
      };
    }

    return { valid: true };
  }

  /**
   * Check if teacher is already assigned to another period at this time
   */
  private async checkDoubleBooking(
    teacherId: string,
    dayOfWeek: number,
    periodNumber: number,
    excludeId?: string
  ): Promise<ValidationResult> {
    let query = this.supabase
      .from('periods')
      .select('id')
      .eq('teacher_id', teacherId)
      .eq('day_of_week', dayOfWeek)
      .eq('period_number', periodNumber);

    // Exclude current record if updating
    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data: conflicts, error } = await query;

    if (error) {
      console.error('Error checking double-booking:', error);
      return { valid: true }; // Allow operation if check fails
    }

    if (conflicts && conflicts.length > 0) {
      return {
        valid: false,
        reason: 'Teacher is already assigned to another period at this time (double-booking prevention).',
      };
    }

    return { valid: true };
  }

  /**
   * Validate substitution request operations
   */
  private async validateSubstitutionOperation(
    operation: DatabaseOperation
  ): Promise<ValidationResult> {
    if (operation.operation === 'INSERT') {
      const data = operation.data;

      if (!data) {
        return {
          valid: false,
          reason: 'Missing operation data',
        };
      }

      // Validate required fields
      const required = ['original_teacher_id', 'period_id', 'requested_by'];
      for (const field of required) {
        if (!data[field]) {
          return {
            valid: false,
            reason: `Missing required field: ${field}`,
          };
        }
      }

      // Validate that period exists
      const { data: period, error } = await this.supabase
        .from('periods')
        .select('id')
        .eq('id', data.period_id)
        .single();

      if (error || !period) {
        return {
          valid: false,
          reason: 'The specified period does not exist',
        };
      }
    }

    return { valid: true };
  }

  /**
   * Validate time format (HH:MM)
   */
  private isValidTimeFormat(time: string): boolean {
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
  }
}

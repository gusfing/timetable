// Context retrieval system for RAG pattern

import { createClient } from '@supabase/supabase-js';
import type { CommandContext, ExtractedEntities } from './types';

export class ContextRetriever {
  private supabase;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  /**
   * Retrieve relevant context from database based on extracted entities
   */
  async retrieveContext(
    command: string,
    entities: ExtractedEntities
  ): Promise<CommandContext> {
    // Execute queries in parallel for performance
    const [teachers, periods, classes] = await Promise.all([
      this.retrieveTeachers(entities),
      this.retrievePeriods(entities),
      this.retrieveClasses(entities),
    ]);

    return {
      teachers,
      periods,
      classes,
      constraints: this.getConstraints(),
    };
  }

  /**
   * Retrieve relevant teachers based on extracted names
   */
  private async retrieveTeachers(entities: ExtractedEntities) {
    let query = this.supabase
      .from('teachers')
      .select('id, name, subjects, employee_id');

    // If specific teachers mentioned, filter by name
    if (entities.teachers.length > 0) {
      const nameFilters = entities.teachers
        .map(name => `name.ilike.%${name}%`)
        .join(',');
      query = query.or(nameFilters);
    }

    const { data, error } = await query.limit(50);

    if (error) {
      console.error('Error retrieving teachers:', error);
      return [];
    }

    return (data || []).map(t => ({
      id: t.id,
      name: t.name,
      subjects: t.subjects || [],
      employeeId: t.employee_id,
    }));
  }

  /**
   * Retrieve relevant periods based on extracted entities
   */
  private async retrievePeriods(entities: ExtractedEntities) {
    let query = this.supabase
      .from('periods')
      .select(`
        id,
        teacher_id,
        class_id,
        subject,
        day_of_week,
        period_number,
        start_time,
        end_time,
        period_type,
        teachers (name),
        classes (name)
      `);

    // Filter by day if specified
    if (entities.days.length > 0) {
      const dayNumbers = entities.days
        .map(day => this.getDayNumber(day))
        .filter(n => n !== undefined);
      
      if (dayNumbers.length > 0) {
        query = query.in('day_of_week', dayNumbers);
      }
    }

    // Filter by period number if specified
    if (entities.periods.length > 0) {
      query = query.in('period_number', entities.periods);
    }

    // Filter by subject if specified
    if (entities.subjects.length > 0) {
      const subjectFilters = entities.subjects
        .map(s => `subject.ilike.%${s}%`)
        .join(',');
      query = query.or(subjectFilters);
    }

    const { data, error } = await query.limit(100);

    if (error) {
      console.error('Error retrieving periods:', error);
      return [];
    }

    return (data || []).map((p: any) => ({
      id: p.id,
      teacherId: p.teacher_id,
      teacherName: p.teachers?.name || 'Unknown',
      classId: p.class_id,
      className: p.classes?.name || 'Unknown',
      subject: p.subject,
      dayOfWeek: p.day_of_week,
      periodNumber: p.period_number,
      startTime: p.start_time,
      endTime: p.end_time,
      periodType: p.period_type,
    }));
  }

  /**
   * Retrieve relevant classes based on extracted names
   */
  private async retrieveClasses(entities: ExtractedEntities) {
    let query = this.supabase
      .from('classes')
      .select('id, name, wing_id, grade_level');

    // If specific classes mentioned, filter by name
    if (entities.classes.length > 0) {
      const nameFilters = entities.classes
        .map(name => `name.ilike.%${name}%`)
        .join(',');
      query = query.or(nameFilters);
    }

    const { data, error } = await query.limit(50);

    if (error) {
      console.error('Error retrieving classes:', error);
      return [];
    }

    return (data || []).map(c => ({
      id: c.id,
      name: c.name,
      wingId: c.wing_id,
      gradeLevel: c.grade_level,
    }));
  }

  /**
   * Get scheduling constraints
   */
  private getConstraints(): string[] {
    return [
      'Maximum 3 consecutive teaching periods per teacher',
      'No double-booking of teachers or rooms',
      'Period Zero must be assigned to class teacher',
      'Teachers cannot be assigned to multiple wings',
      'Teaching periods must be between period 1 and 10',
      'Period Zero (0) is for morning activities',
      'Each period must have valid start and end times',
      'End time must be after start time',
    ];
  }

  /**
   * Convert day name to number
   */
  private getDayNumber(dayName: string): number | undefined {
    const days: Record<string, number> = {
      sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
      thursday: 4, friday: 5, saturday: 6,
      sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
    };
    return days[dayName.toLowerCase()];
  }
}

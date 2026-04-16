// Entity extraction for natural language commands

import type { ExtractedEntities } from './types';

const DAY_NAMES: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

export class EntityExtractor {
  /**
   * Extract entities from natural language command
   */
  extractEntities(command: string): ExtractedEntities {
    const lowerCommand = command.toLowerCase();
    
    return {
      teachers: this.extractTeachers(command),
      classes: this.extractClasses(command),
      subjects: this.extractSubjects(command),
      days: this.extractDays(lowerCommand),
      periods: this.extractPeriods(lowerCommand),
    };
  }

  /**
   * Extract teacher names (capitalized words after "teacher")
   */
  private extractTeachers(command: string): string[] {
    const patterns = [
      /teacher\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
      /(?:for|to)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/g,
    ];

    const teachers = new Set<string>();
    
    for (const pattern of patterns) {
      const matches = [...command.matchAll(pattern)];
      matches.forEach(match => {
        if (match[1]) {
          teachers.add(match[1].trim());
        }
      });
    }

    return Array.from(teachers);
  }

  /**
   * Extract class names (e.g., "Class 5A", "5A", "Grade 10")
   */
  private extractClasses(command: string): string[] {
    const patterns = [
      /class\s+([A-Z0-9-]+)/gi,
      /grade\s+(\d+[A-Z]?)/gi,
      /\b([1-9][0-2]?[A-Z])\b/g, // Matches patterns like 5A, 10B
    ];

    const classes = new Set<string>();
    
    for (const pattern of patterns) {
      const matches = [...command.matchAll(pattern)];
      matches.forEach(match => {
        if (match[1]) {
          classes.add(match[1].trim());
        }
      });
    }

    return Array.from(classes);
  }

  /**
   * Extract subject names (capitalized words that might be subjects)
   */
  private extractSubjects(command: string): string[] {
    const commonSubjects = [
      'math', 'mathematics', 'english', 'science', 'physics', 'chemistry',
      'biology', 'history', 'geography', 'art', 'music', 'pe', 'physical education',
      'computer science', 'cs', 'literature', 'social studies', 'economics',
    ];

    const subjects = new Set<string>();
    const lowerCommand = command.toLowerCase();

    for (const subject of commonSubjects) {
      if (lowerCommand.includes(subject)) {
        subjects.add(subject);
      }
    }

    // Also look for capitalized words that might be subjects
    const capitalizedPattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g;
    const matches = [...command.matchAll(capitalizedPattern)];
    
    matches.forEach(match => {
      const word = match[1].toLowerCase();
      // Exclude common non-subject words
      if (!['teacher', 'class', 'grade', 'period', 'monday', 'tuesday', 'wednesday', 
            'thursday', 'friday', 'saturday', 'sunday'].includes(word)) {
        subjects.add(match[1]);
      }
    });

    return Array.from(subjects);
  }

  /**
   * Extract day names
   */
  private extractDays(lowerCommand: string): string[] {
    const days: string[] = [];

    for (const [dayName, dayNumber] of Object.entries(DAY_NAMES)) {
      if (lowerCommand.includes(dayName)) {
        days.push(dayName);
      }
    }

    return days;
  }

  /**
   * Extract period numbers
   */
  private extractPeriods(lowerCommand: string): number[] {
    const patterns = [
      /period\s+(\d+)/gi,
      /period\s+zero/gi,
      /p(\d+)/gi,
    ];

    const periods = new Set<number>();

    for (const pattern of patterns) {
      const matches = [...lowerCommand.matchAll(pattern)];
      matches.forEach(match => {
        if (match[0].includes('zero')) {
          periods.add(0);
        } else if (match[1]) {
          const num = parseInt(match[1], 10);
          if (num >= 0 && num <= 10) {
            periods.add(num);
          }
        }
      });
    }

    return Array.from(periods);
  }

  /**
   * Convert day name to day number
   */
  getDayNumber(dayName: string): number | undefined {
    return DAY_NAMES[dayName.toLowerCase()];
  }
}

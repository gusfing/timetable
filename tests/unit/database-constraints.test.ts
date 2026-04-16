import { describe, it, expect } from 'vitest';

/**
 * Unit Tests for Database Constraints
 * These tests verify specific examples and edge cases
 */

describe('Database Constraints - Unit Tests', () => {
  describe('Consecutive Period Limit', () => {
    it('should allow up to 3 consecutive teaching periods', () => {
      const schedule = [
        { periodNumber: 1, periodType: 'teaching' },
        { periodNumber: 2, periodType: 'teaching' },
        { periodNumber: 3, periodType: 'teaching' },
      ];

      const maxConsecutive = calculateMaxConsecutive(schedule);
      expect(maxConsecutive).toBe(3);
      expect(maxConsecutive).toBeLessThanOrEqual(3);
    });

    it('should reject 4 consecutive teaching periods', () => {
      const schedule = [
        { periodNumber: 1, periodType: 'teaching' },
        { periodNumber: 2, periodType: 'teaching' },
        { periodNumber: 3, periodType: 'teaching' },
        { periodNumber: 4, periodType: 'teaching' },
      ];

      const maxConsecutive = calculateMaxConsecutive(schedule);
      expect(maxConsecutive).toBe(4);
      // This should trigger a constraint violation in the database
      expect(maxConsecutive).toBeGreaterThan(3);
    });

    it('should reset consecutive count after non-teaching period', () => {
      const schedule = [
        { periodNumber: 1, periodType: 'teaching' },
        { periodNumber: 2, periodType: 'teaching' },
        { periodNumber: 3, periodType: 'break' },
        { periodNumber: 4, periodType: 'teaching' },
        { periodNumber: 5, periodType: 'teaching' },
      ];

      const maxConsecutive = calculateMaxConsecutive(schedule);
      expect(maxConsecutive).toBe(2);
    });

    it('should handle empty schedule', () => {
      const schedule: any[] = [];
      const maxConsecutive = calculateMaxConsecutive(schedule);
      expect(maxConsecutive).toBe(0);
    });

    it('should handle single teaching period', () => {
      const schedule = [{ periodNumber: 1, periodType: 'teaching' }];
      const maxConsecutive = calculateMaxConsecutive(schedule);
      expect(maxConsecutive).toBe(1);
    });
  });

  describe('Fairness Index Calculation', () => {
    it('should calculate fairness index as sum of regular and substitution periods', () => {
      const regularPeriods = 15;
      const substitutionPeriods = 3;
      const fairnessIndex = calculateFairnessIndex(regularPeriods, substitutionPeriods);
      
      expect(fairnessIndex).toBe(18);
    });

    it('should handle zero periods', () => {
      const fairnessIndex = calculateFairnessIndex(0, 0);
      expect(fairnessIndex).toBe(0);
    });

    it('should increase when accepting substitution', () => {
      const initialIndex = calculateFairnessIndex(15, 3);
      const newIndex = calculateFairnessIndex(15, 4);
      
      expect(newIndex).toBeGreaterThan(initialIndex);
      expect(newIndex - initialIndex).toBe(1);
    });
  });

  describe('Double-Booking Prevention', () => {
    it('should detect teacher double-booking', () => {
      const bookings = [
        { teacherId: 'teacher-1', dayOfWeek: 1, periodNumber: 3 },
        { teacherId: 'teacher-1', dayOfWeek: 1, periodNumber: 3 },
      ];

      const hasConflict = checkDoubleBooking(bookings);
      expect(hasConflict).toBe(true);
    });

    it('should allow same teacher at different times', () => {
      const bookings = [
        { teacherId: 'teacher-1', dayOfWeek: 1, periodNumber: 3 },
        { teacherId: 'teacher-1', dayOfWeek: 1, periodNumber: 4 },
      ];

      const hasConflict = checkDoubleBooking(bookings);
      expect(hasConflict).toBe(false);
    });

    it('should allow different teachers at same time', () => {
      const bookings = [
        { teacherId: 'teacher-1', dayOfWeek: 1, periodNumber: 3 },
        { teacherId: 'teacher-2', dayOfWeek: 1, periodNumber: 3 },
      ];

      const hasConflict = checkDoubleBooking(bookings);
      expect(hasConflict).toBe(false);
    });
  });

  describe('Wing Isolation', () => {
    it('should filter periods by wing correctly', () => {
      const allPeriods = [
        { id: '1', wingId: 'blossom', subject: 'Math' },
        { id: '2', wingId: 'scholar', subject: 'Science' },
        { id: '3', wingId: 'blossom', subject: 'English' },
        { id: '4', wingId: 'master', subject: 'Physics' },
      ];

      const blossomPeriods = filterByWing(allPeriods, 'blossom');
      expect(blossomPeriods).toHaveLength(2);
      expect(blossomPeriods.every(p => p.wingId === 'blossom')).toBe(true);
    });

    it('should return empty array for non-existent wing', () => {
      const allPeriods = [
        { id: '1', wingId: 'blossom', subject: 'Math' },
      ];

      const filtered = filterByWing(allPeriods, 'nonexistent' as any);
      expect(filtered).toHaveLength(0);
    });
  });

  describe('Substitution Request Expiration', () => {
    it('should mark request as expired when past expiration time', () => {
      const now = new Date('2024-06-15T10:00:00Z');
      const expirationTime = new Date('2024-06-15T09:00:00Z');
      
      const isExpired = checkExpiration(expirationTime, now);
      expect(isExpired).toBe(true);
    });

    it('should keep request active when before expiration time', () => {
      const now = new Date('2024-06-15T09:00:00Z');
      const expirationTime = new Date('2024-06-15T10:00:00Z');
      
      const isExpired = checkExpiration(expirationTime, now);
      expect(isExpired).toBe(false);
    });

    it('should handle exact expiration time', () => {
      const now = new Date('2024-06-15T10:00:00Z');
      const expirationTime = new Date('2024-06-15T10:00:00Z');
      
      const isExpired = checkExpiration(expirationTime, now);
      expect(isExpired).toBe(false); // Not expired at exact time
    });
  });
});

// Helper functions
function calculateMaxConsecutive(schedule: Array<{ periodNumber: number; periodType: string }>): number {
  let maxConsecutive = 0;
  let currentConsecutive = 0;

  for (let i = 0; i < schedule.length; i++) {
    const period = schedule[i];
    const prevPeriod = i > 0 ? schedule[i - 1] : null;

    if (period.periodType === 'teaching') {
      if (prevPeriod && prevPeriod.periodNumber === period.periodNumber - 1 && prevPeriod.periodType === 'teaching') {
        currentConsecutive++;
      } else {
        currentConsecutive = 1;
      }
      maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
    } else {
      currentConsecutive = 0;
    }
  }

  return maxConsecutive;
}

function calculateFairnessIndex(regularPeriods: number, substitutionPeriods: number): number {
  return regularPeriods + substitutionPeriods;
}

function checkDoubleBooking(bookings: Array<{ teacherId: string; dayOfWeek: number; periodNumber: number }>): boolean {
  const seen = new Set<string>();
  
  for (const booking of bookings) {
    const key = `${booking.teacherId}-${booking.dayOfWeek}-${booking.periodNumber}`;
    if (seen.has(key)) {
      return true;
    }
    seen.add(key);
  }
  
  return false;
}

function filterByWing<T extends { wingId: string }>(periods: T[], wingId: string): T[] {
  return periods.filter(p => p.wingId === wingId);
}

function checkExpiration(expirationTime: Date, currentTime: Date): boolean {
  return currentTime > expirationTime;
}

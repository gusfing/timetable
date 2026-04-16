// Type definitions for AI Commander

export interface CommandContext {
  teachers: Array<{
    id: string;
    name: string;
    subjects: string[];
    employeeId: string;
  }>;
  periods: Array<{
    id: string;
    teacherId: string;
    teacherName: string;
    classId: string;
    className: string;
    subject: string;
    dayOfWeek: number;
    periodNumber: number;
    startTime: string;
    endTime: string;
    periodType: string;
  }>;
  classes: Array<{
    id: string;
    name: string;
    wingId: string;
    gradeLevel: number;
  }>;
  constraints: string[];
}

export interface DatabaseOperation {
  operation: 'INSERT' | 'UPDATE' | 'DELETE' | 'CLARIFY' | 'QUERY';
  table: 'periods' | 'teachers' | 'classes' | 'substitution_requests';
  data?: Record<string, any>;
  reasoning: string;
  ambiguities?: string[];
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export interface ExecutionResult {
  message: string;
  operations: DatabaseOperation[];
  data?: any;
}

export interface CommandResult {
  success: boolean;
  message: string;
  operations?: DatabaseOperation[];
  executionTime: number;
  fromCache?: boolean;
  fallbackUrl?: string;
  suggestions?: string[];
  data?: any;
}

export interface ExtractedEntities {
  teachers: string[];
  classes: string[];
  subjects: string[];
  days: string[];
  periods: number[];
  teacherIds?: string[];
  classIds?: string[];
}

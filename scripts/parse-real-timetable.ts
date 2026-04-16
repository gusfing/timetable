import * as fs from 'fs';
import * as path from 'path';

// Read the real timetable data
const dataPath = path.join(process.cwd(), '..', 'timetable_all_data.json');
const rawData = fs.readFileSync(dataPath, 'utf-8');
const timetableData = JSON.parse(rawData);

interface Teacher {
  id: string;
  name: string;
  employee_id: string;
  wing: string;
  workload_score: number;
  subjects: string[];
  classTeacher?: string;
}

interface TimetableEntry {
  id: string;
  teacher_id: string;
  class_id: string;
  room_id: null;
  wing_id: string;
  day_of_week: number;
  day: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri';
  period_number: number;
  class_name: string;
  subject: string;
  start_time: string;
  end_time: string;
  is_period_zero: boolean;
  period_type: string;
  is_substitution: boolean;
  created_at: string;
  updated_at: string;
}

const teachers: Teacher[] = [];
const timetable: TimetableEntry[] = [];
const teacherMap = new Map<string, string>(); // name -> id

let teacherCounter = 1;

function getOrCreateTeacher(name: string, classTeacher?: string): string {
  if (teacherMap.has(name)) {
    return teacherMap.get(name)!;
  }
  
  const teacherId = `teacher-${teacherCounter}`;
  const employeeId = `EMP${teacherCounter}`;
  teacherCounter++;
  
  teachers.push({
    id: teacherId,
    name,
    employee_id: employeeId,
    wing: 'Scholar',
    workload_score: 0,
    subjects: [],
    classTeacher
  });
  
  teacherMap.set(name, teacherId);
  return teacherId;
}

function parseDay(dayData: any[], dayName: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri', dayIndex: number) {
  if (!Array.isArray(dayData) || dayData.length < 3) return;
  
  // Skip header rows (first 2 rows)
  for (let i = 2; i < dayData.length; i++) {
    const row = dayData[i];
    if (!Array.isArray(row) || row.length < 3) continue;
    
    const classTeacher = row[0]; // e.g., "IIIA" - if present, this teacher is a class teacher
    const teacherName = row[1]; // e.g., "Parminder kaur"
    
    if (!teacherName || teacherName === 'null') continue;
    
    // Determine if this teacher is a class teacher (has a class in column 0)
    const isClassTeacher = classTeacher && classTeacher !== null && classTeacher !== 'null';
    
    const teacherId = getOrCreateTeacher(teacherName, isClassTeacher ? classTeacher : undefined);
    
    // Update teacher's isClassTeacher flag
    const teacher = teachers.find(t => t.id === teacherId);
    if (teacher && !teacher.classTeacher && isClassTeacher) {
      teacher.classTeacher = classTeacher;
    }
    
    // Parse periods (columns 2-10 are periods 0-8)
    for (let periodIdx = 2; periodIdx < row.length && periodIdx < 11; periodIdx++) {
      const className = row[periodIdx];
      const periodNumber = periodIdx - 2; // 0-8
      
      if (!className || className === null || className === 'null') continue;
      
      // Skip if it's just the class teacher period (same as classTeacher) for period 0
      if (periodNumber === 0 && className === classTeacher) continue;
      
      timetable.push({
        id: `entry-${teacherId}-${dayName}-${periodNumber}`,
        teacher_id: teacherId,
        class_id: `class-${className}`,
        room_id: null,
        wing_id: 'wing-scholar',
        day_of_week: dayIndex,
        day: dayName,
        period_number: periodNumber,
        class_name: className,
        subject: className,
        start_time: '08:00:00',
        end_time: '08:45:00',
        is_period_zero: periodNumber === 0,
        period_type: 'teaching',
        is_substitution: false,
        created_at: '2024-03-01T00:00:00.000Z',
        updated_at: '2024-03-01T00:00:00.000Z'
      });
    }
  }
}

// Parse each day
parseDay(timetableData.MON, 'Mon', 1);
parseDay(timetableData.TUE, 'Tue', 2);
parseDay(timetableData.WED, 'Wed', 3);
parseDay(timetableData.THUR || timetableData.THU, 'Thu', 4);
parseDay(timetableData.FRI, 'Fri', 5);

// Calculate workload for each teacher
teachers.forEach(teacher => {
  const teacherPeriods = timetable.filter(t => t.teacher_id === teacher.id);
  teacher.workload_score = teacherPeriods.length;
  
  // Extract unique subjects
  const subjects = new Set(teacherPeriods.map(t => t.subject));
  teacher.subjects = Array.from(subjects);
});

// Generate TypeScript code
const output = `// Auto-generated from real timetable data
import { Teacher, TimetableEntry } from '@/types/database';

export const mockTeachers: Teacher[] = ${JSON.stringify(teachers, null, 2)};

export const mockTimetable: TimetableEntry[] = ${JSON.stringify(timetable, null, 2)};
`;

// Write to mockData.ts
const outputPath = path.join(process.cwd(), 'src', 'services', 'mockData.ts');
fs.writeFileSync(outputPath, output, 'utf-8');

console.log(`✅ Generated mock data:`);
console.log(`   - ${teachers.length} teachers`);
console.log(`   - ${timetable.length} timetable entries`);
console.log(`   - Output: ${outputPath}`);

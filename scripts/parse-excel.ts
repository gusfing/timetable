import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';

interface Teacher {
  id: string;
  name: string;
  wing: 'Blossom' | 'Scholar' | 'Master';
  employee_id: string;
  telegram_id: string | null;
  workload_score: number;
  subjects: string[];
  created_at: string;
}

interface TimetableEntry {
  id: string;
  teacher_id: string;
  day: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri';
  period_number: number;
  class_name: string;
  subject: string;
  is_substitution: boolean;
  created_at: string;
}

async function parseExcelFile() {
  const filePath = path.join(__dirname, '..', '..', 'Copy of TIMETABLE_FINAL_1_JULY_25___(23.07.25)(1).xlsx');
  const workbook = new ExcelJS.Workbook();
  
  console.log('Reading Excel file:', filePath);
  await workbook.xlsx.readFile(filePath);
  
  const teachers: Teacher[] = [];
  const timetable: TimetableEntry[] = [];
  const dayMap: Record<string, 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri'> = {
    'MON': 'Mon', 'TUE': 'Tue', 'WED': 'Wed', 'THUR': 'Thu', 'FRI': 'Fri'
  };
  
  // Process each day worksheet
  for (let wsIdx = 0; wsIdx < 5; wsIdx++) {
    const worksheet = workbook.getWorksheet(wsIdx + 1);
    if (!worksheet) continue;
    
    const dayName = worksheet.name.toUpperCase();
    if (!dayMap[dayName]) continue;
    
    const day = dayMap[dayName];
    console.log(`Processing ${day}...`);
    
    // Parse rows starting from row 3 (row 1-2 are headers)
    for (let row = 3; row <= worksheet.rowCount; row++) {
      const rowObj = worksheet.getRow(row);
      const values = rowObj.values as any[];
      
      // Skip empty rows
      if (!values[1] && !values[2]) continue;
      
      const className = values[1] as string;
      const teacherName = values[2] as string;
      const subject = values[6] as string;
      
      if (!teacherName || !className) continue;
      
      // Create teacher if not exists
      let teacher = teachers.find(t => t.name === teacherName.trim());
      if (!teacher) {
        teacher = {
          id: `teacher-${teachers.length + 1}`,
          name: teacherName.trim(),
          wing: 'Scholar', // Default to Scholar wing
          employee_id: `EMP${teachers.length + 1}`,
          telegram_id: null,
          workload_score: 0,
          subjects: [],
          created_at: '2024-03-01T00:00:00.000Z',
        };
        teachers.push(teacher);
      }
      
      // Add subject if not already present
      if (subject && typeof subject === 'string' && !teacher.subjects.includes(subject.trim())) {
        teacher.subjects.push(subject.trim());
      }
      
      // Create timetable entry for each period (columns 3-9)
      for (let col = 3; col <= 9; col++) {
        const periodNumber = col - 3;
        const cellValue = values[col];
        
        if (cellValue && typeof cellValue === 'string') {
          const entry: TimetableEntry = {
            id: `entry-${teacher.id}-${day}-${periodNumber}`,
            teacher_id: teacher.id,
            day,
            period_number: periodNumber,
            class_name: cellValue.trim(),
            subject: subject?.trim() || 'Subject',
            is_substitution: false,
            created_at: '2024-03-01T00:00:00.000Z',
          };
          timetable.push(entry);
        }
      }
    }
  }
  
  // Update workload scores
  teachers.forEach(t => {
    t.workload_score = timetable.filter(e => e.teacher_id === t.id).length;
  });
  
  // Save to mockData file
  const mockDataPath = path.join(__dirname, '..', 'src', 'services', 'mockData.ts');
  const mockDataContent = `import { Teacher, TimetableEntry } from '@/types/database';

export const mockTeachers: Teacher[] = ${JSON.stringify(teachers, null, 2)};

export const mockTimetable: TimetableEntry[] = ${JSON.stringify(timetable, null, 2)};

export const getPeriodsForTeacher = (teacherId: string, day: string) => {
    const teacher = mockTeachers.find((t) => t.id === teacherId);
    if (!teacher) return [];

    const timeSlots = [
        '8:30 - 9:15',
        '9:15 - 10:00',
        '10:00 - 10:45',
        '10:45 - 11:30',
        '11:30 - 12:15',
        '12:15 - 1:00',
        '1:00 - 1:45',
    ];

    return timeSlots.map((time, index) => {
        const entry = mockTimetable.find(
            (p) => p.teacher_id === teacherId && p.day === day && p.period_number === index
        );

        if (entry?.class_name === 'Break' || entry?.class_name === 'Lunch') {
            return {
                time,
                subject: entry.class_name,
                class: '',
                room: '',
            };
        }

        return {
            time,
            subject: entry?.subject || 'Free Period',
            class: entry?.class_name || '',
            room: entry?.class_name === '10-B' ? 'Lab-2' : '101',
        };
    });
};
`;
  
  fs.writeFileSync(mockDataPath, mockDataContent);
  console.log('Mock data saved to:', mockDataPath);
  console.log('Total teachers:', teachers.length);
  console.log('Total timetable entries:', timetable.length);
}

parseExcelFile().catch(console.error);

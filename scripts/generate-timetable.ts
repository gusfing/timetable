/**
 * Generates a full timetable assigning all 42 teachers to classes
 * Classes: 1A-10D (4 sections each) + 11/12 streams
 * 7 periods per day, 5 days
 */

// All classes
const CLASSES = [
  // Class 1-10, 4 sections each
  ...['I','II','III','IV','V','VI','VII','VIII','IX','X'].flatMap(cls =>
    ['A','B','C','D'].map(sec => `${cls}${sec}`)
  ),
  // Class 11-12 streams
  'XIA-Arts', 'XIB-Arts',
  'XIA-Commerce', 'XIB-Commerce',
  'XIA-CommNoMath', 'XIB-CommNoMath',
  'XIA-Science', 'XIB-Science',
  'XIA-ScienceBio', 'XIB-ScienceBio',
  'XIIA-Arts', 'XIIB-Arts',
  'XIIA-Commerce', 'XIIB-Commerce',
  'XIIA-CommNoMath', 'XIIB-CommNoMath',
  'XIIA-Science', 'XIIB-Science',
  'XIIA-ScienceBio', 'XIIB-ScienceBio',
];

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const;
const PERIODS = [0, 1, 2, 3, 4, 5, 6]; // 7 periods per day

// 42 teachers from parsed Excel data
const teachers = [
  { id: 'teacher-1', name: 'Parminder kaur', employee_id: 'EMP1' },
  { id: 'teacher-2', name: 'Ranjeeta', employee_id: 'EMP2' },
  { id: 'teacher-3', name: 'Rashpal K', employee_id: 'EMP3' },
  { id: 'teacher-4', name: 'Maninder K', employee_id: 'EMP4' },
  { id: 'teacher-5', name: 'J.K.Arora', employee_id: 'EMP5' },
  { id: 'teacher-6', name: 'Jasbir K', employee_id: 'EMP6' },
  { id: 'teacher-7', name: 'Sonia', employee_id: 'EMP7' },
  { id: 'teacher-8', name: 'Mohanjyoti k', employee_id: 'EMP8' },
  { id: 'teacher-9', name: 'Jagdeep K', employee_id: 'EMP9' },
  { id: 'teacher-10', name: 'Gurpreet K', employee_id: 'EMP10' },
  { id: 'teacher-11', name: 'Sonia Suri', employee_id: 'EMP11' },
  { id: 'teacher-12', name: 'Roopshikha', employee_id: 'EMP12' },
  { id: 'teacher-13', name: 'Arti Sareen', employee_id: 'EMP13' },
  { id: 'teacher-14', name: 'Preeti Sharma', employee_id: 'EMP14' },
  { id: 'teacher-15', name: 'Komalpreet', employee_id: 'EMP15' },
  { id: 'teacher-16', name: 'Saranjit K', employee_id: 'EMP16' },
  { id: 'teacher-17', name: 'Gurpreet K Mahi', employee_id: 'EMP17' },
  { id: 'teacher-18', name: 'Prity Sood', employee_id: 'EMP18' },
  { id: 'teacher-19', name: 'Tajinder K', employee_id: 'EMP19' },
  { id: 'teacher-20', name: 'Jaswinder K', employee_id: 'EMP20' },
  { id: 'teacher-21', name: 'Amandeep K', employee_id: 'EMP21' },
  { id: 'teacher-22', name: 'Arti Malhotra', employee_id: 'EMP22' },
  { id: 'teacher-23', name: 'Preet K', employee_id: 'EMP23' },
  { id: 'teacher-24', name: 'Seema', employee_id: 'EMP24' },
  { id: 'teacher-25', name: 'Priti Singhal', employee_id: 'EMP25' },
  { id: 'teacher-26', name: 'Ritu Mehra', employee_id: 'EMP26' },
  { id: 'teacher-27', name: 'Ravinder K Shalu', employee_id: 'EMP27' },
  { id: 'teacher-28', name: 'Geeta Lamba', employee_id: 'EMP28' },
  { id: 'teacher-29', name: 'Aurbindo Swain', employee_id: 'EMP29' },
  { id: 'teacher-30', name: 'S.K.Bhatia', employee_id: 'EMP30' },
  { id: 'teacher-31', name: 'Pushpinder K', employee_id: 'EMP31' },
  { id: 'teacher-32', name: 'Gurleen K', employee_id: 'EMP32' },
  { id: 'teacher-33', name: 'Rajvinder K', employee_id: 'EMP33' },
  { id: 'teacher-34', name: 'Kulvinder k', employee_id: 'EMP34' },
  { id: 'teacher-35', name: 'Pawandeep k', employee_id: 'EMP35' },
  { id: 'teacher-36', name: 'Rajinder Sharma', employee_id: 'EMP36' },
  { id: 'teacher-37', name: 'Ramanpreet K', employee_id: 'EMP37' },
  { id: 'teacher-38', name: 'Ramandeep Kaur', employee_id: 'EMP38' },
  { id: 'teacher-39', name: 'Surjit Kaur', employee_id: 'EMP39' },
  { id: 'teacher-40', name: 'Prabhjeet k', employee_id: 'EMP40' },
  { id: 'teacher-41', name: 'Prity Singhal', employee_id: 'EMP41' },
  { id: 'teacher-42', name: 'Kulvinder K', employee_id: 'EMP42' },
];

// Generate timetable: distribute classes across teachers evenly
// Each teacher gets 5-6 periods per day (max 1 free period)
function generateTimetable() {
  const entries: any[] = [];
  let entryId = 1;

  // Track which slots are taken per teacher per day
  const teacherSlots: Record<string, Set<string>> = {};
  teachers.forEach(t => { teacherSlots[t.id] = new Set(); });

  // Track which class-period-day slots are taken
  const classSlots: Record<string, Set<string>> = {};
  CLASSES.forEach(c => { classSlots[c] = new Set(); });

  // Assign each class 1 period per day per teacher rotation
  // Total slots needed: 60 classes × 5 days × 7 periods = 2100 slots
  // Total teacher capacity: 42 teachers × 5 days × 6 periods = 1260 slots
  // So each class gets ~1 period per day covered by different teachers

  // Simple round-robin: assign teachers to class-day-period slots
  let teacherIndex = 0;

  for (const day of DAYS) {
    for (const period of PERIODS) {
      for (let classIdx = 0; classIdx < CLASSES.length; classIdx++) {
        const className = CLASSES[classIdx];
        const classKey = `${className}-${day}-${period}`;

        // Find next available teacher for this slot
        let assigned = false;
        let attempts = 0;

        while (!assigned && attempts < teachers.length) {
          const teacher = teachers[teacherIndex % teachers.length];
          const slotKey = `${day}-${period}`;

          // Check teacher not already teaching this period on this day
          if (!teacherSlots[teacher.id].has(slotKey)) {
            // Count how many periods this teacher has today
            const todayPeriods = PERIODS.filter(p =>
              teacherSlots[teacher.id].has(`${day}-${p}`)
            ).length;

            // Max 6 periods per day (1 free period minimum)
            if (todayPeriods < 6) {
              teacherSlots[teacher.id].add(slotKey);

              entries.push({
                id: `entry-${entryId++}`,
                teacher_id: teacher.id,
                day,
                period_number: period,
                class_name: className,
                subject: getSubject(className),
                is_substitution: false,
                created_at: '2024-03-01T00:00:00.000Z',
              });

              assigned = true;
            }
          }

          teacherIndex++;
          attempts++;
        }

        teacherIndex++;
      }
    }
  }

  return entries;
}

function getSubject(className: string): string {
  if (className.includes('Arts')) return 'Arts';
  if (className.includes('CommNoMath')) return 'Commerce (No Math)';
  if (className.includes('Commerce')) return 'Commerce';
  if (className.includes('ScienceBio')) return 'Science (Bio)';
  if (className.includes('Science')) return 'Science';
  if (className.startsWith('XII') || className.startsWith('XI')) return 'Senior Subject';
  if (className.startsWith('IX') || className.startsWith('X')) return 'Secondary Subject';
  if (className.startsWith('VI') || className.startsWith('VII') || className.startsWith('VIII')) return 'Middle Subject';
  return 'Primary Subject';
}

const timetable = generateTimetable();
console.log(`Generated ${timetable.length} timetable entries`);

// Count periods per teacher per day
const summary: Record<string, Record<string, number>> = {};
timetable.forEach(e => {
  if (!summary[e.teacher_id]) summary[e.teacher_id] = {};
  if (!summary[e.teacher_id][e.day]) summary[e.teacher_id][e.day] = 0;
  summary[e.teacher_id][e.day]++;
});

teachers.forEach(t => {
  const days = summary[t.id] || {};
  const counts = DAYS.map(d => days[d] || 0);
  const freePeriods = counts.map(c => 7 - c);
  console.log(`${t.name}: ${counts.join('/')} periods/day, free: ${freePeriods.join('/')}`);
});

// Write to file
import { writeFileSync } from 'fs';
import { join } from 'path';

const output = `import { Teacher, TimetableEntry } from '@/types/database';

export const mockTeachers: Teacher[] = ${JSON.stringify(
  teachers.map((t, i) => ({
    id: t.id,
    name: t.name,
    wing: 'Scholar' as const,
    employee_id: t.employee_id,
    telegram_id: null,
    workload_score: Math.floor(Math.random() * 10) + 20,
    subjects: [],
    created_at: '2024-03-01T00:00:00.000Z',
  })),
  null, 2
)};

export const mockTimetable: TimetableEntry[] = ${JSON.stringify(timetable, null, 2)};

export const CLASSES = ${JSON.stringify(CLASSES, null, 2)};
`;

writeFileSync(join(__dirname, '../src/services/mockData.ts'), output);
console.log('✅ mockData.ts updated successfully!');

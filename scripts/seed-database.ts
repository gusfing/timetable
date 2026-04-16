import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Default configuration based on the Excel file
const DEFAULT_CONFIG = {
  schoolName: 'GHPS',
  periodsPerDay: 8,
  specialPeriod: 'Period 0 is for morning prayer and class teacher',
  lunchBreak: 'Between period 3 and 4',
  wings: ['Primary', 'Middle', 'Senior'],
  nonRegularTeachers: 4,
  substituteRules: 'Same wing only',
  specialRules: 'None'
};

async function seedDatabase() {
  try {
    console.log('🌱 Starting database seed...');

    // Read the timetable data
    const dataPath = path.join(process.cwd(), '..', 'timetable_all_data.json');
    const rawData = fs.readFileSync(dataPath, 'utf-8');
    const timetableData = JSON.parse(rawData);

    console.log('📊 Loaded timetable data');

    // 1. Create wings
    console.log('Creating wings...');
    const wings = ['Primary', 'Middle', 'Senior'];
    for (const wingName of wings) {
      const { error } = await supabase
        .from('wings')
        .upsert({ name: wingName }, { onConflict: 'name' });
      
      if (error) console.error(`Error creating wing ${wingName}:`, error);
    }

    // 2. Extract and create teachers from the timetable
    console.log('Extracting teachers from timetable...');
    const teachers = extractTeachers(timetableData);
    
    console.log(`Found ${teachers.length} teachers`);
    
    for (const teacher of teachers) {
      const { error } = await supabase
        .from('teachers')
        .upsert({
          name: teacher.name,
          employee_id: teacher.employeeId,
          wing_id: null, // Will be assigned later
          is_regular: teacher.isRegular,
          telegram_chat_id: null
        }, { onConflict: 'employee_id' });
      
      if (error) console.error(`Error creating teacher ${teacher.name}:`, error);
    }

    // 3. Create periods
    console.log('Creating periods...');
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const periods = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    
    for (const day of days) {
      for (const periodNum of periods) {
        // Skip lunch break (between 3 and 4)
        if (periodNum === 3.5) continue;
        
        const { error } = await supabase
          .from('periods')
          .upsert({
            day_of_week: day,
            period_number: periodNum,
            start_time: getStartTime(periodNum),
            end_time: getEndTime(periodNum),
            is_break: periodNum === 0 // Period 0 is special
          }, { onConflict: 'day_of_week,period_number' });
        
        if (error) console.error(`Error creating period ${day} ${periodNum}:`, error);
      }
    }

    console.log('✅ Database seeded successfully!');
    console.log('\n📋 Configuration:');
    console.log(JSON.stringify(DEFAULT_CONFIG, null, 2));

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

function extractTeachers(data: any): Array<{name: string, employeeId: string, isRegular: boolean}> {
  const teachers = new Set<string>();
  const teacherList: Array<{name: string, employeeId: string, isRegular: boolean}> = [];
  
  // Extract from MON sheet
  if (data.MON && Array.isArray(data.MON)) {
    for (const row of data.MON) {
      if (Array.isArray(row) && row.length >= 2 && row[1]) {
        const teacherName = String(row[1]).trim();
        if (teacherName && !teachers.has(teacherName) && teacherName !== 'null') {
          teachers.add(teacherName);
          
          // Determine if regular teacher (has a class code in first column)
          const isRegular = row[0] && String(row[0]).trim() !== '';
          
          teacherList.push({
            name: teacherName,
            employeeId: `EMP${String(teacherList.length + 1).padStart(3, '0')}`,
            isRegular
          });
        }
      }
    }
  }
  
  return teacherList;
}

function getStartTime(period: number): string {
  const times: Record<number, string> = {
    0: '08:00:00',
    1: '08:30:00',
    2: '09:15:00',
    3: '10:00:00',
    4: '11:30:00', // After lunch
    5: '12:15:00',
    6: '13:00:00',
    7: '13:45:00',
    8: '14:30:00'
  };
  return times[period] || '08:00:00';
}

function getEndTime(period: number): string {
  const times: Record<number, string> = {
    0: '08:30:00',
    1: '09:15:00',
    2: '10:00:00',
    3: '10:45:00',
    4: '12:15:00',
    5: '13:00:00',
    6: '13:45:00',
    7: '14:30:00',
    8: '15:15:00'
  };
  return times[period] || '09:00:00';
}

// Run the seed
seedDatabase();

import { createClient } from '@supabase/supabase-js';
import { Database } from '../src/types/database';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

const wings = ['Blossom', 'Scholar', 'Master'] as const;

async function seedTeachersAndTimetable() {
    console.log('🌱 Reading real data from timetable_all_data.json...');

    const dataPath = path.join(process.cwd(), '../timetable_all_data.json');
    let rawData;
    try {
        rawData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    } catch (e) {
        console.log('Cant find json at ' + dataPath);
        return;
    }

    console.log('🧹 Clearing existing data...');
    await (supabase.from('audit_logs') as any).delete().neq('action', 'none');
    await (supabase.from('substitution_requests') as any).delete().neq('status', 'none');
    await (supabase.from('periods') as any).delete().neq('subject', 'none');
    await (supabase.from('classes') as any).delete().neq('name', 'none');
    await (supabase.from('rooms') as any).delete().neq('name', 'none');
    await (supabase.from('teachers') as any).delete().neq('name', 'none');
    await (supabase.from('wings') as any).delete().neq('name', 'none');
    await (supabase.from('tenants') as any).delete().neq('name', 'none');

    console.log('🏛️ Creating Tenant and Wings...');
    const { data: tenant, error: tenantErr } = await (supabase.from('tenants') as any)
        .insert({ name: 'Anti-Gravity Demo School', domain: 'demo.school.org' })
        .select().single();
    
    if (tenantErr || !tenant) {
        console.error('Failed to create tenant:', tenantErr);
        return;
    }
    const tenantId = tenant.id;

    // Create SuperAdmin
    await (supabase.from('teachers') as any).insert({
        tenant_id: tenantId,
        name: 'System SuperAdmin',
        employee_id: 'SUPERADMIN',
        role: 'superadmin'
    });

    // Create Wings
    const { data: insertedWings } = await (supabase.from('wings') as any).insert([
        { tenant_id: tenantId, name: 'Blossom', description: 'Early childhood' },
        { tenant_id: tenantId, name: 'Scholar', description: 'Middle school' },
        { tenant_id: tenantId, name: 'Master', description: 'High school' }
    ]).select('id, name');

    const wingMap: Record<string, string> = {};
    (insertedWings as any[])?.forEach(w => wingMap[w.name] = w.id);

    const daysMap: Record<string, number> = { 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5 };
    const activeSheets = Object.keys(rawData).filter(k => 
        ['MON', 'TUE', 'WED', 'THU', 'FRI'].some(d => k.toUpperCase().startsWith(d))
    );

    const teachersToInsert: any[] = [];
    const classesToInsert: any[] = [];
    const periodsToInsert: any[] = [];

    const teacherSeen = new Set();
    const classSeen = new Set();

    for (const sheetName of activeSheets) {
        const data = rawData[sheetName];
        let rawDay = sheetName.substring(0, 3).toUpperCase();
        const dayName = rawDay.charAt(0) + rawDay.substring(1).toLowerCase();
        const dayIdx = daysMap[dayName];

        if (dayIdx === undefined) continue;

        let startIndex = data.findIndex((row: any) => row && row[2] === 0);
        if (startIndex === -1) startIndex = 5; 

        for (let i = startIndex + 1; i < data.length; i++) {
            const row = data[i];
            if (!row || row.length < 2) continue;

            const tName = String(row[1] || '').trim().replace(/\s+/g, ' ');
            if (!tName || tName === 'Teacher Name') continue;

            const wingName: any = wings[Math.floor(Math.random() * wings.length)];
            const wingId = wingMap[wingName];

            if (!teacherSeen.has(tName)) {
                teachersToInsert.push({
                    tenant_id: tenantId,
                    name: tName,
                    employee_id: `EMP${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
                    role: 'teacher',
                    subjects: [],
                    updated_at: new Date().toISOString()
                });
                teacherSeen.add(tName);
            }

            for (let periodIdx = 0; periodIdx <= 7; periodIdx++) {
                const className = String(row[periodIdx + 2] || '').trim();
                if (!className || className === '-' || className === 'Break' || className === 'Lunch') continue;

                if (!classSeen.has(className)) {
                    classesToInsert.push({
                        tenant_id: tenantId,
                        name: className,
                        wing_id: wingId,
                    });
                    classSeen.add(className);
                }

                periodsToInsert.push({
                    tenant_id: tenantId,
                    teacherName: tName,
                    className: className,
                    day_of_week: dayIdx,
                    period_number: periodIdx,
                    subject: 'General',
                    wing_id: wingId
                });
            }
        }
    }

    console.log(`🧑‍🏫 Inserting ${teachersToInsert.length} teachers...`);
    const { data: insertedTeachers } = await (supabase.from('teachers') as any).insert(teachersToInsert).select();
    const teacherIdMap: Record<string, string> = {};
    (insertedTeachers as any[])?.forEach(t => teacherIdMap[t.name] = t.id);

    console.log(`🏫 Inserting ${classesToInsert.length} classes...`);
    const { data: insertedClasses } = await (supabase.from('classes') as any).insert(classesToInsert).select();
    const classIdMap: Record<string, string> = {};
    (insertedClasses as any[])?.forEach(c => classIdMap[c.name] = c.id);

    console.log(`📅 Inserting ${periodsToInsert.length} periods...`);
    const finalPeriods = periodsToInsert.map(p => ({
        tenant_id: p.tenant_id,
        teacher_id: teacherIdMap[p.teacherName],
        class_id: classIdMap[p.className],
        wing_id: p.wing_id,
        day_of_week: p.day_of_week,
        period_number: p.period_number,
        subject: p.subject,
        start_time: '08:00:00',
        end_time: '08:45:00',
        period_type: 'teaching',
        updated_at: new Date().toISOString(),
        is_period_zero: false
    })).filter(p => p.teacher_id && p.class_id);

    for (let i = 0; i < finalPeriods.length; i += 500) {
         const { error } = await (supabase.from('periods') as any).insert(finalPeriods.slice(i, i + 500));
         if(error) {
             console.error('Period Insert Error (skipping block):', error.message);
         }
    }

    console.log('✅ Seeding complete!');
    console.log('   -> Tenant ID:', tenantId);
}

seedTeachersAndTimetable();

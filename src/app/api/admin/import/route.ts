import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';
import * as ExcelJS from 'exceljs';

export async function POST(req: Request) {
    try {
        const cookieStore = await cookies();
        const supabase = createClient(cookieStore);
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Fetch user's tenant_id and verify admin rights
        const { data: profile } = await supabase.from('teachers')
            .select('tenant_id, role')
            .eq('id', session.user.id)
            .single();

        if (!profile || (profile.role !== 'admin' && profile.role !== 'superadmin')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const formData = await req.formData();
        const file = formData.get('file') as Blob;
        
        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        const buffer = await file.arrayBuffer();
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);

        const daysMap: Record<string, number> = { 'MON': 1, 'TUE': 2, 'WED': 3, 'THU': 4, 'FRI': 5 };
        const activeSheets = workbook.worksheets.filter(sheet => {
            const name = sheet.name.toUpperCase();
            return Object.keys(daysMap).some(d => name.startsWith(d));
        });

        if (activeSheets.length === 0) {
            return NextResponse.json({ error: 'No valid day sheets found (MON, TUE, etc.)' }, { status: 400 });
        }

        // We fetch default wings to map parsed classes seamlessly
        const { data: wings } = await supabase.from('wings').select('id, name');
        let defaultWingId = wings && wings.length > 0 ? wings[0].id : null;

        const teachersToUpsert = new Map<string, any>();
        const classesToUpsert = new Map<string, any>();
        const periodsToInsert: any[] = [];

        for (const sheet of activeSheets) {
            const dayKey = Object.keys(daysMap).find(d => sheet.name.toUpperCase().startsWith(d))!;
            const dayIdx = daysMap[dayKey];

            // Finding the first data row by looking for period sequence (0, 1, 2)
            let startRowIdx = 1;
            sheet.eachRow((row, rowNumber) => {
                if (row.getCell(3).value === 0 || row.getCell(3).value === '0') {
                    startRowIdx = rowNumber + 1;
                }
            });

            sheet.eachRow((row, rowNumber) => {
                if (rowNumber < startRowIdx) return;
                
                const rawTeacherName = row.getCell(2).text;
                const tName = (rawTeacherName || '').trim().replace(/\s+/g, ' ');
                if (!tName || tName.toLowerCase() === 'teacher name') return;

                if (!teachersToUpsert.has(tName)) {
                    teachersToUpsert.set(tName, {
                        tenant_id: profile.tenant_id,
                        name: tName,
                        employee_id: `EMP-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`.toUpperCase(),
                        role: 'teacher',
                        subjects: []
                    });
                }

                // Parse periods (Columns 3 to 10 mapped to period_number 0 to 7)
                for (let periodIdx = 0; periodIdx <= 7; periodIdx++) {
                    const colIdx = periodIdx + 3; // ExcelJS columns are 1-indexed (col 1 is row header usually, wait, raw JSON had col 0 as class, col 1 as teacher, col 2 as 0. ExcelJS cols: A=1, B=2. So Class is 1, Teacher is 2. Periods start at 3!)
                    const rawClass = row.getCell(colIdx).text;
                    const className = (rawClass || '').trim();
                    
                    if (!className || className === '-' || className.toLowerCase() === 'break' || className.toLowerCase() === 'lunch') continue;

                    if (!classesToUpsert.has(className)) {
                        classesToUpsert.set(className, {
                            tenant_id: profile.tenant_id,
                            name: className,
                            wing_id: defaultWingId // Temp default mapping
                        });
                    }

                    periodsToInsert.push({
                        tenant_id: profile.tenant_id,
                        teacherName: tName,
                        className: className,
                        day_of_week: dayIdx,
                        period_number: periodIdx,
                        subject: 'General', // TODO: Parse subject properly
                        wing_id: defaultWingId,
                        start_time: '08:00:00',
                        end_time: '08:45:00',
                        period_type: 'teaching'
                    });
                }
            });
        }

        // ACTUAL IMPORT LOGIC
        // 1. Upsert Teachers
        const teacherData = Array.from(teachersToUpsert.values());
        const { data: insertedTeachers, error: tError } = await supabase
            .from('teachers')
            .upsert(teacherData, { onConflict: 'tenant_id, name' })
            .select('id, name');

        if (tError) throw tError;
        const teacherMap = new Map(insertedTeachers.map(t => [t.name, t.id]));

        // 2. Upsert Classes
        const classData = Array.from(classesToUpsert.values());
        const { data: insertedClasses, error: cError } = await supabase
            .from('classes')
            .upsert(classData, { onConflict: 'tenant_id, name' })
            .select('id, name');

        if (cError) throw cError;
        const classMap = new Map(insertedClasses.map(c => [c.name, c.id]));

        // 3. Prepare Periods with correct IDs
        const finalPeriods = periodsToInsert.map(p => ({
            tenant_id: p.tenant_id,
            teacher_id: teacherMap.get(p.teacherName),
            class_id: classMap.get(p.className),
            subject: p.subject,
            day_of_week: p.day_of_week,
            period_number: p.period_number,
            wing_id: p.wing_id,
            start_time: p.start_time,
            end_time: p.end_time,
            period_type: p.period_type,
            is_period_zero: p.period_number === 0
        }));

        // 4. Batch Insert Periods
        const { error: pError } = await supabase
            .from('periods')
            .insert(finalPeriods);

        if (pError) throw pError;

        return NextResponse.json({ 
            success: true, 
            message: `Successfully imported ${finalPeriods.length} periods.`,
            stats: {
                teachersCount: insertedTeachers.length,
                classesCount: insertedClasses.length,
                periodsCount: finalPeriods.length
            }
        });

    } catch (error: any) {
        console.error("Import Error:", error);
        return NextResponse.json({ error: error.message || 'Failed to process file' }, { status: 500 });
    }
}

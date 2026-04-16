import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export interface ParsedTimetableData {
  teachers: Array<{
    name: string;
    schedule: Record<string, Record<number, string>>; // day -> period -> class
  }>;
  days: string[];
  maxPeriods: number;
  rawSheets: string[];
  ambiguities: string[];
}

// Global store for parsed timetable (replace with DB in production)
let parsedTimetableStore: ParsedTimetableData | null = null;

export function getParsedTimetable(): ParsedTimetableData | null {
  return parsedTimetableStore;
}

export function setParsedTimetable(data: ParsedTimetableData) {
  parsedTimetableStore = data;
}

function parseExcelTimetable(buffer: Buffer): ParsedTimetableData {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetNames = workbook.SheetNames;

  const teachers: Map<string, Record<string, Record<number, string>>> = new Map();
  const days: string[] = [];
  const ambiguities: string[] = [];
  let maxPeriods = 0;

  for (const sheetName of sheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (data.length < 2) continue;

    // Detect day from sheet name or first row
    const dayName = sheetName.toUpperCase().includes('MON') ? 'Mon' :
                    sheetName.toUpperCase().includes('TUE') ? 'Tue' :
                    sheetName.toUpperCase().includes('WED') ? 'Wed' :
                    sheetName.toUpperCase().includes('THU') ? 'Thu' :
                    sheetName.toUpperCase().includes('FRI') ? 'Fri' :
                    sheetName;

    if (!days.includes(dayName)) days.push(dayName);

    // Find header row (contains period numbers 0,1,2...)
    let headerRowIdx = -1;
    let periodStartCol = -1;
    let teacherCol = -1;

    for (let r = 0; r < Math.min(5, data.length); r++) {
      const row = data[r];
      for (let c = 0; c < row.length; c++) {
        const cell = String(row[c]).trim();
        if (cell === '0' || cell === '1') {
          // Check if next cells are sequential numbers
          const next = String(row[c + 1] || '').trim();
          if (next === '1' || next === '2') {
            headerRowIdx = r;
            periodStartCol = c;
            break;
          }
        }
      }
      if (headerRowIdx >= 0) break;
    }

    if (headerRowIdx < 0) {
      ambiguities.push(`Sheet "${sheetName}": Could not find period header row`);
      continue;
    }

    // Count periods from header
    const headerRow = data[headerRowIdx];
    let periodCount = 0;
    for (let c = periodStartCol; c < headerRow.length; c++) {
      const val = String(headerRow[c]).trim();
      if (val === '' && periodCount > 0) break;
      if (!isNaN(Number(val)) && val !== '') periodCount++;
    }
    maxPeriods = Math.max(maxPeriods, periodCount);

    // Parse teacher rows
    for (let r = headerRowIdx + 1; r < data.length; r++) {
      const row = data[r];
      if (!row || row.length === 0) continue;

      // Teacher name is typically in column 1 or 2
      let teacherName = '';
      for (let c = 0; c <= Math.min(3, periodStartCol - 1); c++) {
        const val = String(row[c] || '').trim();
        if (val && val.length > 2 && isNaN(Number(val)) &&
            !val.match(/^[0-9]+$/) && val !== '-') {
          teacherName = val;
          break;
        }
      }

      if (!teacherName) continue;

      // Skip rows that look like headers or separators
      if (teacherName.match(/^(MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|MON|TUE|WED|THU|FRI)$/i)) continue;

      if (!teachers.has(teacherName)) {
        teachers.set(teacherName, {});
      }

      const teacherSchedule = teachers.get(teacherName)!;
      if (!teacherSchedule[dayName]) teacherSchedule[dayName] = {};

      // Extract periods
      for (let p = 0; p < periodCount; p++) {
        const colIdx = periodStartCol + p;
        if (colIdx < row.length) {
          const cellVal = String(row[colIdx] || '').trim();
          if (cellVal && cellVal !== '-' && cellVal !== '' &&
              !['W.EX', 'CCA', 'BREAK', 'LUNCH'].includes(cellVal.toUpperCase())) {
            teacherSchedule[dayName][p] = cellVal;
          }
        }
      }
    }
  }

  // Convert map to array
  const teacherArray = Array.from(teachers.entries()).map(([name, schedule]) => ({
    name,
    schedule,
  })).filter(t => {
    // Filter out teachers with very few entries (likely noise)
    const totalPeriods = Object.values(t.schedule).reduce((sum, day) =>
      sum + Object.keys(day).length, 0);
    return totalPeriods > 2;
  });

  if (teacherArray.length === 0) {
    ambiguities.push('Could not extract any teacher data. The Excel format may be unusual.');
  }

  return {
    teachers: teacherArray,
    days: days.length > 0 ? days : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    maxPeriods: maxPeriods || 8,
    rawSheets: sheetNames,
    ambiguities,
  };
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls'].includes(ext || '')) {
      return NextResponse.json({ error: 'Only .xlsx and .xls files are supported' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = parseExcelTimetable(buffer);

    // Store parsed data
    setParsedTimetable(parsed);

    return NextResponse.json({
      success: true,
      summary: {
        teacherCount: parsed.teachers.length,
        days: parsed.days,
        maxPeriods: parsed.maxPeriods,
        sheets: parsed.rawSheets,
        ambiguities: parsed.ambiguities,
        sampleTeachers: parsed.teachers.slice(0, 5).map(t => t.name),
      },
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: error.message || 'Failed to parse file' }, { status: 500 });
  }
}

export async function GET() {
  const data = getParsedTimetable();
  if (!data) {
    return NextResponse.json({ success: false, error: 'No timetable uploaded yet' }, { status: 404 });
  }
  return NextResponse.json({ success: true, data });
}

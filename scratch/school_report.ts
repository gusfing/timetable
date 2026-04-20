const { mockTeachers, mockTimetable } = require('../src/services/mockData');

function generateCompleteReport() {
    const teacherMap = {};
    const classMap = {};
    
    // Initialize Teachers
    mockTeachers.forEach(t => {
        teacherMap[t.id] = {
            name: t.name,
            role: t.role || 'teacher',
            classTeacher: t.classTeacher || 'None',
            subjects: t.subjects || [],
            totalPeriods: 0,
            specialRole: 'Subject Teacher'
        };

        // Refine Special Roles
        if (t.name.includes('H.M')) teacherMap[t.id].specialRole = 'Head Mistress (Admin)';
        if (t.subjects.some(s => s.includes('(P)') || s.includes('(Prac)'))) teacherMap[t.id].specialRole = 'Lab Assistant / Practical Teacher';
        if (t.subjects.some(s => s.includes('S.E'))) teacherMap[t.id].specialRole = 'Special Education Teacher';
        if (t.subjects.some(s => s.includes('PT') || s.includes('P.E') || s.includes('Phy'))) teacherMap[t.id].specialRole = 'PT Teacher / Sports';
        if (t.subjects.some(s => s.includes('Lib'))) teacherMap[t.id].specialRole = 'Librarian';
        if (t.subjects.some(s => s.includes('Art'))) teacherMap[t.id].specialRole = 'Art Teacher';
        if (t.subjects.some(s => s.includes('Mus'))) teacherMap[t.id].specialRole = 'Music Teacher';
    });

    // Process Timetable for workload and class mapping
    mockTimetable.forEach(entry => {
        if (teacherMap[entry.teacher_id]) {
            teacherMap[entry.teacher_id].totalPeriods++;
        }
        
        if (!classMap[entry.class_name]) {
            classMap[entry.class_name] = {
                name: entry.class_name,
                classTeacher: 'Pending',
                teachers: new Set()
            };
        }
        classMap[entry.class_name].teachers.add(teacherMap[entry.teacher_id]?.name || 'Unknown');
    });

    // Map Class Teachers back to ClassMap
    mockTeachers.forEach(t => {
        if (t.classTeacher && classMap[t.classTeacher]) {
            classMap[t.classTeacher].classTeacher = t.name;
        }
    });

    const report = {
        teachers: [],
        classes: [],
        nothingToDo: []
    };

    // Format Teacher Data
    Object.keys(teacherMap).forEach(id => {
        const data = teacherMap[id];
        const info = {
            Name: data.name,
            Role: data.specialRole,
            Class_Teacher: data.classTeacher,
            Workload: data.totalPeriods,
            Expertise: data.subjects.slice(0, 5).join(', ') + (data.subjects.length > 5 ? '...' : '')
        };

        if (data.totalPeriods === 0) {
            let reason = 'No periods assigned in current timetable';
            if (data.specialRole.includes('Admin')) reason = 'Administrative duties (H.M)';
            if (data.specialRole.includes('Lab')) reason = 'Practical/Lab support (on-call)';
            if (data.specialRole.includes('Librarian')) reason = 'Library management';
            
            report.nothingToDo.push({ ...info, Reason: reason });
        } else {
            report.teachers.push(info);
        }
    });

    // Format Class Data
    Object.keys(classMap).forEach(cName => {
        report.classes.push({
            Class: cName,
            Class_Teacher: classMap[cName].classTeacher,
            Assigned_Staff_Count: classMap[cName].teachers.size,
            Staff: Array.from(classMap[cName].teachers).slice(0, 3).join(', ') + '...'
        });
    });

    return report;
}

const report = generateCompleteReport();
console.log('=== 🏫 SCHOOL STAFF & CLASS MAPPING ===\n');
console.log('--- 👩‍🏫 TEACHERS (ACTIVE) ---');
console.table(report.teachers.slice(0, 15));
console.log('\n--- ⚠️ TEACHERS WITH NO ASSIGNED PERIODS ---');
if (report.nothingToDo.length > 0) {
    console.table(report.nothingToDo);
} else {
    console.log('None found in mock data.');
}
console.log('\n--- 🏫 CLASSES & SECTIONS ---');
console.table(report.classes.slice(0, 15));

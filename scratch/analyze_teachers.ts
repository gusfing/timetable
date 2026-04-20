const { mockTeachers, mockTimetable } = require('../src/services/mockData');

function generateTeacherMap() {
    const teacherMap = {};
    
    mockTeachers.forEach(t => {
        teacherMap[t.id] = {
            name: t.name,
            role: t.role || 'teacher',
            classTeacher: t.classTeacher || 'None',
            subjects: t.subjects || [],
            periods: [],
            totalPeriods: 0,
            specialRole: 'Subject Teacher'
        };

        // Infer Special Roles
        if (t.name.includes('H.M')) teacherMap[t.id].specialRole = 'Head Mistress / Admin';
        if (t.subjects.some(s => s.includes('(P)'))) teacherMap[t.id].specialRole = 'Lab Assistant / Practicals';
        if (t.subjects.some(s => s.includes('S.E'))) teacherMap[t.id].specialRole = 'Special Education';
        if (t.subjects.some(s => s.includes('PT') || s.includes('Phy'))) teacherMap[t.id].specialRole = 'PT Teacher';
    });

    mockTimetable.forEach(entry => {
        if (teacherMap[entry.teacher_id]) {
            teacherMap[entry.teacher_id].periods.push(entry);
            teacherMap[entry.teacher_id].totalPeriods++;
        }
    });

    const report = {
        mappedTeachers: [],
        nothingToDo: []
    };

    Object.keys(teacherMap).forEach(id => {
        const data = teacherMap[id];
        const info = {
            id,
            name: data.name,
            classTeacher: data.classTeacher,
            specialRole: data.specialRole,
            totalPeriods: data.totalPeriods,
            subjects: data.subjects.join(', ')
        };

        if (data.totalPeriods === 0) {
            report.nothingToDo.push(info);
        } else {
            report.mappedTeachers.push(info);
        }
    });

    return report;
}

const report = generateTeacherMap();
console.log('--- TEACHERS MAPPED ---');
console.table(report.mappedTeachers.slice(0, 20)); // Just a sample for logs
console.log('\n--- TEACHERS WITH NOTHING TO DO ---');
console.table(report.nothingToDo);

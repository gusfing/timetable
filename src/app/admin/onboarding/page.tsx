'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast, Toaster } from 'sonner';

const STEPS = ['School Info', 'Classes', 'Teachers', 'Rules', 'Done'];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [schoolName, setSchoolName] = useState('');
  const [breakTime, setBreakTime] = useState('Period 4');
  const [classes, setClasses] = useState([{ name: '', wing: 'Scholar' }]);
  const [teachers, setTeachers] = useState([{ name: '', subjects: '', wing: 'Scholar', employeeId: '' }]);

  const next = () => setStep(s => Math.min(s + 1, STEPS.length - 1));
  const prev = () => setStep(s => Math.max(s - 1, 0));

  const finish = () => {
    toast.success('Setup complete! Redirecting to dashboard...');
    setTimeout(() => router.push('/admin/dashboard'), 1500);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <Toaster position="top-right" richColors />
      <div className="w-full max-w-2xl">
        {/* Step indicators */}
        <div className="flex items-center justify-between mb-10">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${i <= step ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground'}`}>
                {i < step ? '✓' : i + 1}
              </div>
              {i < STEPS.length - 1 && <div className={`h-0.5 w-12 mx-1 ${i < step ? 'bg-primary' : 'bg-secondary'}`} />}
            </div>
          ))}
        </div>

        <div className="bg-card border rounded-3xl p-8">
          <h2 className="text-2xl font-bold mb-2">{STEPS[step]}</h2>

          {/* Step 0: School Info */}
          {step === 0 && (
            <div className="space-y-4">
              <p className="text-muted-foreground mb-6">Basic school configuration</p>
              <div>
                <label className="text-sm font-semibold">School Name</label>
                <input className="w-full mt-1 p-3 rounded-xl bg-secondary/50 border-none outline-none" placeholder="e.g. Anti-Gravity Public School" value={schoolName} onChange={e => setSchoolName(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-semibold">School Break Period</label>
                <select className="w-full mt-1 p-3 rounded-xl bg-secondary/50 border-none outline-none" value={breakTime} onChange={e => setBreakTime(e.target.value)}>
                  {[1,2,3,4,5,6,7].map(p => <option key={p}>Period {p}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Step 1: Classes */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-muted-foreground mb-4">Add classes (or use the default I-XII structure)</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {classes.map((cls, i) => (
                  <div key={i} className="flex gap-2">
                    <input className="flex-1 p-2 rounded-xl bg-secondary/50 outline-none text-sm" placeholder="Class name (e.g. VIIA)" value={cls.name} onChange={e => { const c = [...classes]; c[i].name = e.target.value; setClasses(c); }} />
                    <select className="p-2 rounded-xl bg-secondary/50 outline-none text-sm" value={cls.wing} onChange={e => { const c = [...classes]; c[i].wing = e.target.value; setClasses(c); }}>
                      <option>Blossom</option><option>Scholar</option><option>Master</option>
                    </select>
                    <button onClick={() => setClasses(classes.filter((_, j) => j !== i))} className="px-2 text-destructive">✕</button>
                  </div>
                ))}
              </div>
              <button onClick={() => setClasses([...classes, { name: '', wing: 'Scholar' }])} className="text-sm text-primary font-semibold">+ Add Class</button>
              <button onClick={() => {
                const auto: any[] = [];
                ['I','II','III','IV','V','VI','VII','VIII','IX','X'].forEach(c => ['A','B','C','D'].forEach(s => auto.push({ name: `${c}${s}`, wing: 'Scholar' })));
                ['XI','XII'].forEach(c => ['Arts','Commerce','CommNoMath','Science','ScienceBio'].forEach(s => auto.push({ name: `${c}-${s}`, wing: 'Master' })));
                setClasses(auto);
                toast.success('Auto-filled 60 classes!');
              }} className="w-full p-2 rounded-xl border border-primary text-primary text-sm font-semibold">
                Auto-fill I–XII (60 classes)
              </button>
            </div>
          )}

          {/* Step 2: Teachers */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-muted-foreground mb-4">Add teachers to the system</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {teachers.map((t, i) => (
                  <div key={i} className="grid grid-cols-4 gap-2">
                    <input className="p-2 rounded-xl bg-secondary/50 outline-none text-sm col-span-1" placeholder="Name" value={t.name} onChange={e => { const arr = [...teachers]; arr[i].name = e.target.value; setTeachers(arr); }} />
                    <input className="p-2 rounded-xl bg-secondary/50 outline-none text-sm col-span-1" placeholder="EMP ID" value={t.employeeId} onChange={e => { const arr = [...teachers]; arr[i].employeeId = e.target.value; setTeachers(arr); }} />
                    <input className="p-2 rounded-xl bg-secondary/50 outline-none text-sm col-span-1" placeholder="Subjects" value={t.subjects} onChange={e => { const arr = [...teachers]; arr[i].subjects = e.target.value; setTeachers(arr); }} />
                    <select className="p-2 rounded-xl bg-secondary/50 outline-none text-sm" value={t.wing} onChange={e => { const arr = [...teachers]; arr[i].wing = e.target.value; setTeachers(arr); }}>
                      <option>Blossom</option><option>Scholar</option><option>Master</option>
                    </select>
                  </div>
                ))}
              </div>
              <button onClick={() => setTeachers([...teachers, { name: '', subjects: '', wing: 'Scholar', employeeId: '' }])} className="text-sm text-primary font-semibold">+ Add Teacher</button>
            </div>
          )}

          {/* Step 3: Rules */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-muted-foreground mb-4">Default rules are pre-configured. You can edit them anytime from the Rules page.</p>
              <div className="space-y-2 text-sm">
                {[
                  ['Anti-Burnout Limit', '3 consecutive periods max'],
                  ['Min Daily Periods', '6 per teacher'],
                  ['Max Daily Periods', '8 per teacher'],
                  ['Wing Isolation', 'Enabled'],
                  ['Fairness Index', 'Enabled'],
                  ['Blossom Supervision', 'Always on'],
                ].map(([rule, val]) => (
                  <div key={rule} className="flex justify-between p-3 bg-secondary/30 rounded-xl">
                    <span className="font-medium">{rule}</span>
                    <span className="text-primary font-semibold">{val}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => router.push('/admin/rules')} className="text-sm text-primary font-semibold">Edit Rules →</button>
            </div>
          )}

          {/* Step 4: Done */}
          {step === 4 && (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">🎉</div>
              <h3 className="text-xl font-bold mb-2">Setup Complete!</h3>
              <p className="text-muted-foreground mb-6">Your school timetable system is ready. Head to the dashboard to start managing schedules.</p>
              <button onClick={finish} className="px-8 py-3 bg-primary text-white rounded-xl font-semibold">Go to Dashboard</button>
            </div>
          )}

          {/* Navigation */}
          {step < 4 && (
            <div className="flex justify-between mt-8">
              <button onClick={prev} disabled={step === 0} className="px-6 py-2 rounded-xl bg-secondary disabled:opacity-30">Back</button>
              <button onClick={next} className="px-6 py-2 rounded-xl bg-primary text-white font-semibold">
                {step === 3 ? 'Finish Setup' : 'Next →'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

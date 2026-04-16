'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TimetableRules, RULE_METADATA, DEFAULT_RULES } from '@/lib/scheduler/rules';
import { toast, Toaster } from 'sonner';

export default function RulesPage() {
  const router = useRouter();
  const [rules, setRules] = useState<TimetableRules>(DEFAULT_RULES);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/rules').then(r => r.json()).then(d => { if (d.rules) setRules(d.rules); });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch('/api/rules', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rules) });
      toast.success('Rules saved!');
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  const update = (key: keyof TimetableRules, value: any) => setRules(r => ({ ...r, [key]: value }));

  return (
    <div className="min-h-screen bg-background p-8">
      <Toaster position="top-right" richColors />
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <button onClick={() => router.push('/admin/dashboard')} className="text-sm text-muted-foreground mb-2 hover:underline">← Back to Dashboard</button>
            <h1 className="text-3xl font-bold">Timetable Rules</h1>
            <p className="text-muted-foreground">Configure AI-enforced scheduling rules</p>
          </div>
          <button onClick={handleSave} disabled={saving} className="px-6 py-2 bg-primary text-white rounded-xl font-semibold disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Rules'}
          </button>
        </div>

        <div className="space-y-4">
          {(Object.keys(RULE_METADATA) as Array<keyof TimetableRules>).map(key => {
            const meta = RULE_METADATA[key];
            const value = rules[key];
            return (
              <div key={key} className="bg-card border rounded-2xl p-5 flex items-center justify-between gap-4">
                <div className="flex-1">
                  <p className="font-semibold">{meta.label}</p>
                  <p className="text-sm text-muted-foreground">{meta.description}</p>
                </div>
                {meta.type === 'boolean' ? (
                  <button
                    onClick={() => update(key, !value)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${value ? 'bg-primary' : 'bg-secondary'}`}
                  >
                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${value ? 'translate-x-7' : 'translate-x-1'}`} />
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button onClick={() => update(key, Math.max(meta.min!, (value as number) - 1))} className="w-8 h-8 rounded-lg bg-secondary font-bold">-</button>
                    <span className="w-8 text-center font-bold text-lg">{value as number}</span>
                    <button onClick={() => update(key, Math.min(meta.max!, (value as number) + 1))} className="w-8 h-8 rounded-lg bg-secondary font-bold">+</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

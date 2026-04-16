'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
    Calendar, ShieldAlert, Zap, Send, UserPlus, 
    AlertCircle, Sparkles, Sunrise, Users, LayoutGrid, 
    ListFilter, Search, FileSpreadsheet, Bell, Settings2, GraduationCap,
    Clock, Activity, BarChart3, TrendingUp as TrendIcon
} from 'lucide-react';
import Link from 'next/link';
import { findTopSubstitutes } from '@/lib/scheduler/engine';
import { Teacher, TimetableEntry } from '@/types/database';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { DndContext, useDraggable, useDroppable, DragEndEvent } from '@dnd-kit/core';
import { toast, Toaster } from 'sonner';
import { isForbiddenZone, validateMove } from '@/lib/scheduler/validator';
import { createClient } from '@/utils/supabase/client';
import { DEFAULT_RULES, TimetableRulesConfig } from '@/lib/scheduler/rules';
import { AVAILABLE_MODELS, DEFAULT_MODEL } from '@/lib/openrouter';

// Sub-component for Substitution Dialog to prevent heavy calculations on every grid render
function SubstitutionDialogContent({ 
    teacher, 
    selectedDay, 
    periodIndex, 
    teachers, 
    timetable 
}: { 
    teacher: Teacher, 
    selectedDay: string, 
    periodIndex: number, 
    teachers: Teacher[], 
    timetable: TimetableEntry[] 
}) {
    const dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(selectedDay);
    
    // Memoize substitutes calculation
    const substitutes = useMemo(() => {
        return findTopSubstitutes(
            teachers, 
            [teacher.id], 
            teacher.wing || 'Scholar', 
            dayOfWeek, 
            periodIndex + 1, // Fix: Use 1-indexed period number
            timetable
        );
    }, [teacher.id, teacher.wing, dayOfWeek, periodIndex, teachers, timetable]);

    const handleAssign = async (sub: Teacher) => {
        try {
            const res = await fetch('/api/substitutions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    absentTeacherId: teacher.id,
                    substituteTeacherId: sub.id,
                    day: selectedDay,
                    period: periodIndex + 1, // Fix: Use 1-indexed period number
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success(`Assigned ${sub.name} to replace ${teacher.name}`);
            } else {
                throw new Error(data.error);
            }
        } catch (err: any) {
            toast.error(err.message || 'Failed to assign substitution');
        }
    };

    return (
        <DialogContent className="rounded-3xl border-none shadow-2xl sm:max-w-[425px]">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-primary">
                    <UserPlus className="h-5 w-5" /> Smart Substitution
                </DialogTitle>
                <DialogDescription>
                    Find optimal replacements for <strong>{teacher.name}</strong> on {selectedDay}, Period {periodIndex + 1}.
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="p-3 bg-secondary/20 rounded-xl flex items-start gap-3 border border-secondary/30">
                    <AlertCircle className="h-4 w-4 text-primary mt-0.5" />
                    <div>
                        <p className="text-xs font-semibold">Requirement Check</p>
                        <p className="text-[10px] text-muted-foreground">Wing: {teacher.wing || 'Scholar'} | Period: P{periodIndex + 1}</p>
                    </div>
                </div>
                <div className="space-y-2">
                    {substitutes.length > 0 ? (
                        substitutes.map((sub: Teacher) => (
                            <div 
                                key={sub.id} 
                                onClick={() => handleAssign(sub)}
                                className="group p-3 bg-white border border-secondary/50 rounded-2xl hover:border-primary hover:shadow-soft transition-all cursor-pointer flex justify-between items-center"
                            >
                                <div>
                                    <p className="text-sm font-bold">{sub.name}</p>
                                    <p className="text-[10px] text-muted-foreground">Workload: {sub.workload_score || 0} periods</p>
                                </div>
                                <div className="bg-sage-100 text-sage-700 text-[10px] font-bold px-2 py-1 rounded-lg group-hover:bg-primary group-hover:text-white transition-colors">
                                    Assign
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-center py-4 text-xs text-muted-foreground">No eligible substitutes found in this wing.</p>
                    )}
                </div>
            </div>
        </DialogContent>
    );
}

// Draggable Class Card Component
function DraggableClassCard({ p, i, teacher, isConsecutive }: { p: any, i: number, teacher: Teacher, isConsecutive: boolean }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `draggable-${teacher.id}-${i}-${p.day}`,
        data: { p, teacher, periodNumber: i }
    });

    const isSub = p.id?.toString().startsWith('ai-');

    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 50,
    } : undefined;

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className={`p-2 rounded-xl text-center shadow-card bg-white border border-secondary/30 cursor-grab active:cursor-grabbing hover:ring-2 hover:ring-primary/30 transition-shadow relative ${isDragging ? 'opacity-50 ring-2 ring-primary' : ''} ${isConsecutive ? 'ring-2 ring-accent/30' : ''}`}
        >
            {isSub && <div className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full" title="AI Substitution" />}
            <div className="text-[10px] font-bold text-primary truncate">{p.subject}</div>
            {p.subject !== p.class && p.class && (
                <div className="text-[8px] text-muted-foreground">{p.class}</div>
            )}
        </div>
    );
}

// Droppable Period Cell Component
function DroppablePeriodCell({
    teacherId,
    periodIndex,
    day,
    children,
    isForbidden
}: {
    teacherId: string,
    periodIndex: number,
    day: string,
    children: React.ReactNode,
    isForbidden: boolean
}) {
    const { setNodeRef, isOver } = useDroppable({
        id: `droppable-${teacherId}-${periodIndex}-${day}`,
        data: { teacherId, periodIndex, day }
    });

    return (
        <td
            ref={setNodeRef}
            className={`px-2 py-4 border-b border-secondary/20 transition-colors ${isOver ? 'bg-primary/10' : ''} ${isForbidden ? 'bg-destructive/10 animate-pulse' : ''}`}
        >
            {children}
        </td>
    );
}

export default function AdminDashboard() {
    const [selectedDay, setSelectedDay] = useState<'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri'>('Mon');
    const [command, setCommand] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [lastResult, setLastResult] = useState<any>(null);
    const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [pendingChanges, setPendingChanges] = useState<any[]>([]);
    const [hasMounted, setHasMounted] = useState(false);
    const [isMorningSetupOpen, setIsMorningSetupOpen] = useState(false);
    const [absentTeacherIds, setAbsentTeacherIds] = useState<string[]>([]);
    const [unreadNotifCount, setUnreadNotifCount] = useState(0);
    const [rules, setRules] = useState<TimetableRulesConfig>(DEFAULT_RULES);
    const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);

    useEffect(() => {
        setHasMounted(true);
        
        async function fetchData() {
            try {
                // Fetch Teachers from API
                const teachersRes = await fetch('/api/teachers');
                const teachersData = await teachersRes.json();
                setTeachers(teachersData.teachers || []);

                // Fetch Timetable from API
                const ttRes = await fetch(`/api/timetable?day=${selectedDay}`);
                const ttData = await ttRes.json();
                setTimetable(ttData.timetable || []);

                // Fetch rules
                const rulesRes = await fetch('/api/rules');
                const rulesData = await rulesRes.json();
                if (rulesData.rules) setRules(rulesData.rules);

                // Fetch unread notification count
                const notifRes = await fetch('/api/notifications?unread=true&limit=1');
                const notifData = await notifRes.json();
                setUnreadNotifCount(notifData.notifications?.length ?? 0);

            } catch (err) {
                console.error('Error fetching dashboard data:', err);
                toast.error('Failed to load live data');
            }
        }
        
        fetchData();

        // REAL-TIME: Listen for substitution status updates
        const supabaseClient = createClient();
        const subChannel = supabaseClient
            .channel('substitution-updates')
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'substitution_requests' },
                (payload) => {
                    const status = payload.new.status;
                    const teacherId = payload.new.assigned_teacher_id;
                    const teacher = teachers.find(t => t.id === teacherId);
                    
                    if (status === 'accepted') {
                        toast.success(`${teacher?.name || 'A teacher'} accepted a substitution!`, {
                            icon: '✅',
                            duration: 5000
                        });
                        fetchData(); // Refresh to show the assigned teacher in grid
                    } else if (status === 'declined') {
                        toast.error(`${teacher?.name || 'A teacher'} declined a substitution.`, {
                            icon: '❌',
                            description: 'The system is escalating to the next candidate.',
                            duration: 5000
                        });
                    }
                }
            )
            .subscribe();

        return () => {
            supabaseClient.removeChannel(subChannel);
        };
    }, [selectedDay, teachers.length]);

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over) return;

        const activeData = active.data.current as any;
        const overData = over.data.current as any;

        const { p: originalPeriod, teacher: originalTeacher } = activeData;
        const { teacherId: targetTeacherId, periodIndex: targetPeriodIndex, day: targetDay } = overData;

        // 1. Validate Burnout
        const newTimetable = timetable.map((entry: TimetableEntry) => {
            if (entry.id === originalPeriod.pId) {
                return { ...entry, teacher_id: targetTeacherId, period_number: targetPeriodIndex, day: targetDay };
            }
            return entry;
        });

        const validation = validateMove(originalTeacher, targetDay, newTimetable);
        if (!validation.isValid) {
            toast.error(validation.message || "Burnout Alert!", {
                icon: '⚠️'
            });
            return;
        }

        // 2. Optimistic Update
        const oldTimetable = [...timetable];
        setTimetable(newTimetable);
        toast.success("Schedule Updated", {
            description: `Moved ${originalPeriod.subject} to Period ${targetPeriodIndex}`,
        });

        // 3. Sync with Telegram Bridge
        try {
            await fetch('/api/webhooks/timetable', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    teacher_id: targetTeacherId,
                    day: targetDay,
                    period_number: targetPeriodIndex,
                    class_name: originalPeriod.subject,
                    action: "Move"
                })
            });
        } catch (err) {
            console.warn("Failed to notify teacher via Telegram");
        }
    };

    const applyPendingChanges = async () => {
        setIsLoading(true);
        let successCount = 0;
        
        for (const change of pendingChanges) {
            try {
                const res = await fetch('/api/substitutions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        absentTeacherId: change.originalTeacherId,
                        substituteTeacherId: change.teacherId,
                        day: change.day,
                        period: change.period
                    })
                });
                
                if (res.ok) successCount++;
            } catch (error) {
                console.error('Failed to apply substitution:', error);
            }
        }

        await fetchData(); // Refresh everything to show new substitutions
        setPendingChanges([]);
        setLastResult(null);
        setIsLoading(false);
        
        if (successCount > 0) {
            toast.success("Substitutions Applied", {
                description: `${successCount} requests created and teachers notified via Telegram.`,
            });
        }
    };

    const handleAutoGenerate = () => {
        setCommand(`Generate a proper and fair timetable for ${selectedDay}. Ensure no burnout and respect Wing Isolation.`);
        // We don't call handleCommand directly here to let user review the prompt, 
        // or we could just trigger it. Let's trigger it for a "Snappy" feel.
        setTimeout(() => handleCommand(), 100);
    };

    const handleCommand = async () => {
        if (!command.trim()) return;
        setIsLoading(true);
        try {
            const response = await fetch('/api/ai/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: command,
                    model: selectedModel,
                    context: {
                        teachers: teachers.map(t => ({ id: t.id, name: t.name, wing: t.wing, workload: t.workload_score, subjects: t.subjects })),
                        timetable: timetable.filter(e => e.day === selectedDay)
                    }
                }),
            });
            const data = await response.json();
            setLastResult(data);
            if (data.success && data.pendingChanges) {
                setPendingChanges(data.pendingChanges);
                setCommand('');
            }
        } catch (error) {
            console.error('Commander Error:', error);
            toast.error("Commander failed to process");
        } finally {
            setIsLoading(false);
        }
    };

    const handleMorningAutoFill = async () => {
        if (absentTeacherIds.length === 0) {
            toast.error("No absent teachers selected");
            return;
        }

        const newPendingChanges: any[] = [];
        let changesCount = 0;

        for (const absentId of absentTeacherIds) {
            const absentTeacher = teachers.find(t => t.id === absentId);
            if (!absentTeacher) continue;

            // Find their classes today
            const theirPeriods = timetable.filter(p =>
                p.teacher_id === absentId &&
                p.day === selectedDay
            );

            for (const period of theirPeriods) {
                try {
                    const res = await fetch(
                        `/api/substitutions?absentTeacherId=${absentId}&day=${selectedDay}&period=${period.period_number}`
                    );
                    const data = await res.json();

                    if (data.substitutes && data.substitutes.length > 0) {
                        const chosenSub = data.substitutes[0];
                        newPendingChanges.push({
                            period: period.period_number,
                            class: period.class_name,
                            day: selectedDay,
                            teacherId: chosenSub.id,
                            teacherName: chosenSub.name,
                            originalTeacherId: absentId,
                            originalTeacherName: absentTeacher.name,
                        });
                        changesCount++;
                    }
                } catch (err) {
                    console.warn('Failed to find substitute for period', period.period_number);
                }
            }
        }

        if (changesCount > 0) {
            setPendingChanges(newPendingChanges);
            setLastResult({ suggestion: `Morning Setup found ${changesCount} optimal substitutions for absent teachers.` });
            setIsMorningSetupOpen(false);
            setAbsentTeacherIds([]);
            toast.success("Morning Setup Complete", { description: "Review pending changes and click Apply to confirm" });
        } else {
            toast.info("No available substitutions found for these periods within workload limits.");
        }
    };

    if (!hasMounted) return (
        <div className="min-h-screen bg-background p-8 flex items-center justify-center">
            <div className="animate-pulse flex flex-col items-center">
                <div className="h-4 w-32 bg-secondary rounded mb-4"></div>
                <div className="h-8 w-64 bg-secondary rounded"></div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-background p-8 font-sans">
            <Toaster position="top-right" richColors />
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-5xl font-extrabold text-foreground tracking-tight">
                        Anti-Gravity <span className="text-primary">Admin</span>
                    </h1>
                    <p className="text-muted-foreground font-medium mt-1">AI-powered school scheduling • 8 periods/day</p>
                </div>
                <div className="flex gap-3 flex-wrap">
                    {/* Action buttons (same as before but more compact) */}
                    <div className="flex bg-secondary/30 p-1.5 rounded-2xl backdrop-blur-md border border-secondary/50 gap-1">
                        <Link href="/admin/notifications">
                            <Button variant="ghost" className="rounded-xl relative h-10 w-10 p-0" size="icon">
                                <Bell className="h-5 w-5" />
                                {unreadNotifCount > 0 && <span className="absolute top-1 right-1 bg-primary w-2 h-2 rounded-full" />}
                            </Button>
                        </Link>
                        <Link href="/admin/rules">
                            <Button variant="ghost" className="rounded-xl h-10 w-10 p-0" title="Rules">
                                <Settings2 className="h-5 w-5" />
                            </Button>
                        </Link>
                        <Link href="/admin/import">
                            <Button variant="ghost" className="rounded-xl h-10 w-10 p-0" title="Import">
                                <FileSpreadsheet className="h-5 w-5" />
                            </Button>
                        </Link>
                    </div>

                    <Dialog open={isMorningSetupOpen} onOpenChange={setIsMorningSetupOpen}>
                        <DialogTrigger asChild>
                            <Button className="rounded-2xl h-12 px-6 bg-orange-500 text-white hover:bg-orange-600 border-none shadow-lg shadow-orange-500/20 transition-all active:scale-95">
                                <Sunrise className="mr-2 h-5 w-5" /> Morning Setup
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="rounded-[2.5rem] border-none shadow-2xl backdrop-blur-xl bg-white/90 sm:max-w-[450px]">
                            {/* Dialog content (maintained logic) */}
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2 text-2xl font-bold text-orange-600">
                                    <Sunrise className="h-6 w-6" /> Morning Absence Setup
                                </DialogTitle>
                                <DialogDescription className="text-base">
                                    Select teachers who are absent today to auto-generate substitutions.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="py-4 space-y-4">
                                <div className="max-h-64 overflow-y-auto space-y-2 pr-2 border rounded-3xl p-4 bg-secondary/20 border-white/40">
                                    {teachers.map(t => (
                                        <div key={t.id} className="flex items-center space-x-3 bg-white/50 p-3 rounded-2xl hover:bg-white transition-colors cursor-pointer group">
                                            <input
                                                type="checkbox"
                                                id={`absent-${t.id}`}
                                                className="rounded-lg text-primary focus:ring-primary w-5 h-5 cursor-pointer accent-primary"
                                                checked={absentTeacherIds.includes(t.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) setAbsentTeacherIds([...absentTeacherIds, t.id]);
                                                    else setAbsentTeacherIds(absentTeacherIds.filter(id => id !== t.id));
                                                }}
                                            />
                                            <label htmlFor={`absent-${t.id}`} className="text-sm font-semibold cursor-pointer flex-1 select-none group-hover:text-primary transition-colors">
                                                {t.name} <span className="text-[10px] bg-secondary px-2 py-0.5 rounded-full text-muted-foreground ml-1">{t.wing}</span>
                                            </label>
                                        </div>
                                    ))}
                                </div>
                                <Button onClick={handleMorningAutoFill} className="w-full h-14 rounded-2xl bg-primary text-lg font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all">
                                    <Users className="mr-2 h-6 w-6" /> Auto-Fill Substitutions
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                    
                    <Button 
                        variant="default" 
                        size="lg"
                        className="rounded-2xl h-12 px-6 bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/20 active:scale-95 transition-all text-white font-bold"
                    >
                        <ShieldAlert className="mr-2 h-5 w-5" /> Emergency
                    </Button>
                </div>
            </header>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                <Card className="rounded-[2rem] border-none shadow-soft bg-gradient-to-br from-blue-50 to-white overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
                    <CardContent className="p-6 relative">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-semibold text-blue-600 mb-1">Live Substitutions</p>
                                <h3 className="text-3xl font-black text-slate-800">4 <span className="text-sm font-medium text-slate-500">/ 12</span></h3>
                            </div>
                            <div className="bg-blue-100 p-3 rounded-2xl text-blue-600 group-hover:animate-pulse">
                                <Activity className="h-5 w-5" />
                            </div>
                        </div>
                        <div className="mt-4 flex items-center gap-2">
                             <span className="text-[10px] font-bold py-0.5 px-2 rounded-full bg-green-100 text-green-700">+2 today</span>
                             <span className="text-[10px] text-muted-foreground">33% coverage</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-[2rem] border-none shadow-soft bg-gradient-to-br from-emerald-50 to-white overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-semibold text-emerald-600 mb-1">Fairness Index</p>
                                <h3 className="text-3xl font-black text-slate-800">92%</h3>
                            </div>
                            <div className="bg-emerald-100 p-3 rounded-2xl text-emerald-600">
                                <TrendIcon className="h-5 w-5" />
                            </div>
                        </div>
                        <div className="mt-4 flex items-center gap-2">
                             <div className="flex-1 h-1.5 bg-emerald-100 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 w-[92%]" />
                             </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-[2rem] border-none shadow-soft bg-gradient-to-br from-amber-50 to-white overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-semibold text-amber-600 mb-1">Pending Gaps</p>
                                <h3 className="text-3xl font-black text-slate-800">2</h3>
                            </div>
                            <div className="bg-amber-100 p-3 rounded-2xl text-amber-600">
                                <AlertCircle className="h-5 w-5" />
                            </div>
                        </div>
                        <p className="mt-4 text-[10px] font-medium text-amber-700">P4 (Maths) and P7 (Physics) need attention</p>
                    </CardContent>
                </Card>

                <Card className="rounded-[2rem] border-none shadow-soft bg-indigo-600 text-white overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-semibold text-indigo-100 mb-1">Teacher Morale</p>
                                <h3 className="text-3xl font-black">High</h3>
                            </div>
                            <div className="bg-white/20 p-3 rounded-2xl text-white">
                                <Sparkles className="h-5 w-5" />
                            </div>
                        </div>
                        <p className="mt-4 text-[10px] font-medium text-indigo-200">Anti-burnout rules applied to all 42 teachers</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Left Column */}
                <div className="space-y-6">
                    <Card className="rounded-2xl border-none shadow-soft overflow-hidden">
                        <div className="bg-primary p-4 text-primary-foreground flex justify-between items-center">
                            <span className="font-semibold">Active Rules</span>
                            <Link href="/admin/rules">
                                <Badge variant="secondary" className="bg-white/20 text-white border-none cursor-pointer hover:bg-white/30 transition-colors">Edit</Badge>
                            </Link>
                        </div>
                        <CardContent className="pt-4">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-muted-foreground">🔥 Anti-Burnout Limit</span>
                                    <Badge variant="outline" className="text-[10px] border-destructive/50 text-destructive">{rules.maxConsecutivePeriods} periods</Badge>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-muted-foreground">☕ Teacher Break</span>
                                    <Badge variant="outline" className="text-[10px]">{rules.dayTeacherBreaks}/day</Badge>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-muted-foreground">🔔 School Break</span>
                                    <Badge variant="outline" className="text-[10px]">Period {rules.schoolBreakPeriod}</Badge>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-muted-foreground">📉 Min/Max Periods</span>
                                    <Badge variant="outline" className="text-[10px] text-primary">{rules.minDailyPeriods}–{rules.maxDailyPeriods}/day</Badge>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-muted-foreground">⚖️ Fairness Index</span>
                                    <Badge variant="outline" className={`text-[10px] ${rules.fairnessIndexEnabled ? 'text-green-600 border-green-400/50' : 'text-muted-foreground'}`}>{rules.fairnessIndexEnabled ? 'On' : 'Off'}</Badge>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-muted-foreground">🌸 Blossom Guard</span>
                                    <Badge variant="outline" className={`text-[10px] ${rules.blossomSupervisionAlways ? 'text-pink-600 border-pink-400/50' : 'text-muted-foreground'}`}>{rules.blossomSupervisionAlways ? 'Always' : 'Off'}</Badge>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-muted-foreground">🤖 AI Model</span>
                                    <select
                                        value={selectedModel}
                                        onChange={e => setSelectedModel(e.target.value)}
                                        className="text-[10px] bg-secondary/50 border-none rounded-lg px-2 py-0.5 text-foreground max-w-[100px] truncate"
                                    >
                                        {AVAILABLE_MODELS.map(m => (
                                            <option key={m.id} value={m.id}>{m.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="rounded-2xl border-none shadow-soft">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center"><Zap className="mr-2 h-4 w-4 text-primary" /> The Commander</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Type a command..."
                                    className="rounded-xl bg-secondary/50 border-none"
                                    value={command}
                                    onChange={(e) => setCommand(e.target.value)}
                                    disabled={isLoading}
                                    onKeyDown={(e) => e.key === 'Enter' && handleCommand()}
                                />
                                <Button
                                    size="icon"
                                    className="rounded-xl bg-primary min-w-[40px]"
                                    onClick={handleCommand}
                                    disabled={isLoading}
                                >
                                    {isLoading ? <div className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" /> : <Send className="h-4 w-4" />}
                                </Button>
                            </div>
                            {lastResult && (
                                <div className="mt-4 p-3 bg-sage-50 rounded-xl border border-sage-200">
                                    <p className="text-[10px] font-bold text-sage-600 uppercase tracking-wider mb-1">AI Suggestion</p>
                                    <p className="text-xs text-foreground">{lastResult.suggestion || lastResult.error}</p>

                                    {pendingChanges.length > 0 && (
                                        <div className="mt-3 space-y-2">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase">Pending Changes</p>
                                            <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                                                {pendingChanges.map((change, idx) => (
                                                    <div key={idx} className="text-[10px] bg-white p-1.5 rounded-lg border border-secondary/50 flex justify-between items-center">
                                                        <span>P{change.period}: {change.class}</span>
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-primary font-bold">→ {teachers.find(t => t.id === change.teacherId)?.name || change.teacherId}</span>
                                                            <span className="text-[8px] text-muted-foreground italic line-through">
                                                                {teachers.find(t => t.id === change.originalTeacherId)?.name}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                            <Button
                                                onClick={applyPendingChanges}
                                                className="w-full h-8 rounded-lg bg-primary text-[10px] font-bold mt-2"
                                            >
                                                Apply All Changes
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Grid Column */}
                <div className="lg:col-span-3 space-y-6">
                    <Tabs defaultValue="grid" className="w-full">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                            <TabsList className="bg-secondary p-1 rounded-xl">
                                <TabsTrigger value="grid" className="rounded-lg px-6 data-[state=active]:bg-white">Live Grid</TabsTrigger>
                                <TabsTrigger value="fairness" className="rounded-lg px-6 data-[state=active]:bg-white">Fairness View</TabsTrigger>
                            </TabsList>

                            <div className="flex items-center gap-3">
                                <Button
                                    onClick={handleAutoGenerate}
                                    variant="outline"
                                    size="sm"
                                    className="rounded-xl border-primary/30 text-primary hover:bg-primary/5 hidden md:flex items-center gap-2"
                                >
                                    <Sparkles className="h-3.5 w-3.5" /> AI Optimize {selectedDay}
                                </Button>
                                <div className="h-6 w-px bg-secondary mx-1 hidden md:block" />
                                <div className="flex gap-1.5">
                                    {(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const).map(day => (
                                        <Button
                                            key={day}
                                            variant={selectedDay === day ? 'default' : 'ghost'}
                                            size="sm"
                                            className={`rounded-lg px-3 ${selectedDay === day ? 'bg-primary' : 'text-muted-foreground'}`}
                                            onClick={() => setSelectedDay(day)}
                                        >
                                            {day}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        </div>

<TabsContent value="grid" className="m-0">
                            <Card className="rounded-3xl border-none shadow-soft overflow-hidden">
                                <div className="overflow-x-auto">
                                    <DndContext id="admin-timetable-context" onDragEnd={handleDragEnd}>
                                        <table className="w-full text-left border-collapse min-w-[800px]">
                                            <thead>
                                                <tr className="bg-secondary/30">
                                                    <th className="px-6 py-4 text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b border-secondary">Teacher</th>
                                                    <th className="px-4 py-4 text-sm font-semibold uppercase tracking-wider border-b border-secondary text-center text-muted-foreground">P1</th>
                                                    <th className="px-4 py-4 text-sm font-semibold uppercase tracking-wider border-b border-secondary text-center text-muted-foreground">P2</th>
                                                    <th className="px-4 py-4 text-sm font-semibold uppercase tracking-wider border-b border-secondary text-center text-muted-foreground">P3</th>
                                                    <th className="px-4 py-4 text-sm font-semibold uppercase tracking-wider border-b border-secondary text-center text-orange-600 bg-orange-50">🍽️ LUNCH</th>
                                                    <th className="px-4 py-4 text-sm font-semibold uppercase tracking-wider border-b border-secondary text-center text-muted-foreground">P4</th>
                                                    <th className="px-4 py-4 text-sm font-semibold uppercase tracking-wider border-b border-secondary text-center text-muted-foreground">P5</th>
                                                    <th className="px-4 py-4 text-sm font-semibold uppercase tracking-wider border-b border-secondary text-center text-muted-foreground">P6</th>
                                                    <th className="px-4 py-4 text-sm font-semibold uppercase tracking-wider border-b border-secondary text-center text-muted-foreground">P7</th>
                                                    <th className="px-4 py-4 text-sm font-semibold uppercase tracking-wider border-b border-secondary text-center text-muted-foreground">P8</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-secondary/20">
                                                {teachers.map(teacher => {
                                                    const teacherPeriods = timetable.filter(
                                                        (p) => p.teacher_id === teacher.id && (p.day === selectedDay || p.day_of_week === ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(selectedDay))
                                                    );

                                                    const schedule = [...Array(8)].map((_, i) => {
                                                        const p = teacherPeriods.find((entry: TimetableEntry) => entry.period_number === i + 1);
                                                        return {
                                                            pId: p?.id,
                                                            subject: p?.subject || 'Free Period',
                                                            class_name: p?.class_name,
                                                            day: selectedDay,
                                                            isBreak: false,
                                                        };
                                                    });

                                                    return (
                                                        <tr key={teacher.id} className="hover:bg-secondary/10 transition-colors">
                                                            <td className="px-6 py-4 border-b border-secondary/20">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="font-medium text-foreground">{teacher.name}</div>
                                                                    <Badge variant="outline" className={`text-[9px] px-1 h-4 rounded-md border-none ${teacher.wing === 'Blossom' ? 'bg-pink-100 text-pink-700' :
                                                                        teacher.wing === 'Scholar' ? 'bg-blue-100 text-blue-700' :
                                                                            'bg-purple-100 text-purple-700'
                                                                        }`}>
                                                                        {(teacher.wing || 'Scholar').charAt(0)}
                                                                    </Badge>
                                                                </div>
                                                                <div className="flex items-center gap-2 mt-0.5">
                                                                    <div className="text-[10px] text-muted-foreground">Index: <span className="font-bold text-primary">{teacher.workload_score || 0}</span></div>
                                                                    <div className="h-1 w-1 bg-secondary rounded-full" />
                                                                    <div className="text-[10px] text-muted-foreground">{teacher.wing || 'Scholar'}</div>
                                                                </div>
                                                            </td>
                                                            {/* P1, P2, P3 */}
                                                            {schedule.slice(0, 3).map((p, i) => {
                                                                const periodNum = i + 1;
                                                                const isForbidden = isForbiddenZone(teacher, selectedDay, periodNum, timetable, rules);
                                                                const hasClass = p.class_name && p.class_name !== 'Free Period' && p.class_name !== 'Break' && p.class_name !== 'Lunch' && p.class_name !== 'Rest';

                                                                return (
                                                                    <DroppablePeriodCell
                                                                        key={i}
                                                                        teacherId={teacher.id}
                                                                        periodIndex={periodNum}
                                                                        day={selectedDay}
                                                                        isForbidden={isForbidden}
                                                                    >
                                                                        {hasClass ? (
                                                                            <Dialog>
                                                                                <DialogTrigger asChild>
                                                                                    <div className="w-full">
                                                                                        <DraggableClassCard
                                                                                            p={p}
                                                                                            i={i}
                                                                                            teacher={teacher}
                                                                                            isConsecutive={!!(i >= 2 && schedule[i - 1].class_name && schedule[i - 2].class_name)}
                                                                                        />
                                                                                    </div>
                                                                                </DialogTrigger>
                                                                                <SubstitutionDialogContent 
                                                                                    teacher={teacher}
                                                                                    selectedDay={selectedDay}
                                                                                    periodIndex={i}
                                                                                    teachers={teachers}
                                                                                    timetable={timetable}
                                                                                />
                                                                            </Dialog>
                                                                        ) : (
                                                                            <div className="h-10 w-full rounded-xl flex items-center justify-center bg-secondary/20 text-[9px] text-muted-foreground italic">
                                                                                {p.subject}
                                                                            </div>
                                                                        )}
                                                                    </DroppablePeriodCell>
                                                                );
                                                            })}
                                                            {/* LUNCH BREAK */}
                                                            <td className="px-2 py-4 border-b border-secondary/20 bg-orange-50/50">
                                                                <div className="h-10 w-full rounded-xl flex items-center justify-center bg-orange-100 text-[9px] text-orange-600 font-semibold">
                                                                    🍽️ Lunch
                                                                </div>
                                                            </td>
                                                            {/* P4, P5, P6, P7, P8 */}
                                                            {schedule.slice(3, 8).map((p, i) => {
                                                                const periodNum = i + 4; // 4, 5, 6, 7, 8
                                                                const isForbidden = isForbiddenZone(teacher, selectedDay, periodNum, timetable, rules);
                                                                const hasClass = p.class_name && p.class_name !== 'Free Period' && p.class_name !== 'Break' && p.class_name !== 'Lunch' && p.class_name !== 'Rest';

                                                                return (
                                                                    <DroppablePeriodCell
                                                                        key={i+3}
                                                                        teacherId={teacher.id}
                                                                        periodIndex={periodNum}
                                                                        day={selectedDay}
                                                                        isForbidden={isForbidden}
                                                                    >
                                                                        {hasClass ? (
                                                                            <Dialog>
                                                                                <DialogTrigger asChild>
                                                                                    <div className="w-full">
                                                                                        <DraggableClassCard
                                                                                            p={p}
                                                                                            i={i+3}
                                                                                            teacher={teacher}
                                                                                            isConsecutive={!!(i >= 2 && schedule[i + 2].class_name && schedule[i + 1].class_name)}
                                                                                        />
                                                                                    </div>
                                                                                </DialogTrigger>
                                                                                <SubstitutionDialogContent 
                                                                                    teacher={teacher}
                                                                                    selectedDay={selectedDay}
                                                                                    periodIndex={i+3}
                                                                                    teachers={teachers}
                                                                                    timetable={timetable}
                                                                                />
                                                                            </Dialog>
                                                                        ) : (
                                                                            <div className="h-10 w-full rounded-xl flex items-center justify-center bg-secondary/20 text-[9px] text-muted-foreground italic">{p.subject}
                                                                                {p.subject}
                                                                            </div>
                                                                        )}
                                                                    </DroppablePeriodCell>
                                                                );
                                                            })}
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </DndContext>
                                </div>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </div>
    );
}

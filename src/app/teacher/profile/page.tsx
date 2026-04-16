'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { User, Calendar, MessageSquare, Link as LinkIcon, CheckCircle, AlertCircle, CalendarMinus } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import SubstitutionCard from '@/components/SubstitutionCard';
import { Teacher, TimetableEntry, SubstitutionRequest } from '@/types/database';
import { createClient } from '@/utils/supabase/client';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

export default function TeacherProfilePage() {
    const router = useRouter();
    
    const [teacher, setTeacher] = useState<Teacher | null>(null);
    const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
    const [substitutions, setSubstitutions] = useState<SubstitutionRequest[]>([]);
    const [selectedDay, setSelectedDay] = useState<'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri'>('Mon');
    const [employeeId, setEmployeeId] = useState('');
    const [isLinking, setIsLinking] = useState(false);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    const [isAbsenceModalOpen, setIsAbsenceModalOpen] = useState(false);
    const [absencePeriodSelect, setAbsencePeriodSelect] = useState<number>(-1);
    const [isSubmittingAbsence, setIsSubmittingAbsence] = useState(false);

    useEffect(() => {
        fetchTeacherData();
    }, [selectedDay]);

    const fetchTeacherData = async () => {
        setIsLoading(true);
        try {
            // Check localStorage for authentication
            const isAuthenticated = localStorage.getItem('isAuthenticated');
            const userType = localStorage.getItem('userType');
            const currentUserStr = localStorage.getItem('currentUser');

            if (!isAuthenticated || userType !== 'teacher' || !currentUserStr) {
                router.push('/login');
                return;
            }

            const currentUser = JSON.parse(currentUserStr);
            setTeacher(currentUser);

            // Fetch timetable from API
            const response = await fetch(`/api/timetable?teacherId=${currentUser.id}&day=${selectedDay}`);
            console.log('Timetable API response:', response.status);
            if (response.ok) {
                const data = await response.json();
                console.log('Timetable data:', data);
                setTimetable(data.timetable || []);
            } else {
                console.error('Failed to fetch timetable:', await response.text());
            }

            // Fetch substitutions from API
            const subsResponse = await fetch(`/api/substitutions?teacherId=${currentUser.id}`);
            if (subsResponse.ok) {
                const subsData = await subsResponse.json();
                setSubstitutions(subsData.substitutions || []);
            }

        } catch (error) {
            console.error('Error fetching teacher data:', error);
            toast.error('Failed to load profile data');
        } finally {
            setIsLoading(false);
        }
    };

    const handleLinkTelegram = async () => {
        setIsLinking(true);
        // Link logic here (edge function or update query)
        toast.success('Telegram linking available soon via bot interface.');
        setIsLinking(false);
    };

    const handleReportAbsence = async () => {
        if (!teacher) return;
        if (absencePeriodSelect === -1) {
            toast.error("Please select a specific period to miss");
            return;
        }

        const periodTarget = timetable.find(t => t.period_number === absencePeriodSelect);
        if (!periodTarget) {
            toast.error("No class scheduled for that period anyway");
            return;
        }

        setIsSubmittingAbsence(true);
        try {
            const response = await fetch('/api/substitutions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    teacherId: teacher.id,
                    periodId: periodTarget.id,
                    day: selectedDay,
                    periodNumber: absencePeriodSelect
                })
            });

            if (!response.ok) throw new Error('Failed to submit');

            toast.success("Absence reported. Sent to Admin for review.");
            setIsAbsenceModalOpen(false);
        } catch (err: any) {
            toast.error("Failed to report absence", { description: err.message });
        } finally {
            setIsSubmittingAbsence(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background p-8 flex items-center justify-center">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background p-8 font-sans">
            <Toaster position="top-right" richColors />

            <header className="mb-8 flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-bold text-foreground">
                        Teacher <span className="text-primary">Profile</span>
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        View your live schedule and manage requests.
                    </p>
                </div>
                <Dialog open={isAbsenceModalOpen} onOpenChange={setIsAbsenceModalOpen}>
                    <DialogTrigger asChild>
                        <Button variant="destructive" className="rounded-xl font-bold shadow-soft">
                            <CalendarMinus className="mr-2 h-4 w-4" /> Report Absence
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="rounded-3xl p-6 border-none shadow-2xl">
                        <DialogHeader>
                            <DialogTitle className="text-destructive flex items-center">
                                <AlertCircle className="w-5 h-5 mr-2" /> Request Cover
                            </DialogTitle>
                            <DialogDescription>
                                Mark yourself as absent for a specific period on {selectedDay}. This will queue for Admin approval.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div>
                                <label className="text-sm font-semibold text-muted-foreground mb-2 block">Select Period</label>
                                <select 
                                    className="w-full bg-secondary/20 p-3 rounded-xl border-none outline-none focus:ring-2 ring-primary"
                                    value={absencePeriodSelect}
                                    onChange={(e) => setAbsencePeriodSelect(parseInt(e.target.value))}
                                >
                                    <option value={-1}>-- Choose Class --</option>
                                    {timetable.map(p => (
                                        <option key={p.id} value={p.period_number}>
                                            Period {p.period_number} - {p.class_name || p.subject}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <Button 
                                className="w-full rounded-xl" 
                                variant="destructive"
                                onClick={handleReportAbsence}
                                disabled={isSubmittingAbsence || absencePeriodSelect === -1}
                            >
                                {isSubmittingAbsence ? "Submitting..." : "Submit Absence Ticket"}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column - Profile Info */}
                <div className="space-y-6">
                    <Card className="rounded-2xl border-none shadow-soft">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <User className="h-5 w-5 text-primary" />
                                My Profile
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <p className="text-sm font-semibold text-muted-foreground">Name</p>
                                <p className="text-lg font-bold">{teacher?.name}</p>
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-muted-foreground">Wing</p>
                                <Badge className={`${teacher?.wing === 'Blossom' ? 'bg-pink-100 text-pink-700' :
                                        teacher?.wing === 'Scholar' ? 'bg-blue-100 text-blue-700' :
                                            'bg-purple-100 text-purple-700'
                                    }`}>
                                    {teacher?.wing || 'Assigned'}
                                </Badge>
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-muted-foreground">Workload Index</p>
                                <p className="text-lg font-bold">{teacher?.workload_score || 0}</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column - Schedule */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="rounded-2xl border-none shadow-soft">
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle className="flex items-center gap-2">
                                    <Calendar className="h-5 w-5 text-primary" />
                                    Live Schedule
                                </CardTitle>
                                <div className="flex gap-1.5 bg-secondary/10 p-1 rounded-xl">
                                    {(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const).map(day => (
                                        <Button
                                            key={day}
                                            variant={selectedDay === day ? 'default' : 'ghost'}
                                            size="sm"
                                            className={`rounded-lg px-3 ${selectedDay === day ? 'bg-primary' : 'text-muted-foreground hover:bg-white/50'}`}
                                            onClick={() => setSelectedDay(day)}
                                        >
                                            {day}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {timetable.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    <p>No classes scheduled for {selectedDay}</p>
                                    <p className="text-sm mt-2">Loading timetable data...</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {[0, 1, 2, 3, 4, 5, 6, 7].map((periodNum) => {
                                        const period = timetable.find(t => t.period_number === periodNum);
                                        const isFree = !period || period.subject === 'Rest';

                                        return (
                                            <div
                                                key={periodNum}
                                                className={`p-4 rounded-2xl flex items-center justify-between border ${isFree
                                                        ? 'bg-sage-50 border-sage-100/50'
                                                        : 'bg-white border-secondary/30 shadow-sm'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg ${isFree ? 'bg-sage-100 text-sage-600' : 'bg-primary/10 text-primary'}`}>
                                                        P{periodNum}
                                                    </div>
                                                    <div>
                                                        <p className="text-base font-bold text-foreground">
                                                            {isFree ? 'Free Period / Prep' : period.subject}
                                                        </p>
                                                        {!isFree && (
                                                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                                                Class: <span className="font-semibold">{period.class_name}</span>
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

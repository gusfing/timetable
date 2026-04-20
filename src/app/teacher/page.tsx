'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { toast, Toaster } from 'sonner';
import {
  Calendar, Bell, Clock, CheckCircle, XCircle, BookOpen,
  User, Sunrise, Coffee, ChevronLeft, ChevronRight, RefreshCw, LogOut
} from 'lucide-react';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const PERIOD_TIMES: Record<number, string> = {
  1: '8:00-8:45',
  2: '8:45-9:30',
  3: '9:30-10:15',
  4: '10:15-11:00',
  5: '11:00-11:30',  // Break
  6: '11:30-12:15',
  7: '12:15-1:00',
  8: '1:00-1:45',
};

const PERIOD_COLORS: Record<string, string> = {
  teaching: 'from-blue-500/20 to-indigo-500/10 border-blue-500/30',
  break: 'from-green-500/20 to-emerald-500/10 border-green-500/30',
  rest: 'from-amber-500/20 to-yellow-500/10 border-amber-500/30',
  prep: 'from-purple-500/20 to-violet-500/10 border-purple-500/30',
  lunch: 'from-orange-500/20 to-amber-500/10 border-orange-500/30',
  free: 'from-white/5 to-white/3 border-white/10',
};

export default function TeacherPortal() {
  const supabase = createClient();
  const [teacher, setTeacher] = useState<any>(null);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [substitutions, setSubstitutions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<string>(() => {
    const today = new Date().getDay();
    return DAY_LABELS[today] || 'Mon';
  });

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const hasDemoSession = document.cookie.includes('demo_session');
        
        if (!session && !hasDemoSession) { 
          window.location.href = '/login'; 
          return; 
        }

        const userId = session?.user?.id || '00000000-0000-0000-0000-000000000002';
        const userEmail = session?.user?.email || 'teacher1@demo.school';

        // Get teacher profile
        const { data: teacherData } = await supabase
          .from('teachers')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        // Fallback: search by email
        if (!teacherData) {
          const { data: teacherByEmail } = await supabase
            .from('teachers')
            .select('*')
            .eq('employee_id', session?.user?.email)
            .maybeSingle();
          if (teacherByEmail) setTeacher(teacherByEmail);
        } else {
          setTeacher(teacherData);
        }

        const tId = teacherData?.id || userId;

        // Get today's schedule
        const dayOfWeek = DAY_LABELS.indexOf(selectedDay);
        const { data: scheduleData } = await supabase
          .from('periods')
          .select('*, classes(name), rooms(name)')
          .eq('teacher_id', tId)
          .eq('day_of_week', dayOfWeek)
          .order('period_number');

        setSchedule(scheduleData || []);

        // Get notifications
        const notifRes = await fetch(`/api/notifications?teacherId=${tId}&limit=20`);
        const notifData = await notifRes.json();
        setNotifications(notifData.notifications || []);

        // Get pending substitution requests for this teacher
        const { data: subData } = await supabase
          .from('substitution_requests')
          .select('*, periods(period_number, day_of_week, classes(name))')
          .eq('assigned_teacher_id', tId)
          .in('status', ['pending', 'assigned'])
          .order('created_at', { ascending: false });

        setSubstitutions(subData || []);
      } catch (err: any) {
        toast.error('Failed to load schedule');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [selectedDay]);

  const respondToSubstitution = async (subId: string, accept: boolean) => {
    try {
      const { error } = await supabase
        .from('substitution_requests')
        .update({ status: accept ? 'accepted' : 'declined' })
        .eq('id', subId);

      if (error) throw error;
      setSubstitutions(prev => prev.filter(s => s.id !== subId));
      toast.success(accept ? 'Substitution accepted' : 'Substitution declined');
    } catch (err: any) {
      toast.error(err.message || 'Failed to respond');
    }
  };

  // Build 8-period schedule
  const fullSchedule = Array.from({ length: 8 }, (_, i) => {
    const p = schedule.find(s => s.period_number === i + 1);
    return p ? { ...p, class_name: p.classes?.name || p.subject } : null;
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/60">Loading your schedule...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/30 to-slate-900 font-sans pb-16">
      <Toaster position="top-right" richColors />

      {/* Header */}
      <div className="bg-gradient-to-r from-purple-900/80 to-indigo-900/80 backdrop-blur border-b border-white/10 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center">
              <User className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-white">{teacher?.name || 'Teacher'}</div>
              <div className="text-xs text-white/50">{teacher?.wing || 'Scholar'} Wing • {teacher?.subjects?.join(', ') || 'All Subjects'}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative p-2 text-white/60 hover:text-white transition-colors rounded-lg hover:bg-white/10">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>
            <button
              onClick={() => supabase.auth.signOut().then(() => window.location.href = '/login')}
              className="p-2 text-white/60 hover:text-white transition-colors rounded-lg hover:bg-white/10"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 pt-8 space-y-6">

        {/* Pending Substitutions Alert */}
        {substitutions.length > 0 && (
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <RefreshCw className="h-4 w-4 text-orange-400 animate-spin" />
              <span className="font-semibold text-orange-300 text-sm">
                {substitutions.length} Pending Substitution Request{substitutions.length > 1 ? 's' : ''}
              </span>
            </div>
            <div className="space-y-3">
              {substitutions.map(sub => {
                const period = sub.periods;
                const dayName = period ? DAY_LABELS[period.day_of_week] : '?';
                const className = period?.classes?.name || 'Unknown Class';
                const periodNum = period?.period_number || '?';
                return (
                  <div key={sub.id} className="flex items-center justify-between gap-4 bg-white/5 rounded-xl p-3">
                    <div>
                      <p className="text-white text-sm font-medium">{className}</p>
                      <p className="text-white/50 text-xs">{dayName} — Period {periodNum} ({PERIOD_TIMES[periodNum as number] || ''})</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => respondToSubstitution(sub.id, true)}
                        className="flex items-center gap-1 bg-green-500/20 text-green-400 border border-green-500/30 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-green-500/30 transition-colors"
                      >
                        <CheckCircle className="h-3.5 w-3.5" /> Accept
                      </button>
                      <button
                        onClick={() => respondToSubstitution(sub.id, false)}
                        className="flex items-center gap-1 bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-red-500/20 transition-colors"
                      >
                        <XCircle className="h-3.5 w-3.5" /> Decline
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Day Selector */}
        <div>
          <div className="flex items-center gap-3 mb-4">
            <Calendar className="h-5 w-5 text-purple-400" />
            <h2 className="text-lg font-bold text-white">My Schedule</h2>
          </div>
          <div className="flex gap-2">
            {(['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const).map(day => {
              const isToday = DAY_LABELS[new Date().getDay()] === day;
              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    selectedDay === day
                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30'
                      : isToday
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                      : 'text-white/40 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {day}
                  {isToday && <span className="block text-[9px] opacity-70">Today</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* 8-Period Schedule */}
        <div className="space-y-2">
          {fullSchedule.map((period, idx) => {
            const periodNum = idx + 1;
            const time = PERIOD_TIMES[periodNum];
            const isBreak = period?.period_type === 'break' || period?.period_type === 'lunch' || (!period && periodNum === 5);
            const isFree = !period;
            const type = period?.period_type || (isBreak ? 'break' : 'free');
            const gradient = PERIOD_COLORS[type] || PERIOD_COLORS.free;

            return (
              <div key={periodNum} className={`flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r border ${gradient} transition-all`}>
                <div className="w-10 text-center shrink-0">
                  <div className="text-lg font-black text-white/80">P{periodNum}</div>
                  <div className="text-[9px] text-white/30 leading-tight">{time}</div>
                </div>
                <div className="w-px h-10 bg-white/20 shrink-0" />
                <div className="flex-1">
                  {period ? (
                    <>
                      <div className="font-semibold text-white">{period.class_name || period.subject}</div>
                      <div className="text-xs text-white/40">
                        {period.period_type === 'teaching' ? `${period.subject || ''}` : period.period_type}
                        {period.rooms?.name && ` • Room ${period.rooms.name}`}
                        {period.is_substitution && ' • 🔄 Substitution'}
                      </div>
                    </>
                  ) : (
                    <div className="text-white/30 text-sm italic">
                      {periodNum === 5 ? '🔔 School Break' : 'Free Period'}
                    </div>
                  )}
                </div>
                {type === 'teaching' && (
                  <BookOpen className="h-4 w-4 text-blue-400 shrink-0" />
                )}
                {(type === 'break' || type === 'lunch' || periodNum === 5) && (
                  <Coffee className="h-4 w-4 text-green-400 shrink-0" />
                )}
              </div>
            );
          })}
        </div>

        {/* Notifications Section */}
        {notifications.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Bell className="h-4 w-4 text-purple-400" />
              <h3 className="font-semibold text-white">Recent Notifications</h3>
            </div>
            <div className="space-y-2">
              {notifications.slice(0, 5).map(n => (
                <div key={n.id} className={`p-3 rounded-xl border text-sm transition-all ${
                  n.is_read ? 'bg-white/3 border-white/5 opacity-50' : 'bg-white/7 border-white/15'
                }`}>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white">{n.title}</span>
                    {!n.is_read && <div className="w-1.5 h-1.5 bg-purple-400 rounded-full" />}
                  </div>
                  <p className="text-white/40 text-xs mt-0.5">{n.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

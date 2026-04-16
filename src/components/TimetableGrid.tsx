'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DndContext, useDraggable, useDroppable, DragEndEvent } from '@dnd-kit/core';
import { UserPlus, AlertCircle } from 'lucide-react';
import { Teacher, TimetableEntry } from '@/types/database';
import { findTopSubstitutes } from '@/lib/scheduler/engine';
import { isForbiddenZone } from '@/lib/scheduler/validator';

interface TimetableGridProps {
  teachers: Teacher[];
  timetable: TimetableEntry[];
  selectedDay: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri';
  onDragEnd?: (event: DragEndEvent) => void;
  editable?: boolean;
}

// Draggable Class Card Component
function DraggableClassCard({ p, i, teacher, isConsecutive, editable }: { 
  p: any, 
  i: number, 
  teacher: Teacher, 
  isConsecutive: boolean,
  editable?: boolean 
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `draggable-${teacher.id}-${i}-${p.day}`,
    data: { p, teacher, periodNumber: i },
    disabled: !editable
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
      {...(editable ? listeners : {})}
      {...(editable ? attributes : {})}
      className={`p-2 rounded-xl text-center shadow-card bg-white border border-secondary/30 ${editable ? 'cursor-grab active:cursor-grabbing' : ''} hover:ring-2 hover:ring-primary/30 transition-shadow relative ${isDragging ? 'opacity-50 ring-2 ring-primary' : ''} ${isConsecutive ? 'ring-2 ring-accent/30' : ''}`}
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
  isForbidden,
  editable
}: {
  teacherId: string,
  periodIndex: number,
  day: string,
  children: React.ReactNode,
  isForbidden: boolean,
  editable?: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `droppable-${teacherId}-${periodIndex}-${day}`,
    data: { teacherId, periodIndex, day },
    disabled: !editable
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

export default function TimetableGrid({ 
  teachers, 
  timetable, 
  selectedDay, 
  onDragEnd,
  editable = false 
}: TimetableGridProps) {
  return (
    <div className="overflow-x-auto">
      <DndContext id="timetable-grid-context" onDragEnd={onDragEnd}>
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-secondary/30">
              <th className="px-6 py-4 text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b border-secondary">Teacher</th>
              {[...Array(8)].map((_, i) => (
                <th key={i} className="px-6 py-4 text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b border-secondary text-center">P{i}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-secondary/20">
            {teachers.map(teacher => {
              const teacherPeriods = timetable.filter(
                (p) => p.teacher_id === teacher.id && p.day === selectedDay
              );

              const schedule = [...Array(8)].map((_, i) => {
                const p = teacherPeriods.find((entry: TimetableEntry) => entry.period_number === i);
                return {
                  pId: p?.id,
                  subject: p?.class_name === 'Break' ? 'Break' : p?.class_name === 'Lunch' ? 'Lunch' : p?.class_name || 'Free Period',
                  class: p?.class_name,
                  day: selectedDay,
                };
              });

              return (
                <tr key={teacher.id} className="hover:bg-secondary/10 transition-colors">
                  <td className="px-6 py-4 border-b border-secondary/20">
                    <div className="flex items-center gap-2">
                      <div className="font-medium text-foreground">{teacher.name}</div>
                      <Badge variant="outline" className={`text-[9px] px-1 h-4 rounded-md border-none ${
                        teacher.wing === 'Blossom' ? 'bg-pink-100 text-pink-700' :
                        teacher.wing === 'Scholar' ? 'bg-blue-100 text-blue-700' :
                        'bg-purple-100 text-purple-700'
                      }`}>
                        {(teacher.wing || 'S').charAt(0)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="h-1 w-1 bg-secondary rounded-full" />
                      <div className="text-[10px] text-muted-foreground">{teacher.wing}</div>
                    </div>
                  </td>
                  {schedule.map((p, i) => {
                    const isForbidden = isForbiddenZone(teacher, selectedDay, i, timetable);
                    const hasClass = p.class && p.class !== 'Free Period' && p.class !== 'Break' && p.class !== 'Lunch';
                    const substitutes = hasClass
                      ? findTopSubstitutes(teachers, [teacher.id], teacher.wing || 'Scholar', ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(selectedDay), i, timetable)
                      : [];

                    return (
                      <DroppablePeriodCell
                        key={i}
                        teacherId={teacher.id}
                        periodIndex={i}
                        day={selectedDay}
                        isForbidden={isForbidden}
                        editable={editable}
                      >
                        {hasClass ? (
                          <Dialog>
                            <DialogTrigger asChild>
                              <div className="w-full">
                                <DraggableClassCard
                                  p={p}
                                  i={i}
                                  teacher={teacher}
                                  isConsecutive={!!(i >= 2 && schedule[i - 1].class && schedule[i - 2].class)}
                                  editable={editable}
                                />
                              </div>
                            </DialogTrigger>
                            <DialogContent className="rounded-3xl border-none shadow-2xl sm:max-w-[425px]">
                              <DialogHeader>
                                <DialogTitle className="flex items-center gap-2 text-primary">
                                  <UserPlus className="h-5 w-5" /> Smart Substitution
                                </DialogTitle>
                                <DialogDescription>
                                  Find optimal replacements for <strong>{teacher.name}</strong> on {selectedDay}, Period {i}.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                <div className="p-3 bg-secondary/20 rounded-xl flex items-start gap-3 border border-secondary/30">
                                  <AlertCircle className="h-4 w-4 text-primary mt-0.5" />
                                  <div>
                                    <p className="text-xs font-semibold">Requirement Check</p>
                                    <p className="text-[10px] text-muted-foreground">Wing: {teacher.wing} | Period: P{i}</p>
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  {substitutes.map((sub: Teacher) => (
                                    <div key={sub.id} className="group p-3 bg-white border border-secondary/50 rounded-2xl hover:border-primary hover:shadow-soft transition-all cursor-pointer flex justify-between items-center">
                                      <div>
                                        <p className="text-sm font-bold">{sub.name}</p>
                                        <p className="text-[10px] text-muted-foreground">Workload: {sub.workload_score} periods</p>
                                      </div>
                                      <div className="bg-sage-100 text-sage-700 text-[10px] font-bold px-2 py-1 rounded-lg group-hover:bg-primary group-hover:text-white transition-colors">
                                        Assign
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        ) : (
                          <div className="h-10 w-full rounded-xl flex items-center justify-center bg-secondary/20 text-[9px] text-muted-foreground italic">
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
  );
}

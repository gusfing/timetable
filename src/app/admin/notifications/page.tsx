'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Notification } from '@/lib/notifications';
import { toast, Toaster } from 'sonner';

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    fetch('/api/notifications').then(r => r.json()).then(d => {
      if (d.notifications) setNotifications(d.notifications.reverse());
    });
  }, []);

  const markRead = async (id: string) => {
    await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    setNotifications(n => n.map(x => x.id === id ? { ...x, read: true } : x));
  };

  const typeIcon: Record<string, string> = {
    substitution_request: '📋',
    schedule_change: '📅',
    absence_confirmed: '🚫',
    general: '📢',
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <Toaster position="top-right" richColors />
      <div className="max-w-2xl mx-auto">
        <button onClick={() => router.push('/admin/dashboard')} className="text-sm text-muted-foreground mb-4 hover:underline">← Back to Dashboard</button>
        <h1 className="text-3xl font-bold mb-2">Notifications</h1>
        <p className="text-muted-foreground mb-8">{notifications.filter(n => !n.read).length} unread</p>

        {notifications.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">No notifications yet</div>
        ) : (
          <div className="space-y-3">
            {notifications.map(n => (
              <div key={n.id} className={`p-4 rounded-2xl border transition-colors ${n.read ? 'bg-card opacity-60' : 'bg-card border-primary/30'}`}>
                <div className="flex justify-between items-start gap-4">
                  <div className="flex gap-3">
                    <span className="text-2xl">{typeIcon[n.type] || '📢'}</span>
                    <div>
                      <p className="font-semibold">{n.title}</p>
                      <p className="text-sm text-muted-foreground">{n.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        To: {n.teacher_name} • {new Date(n.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  {!n.read && (
                    <button onClick={() => markRead(n.id)} className="text-xs text-primary font-semibold whitespace-nowrap">Mark read</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

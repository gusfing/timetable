export interface Notification {
  id: string;
  teacher_id: string;
  teacher_name: string;
  type: 'substitution_request' | 'schedule_change' | 'absence_confirmed' | 'general';
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  metadata?: Record<string, any>;
}

// In-memory store for demo mode (replace with Supabase in production)
const notificationStore: Notification[] = [];

export function createNotification(data: Omit<Notification, 'id' | 'created_at' | 'read'>): Notification {
  const notification: Notification = {
    ...data,
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    read: false,
    created_at: new Date().toISOString(),
  };
  notificationStore.push(notification);
  return notification;
}

export function getNotifications(teacherId?: string): Notification[] {
  if (teacherId) return notificationStore.filter(n => n.teacher_id === teacherId);
  return [...notificationStore];
}

export function markAsRead(notificationId: string): void {
  const n = notificationStore.find(n => n.id === notificationId);
  if (n) n.read = true;
}

export function getUnreadCount(teacherId: string): number {
  return notificationStore.filter(n => n.teacher_id === teacherId && !n.read).length;
}

// Send Telegram notification
export async function sendTelegramNotification(
  telegramId: string,
  message: string
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !telegramId) return false;

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: telegramId,
          text: message,
          parse_mode: 'Markdown',
        }),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

// Send substitution request notification (in-app + Telegram)
export async function notifySubstitution(
  teacher: { id: string; name: string; telegram_id: string | null },
  details: { day: string; period: number; className: string; absentTeacher: string }
): Promise<Notification> {
  const message = `📋 *Substitution Request*\n\nYou have been assigned to cover:\n📅 ${details.day}, Period ${details.period + 1}\n🏫 Class: ${details.className}\n👤 Covering for: ${details.absentTeacher}\n\nPlease confirm your availability.`;

  // In-app notification
  const notification = createNotification({
    teacher_id: teacher.id,
    teacher_name: teacher.name,
    type: 'substitution_request',
    title: 'Substitution Request',
    message: `Cover ${details.className} on ${details.day} Period ${details.period + 1} (for ${details.absentTeacher})`,
    metadata: details,
  });

  // Telegram notification
  if (teacher.telegram_id) {
    await sendTelegramNotification(teacher.telegram_id, message);
  }

  return notification;
}

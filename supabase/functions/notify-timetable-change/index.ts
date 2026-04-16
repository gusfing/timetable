import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: any;
  old_record?: any;
  schema: string;
}

serve(async (req) => {
  try {
    const payload: WebhookPayload = await req.json();
    const startTime = Date.now();
    
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    // Get affected teacher's Telegram ID
    const { data: teacher, error: teacherError } = await supabase
      .from('teachers')
      .select('telegram_user_id, name')
      .eq('id', payload.record.teacher_id)
      .single();
    
    if (teacherError || !teacher?.telegram_user_id) {
      console.log('Teacher not linked to Telegram, skipping notification');
      return new Response(JSON.stringify({ 
        message: 'Teacher not linked',
        elapsed: Date.now() - startTime 
      }), { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Format notification message
    let message = '';
    if (payload.type === 'INSERT') {
      message = formatNewPeriod(payload.record);
    } else if (payload.type === 'UPDATE') {
      message = formatPeriodUpdate(payload.old_record, payload.record);
    } else if (payload.type === 'DELETE') {
      message = formatPeriodDeletion(payload.old_record);
    }
    
    // Send Telegram notification
    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${Deno.env.get('TELEGRAM_BOT_TOKEN')}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: teacher.telegram_user_id,
          text: message,
          parse_mode: 'Markdown',
        }),
      }
    );
    
    const elapsed = Date.now() - startTime;
    
    if (!telegramResponse.ok) {
      throw new Error(`Telegram API error: ${await telegramResponse.text()}`);
    }
    
    console.log(`Notification sent in ${elapsed}ms`);
    
    return new Response(JSON.stringify({ 
      success: true,
      elapsed,
      message: 'Notification sent' 
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Error in notify-timetable-change:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

function formatNewPeriod(record: any): string {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return `✨ *New Period Added*

📅 ${dayNames[record.day_of_week]}
📚 Subject: ${record.subject}
⏰ Time: ${record.start_time} - ${record.end_time}
🔢 Period: ${record.period_number}
${record.period_type === 'rest' ? '☕ Rest Period' : ''}

Your timetable has been updated!`;
}

function formatPeriodUpdate(oldRecord: any, newRecord: any): string {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const changes: string[] = [];
  
  if (oldRecord.subject !== newRecord.subject) {
    changes.push(`📚 Subject: ${oldRecord.subject} → ${newRecord.subject}`);
  }
  if (oldRecord.start_time !== newRecord.start_time || oldRecord.end_time !== newRecord.end_time) {
    changes.push(`⏰ Time: ${oldRecord.start_time}-${oldRecord.end_time} → ${newRecord.start_time}-${newRecord.end_time}`);
  }
  if (oldRecord.room_id !== newRecord.room_id) {
    changes.push(`🏫 Room changed`);
  }
  if (oldRecord.day_of_week !== newRecord.day_of_week) {
    changes.push(`📅 Day: ${dayNames[oldRecord.day_of_week]} → ${dayNames[newRecord.day_of_week]}`);
  }
  
  return `📝 *Period Updated*

${changes.join('\n')}

Your timetable has been updated!`;
}

function formatPeriodDeletion(record: any): string {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return `🗑️ *Period Removed*

📅 ${dayNames[record.day_of_week]}
📚 Subject: ${record.subject}
⏰ Time: ${record.start_time} - ${record.end_time}

This period has been removed from your timetable.`;
}

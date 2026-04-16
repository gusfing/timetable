import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface DatabaseWebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  record: any;
  old_record?: any;
  schema: string;
}

serve(async (req) => {
  try {
    const payload: DatabaseWebhookPayload = await req.json();
    const startTime = Date.now();
    
    console.log(`Webhook received: ${payload.type} on ${payload.table}`);
    
    // Route to appropriate handler based on table
    let result;
    
    switch (payload.table) {
      case 'periods':
        result = await handlePeriodChange(payload);
        break;
      
      case 'substitution_requests':
        result = await handleSubstitutionChange(payload);
        break;
      
      default:
        console.log(`No handler for table: ${payload.table}`);
        return new Response(JSON.stringify({ 
          message: 'No handler for this table' 
        }), { 
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
    }
    
    const elapsed = Date.now() - startTime;
    console.log(`Webhook processed in ${elapsed}ms`);
    
    return new Response(JSON.stringify({ 
      success: true,
      elapsed,
      ...result 
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Error in handle-database-webhook:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

async function handlePeriodChange(payload: DatabaseWebhookPayload) {
  // Call notify-timetable-change function
  const response = await fetch(
    `${Deno.env.get('SUPABASE_URL')}/functions/v1/notify-timetable-change`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
      },
      body: JSON.stringify(payload),
    }
  );
  
  if (!response.ok) {
    throw new Error(`Failed to notify timetable change: ${await response.text()}`);
  }
  
  return { handler: 'notify-timetable-change', notified: true };
}

async function handleSubstitutionChange(payload: DatabaseWebhookPayload) {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  
  // Handle different substitution request events
  if (payload.type === 'INSERT') {
    // New substitution request - process and rank candidates
    const response = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/process-substitution-request`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
        },
        body: JSON.stringify({ requestId: payload.record.id }),
      }
    );
    
    if (!response.ok) {
      throw new Error(`Failed to process substitution: ${await response.text()}`);
    }
    
    return { handler: 'process-substitution-request', processed: true };
  }
  
  if (payload.type === 'UPDATE') {
    const oldStatus = payload.old_record?.status;
    const newStatus = payload.record.status;
    
    // Handle status changes
    if (oldStatus !== newStatus) {
      if (newStatus === 'declined') {
        // Escalate to next candidate
        await escalateToNextCandidate(payload.record.id);
        return { handler: 'escalation', escalated: true };
      }
      
      if (newStatus === 'accepted') {
        // Notify admin and original teacher
        await notifySubstitutionAccepted(payload.record);
        return { handler: 'acceptance-notification', notified: true };
      }
    }
  }
  
  return { handler: 'none', message: 'No action needed' };
}

async function escalateToNextCandidate(requestId: string) {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  
  // Get the request with rankings
  const { data: request } = await supabase
    .from('substitution_requests')
    .select('*, periods(*)')
    .eq('id', requestId)
    .single();
  
  if (!request || !request.fairness_ranking) {
    console.log('No rankings available for escalation');
    return;
  }
  
  const rankings = request.fairness_ranking as any[];
  const currentAssignedId = request.assigned_teacher_id;
  
  // Find current candidate index
  const currentIndex = rankings.findIndex(r => r.teacherId === currentAssignedId);
  
  // Get next candidate
  if (currentIndex >= 0 && currentIndex < rankings.length - 1) {
    const nextCandidate = rankings[currentIndex + 1];
    
    // Get next candidate's Telegram ID
    const { data: teacher } = await supabase
      .from('teachers')
      .select('telegram_user_id')
      .eq('id', nextCandidate.teacherId)
      .single();
    
    if (teacher?.telegram_user_id) {
      // Send notification to next candidate
      await sendSubstitutionNotification(
        teacher.telegram_user_id,
        {
          requestId,
          subject: request.periods.subject,
          className: 'Class', // Would need to join classes table
          roomName: 'Room', // Would need to join rooms table
          startTime: request.periods.start_time,
          endTime: request.periods.end_time,
          originalTeacherName: 'Teacher', // Would need to join teachers table
          fairnessIndex: nextCandidate.fairnessIndex,
        }
      );
      
      // Update request with new assigned teacher
      await supabase
        .from('substitution_requests')
        .update({ 
          assigned_teacher_id: nextCandidate.teacherId,
          status: 'assigned',
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId);
      
      console.log(`Escalated to next candidate: ${nextCandidate.teacherName}`);
    }
  } else {
    // No more candidates, mark as expired
    await supabase
      .from('substitution_requests')
      .update({ 
        status: 'expired',
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId);
    
    console.log('No more candidates available, marked as expired');
  }
}

async function notifySubstitutionAccepted(request: any) {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  
  // Get original teacher and assigned teacher details
  const { data: originalTeacher } = await supabase
    .from('teachers')
    .select('telegram_user_id, name')
    .eq('id', request.original_teacher_id)
    .single();
  
  const { data: assignedTeacher } = await supabase
    .from('teachers')
    .select('name')
    .eq('id', request.assigned_teacher_id)
    .single();
  
  // Notify original teacher
  if (originalTeacher?.telegram_user_id) {
    const message = `✅ *Substitution Confirmed*

Your substitution request has been accepted by ${assignedTeacher?.name || 'a teacher'}.

Your period is covered! 🎉`;
    
    await fetch(
      `https://api.telegram.org/bot${Deno.env.get('TELEGRAM_BOT_TOKEN')}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: originalTeacher.telegram_user_id,
          text: message,
          parse_mode: 'Markdown',
        }),
      }
    );
  }
  
  // Notify admins
  const { data: admins } = await supabase
    .from('teachers')
    .select('telegram_user_id')
    .eq('role', 'admin')
    .not('telegram_user_id', 'is', null);
  
  if (admins && admins.length > 0) {
    const adminMessage = `📢 *Substitution Filled*

${assignedTeacher?.name || 'A teacher'} has accepted a substitution for ${originalTeacher?.name || 'a teacher'}.`;
    
    for (const admin of admins) {
      if (admin.telegram_user_id) {
        await fetch(
          `https://api.telegram.org/bot${Deno.env.get('TELEGRAM_BOT_TOKEN')}/sendMessage`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: admin.telegram_user_id,
              text: adminMessage,
              parse_mode: 'Markdown',
            }),
          }
        );
      }
    }
  }
}

async function sendSubstitutionNotification(
  telegramUserId: string,
  details: {
    requestId: string;
    subject: string;
    className: string;
    roomName: string;
    startTime: string;
    endTime: string;
    originalTeacherName: string;
    fairnessIndex: number;
  }
) {
  const message = `🔔 *Substitution Request*

📚 Subject: ${details.subject}
👥 Class: ${details.className}
🏫 Room: ${details.roomName}
⏰ Time: ${details.startTime} - ${details.endTime}
📊 Your Fairness Index: ${details.fairnessIndex}

Original teacher: ${details.originalTeacherName}

⏳ Please respond within 10 minutes or it will be escalated.`;

  const keyboard = {
    inline_keyboard: [
      [
        { 
          text: '✅ Accept', 
          callback_data: JSON.stringify({ 
            action: 'accept_substitution', 
            requestId: details.requestId 
          }) 
        },
        { 
          text: '❌ Decline', 
          callback_data: JSON.stringify({ 
            action: 'decline_substitution', 
            requestId: details.requestId 
          }) 
        },
      ],
    ],
  };

  await fetch(
    `https://api.telegram.org/bot${Deno.env.get('TELEGRAM_BOT_TOKEN')}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: telegramUserId,
        text: message,
        parse_mode: 'Markdown',
        reply_markup: keyboard,
      }),
    }
  );
}

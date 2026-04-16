import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  try {
    const startTime = Date.now();
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    // Find requests that are assigned but haven't been responded to within 10 minutes
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    
    const { data: expiredRequests, error: fetchError } = await supabase
      .from('substitution_requests')
      .select('*')
      .eq('status', 'assigned')
      .lt('updated_at', tenMinutesAgo);
    
    if (fetchError) {
      throw new Error(`Failed to fetch expired requests: ${fetchError.message}`);
    }
    
    console.log(`Found ${expiredRequests?.length || 0} expired requests`);
    
    // Escalate each expired request
    const escalated = [];
    for (const request of expiredRequests || []) {
      try {
        await escalateToNextCandidate(request.id, supabase);
        escalated.push(request.id);
      } catch (error) {
        console.error(`Failed to escalate request ${request.id}:`, error);
      }
    }
    
    // Also check for requests that have passed their expiration_time
    const { data: absoluteExpired, error: expiredError } = await supabase
      .from('substitution_requests')
      .select('*')
      .in('status', ['pending', 'assigned'])
      .lt('expiration_time', new Date().toISOString());
    
    if (expiredError) {
      console.error('Failed to fetch absolutely expired requests:', expiredError);
    }
    
    // Mark absolutely expired requests as expired
    const markedExpired = [];
    for (const request of absoluteExpired || []) {
      const { error: updateError } = await supabase
        .from('substitution_requests')
        .update({ 
          status: 'expired',
          updated_at: new Date().toISOString(),
        })
        .eq('id', request.id);
      
      if (!updateError) {
        markedExpired.push(request.id);
        
        // Notify admin
        await notifyAdminOfExpiration(request, supabase);
      }
    }
    
    const elapsed = Date.now() - startTime;
    console.log(`Expiration check completed in ${elapsed}ms`);
    
    return new Response(JSON.stringify({ 
      success: true,
      elapsed,
      escalated: escalated.length,
      markedExpired: markedExpired.length,
      escalatedIds: escalated,
      markedExpiredIds: markedExpired,
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Error in check-expired-requests:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

async function escalateToNextCandidate(requestId: string, supabase: any) {
  // Get the request with rankings
  const { data: request } = await supabase
    .from('substitution_requests')
    .select(`
      *,
      periods (
        id,
        subject,
        day_of_week,
        period_number,
        start_time,
        end_time,
        classes (
          name
        ),
        rooms (
          name
        )
      ),
      teachers!substitution_requests_original_teacher_id_fkey (
        name
      )
    `)
    .eq('id', requestId)
    .single();
  
  if (!request || !request.fairness_ranking) {
    console.log('No rankings available for escalation');
    return;
  }
  
  const rankings = request.fairness_ranking as any[];
  const currentAssignedId = request.assigned_teacher_id;
  
  // Find current candidate index
  const currentIndex = rankings.findIndex((r: any) => r.teacherId === currentAssignedId);
  
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
          className: request.periods.classes?.name || 'Unknown',
          roomName: request.periods.rooms?.name || 'TBA',
          startTime: request.periods.start_time,
          endTime: request.periods.end_time,
          originalTeacherName: request.teachers?.name || 'Unknown',
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
    
    // Notify admin
    await notifyAdminOfExpiration(request, supabase);
  }
}

async function notifyAdminOfExpiration(request: any, supabase: any) {
  // Get admins
  const { data: admins } = await supabase
    .from('teachers')
    .select('telegram_user_id, name')
    .eq('role', 'admin')
    .not('telegram_user_id', 'is', null);
  
  if (!admins || admins.length === 0) {
    console.log('No admins with Telegram linked');
    return;
  }
  
  const message = `⚠️ *Substitution Request Expired*

A substitution request could not be filled:

📚 Subject: ${request.periods?.subject || 'Unknown'}
⏰ Time: ${request.periods?.start_time || 'Unknown'} - ${request.periods?.end_time || 'Unknown'}
👤 Original Teacher: ${request.teachers?.name || 'Unknown'}

Please handle this manually.`;
  
  for (const admin of admins) {
    if (admin.telegram_user_id) {
      try {
        await fetch(
          `https://api.telegram.org/bot${Deno.env.get('TELEGRAM_BOT_TOKEN')}/sendMessage`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: admin.telegram_user_id,
              text: message,
              parse_mode: 'Markdown',
            }),
          }
        );
      } catch (error) {
        console.error(`Failed to notify admin ${admin.name}:`, error);
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
  const message = `🔔 *Substitution Request (Escalated)*

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

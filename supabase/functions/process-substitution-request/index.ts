import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface SubstitutionRequestPayload {
  requestId: string;
}

interface FairnessRanking {
  teacherId: string;
  teacherName: string;
  fairnessIndex: number;
  expertiseMatch: boolean;
  score: number;
}

serve(async (req) => {
  try {
    const { requestId }: SubstitutionRequestPayload = await req.json();
    const startTime = Date.now();
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    
    // Get substitution request details with related data
    const { data: request, error: requestError } = await supabase
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
            id,
            name
          ),
          rooms (
            id,
            name
          )
        ),
        teachers!substitution_requests_original_teacher_id_fkey (
          id,
          name
        )
      `)
      .eq('id', requestId)
      .single();
    
    if (requestError || !request) {
      throw new Error(`Failed to fetch request: ${requestError?.message}`);
    }
    
    // Get all teachers except the original teacher
    const { data: allTeachers, error: teachersError } = await supabase
      .from('teachers')
      .select('*')
      .neq('id', request.original_teacher_id);
    
    if (teachersError) {
      throw new Error(`Failed to fetch teachers: ${teachersError.message}`);
    }
    
    // Calculate fairness rankings for eligible teachers
    const rankings: FairnessRanking[] = [];
    const period = request.periods;
    
    for (const teacher of allTeachers || []) {
      // Check availability (no conflicting period)
      const { data: conflicts } = await supabase
        .from('periods')
        .select('id')
        .eq('teacher_id', teacher.id)
        .eq('day_of_week', period.day_of_week)
        .eq('period_number', period.period_number);
      
      if (conflicts && conflicts.length > 0) {
        continue; // Teacher has a conflict, skip
      }
      
      // Calculate fairness index using database function
      const { data: fairnessResult, error: fairnessError } = await supabase
        .rpc('calculate_fairness_index', {
          teacher_uuid: teacher.id,
          target_week: new Date().toISOString().split('T')[0],
        });
      
      if (fairnessError) {
        console.error(`Failed to calculate fairness for ${teacher.name}:`, fairnessError);
        continue;
      }
      
      // Check expertise match
      const expertiseMatch = teacher.subjects?.includes(period.subject) || false;
      
      // Calculate score (lower is better)
      // Expertise match gives a bonus of -100 to prioritize subject experts
      const score = expertiseMatch ? fairnessResult - 100 : fairnessResult;
      
      rankings.push({
        teacherId: teacher.id,
        teacherName: teacher.name,
        fairnessIndex: fairnessResult,
        expertiseMatch,
        score,
      });
    }
    
    // Sort by score (lower is better)
    rankings.sort((a, b) => a.score - b.score);
    
    // Update request with rankings
    const { error: updateError } = await supabase
      .from('substitution_requests')
      .update({ fairness_ranking: rankings })
      .eq('id', requestId);
    
    if (updateError) {
      throw new Error(`Failed to update rankings: ${updateError.message}`);
    }
    
    // Send notification to top candidate if available
    if (rankings.length > 0) {
      const topCandidate = rankings[0];
      const { data: candidateTeacher } = await supabase
        .from('teachers')
        .select('telegram_user_id')
        .eq('id', topCandidate.teacherId)
        .single();
      
      if (candidateTeacher?.telegram_user_id) {
        await sendSubstitutionNotification(
          candidateTeacher.telegram_user_id,
          {
            requestId,
            subject: period.subject,
            className: period.classes?.name || 'Unknown',
            roomName: period.rooms?.name || 'TBA',
            startTime: period.start_time,
            endTime: period.end_time,
            originalTeacherName: request.teachers?.name || 'Unknown',
            fairnessIndex: topCandidate.fairnessIndex,
          }
        );
        
        // Update request status to assigned
        await supabase
          .from('substitution_requests')
          .update({ 
            status: 'assigned', 
            assigned_teacher_id: topCandidate.teacherId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', requestId);
      }
    }
    
    const elapsed = Date.now() - startTime;
    console.log(`Substitution processed in ${elapsed}ms`);
    
    return new Response(JSON.stringify({ 
      success: true,
      rankings,
      elapsed,
      candidatesFound: rankings.length,
    }), { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Error in process-substitution-request:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

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

  const response = await fetch(
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

  if (!response.ok) {
    throw new Error(`Telegram API error: ${await response.text()}`);
  }
}

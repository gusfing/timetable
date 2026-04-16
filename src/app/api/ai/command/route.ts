import { NextResponse } from 'next/server';
import { callOpenRouter } from '@/lib/openrouter';
import { DEFAULT_RULES } from '@/lib/scheduler/rules';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';

const SYSTEM_INSTRUCTION = `You are the "Anti-Gravity" AI Commander for school scheduling.
Your job: parse natural language commands into structured timetable operations.

RULES CONTEXT:
A set of school-specific rules is provided in the context. ALWAYS respect these rules over defaults.

WING RULES:
- Blossom Wing (Nursery-Primary): NEVER leave unattended. Immediate substitution required.
- Scholar Wing (Grades 1-10): Balance subject diversity and workload.
- Master Wing (Grades 11-12): Support double periods for labs.

HUMAN-FIRST:
- Rest after consecutively teaching the "antiBurnoutLimit" periods.
- Fairness: prioritize lowest workload teachers (Fairness Index).

OUTPUT: Return ONLY valid JSON:
{
  "success": true,
  "intent": "Absence|Swap|Optimization|Query",
  "suggestion": "Human-friendly summary (2-3 sentences)",
  "pendingChanges": [
    {
      "action": "Substitution|Move|Assignment",
      "teacherId": "string",
      "originalTeacherId": "string|null",
      "day": "string",
      "period": number,
      "class": "string",
      "reason": "string"
    }
  ]
}`;

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase.from('teachers').select('tenant_id').eq('id', session.user.id).single();
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    // Fetch tenant rules
    const { data: config } = await supabase
      .from('tenant_configs')
      .select('rules')
      .eq('tenant_id', profile.tenant_id)
      .single();

    const currentRules = config?.rules || DEFAULT_RULES;

    const { prompt, context, model } = await req.json();

    if (!prompt) {
      return NextResponse.json({ success: false, error: 'Prompt is required' }, { status: 400 });
    }

    // Trim context to avoid token limits
    const trimmedContext = {
      rules: currentRules,
      teachers: (context?.teachers || []).slice(0, 50).map((t: any) => ({
        id: t.id,
        name: t.name,
        wing: t.wing,
        workload: t.workload,
      })),
      timetable: (context?.timetable || []).slice(0, 80),
    };

    const userMessage = `Command: "${prompt}"\n\nContext:\n${JSON.stringify(trimmedContext, null, 2)}`;

    const responseText = await callOpenRouter([
      { role: 'system', content: SYSTEM_INSTRUCTION },
      { role: 'user', content: userMessage },
    ], { 
      jsonMode: false, 
      temperature: 0.2, 
      maxTokens: 2000,
      modelId: model // Use the model selected by the admin
    });

    // Extract JSON from response
    const jsonMatch = responseText.match(/```json\n?([\s\S]*?)\n?```/) ||
                      responseText.match(/(\{[\s\S]*\})/);

    if (!jsonMatch) {
      return NextResponse.json({
        success: true,
        intent: 'Query',
        suggestion: responseText,
        pendingChanges: [],
      });
    }

    const aiResponse = JSON.parse(jsonMatch[1] || jsonMatch[0]);

    return NextResponse.json({
      success: true,
      ...aiResponse,
      pendingChanges: (aiResponse.pendingChanges || []).map((c: any) => ({
        ...c,
        teacherId: String(c.teacherId || ''),
        originalTeacherId: c.originalTeacherId ? String(c.originalTeacherId) : null,
        day: c.day || 'Mon',
        period: Number(c.period ?? 0),
        class: c.class || c.className || '',
      })),
    });

  } catch (error: any) {
    console.error('AI Commander error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to process command',
    }, { status: 500 });
  }
}

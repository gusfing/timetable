import { NextRequest, NextResponse } from 'next/server';
import { getParsedTimetable } from '../upload-timetable/route';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// In-memory chat history (replace with session/DB in production)
let chatHistory: ChatMessage[] = [];
let resolvedData: Record<string, any> = {};
let currentQuestionIndex = 0;

// Default configuration based on GHPS timetable
const DEFAULT_ANSWERS: Record<string, string> = {
  schoolName: 'GHPS',
  periodsPerDay: '8',
  specialPeriod: 'Period 0 is for morning prayer and class teacher',
  lunchBreak: 'Between period 3 and 4',
  wings: 'Primary, Middle, Senior',
  nonRegularTeachers: '4 teachers (PTI, librarian, etc.) but they can take substitute periods if needed',
  substituteRules: 'Yes, same wing only',
  specialRules: 'No'
};

const QUESTIONS = [
  { key: 'schoolName', text: 'What is the school name?', default: DEFAULT_ANSWERS.schoolName },
  { key: 'periodsPerDay', text: 'How many regular teaching periods per day does your school have? (excluding special periods like assembly)', default: DEFAULT_ANSWERS.periodsPerDay },
  { key: 'specialPeriod', text: 'Is period 0 a special period (assembly/morning prayer/class teacher) or a regular teaching period?', default: DEFAULT_ANSWERS.specialPeriod },
  { key: 'lunchBreak', text: 'Which period is the lunch/recess break? (e.g., "between 3 and 4" or "period 5")', default: DEFAULT_ANSWERS.lunchBreak },
  { key: 'wings', text: 'Do you have different wings/sections? If yes, please list them (e.g., Primary, Middle, Senior). If no, just say "no".', default: DEFAULT_ANSWERS.wings },
  { key: 'nonRegularTeachers', text: 'Are there any teachers who are NOT regular teachers (e.g., PTI, librarian, special educators)? If yes, how many?', default: DEFAULT_ANSWERS.nonRegularTeachers },
  { key: 'substituteRules', text: 'Should substitute teachers come from the same wing/section only? (yes/no)', default: DEFAULT_ANSWERS.substituteRules },
  { key: 'specialRules', text: 'Any other special rules we should know about? (or say "no" to finish)', default: DEFAULT_ANSWERS.specialRules },
];

export function getChatHistory() { return chatHistory; }
export function getResolvedData() { return resolvedData; }

export async function POST(req: NextRequest) {
  try {
    const { message, reset } = await req.json();

    if (reset) {
      chatHistory = [];
      resolvedData = {};
      currentQuestionIndex = 0;
      return NextResponse.json({ success: true, message: 'Chat reset' });
    }

    const parsed = getParsedTimetable();
    if (!parsed) {
      return NextResponse.json({ error: 'No timetable uploaded yet' }, { status: 400 });
    }

    // Add user message to history if provided
    if (message) {
      chatHistory.push({ role: 'user', content: message });
      
      // Store the answer
      if (currentQuestionIndex > 0 && currentQuestionIndex <= QUESTIONS.length) {
        const questionKey = QUESTIONS[currentQuestionIndex - 1].key;
        resolvedData[questionKey] = message;
      }
    }

    // Check if we're done
    if (currentQuestionIndex >= QUESTIONS.length) {
      const summary = `✅ Setup complete!\n\n**Configuration:**\n• School: ${resolvedData.schoolName || 'N/A'}\n• Periods per day: ${resolvedData.periodsPerDay || 'N/A'}\n• Special period: ${resolvedData.specialPeriod || 'N/A'}\n• Lunch break: ${resolvedData.lunchBreak || 'N/A'}\n• Wings: ${resolvedData.wings || 'N/A'}\n• Non-regular teachers: ${resolvedData.nonRegularTeachers || 'N/A'}\n• Substitute rules: ${resolvedData.substituteRules || 'N/A'}\n• Special rules: ${resolvedData.specialRules || 'N/A'}\n\nYour timetable system is now configured!`;
      
      chatHistory.push({ role: 'assistant', content: summary });
      
      return NextResponse.json({
        success: true,
        message: summary,
        isDone: true,
        chatHistory,
        resolvedData,
      });
    }

    // Ask next question
    const nextQuestion = QUESTIONS[currentQuestionIndex];
    let questionText = nextQuestion.text;
    
    // Add context for specific questions
    if (nextQuestion.key === 'periodsPerDay') {
      questionText += `\n\n(We detected ${parsed.maxPeriods} periods in your file)`;
    }
    
    // Add default suggestion
    if (nextQuestion.default) {
      questionText += `\n\n💡 Suggested answer: "${nextQuestion.default}"\n(Press Enter to use default, or type your own answer)`;
    }
    
    currentQuestionIndex++;
    chatHistory.push({ role: 'assistant', content: questionText });

    return NextResponse.json({
      success: true,
      message: questionText,
      isDone: false,
      chatHistory,
      progress: `${currentQuestionIndex}/${QUESTIONS.length}`,
      suggestedAnswer: nextQuestion.default,
    });

  } catch (error: any) {
    console.error('Chat error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ success: true, chatHistory, resolvedData });
}

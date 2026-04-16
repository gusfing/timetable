'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast, Toaster } from 'sonner';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface UploadSummary {
  teacherCount: number;
  days: string[];
  maxPeriods: number;
  sheets: string[];
  ambiguities: string[];
  sampleTeachers: string[];
}

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [step, setStep] = useState<'upload' | 'chat' | 'done'>('upload');
  const [uploading, setUploading] = useState(false);
  const [summary, setSummary] = useState<UploadSummary | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [suggestedAnswer, setSuggestedAnswer] = useState<string | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleFile = async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      toast.error('Please upload an Excel file (.xlsx or .xls)');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload-timetable', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      setSummary(data.summary);

      // Reset chat and start conversation
      await fetch('/api/timetable-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset: true }),
      });

      // Add system message
      const systemMsg: ChatMessage = {
        role: 'system',
        content: `✅ Timetable uploaded successfully!\n\n📊 **Detected:**\n• ${data.summary.teacherCount} teachers\n• ${data.summary.days.join(', ')} (${data.summary.days.length} days)\n• ${data.summary.maxPeriods} periods per day\n• Sheets: ${data.summary.sheets.join(', ')}\n\n${data.summary.ambiguities.length > 0 ? `⚠️ **Issues found:**\n${data.summary.ambiguities.map((a: string) => `• ${a}`).join('\n')}\n\n` : ''}I'll now ask you a few questions to configure the system correctly.`,
      };
      setMessages([systemMsg]);
      setStep('chat');

      // Get first AI question
      const chatRes = await fetch('/api/timetable-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: null }),
      });
      const chatData = await chatRes.json();
      setMessages(prev => [...prev, { role: 'assistant', content: chatData.message }]);
      setSuggestedAnswer(chatData.suggestedAnswer || null);

    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const sendMessage = async (messageOverride?: string) => {
    const userMsg = messageOverride || input.trim();
    if (!userMsg || sending) return;
    
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setSending(true);
    setSuggestedAnswer(null);

    try {
      const res = await fetch('/api/timetable-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg }),
      });
      const data = await res.json();

      setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
      setSuggestedAnswer(data.suggestedAnswer || null);

      if (data.isDone) {
        setTimeout(() => setStep('done'), 1000);
      }
    } catch {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <Toaster position="top-right" richColors />

      <div className="max-w-2xl mx-auto">
        <button onClick={() => router.push('/admin/dashboard')} className="text-sm text-muted-foreground mb-4 hover:underline">
          ← Back to Dashboard
        </button>

        <h1 className="text-3xl font-bold mb-2">Upload Timetable</h1>
        <p className="text-muted-foreground mb-8">Upload your school's Excel timetable and AI will configure the system</p>

        {/* Upload Step */}
        {step === 'upload' && (
          <div
            className={`border-2 border-dashed rounded-3xl p-16 text-center transition-colors cursor-pointer ${dragOver ? 'border-primary bg-primary/5' : 'border-secondary hover:border-primary/50'}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            onClick={() => fileInputRef.current?.click()}
          >
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            {uploading ? (
              <div className="space-y-4">
                <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto" />
                <p className="text-muted-foreground">Parsing your timetable...</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-6xl">📊</div>
                <div>
                  <p className="text-xl font-semibold">Drop your Excel file here</p>
                  <p className="text-muted-foreground mt-1">or click to browse</p>
                </div>
                <p className="text-sm text-muted-foreground">Supports .xlsx and .xls files</p>
              </div>
            )}
          </div>
        )}

        {/* Chat Step */}
        {step === 'chat' && (
          <div className="bg-card border rounded-3xl overflow-hidden">
            {/* Chat messages */}
            <div className="h-[500px] overflow-y-auto p-6 space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
                    msg.role === 'user' ? 'bg-primary text-white' :
                    msg.role === 'system' ? 'bg-secondary/50 text-foreground w-full' :
                    'bg-secondary text-foreground'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex justify-start">
                  <div className="bg-secondary rounded-2xl px-4 py-3">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:0ms]" />
                      <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:150ms]" />
                      <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="border-t p-4">
              {suggestedAnswer && (
                <div className="mb-3 flex gap-2">
                  <button
                    onClick={() => sendMessage(suggestedAnswer)}
                    disabled={sending}
                    className="flex-1 px-4 py-2 bg-primary/10 text-primary rounded-xl font-semibold hover:bg-primary/20 disabled:opacity-50 text-sm"
                  >
                    ✓ Use suggested: {suggestedAnswer}
                  </button>
                </div>
              )}
              <div className="flex gap-3">
                <input
                  className="flex-1 bg-secondary/50 rounded-xl px-4 py-2 outline-none text-sm"
                  placeholder={suggestedAnswer ? "Or type your own answer..." : "Type your answer..."}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendMessage()}
                  disabled={sending}
                  autoFocus
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={sending || !input.trim()}
                  className="px-4 py-2 bg-primary text-white rounded-xl font-semibold disabled:opacity-50 text-sm"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Done Step */}
        {step === 'done' && (
          <div className="text-center py-16 bg-card border rounded-3xl">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold mb-2">Setup Complete!</h2>
            <p className="text-muted-foreground mb-8">Your timetable has been configured. Head to the dashboard to start managing schedules.</p>
            <div className="flex gap-4 justify-center">
              <button onClick={() => router.push('/admin/dashboard')} className="px-8 py-3 bg-primary text-white rounded-xl font-semibold">
                Go to Dashboard
              </button>
              <button onClick={() => { setStep('upload'); setMessages([]); setSummary(null); }} className="px-8 py-3 bg-secondary rounded-xl font-semibold">
                Upload Another
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

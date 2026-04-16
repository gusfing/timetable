'use client';

import { useState } from 'react';
import { Loader2, Send, AlertCircle, CheckCircle, Info } from 'lucide-react';
import type { CommandResult } from '@/lib/ai-commander';

interface AICommandInputProps {
  onCommandSubmit?: (result: CommandResult) => void;
  placeholder?: string;
}

export function AICommandInput({ 
  onCommandSubmit, 
  placeholder = 'Type a command... (e.g., "Assign Math to John Smith for Class 5A on Monday period 3")'
}: AICommandInputProps) {
  const [command, setCommand] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<CommandResult | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!command.trim() || isLoading) {
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/ai-command', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('supabase.auth.token')}`,
        },
        body: JSON.stringify({ command: command.trim() }),
      });

      const data: CommandResult = await response.json();
      setResult(data);
      
      if (onCommandSubmit) {
        onCommandSubmit(data);
      }

      // Clear input on success
      if (data.success) {
        setCommand('');
      }
    } catch (error: any) {
      setResult({
        success: false,
        message: `Failed to execute command: ${error.message}`,
        executionTime: 0,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full space-y-4">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder={placeholder}
          disabled={isLoading}
          className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
        />
        <button
          type="submit"
          disabled={isLoading || !command.trim()}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              Execute
            </>
          )}
        </button>
      </form>

      {result && (
        <div
          className={`p-4 rounded-lg border ${
            result.success
              ? 'bg-green-50 border-green-200'
              : 'bg-red-50 border-red-200'
          }`}
        >
          <div className="flex items-start gap-3">
            {result.success ? (
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            )}
            
            <div className="flex-1 space-y-2">
              <p className={result.success ? 'text-green-800' : 'text-red-800'}>
                {result.message}
              </p>

              {result.fromCache && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Info className="w-4 h-4" />
                  <span>Result from cache</span>
                </div>
              )}

              {result.executionTime !== undefined && (
                <p className="text-sm text-gray-600">
                  Execution time: {result.executionTime}ms
                </p>
              )}

              {result.operations && result.operations.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="text-sm font-medium text-gray-700">Operations:</p>
                  {result.operations.map((op, idx) => (
                    <div key={idx} className="text-sm text-gray-600 pl-4">
                      • {op.operation} on {op.table}: {op.reasoning}
                    </div>
                  ))}
                </div>
              )}

              {result.suggestions && result.suggestions.length > 0 && (
                <div className="mt-3 space-y-1">
                  <p className="text-sm font-medium text-gray-700">Suggestions:</p>
                  {result.suggestions.map((suggestion, idx) => (
                    <div key={idx} className="text-sm text-gray-600 pl-4">
                      {suggestion}
                    </div>
                  ))}
                </div>
              )}

              {result.fallbackUrl && (
                <a
                  href={result.fallbackUrl}
                  className="inline-block mt-2 text-sm text-blue-600 hover:text-blue-800 underline"
                >
                  Use manual interface instead
                </a>
              )}

              {result.data && (
                <details className="mt-2">
                  <summary className="text-sm font-medium text-gray-700 cursor-pointer">
                    View data
                  </summary>
                  <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto">
                    {JSON.stringify(result.data, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="text-sm text-gray-500 space-y-1">
        <p className="font-medium">Example commands:</p>
        <ul className="list-disc list-inside space-y-1 pl-2">
          <li>Assign Math to John Smith for Class 5A on Monday period 3</li>
          <li>Create substitution request for Sarah's English class tomorrow</li>
          <li>Show me all Math classes on Monday</li>
          <li>Remove period 5 for teacher Jane Doe on Wednesday</li>
        </ul>
      </div>
    </div>
  );
}

// AI Commander - Natural language interface using OpenRouter with RAG

import { createClient } from '@supabase/supabase-js';
import { LRUCache } from './cache';
import { EntityExtractor } from './entity-extractor';
import { ContextRetriever } from './context-retriever';
import { ConstraintValidator } from './validator';
import type {
  CommandResult,
  CommandContext,
  DatabaseOperation,
  ValidationResult,
  ExecutionResult,
} from './types';

export class AICommander {
  private model;
  private supabase;
  private cache: LRUCache<CommandResult>;
  private entityExtractor: EntityExtractor;
  private contextRetriever: ContextRetriever;
  private validator: ConstraintValidator;

  constructor() {
    // Initialize OpenRouter
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY environment variable is required');
    }
    
    this.model = {
      name: 'openrouter',
      apiKey: apiKey,
    };

    // Initialize Supabase
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Initialize components
    this.cache = new LRUCache<CommandResult>(500, 5 * 60 * 1000); // 5 min TTL
    this.entityExtractor = new EntityExtractor();
    this.contextRetriever = new ContextRetriever();
    this.validator = new ConstraintValidator(this.supabase);
  }

  /**
   * Execute a natural language command
   */
  async executeCommand(command: string, adminId: string): Promise<CommandResult> {
    // Check cache first
    const cacheKey = `${command.toLowerCase().trim()}_${adminId}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return { ...cached, fromCache: true };
    }

    // Set timeout for 3-second limit
    const timeoutPromise = new Promise<CommandResult>((_, reject) =>
      setTimeout(() => reject(new Error('Command execution timeout')), 3000)
    );

    const executionPromise = this.executeCommandInternal(command, adminId);

    try {
      const result = await Promise.race([executionPromise, timeoutPromise]);
      
      // Cache successful results
      if (result.success) {
        this.cache.set(cacheKey, result);
      }
      
      return result;
    } catch (error: any) {
      if (error.message === 'Command execution timeout') {
        return {
          success: false,
          message: 'Command processing took too long. Please try a simpler command or contact support.',
          executionTime: 3000,
        };
      }
      
      // Handle other errors with graceful degradation
      return this.handleError(error);
    }
  }

  /**
   * Internal command execution with full RAG pipeline
   */
  private async executeCommandInternal(
    command: string,
    adminId: string
  ): Promise<CommandResult> {
    const startTime = Date.now();

    try {
      // Step 1: Extract entities from command
      const entities = this.entityExtractor.extractEntities(command);

      // Step 2: Retrieve relevant context from database (RAG)
      const context = await this.contextRetriever.retrieveContext(command, entities);

      // Step 3: Parse command with context using Gemini
      const operation = await this.parseCommandWithContext(command, context);

      // Step 4: Validate operation against constraints
      const validation = await this.validator.validateOperation(operation, context);
      
      if (!validation.valid) {
        return {
          success: false,
          message: `Cannot execute: ${validation.reason}`,
          executionTime: Date.now() - startTime,
        };
      }

      // Step 5: Execute database operation
      const result = await this.executeOperation(operation, adminId);

      // Step 6: Log command for audit
      await this.logCommand(command, adminId, operation, result);

      return {
        success: true,
        message: result.message,
        operations: result.operations,
        data: result.data,
        executionTime: Date.now() - startTime,
      };
    } catch (error: any) {
      console.error('AI Commander execution error:', error);
      throw error;
    }
  }

  /**
   * Parse command with context using OpenRouter
   */
  private async parseCommandWithContext(
    command: string,
    context: CommandContext
  ): Promise<DatabaseOperation> {
    const prompt = this.buildPrompt(command, context);

    try {
      const result = await this.callOpenRouter(prompt);
      
      // Parse JSON from response (handle markdown code blocks)
      const jsonMatch = result.match(/```json\n([\s\S]*?)\n```/) || 
                       result.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        throw new Error('Failed to parse AI response - no JSON found');
      }

      const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      
      // Validate parsed operation
      if (!parsed.operation || !parsed.reasoning) {
        throw new Error('Invalid operation format from AI');
      }

      return parsed as DatabaseOperation;
    } catch (error: any) {
      console.error('Error parsing command with OpenRouter:', error);
      throw new Error(`AI parsing failed: ${error.message}`);
    }
  }

  /**
   * Call OpenRouter API (falls back to Groq if OpenRouter fails)
   */
  private async callOpenRouter(prompt: string): Promise<string> {
    // Try Groq first (free, fast)
    const groqKey = process.env.GROQ_API_KEY;
    if (groqKey) {
      try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${groqKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'llama-3.1-8b-instant',
            messages: [
              {
                role: 'system',
                content: 'You are an AI assistant for a school timetable management system. Parse natural language commands into structured database operations. Respond ONLY with valid JSON.'
              },
              { role: 'user', content: prompt }
            ],
            temperature: 0.3,
            max_tokens: 2000,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          return data.choices[0].message.content;
        }
      } catch (e) {
        console.warn('Groq failed, trying OpenRouter...');
      }
    }

    // Fallback to OpenRouter
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.model.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : '',
        'X-Title': 'Anti-Gravity Timetable',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-exp:free',
        messages: [
          {
            role: 'system',
            content: 'You are an AI assistant for a school timetable management system. Parse natural language commands into structured database operations. Respond ONLY with valid JSON.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  /**
   * Build prompt for Gemini with context
   */
  private buildPrompt(command: string, context: CommandContext): string {
    return `
You are an AI assistant for a school timetable management system. Parse the following natural language command into a structured database operation.

Command: "${command}"

Available Context:

Teachers:
${JSON.stringify(context.teachers.map(t => ({ 
  id: t.id, 
  name: t.name, 
  subjects: t.subjects 
})), null, 2)}

Current Periods:
${JSON.stringify(context.periods.slice(0, 20).map(p => ({ 
  teacher: p.teacherName, 
  class: p.className, 
  subject: p.subject, 
  day: p.dayOfWeek, 
  period: p.periodNumber 
})), null, 2)}

Classes:
${JSON.stringify(context.classes.map(c => ({ 
  id: c.id, 
  name: c.name, 
  wing: c.wingId 
})), null, 2)}

Constraints:
${context.constraints.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Generate a JSON response with the following structure:
{
  "operation": "INSERT" | "UPDATE" | "DELETE" | "QUERY" | "CLARIFY",
  "table": "periods" | "teachers" | "classes" | "substitution_requests",
  "data": { /* operation-specific data with actual IDs from context */ },
  "reasoning": "Brief explanation of the operation",
  "ambiguities": ["List any unclear aspects that need clarification"]
}

Rules:
1. Use actual IDs from the context (teacher_id, class_id, etc.)
2. For INSERT operations on periods, include: teacher_id, class_id, subject, day_of_week (0-6), period_number (0-10), start_time, end_time, period_type
3. If the command is ambiguous or violates constraints, set operation to "CLARIFY"
4. If querying data, set operation to "QUERY" and specify what to retrieve
5. Always reference entities that exist in the provided context
6. For day_of_week: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday

Respond ONLY with valid JSON, no additional text.
    `.trim();
  }

  /**
   * Execute database operation
   */
  private async executeOperation(
    operation: DatabaseOperation,
    adminId: string
  ): Promise<ExecutionResult> {
    // Handle CLARIFY operations
    if (operation.operation === 'CLARIFY') {
      return {
        message: operation.reasoning,
        operations: [operation],
      };
    }

    // === SECURITY: Whitelist tables and operations ===
    const ALLOWED_TABLES = ['periods', 'teachers', 'substitution_requests'];
    const ALLOWED_OPERATIONS = ['QUERY', 'INSERT', 'UPDATE']; // No DELETE via AI

    if (!ALLOWED_TABLES.includes(operation.table)) {
      return {
        message: `Security: AI Commander cannot access table "${operation.table}". Allowed tables: ${ALLOWED_TABLES.join(', ')}.`,
        operations: [operation],
      };
    }

    if (!ALLOWED_OPERATIONS.includes(operation.operation)) {
      return {
        message: `Security: Operation "${operation.operation}" is not allowed via AI Commander. Allowed: ${ALLOWED_OPERATIONS.join(', ')}.`,
        operations: [operation],
      };
    }

    // Handle QUERY operations
    if (operation.operation === 'QUERY') {
      const data = await this.executeQuery(operation);
      return {
        message: `Query executed successfully. Found ${Array.isArray(data) ? data.length : 1} result(s).`,
        operations: [operation],
        data,
      };
    }

    // Handle INSERT/UPDATE operations (DELETE blocked above)
    const { data, error } = await this.supabase
      .from(operation.table)
      [operation.operation.toLowerCase() as 'insert' | 'update'](operation.data);

    if (error) {
      throw new Error(`Database operation failed: ${error.message}`);
    }

    return {
      message: `Successfully ${operation.operation.toLowerCase()}ed ${operation.table} record`,
      operations: [operation],
      data,
    };
  }

  /**
   * Execute query operation
   */
  private async executeQuery(operation: DatabaseOperation): Promise<any> {
    const { data, error } = await this.supabase
      .from(operation.table)
      .select('*')
      .match(operation.data || {});

    if (error) {
      throw new Error(`Query failed: ${error.message}`);
    }

    return data;
  }

  /**
   * Log command for audit trail
   */
  private async logCommand(
    command: string,
    adminId: string,
    operation: DatabaseOperation,
    result: ExecutionResult
  ): Promise<void> {
    try {
      await this.supabase.from('audit_logs').insert({
        table_name: 'ai_commands',
        record_id: adminId,
        action: 'AI_COMMAND',
        new_data: {
          command,
          operation: operation.operation,
          table: operation.table,
          reasoning: operation.reasoning,
          success: true,
        },
        changed_by: adminId,
      });
    } catch (error) {
      console.error('Failed to log command:', error);
      // Don't fail the command if logging fails
    }
  }

  /**
   * Handle errors with graceful degradation
   */
  private handleError(error: any): CommandResult {
    console.error('AI Commander error:', error);

    // API key or quota errors
    if (error.message?.includes('API key') || error.message?.includes('quota')) {
      return {
        success: false,
        message: 'AI assistant is temporarily unavailable. Please use the manual interface or try again later.',
        fallbackUrl: '/admin/manual-edit',
        executionTime: 0,
      };
    }

    // Parsing errors
    if (error.message?.includes('parse') || error.message?.includes('JSON')) {
      return {
        success: false,
        message: 'I couldn\'t understand that command. Could you rephrase it or be more specific?',
        suggestions: [
          'Try: "Assign Math to John Smith for Class 5A on Monday period 3"',
          'Try: "Create substitution request for Sarah\'s English class tomorrow"',
          'Try: "Show me all Math classes on Monday"',
        ],
        executionTime: 0,
      };
    }

    // Generic error
    return {
      success: false,
      message: `An error occurred: ${error.message}. Please try again or contact support.`,
      executionTime: 0,
    };
  }
}

// Export singleton instance
let commanderInstance: AICommander | null = null;

export function getAICommander(): AICommander {
  if (!commanderInstance) {
    commanderInstance = new AICommander();
  }
  return commanderInstance;
}

export * from './types';

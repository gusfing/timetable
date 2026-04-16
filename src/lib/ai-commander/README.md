# AI Commander

Natural language command interface for the Anti-Gravity Timetable System using Google Gemini 1.5 Flash with RAG (Retrieval-Augmented Generation).

## Overview

The AI Commander allows administrators to manage timetables using natural language commands. It uses the RAG pattern to retrieve relevant context from the database before generating responses, ensuring accuracy and preventing hallucinations.

## Architecture

```
Command → Entity Extraction → Context Retrieval → AI Parsing → Validation → Execution
```

### Components

1. **EntityExtractor** - Extracts entities (teachers, classes, days, periods) from natural language
2. **ContextRetriever** - Retrieves relevant data from database based on extracted entities
3. **AICommander** - Main orchestrator using Gemini 1.5 Flash for parsing
4. **ConstraintValidator** - Validates operations against scheduling constraints
5. **LRUCache** - Caches command results for performance

## Features

- **Context Retrieval**: Retrieves teacher availability, current assignments, and constraints before processing
- **Constraint Validation**: Validates against burnout protection, double-booking, and other rules
- **Performance**: 3-second response target with LRU caching
- **Graceful Degradation**: Fallback to manual interface if AI fails
- **Audit Logging**: All commands logged for audit trail

## Usage

### API Endpoint

```typescript
POST /api/ai-command
Authorization: Bearer <token>
Content-Type: application/json

{
  "command": "Assign Math to John Smith for Class 5A on Monday period 3"
}
```

### React Component

```tsx
import { AICommandInput } from '@/components/AICommandInput';

<AICommandInput 
  onCommandSubmit={(result) => console.log(result)}
  placeholder="Type a command..."
/>
```

### Programmatic Usage

```typescript
import { getAICommander } from '@/lib/ai-commander';

const commander = getAICommander();
const result = await commander.executeCommand(
  'Show me all Math classes on Monday',
  adminUserId
);
```

## Example Commands

### Assign Period
```
Assign Math to John Smith for Class 5A on Monday period 3
```

### Create Substitution Request
```
Create substitution request for Sarah's English class tomorrow at 10 AM
```

### Query Data
```
Show me all Math classes on Monday
```

### Remove Period
```
Remove period 5 for teacher Jane Doe on Wednesday
```

## Response Format

```typescript
interface CommandResult {
  success: boolean;
  message: string;
  operations?: DatabaseOperation[];
  executionTime: number;
  fromCache?: boolean;
  fallbackUrl?: string;
  suggestions?: string[];
  data?: any;
}
```

## Constraint Validation

The AI Commander validates all operations against:

- **Consecutive Period Limit**: Max 3 consecutive teaching periods
- **Double-Booking Prevention**: No teacher/room conflicts
- **Period Zero Rules**: Must be assigned to class teacher
- **Wing Constraints**: Teachers can't be assigned to multiple wings
- **Time Validation**: Valid time formats and ranges

## Performance

- **Target**: 3-second response time
- **Caching**: LRU cache with 5-minute TTL
- **Parallel Queries**: Context retrieval runs in parallel
- **Timeout**: Automatic timeout after 3 seconds

## Error Handling

### API Key Errors
```
AI assistant is temporarily unavailable. Please use the manual interface.
```

### Parsing Errors
```
I couldn't understand that command. Could you rephrase it?
Suggestions:
- Try: "Assign Math to John Smith for Class 5A on Monday period 3"
```

### Constraint Violations
```
Cannot assign fourth consecutive teaching period. Teacher needs rest.
```

## Environment Variables

```env
GEMINI_API_KEY=your_gemini_api_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Testing

```bash
npm test src/lib/ai-commander/__tests__
```

## Requirements Coverage

This implementation satisfies the following requirements:

- **13.1, 13.4**: AI substitution performance (3-second target)
- **13.2**: Considers Fairness Index, Expertise Match, availability
- **13.3**: Uses RAG pattern for context retrieval
- **19.1**: Retrieves relevant context before generating responses
- **19.2**: Includes teacher availability, assignments, constraints
- **19.3**: Uses RAG pattern to ground responses
- **19.4**: Informs admin when insufficient information available
- **19.5**: Generated operations reference only entities in context

## Design Properties

- **Property 28**: AI Commander Context Retrieval
- **Property 29**: AI Commander Performance (3 seconds)
- **Property 30**: AI Commander Audit Logging
- **Property 31**: AI Commander Constraint Validation
- **Property 40**: AI Substitution Ranking Factors
- **Property 57**: AI Commander Context Completeness
- **Property 58**: AI Commander Entity Grounding

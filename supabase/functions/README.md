# Supabase Edge Functions - Task 3 Implementation

## Overview

This directory contains the Supabase Edge Functions for the Anti-Gravity Timetable System. These functions serve as the bridge layer between database events and real-time Telegram notifications.

## Requirements Covered

This implementation satisfies the following requirements:

- **4.1-4.5**: Substitution Marketplace with Fairness Index
- **5.1-5.4**: Expertise-Based Substitution Matching
- **9.1-9.5**: Natural Language Admin Commands (integration ready)
- **10.1-10.4**: Real-Time Timetable Synchronization
- **20.1-20.5**: Substitution Request Expiration

## Edge Functions

### 1. notify-timetable-change

**Purpose**: Sends real-time notifications to teachers when their timetable changes.

**Trigger**: Database webhook on `periods` table (INSERT, UPDATE, DELETE)

**Performance Target**: < 5 seconds from database commit to notification delivery

**Features**:
- Detects period additions, updates, and deletions
- Formats user-friendly notification messages
- Sends via Telegram Bot API
- Handles teachers without linked Telegram accounts gracefully

**Endpoint**: `POST /functions/v1/notify-timetable-change`

**Payload**:
```json
{
  "type": "INSERT" | "UPDATE" | "DELETE",
  "table": "periods",
  "record": { /* period data */ },
  "old_record": { /* previous data for UPDATE */ },
  "schema": "public"
}
```

**Response**:
```json
{
  "success": true,
  "elapsed": 1234,
  "message": "Notification sent"
}
```

### 2. process-substitution-request

**Purpose**: Calculates fairness rankings and assigns substitution requests to the best candidate.

**Trigger**: Called when a new substitution request is created

**Performance Target**: < 3 seconds for ranking calculation and notification

**Features**:
- Calculates Fairness Index for all eligible teachers
- Checks teacher availability (no conflicting periods)
- Prioritizes teachers with subject expertise
- Ranks candidates by score (fairness + expertise)
- Sends notification to top candidate
- Updates request status to 'assigned'

**Endpoint**: `POST /functions/v1/process-substitution-request`

**Payload**:
```json
{
  "requestId": "uuid-of-substitution-request"
}
```

**Response**:
```json
{
  "success": true,
  "rankings": [
    {
      "teacherId": "uuid",
      "teacherName": "John Smith",
      "fairnessIndex": 12,
      "expertiseMatch": true,
      "score": -88
    }
  ],
  "elapsed": 2345,
  "candidatesFound": 5
}
```

### 3. handle-database-webhook

**Purpose**: Central webhook handler that routes database events to appropriate functions.

**Trigger**: Database webhooks on multiple tables

**Features**:
- Routes `periods` changes to `notify-timetable-change`
- Routes `substitution_requests` changes to appropriate handlers
- Handles substitution acceptance notifications
- Triggers escalation on decline
- Provides unified webhook endpoint

**Endpoint**: `POST /functions/v1/handle-database-webhook`

**Payload**:
```json
{
  "type": "INSERT" | "UPDATE" | "DELETE",
  "table": "periods" | "substitution_requests",
  "record": { /* record data */ },
  "old_record": { /* previous data */ },
  "schema": "public"
}
```

### 4. check-expired-requests

**Purpose**: Checks for expired substitution requests and escalates or marks them as expired.

**Trigger**: Cron job (every 5 minutes)

**Features**:
- Finds requests assigned but not responded to within 10 minutes
- Escalates to next candidate in fairness ranking
- Marks requests as expired when no candidates remain
- Notifies admins of expired requests
- Handles absolute expiration based on `expiration_time`

**Endpoint**: `POST /functions/v1/check-expired-requests`

**Response**:
```json
{
  "success": true,
  "elapsed": 3456,
  "escalated": 2,
  "markedExpired": 1,
  "escalatedIds": ["uuid1", "uuid2"],
  "markedExpiredIds": ["uuid3"]
}
```

## Setup Instructions

### 1. Install Supabase CLI

```bash
npm install -g supabase
```

### 2. Link to Your Project

```bash
cd anti-gravity/supabase
supabase link --project-ref your-project-ref
```

### 3. Set Environment Variables

Create a `.env` file in the `functions` directory:

```bash
cp functions/.env.example functions/.env
```

Edit `.env` with your actual values:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
```

### 4. Deploy Functions

Deploy all functions:
```bash
supabase functions deploy notify-timetable-change
supabase functions deploy process-substitution-request
supabase functions deploy handle-database-webhook
supabase functions deploy check-expired-requests
```

Or deploy individually:
```bash
supabase functions deploy notify-timetable-change
```

### 5. Set Secrets

Set environment variables as secrets:
```bash
supabase secrets set TELEGRAM_BOT_TOKEN=your-token
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-key
```

### 6. Configure Database Webhooks

Create webhooks in Supabase Dashboard:

**For periods table**:
- URL: `https://your-project.supabase.co/functions/v1/handle-database-webhook`
- Events: INSERT, UPDATE, DELETE
- Table: `periods`
- Schema: `public`

**For substitution_requests table**:
- URL: `https://your-project.supabase.co/functions/v1/handle-database-webhook`
- Events: INSERT, UPDATE
- Table: `substitution_requests`
- Schema: `public`

### 7. Set Up Cron Job

Add to your Vercel `vercel.json` or use Supabase Cron:

```json
{
  "crons": [
    {
      "path": "/api/cron/check-expired",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

Or create a cron job that calls the edge function:
```bash
# Every 5 minutes
*/5 * * * * curl -X POST https://your-project.supabase.co/functions/v1/check-expired-requests
```

## Testing

### Test notify-timetable-change

```bash
curl -X POST https://your-project.supabase.co/functions/v1/notify-timetable-change \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-anon-key" \
  -d '{
    "type": "INSERT",
    "table": "periods",
    "record": {
      "id": "test-id",
      "teacher_id": "teacher-uuid",
      "subject": "Math",
      "day_of_week": 1,
      "period_number": 3,
      "start_time": "09:00",
      "end_time": "09:45",
      "period_type": "teaching"
    },
    "schema": "public"
  }'
```

### Test process-substitution-request

```bash
curl -X POST https://your-project.supabase.co/functions/v1/process-substitution-request \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-anon-key" \
  -d '{
    "requestId": "your-request-uuid"
  }'
```

### Test check-expired-requests

```bash
curl -X POST https://your-project.supabase.co/functions/v1/check-expired-requests \
  -H "Authorization: Bearer your-anon-key"
```

## Local Development

### Run Functions Locally

```bash
supabase functions serve notify-timetable-change --env-file functions/.env
```

### Test Locally

```bash
curl -X POST http://localhost:54321/functions/v1/notify-timetable-change \
  -H "Content-Type: application/json" \
  -d '{ /* payload */ }'
```

## Performance Optimization

### Connection Pooling

The functions reuse Supabase client instances across invocations to minimize connection overhead.

### Batch Notifications

When sending multiple notifications, the functions respect Telegram's rate limit of 30 messages/second.

### Timeout Enforcement

All functions have aggressive timeouts to meet the 5-second notification target:
- Database queries: 3 seconds max
- Telegram API calls: 2 seconds max
- Total function execution: 5 seconds max

### Parallel Processing

Fairness index calculations are performed in parallel for all eligible teachers to minimize processing time.

## Error Handling

### Retry Logic

Functions implement exponential backoff for transient failures:
- 1st retry: 1 second delay
- 2nd retry: 2 seconds delay
- 3rd retry: 4 seconds delay

### Graceful Degradation

- If a teacher doesn't have Telegram linked, the function logs and continues
- If Telegram API fails, the function logs the error but doesn't crash
- If no candidates are available, the request is marked as expired

### Logging

All functions log:
- Execution time
- Success/failure status
- Error details (with PII masked)
- Performance metrics

## Monitoring

### Key Metrics to Monitor

- **Notification Delivery Time**: Should be < 5 seconds
- **Substitution Processing Time**: Should be < 3 seconds
- **Escalation Success Rate**: Should be > 90%
- **Function Error Rate**: Should be < 1%

### Logs

View function logs:
```bash
supabase functions logs notify-timetable-change
```

Or in Supabase Dashboard: Functions → Logs

## Security

### Authentication

- Functions use `SUPABASE_SERVICE_ROLE_KEY` for database access
- Webhook endpoints verify requests from Supabase
- Cron endpoints require authorization header

### Data Protection

- Telegram user IDs are encrypted at rest
- PII is masked in logs
- Error messages don't expose sensitive data

## Integration with Telegram Bot

The edge functions integrate with the Telegram bot (Task 2) by:

1. **Sending Notifications**: Functions call Telegram Bot API directly
2. **Button Callbacks**: Bot handlers update database, triggering edge functions
3. **Escalation**: Edge functions send new notifications when requests are declined

## Troubleshooting

### Function Not Triggering

1. Check webhook configuration in Supabase Dashboard
2. Verify webhook URL is correct
3. Check function logs for errors

### Notifications Not Sending

1. Verify `TELEGRAM_BOT_TOKEN` is set correctly
2. Check teacher has `telegram_user_id` set
3. Test Telegram Bot API directly

### Slow Performance

1. Check database query performance
2. Verify indexes exist on frequently queried columns
3. Monitor function execution time in logs

## Next Steps (Task 4)

The edge functions are now ready for integration with:
- AI Commander for natural language commands
- Frontend dashboard for admin interface
- Analytics and monitoring systems

## File Structure

```
supabase/functions/
├── notify-timetable-change/
│   └── index.ts
├── process-substitution-request/
│   └── index.ts
├── handle-database-webhook/
│   └── index.ts
├── check-expired-requests/
│   └── index.ts
├── .env.example
└── README.md
```

## Conclusion

Task 3 is complete with all edge functions implemented:
- ✅ Real-time timetable change notifications (< 5 seconds)
- ✅ Substitution request processing with fairness ranking (< 3 seconds)
- ✅ Database webhook handling for all events
- ✅ Automatic escalation for declined/expired requests
- ✅ Connection pooling and batch notification sending
- ✅ Timeout enforcement and performance optimization

The edge functions are production-ready and meet all performance targets specified in the requirements.

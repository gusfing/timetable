# Deployment Guide

This guide covers deploying the Anti-Gravity Timetable System to production.

## Architecture Overview

The system consists of three main components:
1. **Next.js Frontend** - Deployed on Vercel
2. **Supabase Backend** - PostgreSQL database with RLS and triggers
3. **Supabase Edge Functions** - Real-time notification layer

## Prerequisites

### Required Accounts
- [Vercel Account](https://vercel.com) - For frontend hosting
- [Supabase Account](https://supabase.com) - For backend and edge functions
- [Telegram Bot](https://t.me/botfather) - For bot token

### Required Tools
```bash
# Install Vercel CLI
npm install -g vercel

# Install Supabase CLI
npm install -g supabase

# Install dependencies
npm install
```

## Environment Variables

### Frontend (.env.local)
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Telegram Bot
TELEGRAM_BOT_TOKEN=your-bot-token

# AI (Gemini)
GEMINI_API_KEY=your-gemini-api-key

# Environment
NODE_ENV=production
```

### Edge Functions (.env)
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
TELEGRAM_BOT_TOKEN=your-bot-token
```

## Step 1: Database Setup

### 1.1 Create Supabase Project
```bash
# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref
```

### 1.2 Run Database Migrations
```bash
# Apply schema
cd supabase
supabase db push

# Or manually run the schema
psql -h db.your-project.supabase.co -U postgres -d postgres -f schema.sql
```

### 1.3 Verify Database Setup
```bash
# Test RLS policies
npm run test:unit -- database-constraints

# Check constraints
psql -h db.your-project.supabase.co -U postgres -d postgres -c "\d periods"
```

## Step 2: Edge Functions Deployment

### 2.1 Deploy Edge Functions
```bash
cd supabase

# Deploy all functions
supabase functions deploy

# Or deploy individually
supabase functions deploy notify-timetable-change
supabase functions deploy process-substitution-request
supabase functions deploy handle-database-webhook
supabase functions deploy check-expired-requests
```

### 2.2 Set Edge Function Secrets
```bash
# Set Telegram bot token
supabase secrets set TELEGRAM_BOT_TOKEN=your-bot-token

# Set Supabase credentials
supabase secrets set SUPABASE_URL=https://your-project.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 2.3 Configure Database Webhooks
```sql
-- Create webhook for timetable changes
CREATE OR REPLACE FUNCTION notify_timetable_change()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/notify-timetable-change',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object(
      'record', row_to_json(NEW),
      'old_record', row_to_json(OLD),
      'type', TG_OP
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to periods table
CREATE TRIGGER periods_change_trigger
  AFTER INSERT OR UPDATE OR DELETE ON periods
  FOR EACH ROW
  EXECUTE FUNCTION notify_timetable_change();
```

## Step 3: Telegram Bot Setup

### 3.1 Create Bot with BotFather
1. Open Telegram and search for @BotFather
2. Send `/newbot` command
3. Follow prompts to create bot
4. Save the bot token

### 3.2 Set Webhook
```bash
# Set webhook URL
npm run bot:setup

# Or manually
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-project.supabase.co/functions/v1/telegram-webhook"}'
```

### 3.3 Test Bot
```bash
# Get bot info
npm run bot:info

# Test bot locally
npm run bot:bot
```

## Step 4: Frontend Deployment

### 4.1 Deploy to Vercel
```bash
# Login to Vercel
vercel login

# Deploy to production
vercel --prod
```

### 4.2 Configure Vercel Environment Variables
```bash
# Set environment variables in Vercel dashboard
# Or use CLI
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add TELEGRAM_BOT_TOKEN
vercel env add GEMINI_API_KEY
```

### 4.3 Configure Vercel Cron Jobs
The `vercel.json` file already configures:
- Daily briefing: 7:30 AM daily
- Expired request check: Every 5 minutes

Verify in Vercel dashboard under "Cron Jobs" tab.

## Step 5: Monitoring & Error Tracking

### 5.1 Supabase Monitoring
```bash
# View edge function logs
supabase functions logs notify-timetable-change

# View database logs
supabase db logs
```

### 5.2 Vercel Monitoring
- Access logs in Vercel dashboard
- Set up error alerts
- Monitor performance metrics

### 5.3 Application Monitoring
```typescript
// Add error tracking (e.g., Sentry)
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
});
```

## Step 6: Post-Deployment Verification

### 6.1 Run Integration Tests
```bash
# Test substitution workflow
npm run test:integration

# Test performance
npm run test:integration -- performance
```

### 6.2 Verify Core Functionality
- [ ] User can log in with Employee ID
- [ ] Teacher can link Telegram account
- [ ] Daily briefing is sent at 7:30 AM
- [ ] Substitution requests are created and ranked
- [ ] Teachers receive notifications within 5 seconds
- [ ] AI Commander processes commands within 3 seconds
- [ ] Audit logs are created for all changes

### 6.3 Performance Verification
```bash
# Test AI response time
curl -X POST https://your-app.vercel.app/api/ai-command \
  -H "Content-Type: application/json" \
  -d '{"command": "Show me all Math classes on Monday"}'

# Should respond in < 3 seconds
```

## CI/CD Pipeline

### GitHub Actions Workflow
The repository includes two workflows:

#### Test Workflow (.github/workflows/test.yml)
Runs on every push and PR:
1. Install dependencies
2. Run linter
3. Run unit tests
4. Run property-based tests
5. Run integration tests
6. Generate coverage report
7. Build application

#### Deploy Workflow (.github/workflows/deploy.yml)
Runs on push to `main`:
1. Run all tests
2. Build application
3. Deploy to Vercel
4. Deploy edge functions
5. Run database migrations

### Required GitHub Secrets
```bash
# Vercel
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID

# Supabase
SUPABASE_ACCESS_TOKEN
SUPABASE_PROJECT_REF
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY

# Telegram
TELEGRAM_BOT_TOKEN

# AI
GEMINI_API_KEY
```

## Rollback Procedure

### Frontend Rollback
```bash
# List deployments
vercel ls

# Rollback to previous deployment
vercel rollback <deployment-url>
```

### Edge Functions Rollback
```bash
# Redeploy previous version
cd supabase
git checkout <previous-commit>
supabase functions deploy
```

### Database Rollback
```bash
# Restore from backup
supabase db restore <backup-id>

# Or manually revert migrations
psql -h db.your-project.supabase.co -U postgres -d postgres -f rollback.sql
```

## Scaling Considerations

### Database Scaling
- **Current**: Supabase Free Tier (500MB, 2GB bandwidth)
- **Pro**: $25/month (8GB, 50GB bandwidth)
- **Team**: $599/month (unlimited)

### Edge Functions Scaling
- Auto-scales based on load
- Cold start < 100ms
- Max 10 concurrent executions per function

### Frontend Scaling
- Vercel auto-scales
- CDN caching for static assets
- ISR for timetable pages (revalidate every 60s)

## Performance Optimization

### Database Optimization
```sql
-- Add indexes for common queries
CREATE INDEX idx_periods_teacher_day_period 
  ON periods(teacher_id, day_of_week, period_number);

-- Create materialized view for fairness index
CREATE MATERIALIZED VIEW teacher_workload AS
SELECT 
  t.id as teacher_id,
  COUNT(p.id) FILTER (WHERE p.period_type = 'teaching') as regular_periods,
  COUNT(sr.id) FILTER (WHERE sr.status = 'accepted') as substitution_periods
FROM teachers t
LEFT JOIN periods p ON p.teacher_id = t.id
LEFT JOIN substitution_requests sr ON sr.assigned_teacher_id = t.id
GROUP BY t.id;

-- Refresh every 5 minutes
CREATE OR REPLACE FUNCTION refresh_teacher_workload()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY teacher_workload;
END;
$$ LANGUAGE plpgsql;
```

### Edge Function Optimization
```typescript
// Connection pooling
let supabaseClient: any = null;

function getSupabaseClient() {
  if (!supabaseClient) {
    supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
  }
  return supabaseClient;
}

// Batch notifications
async function sendBatchNotifications(notifications: Array<any>) {
  const batchSize = 30; // Telegram rate limit
  for (let i = 0; i < notifications.length; i += batchSize) {
    const batch = notifications.slice(i, i + batchSize);
    await Promise.all(batch.map(n => sendNotification(n)));
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}
```

### AI Commander Optimization
```typescript
// Cache AI responses
import { LRUCache } from 'lru-cache';

const commandCache = new LRUCache<string, CommandResult>({
  max: 500,
  ttl: 1000 * 60 * 5, // 5 minutes
});

// Parallel context retrieval
const [context, entities] = await Promise.all([
  retrieveContext(command),
  extractEntities(command),
]);
```

## Troubleshooting

### Edge Functions Not Triggering
```bash
# Check webhook configuration
supabase functions logs

# Verify database trigger
SELECT * FROM pg_trigger WHERE tgname = 'periods_change_trigger';

# Test manually
curl -X POST https://your-project.supabase.co/functions/v1/notify-timetable-change \
  -H "Content-Type: application/json" \
  -d '{"record": {...}}'
```

### Telegram Bot Not Responding
```bash
# Check webhook status
curl https://api.telegram.org/bot<TOKEN>/getWebhookInfo

# Remove webhook
curl -X POST https://api.telegram.org/bot<TOKEN>/deleteWebhook

# Set webhook again
npm run bot:setup
```

### Performance Issues
```bash
# Check database query performance
EXPLAIN ANALYZE SELECT * FROM periods WHERE teacher_id = 'xxx';

# Monitor edge function execution time
supabase functions logs --tail

# Check Vercel analytics
vercel logs --follow
```

## Security Checklist

- [ ] RLS policies enabled on all tables
- [ ] Service role key stored securely (not in code)
- [ ] API routes protected with authentication
- [ ] Telegram bot webhook uses HTTPS
- [ ] Database encryption at rest enabled
- [ ] TLS 1.3 for all connections
- [ ] Rate limiting configured
- [ ] CORS properly configured
- [ ] Environment variables not committed to git
- [ ] Audit logging enabled

## Support & Maintenance

### Regular Maintenance Tasks
- **Daily**: Monitor error logs
- **Weekly**: Review performance metrics
- **Monthly**: Update dependencies
- **Quarterly**: Review and optimize database queries

### Backup Strategy
- **Database**: Automatic daily backups (Supabase)
- **Code**: Git repository with tags for releases
- **Configuration**: Environment variables documented

### Contact
For deployment issues, contact:
- DevOps Team: devops@example.com
- Supabase Support: https://supabase.com/support
- Vercel Support: https://vercel.com/support

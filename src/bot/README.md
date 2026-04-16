# Anti-Gravity Telegram Bot

This directory contains the complete Telegram bot integration for the Anti-Gravity Timetable System using the grammY framework.

## Features

### 1. Employee ID Verification
- Teachers can link their Telegram account using `/link` command
- Secure verification against the database
- Prevents duplicate account linking
- Logs failed verification attempts

### 2. Daily Briefings
- Automated daily schedule delivery at 7:30 AM
- Personalized schedule for each teacher
- Handles empty schedules gracefully
- Includes period types (teaching, rest, break, lunch)

### 3. Interactive Substitution Notifications
- Real-time substitution requests with Accept/Decline buttons
- Displays fairness index and period details
- 10-minute response window with automatic escalation
- Notifies admins of acceptance/decline

### 4. Schedule Commands
- `/today` - View today's schedule
- `/week` - View weekly schedule
- Formatted with emojis and clear layout

### 5. Error Handling & Retry Logic
- Exponential backoff retry (3 attempts)
- User-friendly error messages
- Admin notifications for system issues
- PII masking in logs

## File Structure

```
src/bot/
├── index.ts          # Main bot implementation with commands and handlers
├── notifier.ts       # Notification functions with retry logic
├── scheduler.ts      # Daily briefing and cron job handlers
├── webhook.ts        # Webhook setup and handlers
└── README.md         # This file
```

## Setup Instructions

### 1. Create a Telegram Bot

1. Talk to [@BotFather](https://t.me/botfather) on Telegram
2. Use `/newbot` command and follow instructions
3. Copy the bot token
4. Add it to `.env.local`:
   ```
   TELEGRAM_BOT_TOKEN=your_bot_token_here
   ```

### 2. Configure Environment Variables

Add these to your `.env.local`:

```env
# Telegram Bot
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
TELEGRAM_WEBHOOK_SECRET=your_webhook_secret_here

# Cron Jobs
CRON_SECRET=your_cron_secret_here

# Supabase (should already be configured)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 3. Development Mode (Polling)

For local development, run the bot with polling:

```bash
npm run dev
```

The bot will start automatically and listen for updates.

### 4. Production Mode (Webhook)

For production deployment on Vercel:

1. Deploy your app to Vercel
2. Set up the webhook:
   ```bash
   curl -X POST https://your-domain.vercel.app/api/telegram-webhook/setup
   ```
3. The webhook will be configured automatically

### 5. Configure Cron Jobs

The `vercel.json` file already includes cron job configuration:

- **Daily Briefing**: Runs at 7:30 AM daily
- **Check Expired**: Runs every 5 minutes

Vercel will automatically set these up when you deploy.

## API Endpoints

### Telegram Webhook
- **POST** `/api/telegram-webhook` - Receives updates from Telegram
- **GET** `/api/telegram-webhook` - Check webhook status

### Cron Jobs
- **POST** `/api/cron/daily-briefing` - Send daily briefings (called by cron)
- **POST** `/api/cron/check-expired` - Check expired substitution requests (called by cron)

## Bot Commands

### User Commands
- `/start` - Welcome message and instructions
- `/link` - Link Telegram account with Employee ID
- `/today` - View today's schedule
- `/week` - View weekly schedule

### Interactive Features
- **Accept/Decline Buttons** - Respond to substitution requests
- **Employee ID Input** - Text-based verification flow

## Usage Examples

### Linking Account
```
User: /link
Bot: 🔐 Account Linking
     Please enter your Employee ID to link your Telegram account.
     Example: EMP001

User: EMP001
Bot: ✅ Account Successfully Linked!
     Welcome, John Smith!
     ...
```

### Viewing Schedule
```
User: /today
Bot: 📅 Monday, January 15, 2024
     
     Your schedule for today:
     
     1. 09:00-09:45 📚 Math | 9-A | Room 101
     2. 09:45-10:30 📚 Math | 9-B | Room 101
     3. 10:30-11:00 ☕ Rest | - | -
     ...
```

### Substitution Request
```
Bot: 🔔 Substitution Request
     
     📚 Subject: Physics
     👥 Class: 10-B
     🏫 Room: Lab-2
     ⏰ Time: 14:00 - 14:45
     📊 Your Fairness Index: 12
     
     Original teacher: Sarah Johnson
     
     ⏳ Please respond within 10 minutes...
     
     [✅ Accept] [❌ Decline]
```

## Error Handling

The bot implements comprehensive error handling:

1. **Retry Logic**: 3 attempts with exponential backoff (1s, 2s, 4s)
2. **User-Friendly Messages**: Technical errors are translated to friendly messages
3. **Admin Notifications**: System issues are reported to admins
4. **Logging**: All errors are logged with masked PII

### Error Message Examples

- Database unavailable: "The system is temporarily unavailable. We're working on it! 🔧"
- Timeout: "The request took too long. Please try again in a moment. ⏱️"
- Not found: "The requested information could not be found. Please contact admin. 🔍"

## Testing

### Manual Testing

1. Start the bot in development mode
2. Open Telegram and search for your bot
3. Test each command:
   - `/start`
   - `/link` with valid/invalid Employee IDs
   - `/today` and `/week`

### Testing Substitution Notifications

Use the notifier functions directly:

```typescript
import { sendSubstitutionNotification } from '@/bot/notifier';

await sendSubstitutionNotification('telegram_user_id', {
  id: 'request_id',
  subject: 'Math',
  className: '9-A',
  roomName: 'Room 101',
  startTime: '09:00',
  endTime: '09:45',
  originalTeacherName: 'John Smith',
  fairnessIndex: 12
});
```

### Testing Daily Briefings

Trigger manually:

```bash
curl -X POST http://localhost:3000/api/cron/daily-briefing \
  -H "Authorization: Bearer your_cron_secret"
```

## Monitoring

### Logs

All bot operations are logged:
- Command usage
- Verification attempts
- Notification delivery
- Errors and retries

### Metrics to Monitor

- Daily briefing delivery rate
- Substitution response time
- Error rate
- Retry success rate

## Security

1. **Employee ID Verification**: Only valid Employee IDs can link accounts
2. **Webhook Secret**: Verifies requests are from Telegram
3. **Cron Secret**: Protects cron endpoints from unauthorized access
4. **PII Masking**: Sensitive data is masked in logs
5. **Rate Limiting**: Respects Telegram's 30 messages/second limit

## Troubleshooting

### Bot Not Responding

1. Check if `TELEGRAM_BOT_TOKEN` is set correctly
2. Verify the bot is running (development) or webhook is set up (production)
3. Check logs for errors

### Webhook Issues

```bash
# Check webhook status
curl https://your-domain.vercel.app/api/telegram-webhook

# Get webhook info from Telegram
curl https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo
```

### Daily Briefings Not Sending

1. Check if cron job is configured in Vercel
2. Verify `CRON_SECRET` is set
3. Check logs in Vercel dashboard
4. Test manually using the API endpoint

## Future Enhancements

- [ ] Multi-language support
- [ ] Rich media messages (images, documents)
- [ ] Inline queries for quick schedule lookup
- [ ] Group chat support for team coordination
- [ ] Analytics dashboard for bot usage

## Support

For issues or questions:
1. Check the logs in Vercel dashboard
2. Review error messages in Telegram
3. Contact the development team

## License

Part of the Anti-Gravity Timetable System

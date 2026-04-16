# Anti-Gravity School Timetable Management System

A comprehensive timetable management platform with database-enforced scheduling rules, real-time Telegram notifications, and AI-powered natural language administration.

## Features

- **Wing-Based Timetable Management** - Separate timetables for Nursery, Scholar, and Master wings
- **Burnout Protection** - Automatic rest periods after 3 consecutive teaching periods
- **Fair Substitution Marketplace** - AI-powered ranking based on workload and expertise
- **Telegram Integration** - Daily briefings and interactive substitution notifications
- **AI Commander** - Natural language interface for timetable management using Gemini 1.5 Flash
- **Real-Time Sync** - Database triggers and edge functions for instant updates
- **Comprehensive Audit Logging** - Complete change history for all timetable modifications

## Tech Stack

- **Frontend**: Next.js 14 with App Router, React Server Components, Tailwind CSS
- **Backend**: Supabase PostgreSQL with RLS, triggers, and constraints
- **Edge Functions**: Supabase Edge Functions (Deno runtime)
- **Telegram Bot**: grammY framework
- **AI**: Google Gemini 1.5 Flash with RAG pattern
- **Deployment**: Vercel (frontend), Supabase (backend + edge functions)

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Supabase account
- Telegram bot token
- Gemini API key

### Installation

```bash
# Clone repository
git clone <repository-url>
cd anti-gravity

# Install dependencies
npm install

# Set up environment variables
cp .env.local.example .env.local
# Edit .env.local with your credentials

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## Testing

The system includes comprehensive test coverage with 63 correctness properties validated through property-based testing.

### Run Tests

```bash
# All tests
npm test

# Unit tests
npm run test:unit

# Property-based tests (100 iterations per property)
npm run test:property

# Integration tests
npm run test:integration

# Coverage report
npm run test:coverage
```

See [TESTING.md](TESTING.md) for detailed testing documentation.

## Deployment

### Frontend (Vercel)

```bash
# Deploy to production
vercel --prod
```

### Backend (Supabase)

```bash
# Deploy edge functions
cd supabase
supabase functions deploy

# Run database migrations
supabase db push
```

### Telegram Bot

```bash
# Set up webhook
npm run bot:setup

# Test bot
npm run bot:info
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for complete deployment guide.

## Project Structure

```
anti-gravity/
├── src/
│   ├── app/                    # Next.js app router pages
│   ├── components/             # React components
│   ├── lib/                    # Utilities and services
│   │   ├── ai-commander/       # AI command processing
│   │   └── scheduler/          # Scheduling logic
│   ├── bot/                    # Telegram bot
│   └── types/                  # TypeScript types
├── supabase/
│   ├── functions/              # Edge functions
│   │   ├── notify-timetable-change/
│   │   ├── process-substitution-request/
│   │   ├── handle-database-webhook/
│   │   └── check-expired-requests/
│   ├── schema.sql              # Database schema
│   └── seed.ts                 # Seed data
├── tests/
│   ├── unit/                   # Unit tests
│   ├── property/               # Property-based tests
│   └── integration/            # Integration tests
├── .github/
│   └── workflows/              # CI/CD pipelines
│       ├── test.yml            # Test workflow
│       └── deploy.yml          # Deployment workflow
└── scripts/                    # Utility scripts
```

## Key Components

### Database Schema

The system uses PostgreSQL with:
- **RLS Policies** - Row-level security for data access control
- **Check Constraints** - Enforce consecutive period limits
- **Unique Constraints** - Prevent double-booking
- **Triggers** - Auto-insert rest periods and audit logs
- **Functions** - Calculate fairness index and validate constraints

### Edge Functions

Four edge functions handle real-time operations:
1. **notify-timetable-change** - Send notifications on timetable updates
2. **process-substitution-request** - Calculate fairness rankings
3. **handle-database-webhook** - Process database change events
4. **check-expired-requests** - Auto-expire old substitution requests

### Telegram Bot

Features:
- Employee ID verification for account linking
- Daily briefings at 7:30 AM
- Interactive substitution notifications with Accept/Decline buttons
- Auto-escalation after 10 minutes of no response

### AI Commander

Natural language interface using Gemini 1.5 Flash:
- RAG pattern for context-aware responses
- 3-second response time target
- Constraint validation before execution
- Audit logging for all commands

## Performance Targets

| Operation | Target | Status |
|-----------|--------|--------|
| AI Substitution Suggestions | < 3 seconds | ✅ |
| Real-Time Notifications | < 5 seconds | ✅ |
| AI Command Processing | < 3 seconds | ✅ |
| Fairness Index Calculation | < 3 seconds | ✅ |
| Daily Briefing Formatting | < 5 seconds | ✅ |

## Correctness Properties

The system validates 63 correctness properties through property-based testing:

### Database Constraints
- Wing isolation and constraint enforcement
- Consecutive period limits (max 3)
- Double-booking prevention
- Foreign key integrity

### Fairness & Scheduling
- Fairness index monotonicity
- Expertise-based prioritization
- Substitution ranking correctness

### Security & Access Control
- RLS policy enforcement
- API authentication
- Data masking in logs and UI

### Performance
- Sub-3-second AI responses
- Sub-5-second notifications
- Scalability under load

See [design document](.kiro/specs/anti-gravity-timetable-system/design.md) for complete property list.

## CI/CD Pipeline

### Automated Testing
- Runs on every push and pull request
- Unit tests, property tests, integration tests
- Coverage reporting
- Build verification

### Automated Deployment
- Deploys to Vercel on push to `main`
- Deploys edge functions to Supabase
- Runs database migrations
- Verifies deployment health

## Environment Variables

### Required Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Telegram
TELEGRAM_BOT_TOKEN=your-bot-token

# AI
GEMINI_API_KEY=your-gemini-api-key

# Environment
NODE_ENV=production
```

See [.env.local.example](.env.local.example) for complete list.

## Scripts

```bash
# Development
npm run dev                 # Start development server
npm run build              # Build for production
npm run start              # Start production server
npm run lint               # Run linter

# Testing
npm test                   # Run all tests
npm run test:unit          # Run unit tests
npm run test:property      # Run property-based tests
npm run test:integration   # Run integration tests
npm run test:coverage      # Generate coverage report

# Telegram Bot
npm run bot:setup          # Set up bot webhook
npm run bot:remove         # Remove bot webhook
npm run bot:info           # Get bot information
npm run bot:bot            # Test bot locally

# Edge Functions
npm run edge:setup         # Set up edge functions
npm run edge:test          # Test edge functions
npm run edge:deploy        # Deploy edge functions
npm run edge:logs          # View edge function logs
```

## Documentation

- [Testing Guide](TESTING.md) - Comprehensive testing documentation
- [Deployment Guide](DEPLOYMENT.md) - Production deployment instructions
- [Design Document](.kiro/specs/anti-gravity-timetable-system/design.md) - System architecture and design
- [Requirements](.kiro/specs/anti-gravity-timetable-system/requirements.md) - Functional requirements
- [Tasks](.kiro/specs/anti-gravity-timetable-system/tasks.md) - Implementation plan

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Write tests for your changes
4. Ensure all tests pass (`npm test`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## License

This project is licensed under the MIT License.

## Support

For issues and questions:
- Create an issue on GitHub
- Contact: support@example.com
- Documentation: [Wiki](https://github.com/your-org/anti-gravity/wiki)

## Acknowledgments

- Supabase for backend infrastructure
- Vercel for frontend hosting
- Telegram for bot platform
- Google for Gemini AI
- fast-check for property-based testing

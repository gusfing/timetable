# Anti-Gravity Timetable System - Database Setup

This directory contains the complete database schema for the Anti-Gravity School Timetable Management System.

## Files

- **schema.sql**: Complete database schema with tables, constraints, triggers, functions, and RLS policies
- **seed.ts**: Seed data for testing and development (if needed)
- **rls_test.ts**: Tests for Row Level Security policies

## Database Schema Overview

The schema implements a three-layer architecture with the database as the source of truth:

### Tables
1. **wings** - Academic divisions (Blossom, Scholar, Master)
2. **teachers** - Teacher profiles with Employee ID and Telegram linking
3. **classes** - Class definitions with wing assignments and class teachers
4. **rooms** - Room inventory with capacity and wing assignments
5. **periods** - Core timetable data with scheduling constraints
6. **substitution_requests** - Substitution marketplace with fairness ranking
7. **audit_logs** - Complete audit trail of all timetable changes

### Key Features

#### Constraints
- **Check constraints**: Consecutive period limits (max 3), data validation
- **Unique constraints**: Double-booking prevention for teachers and rooms
- **Foreign key constraints**: Referential integrity across all tables
- **Time validation**: Ensures end_time > start_time for all periods

#### Database Functions
- **calculate_fairness_index()**: Calculates teacher workload for fair substitution distribution
- **check_consecutive_periods()**: Validates consecutive teaching period limits

#### Triggers
- **enforce_consecutive_limit**: Prevents 4+ consecutive teaching periods
- **auto_rest_after_three**: Automatically inserts rest periods after 3 consecutive teaching periods
- **audit_periods**: Logs all changes to periods table
- **audit_substitution_requests**: Logs all changes to substitution requests

#### Row Level Security (RLS)
- Teachers can only view their own data
- Admins have full access to all data
- Teachers can accept/decline substitution requests assigned to them
- Audit logs are admin-only

## Setup Instructions

### Option 1: Using Supabase Dashboard

1. Log in to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy the contents of `schema.sql`
4. Paste into the SQL Editor and run
5. Verify all tables, functions, and triggers were created successfully

### Option 2: Using Supabase CLI

```bash
# Initialize Supabase in your project (if not already done)
supabase init

# Link to your Supabase project
supabase link --project-ref your-project-ref

# Apply the schema
supabase db push

# Or run the schema file directly
psql -h db.your-project-ref.supabase.co -U postgres -d postgres -f supabase/schema.sql
```

### Option 3: Using Migration Files

```bash
# Create a new migration
supabase migration new initial_schema

# Copy the contents of schema.sql to the new migration file
# Then apply migrations
supabase db push
```

## Verification

After running the schema, verify the setup:

```sql
-- Check all tables were created
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check triggers
SELECT trigger_name, event_object_table 
FROM information_schema.triggers 
WHERE trigger_schema = 'public';

-- Check functions
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_type = 'FUNCTION';

-- Check RLS policies
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public';
```

## Requirements Coverage

This database schema satisfies the following requirements from the specification:

- **Requirement 1.1-1.4**: Wing-based timetable management with RLS policies
- **Requirement 2.1-2.4**: Teacher burnout protection via triggers and constraints
- **Requirement 4.3**: Fairness Index calculation function
- **Requirement 11.1-11.4**: Role-based access control via RLS policies
- **Requirement 15.1-15.5**: Database constraint enforcement (check, unique, foreign key)
- **Requirement 17.1, 17.4-17.5**: Audit logging via triggers

## Next Steps

After setting up the database:

1. Configure Supabase Auth for Employee ID verification
2. Set up Edge Functions for real-time Telegram notifications
3. Implement the Next.js frontend with Supabase client
4. Configure the Telegram bot with grammY framework
5. Set up the AI Commander with Gemini 1.5 Flash and RAG

## Notes

- The schema uses `auth.uid()` for RLS policies, which requires Supabase Auth to be configured
- All timestamps use `TIMESTAMPTZ` for timezone awareness
- The schema includes seed data for the three wings (Blossom, Scholar, Master)
- Indexes are optimized for common query patterns (teacher schedules, substitution lookups)

## Troubleshooting

### Common Issues

1. **Extension errors**: Ensure `uuid-ossp` and `pgcrypto` extensions are enabled
2. **RLS policy errors**: Verify Supabase Auth is configured and users have proper roles
3. **Trigger errors**: Check that functions are created before triggers
4. **Foreign key errors**: Ensure tables are created in the correct order

### Support

For issues or questions, refer to:
- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- Project requirements and design documents in `.kiro/specs/anti-gravity-timetable-system/`

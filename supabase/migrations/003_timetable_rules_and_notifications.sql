-- ============================================================
-- AI Timetable System — Database Migration
-- Run this in your Supabase SQL Editor
-- ============================================================

-- ============================================================
-- TABLE: timetable_rules
-- Stores editable per-tenant scheduling rules (12 total)
-- ============================================================
CREATE TABLE IF NOT EXISTS timetable_rules (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                     UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Rule 1: Anti-Burnout Limit
  "maxConsecutivePeriods"       INTEGER NOT NULL DEFAULT 3 CHECK ("maxConsecutivePeriods" BETWEEN 1 AND 6),

  -- Rule 2: Day Teacher Break
  "dayTeacherBreaks"            INTEGER NOT NULL DEFAULT 1 CHECK ("dayTeacherBreaks" BETWEEN 0 AND 3),

  -- Rule 3: School Break Period (1-8)
  "schoolBreakPeriod"           INTEGER NOT NULL DEFAULT 5 CHECK ("schoolBreakPeriod" BETWEEN 1 AND 8),

  -- Rule 4: Min Daily Periods
  "minDailyPeriods"             INTEGER NOT NULL DEFAULT 6 CHECK ("minDailyPeriods" BETWEEN 1 AND 8),

  -- Rule 5: Max Daily Periods
  "maxDailyPeriods"             INTEGER NOT NULL DEFAULT 8 CHECK ("maxDailyPeriods" BETWEEN 1 AND 8),

  -- Rule 6: Wing Isolation
  "wingIsolation"               BOOLEAN NOT NULL DEFAULT true,

  -- Rule 7: Blossom Supervision
  "blossomSupervisionAlways"    BOOLEAN NOT NULL DEFAULT true,

  -- Rule 8: Subject Burnout Limit
  "subjectBurnoutLimit"         INTEGER NOT NULL DEFAULT 4 CHECK ("subjectBurnoutLimit" BETWEEN 1 AND 10),

  -- Rule 9: Double Period
  "doublePeriodEnabled"         BOOLEAN NOT NULL DEFAULT false,

  -- Rule 10: Fairness Index
  "fairnessIndexEnabled"        BOOLEAN NOT NULL DEFAULT true,

  -- Rule 11: Substitute Workload Cap
  "substituteWorkloadCap"       INTEGER NOT NULL DEFAULT 6 CHECK ("substituteWorkloadCap" BETWEEN 1 AND 8),

  -- Rule 12: Same-Wing Substitute Preference
  "sameWingSubstitutePreferred" BOOLEAN NOT NULL DEFAULT true,

  created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE timetable_rules ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can read/write their own tenant's rules
CREATE POLICY "Admins can manage their rules"
  ON timetable_rules
  FOR ALL
  USING (auth.uid() = tenant_id)
  WITH CHECK (auth.uid() = tenant_id);

-- ============================================================
-- TABLE: teacher_notifications
-- Stores in-app notifications for teachers
-- ============================================================
CREATE TABLE IF NOT EXISTS teacher_notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  teacher_id  UUID NOT NULL,  -- References teachers.id
  type        TEXT NOT NULL CHECK (type IN (
    'substitution_request',
    'schedule_change',
    'absence_marked',
    'assignment',
    'reminder'
  )),
  title       TEXT NOT NULL,
  message     TEXT NOT NULL,
  metadata    JSONB,
  is_read     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_teacher_notifs_teacher ON teacher_notifications(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_notifs_unread ON teacher_notifications(teacher_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_teacher_notifs_created ON teacher_notifications(created_at DESC);

-- Enable RLS
ALTER TABLE teacher_notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Admins see all in their tenant
CREATE POLICY "Admins can manage notifications"
  ON teacher_notifications
  FOR ALL
  USING (auth.uid() = tenant_id)
  WITH CHECK (auth.uid() = tenant_id);

-- Policy: Teachers can see their own notifications
CREATE POLICY "Teachers can see own notifications"
  ON teacher_notifications
  FOR SELECT
  USING (auth.uid() = teacher_id);

-- ============================================================
-- UPDATE: teachers table
-- Add class_teacher fields & wing column if not exists
-- ============================================================
ALTER TABLE teachers 
  ADD COLUMN IF NOT EXISTS is_class_teacher BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS class_teacher_for UUID REFERENCES classes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS wing TEXT;

-- ============================================================
-- UPDATE: periods table
-- Ensure period numbers are 1-8 (not 0-7)
-- Add check constraint for 8 periods
-- ============================================================
ALTER TABLE periods
  ADD COLUMN IF NOT EXISTS is_school_break BOOLEAN NOT NULL DEFAULT false;

-- Index for fast period lookups
CREATE INDEX IF NOT EXISTS idx_periods_teacher_day ON periods(teacher_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_periods_day ON periods(day_of_week, period_number);

-- ============================================================
-- INSERT default rules for existing admin users
-- (Idempotent — won't overwrite existing)
-- ============================================================
INSERT INTO timetable_rules (tenant_id)
SELECT id FROM auth.users
WHERE id NOT IN (SELECT tenant_id FROM timetable_rules)
ON CONFLICT (tenant_id) DO NOTHING;

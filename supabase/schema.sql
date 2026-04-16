-- ============================================================================
-- Anti-Gravity School Timetable Management System - Database Schema (V2.0)
-- Multi-Tenant SaaS Architecture
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- TABLES
-- ============================================================================

-- 1. Tenants table (Organizations/Schools)
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  domain TEXT UNIQUE,
  subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active', 'inactive', 'trial')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Wings table
CREATE TABLE wings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

-- 3. Teachers table (Users)
CREATE TABLE teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL,
  name TEXT NOT NULL,
  telegram_user_id TEXT,
  telegram_linked_at TIMESTAMPTZ,
  subjects TEXT[] DEFAULT '{}',
  role TEXT NOT NULL CHECK (role IN ('teacher', 'admin', 'superadmin')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, employee_id)
);

-- Unique index to ensure 1 telegram user per tenant
CREATE UNIQUE INDEX idx_unique_telegram_per_tenant ON teachers (tenant_id, telegram_user_id) WHERE telegram_user_id IS NOT NULL;

-- 4. Classes table
CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  wing_id UUID NOT NULL REFERENCES wings(id),
  class_teacher_id UUID REFERENCES teachers(id),
  grade_level INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, name, wing_id)
);

-- 5. Rooms table
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  capacity INTEGER,
  wing_id UUID REFERENCES wings(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);

-- 6. Periods table (core timetable data)
CREATE TABLE periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES teachers(id),
  class_id UUID NOT NULL REFERENCES classes(id),
  room_id UUID REFERENCES rooms(id),
  wing_id UUID NOT NULL REFERENCES wings(id),
  subject TEXT NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  period_number INTEGER NOT NULL CHECK (period_number BETWEEN 0 AND 10),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_period_zero BOOLEAN DEFAULT FALSE,
  period_type TEXT NOT NULL DEFAULT 'teaching' CHECK (period_type IN ('teaching', 'rest', 'prep', 'break', 'lunch')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent double-booking of teachers per tenant
  UNIQUE(tenant_id, teacher_id, day_of_week, period_number),
  
  -- Prevent double-booking of rooms per tenant
  UNIQUE(tenant_id, room_id, day_of_week, period_number),
  
  -- Ensure end time is after start time
  CHECK (end_time > start_time)
);

-- 7. Substitution requests table
CREATE TABLE substitution_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  original_teacher_id UUID NOT NULL REFERENCES teachers(id),
  period_id UUID NOT NULL REFERENCES periods(id),
  requested_by UUID NOT NULL REFERENCES teachers(id),
  assigned_teacher_id UUID REFERENCES teachers(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'accepted', 'declined', 'expired', 'cancelled')),
  rejection_reason TEXT,
  fairness_ranking JSONB,
  expiration_time TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CHECK (expiration_time > created_at)
);

-- 8. Tenant Configs (Metadata & Rules)
CREATE TABLE tenant_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  rules JSONB DEFAULT '{}',
  ai_settings JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id)
);

-- 9. Audit log table
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data JSONB,
  new_data JSONB,
  changed_by UUID REFERENCES teachers(id),
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address INET
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_tenants_domain ON tenants(domain);
CREATE INDEX idx_teachers_tenant ON teachers(tenant_id);
CREATE INDEX idx_classes_tenant ON classes(tenant_id);

CREATE INDEX idx_periods_tenant ON periods(tenant_id);
CREATE INDEX idx_periods_teacher_day ON periods(teacher_id, day_of_week);
CREATE INDEX idx_periods_class_day ON periods(class_id, day_of_week);
CREATE INDEX idx_periods_wing ON periods(wing_id);

CREATE INDEX idx_substitution_tenant ON substitution_requests(tenant_id);
CREATE INDEX idx_substitution_status ON substitution_requests(status);
CREATE INDEX idx_substitution_expiration ON substitution_requests(expiration_time) WHERE status = 'pending';

-- ============================================================================
-- DATABASE FUNCTIONS & TRIGGERS
-- ============================================================================

-- Function: Get Current User's Tenant ID (Security Definer avoids recursion)
CREATE OR REPLACE FUNCTION get_current_tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id FROM teachers WHERE id = auth.uid() LIMIT 1;
$$ STABLE LANGUAGE sql SECURITY DEFINER;

-- Function: Check if user is SuperAdmin
CREATE OR REPLACE FUNCTION is_user_superadmin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS(SELECT 1 FROM teachers WHERE id = auth.uid() AND role = 'superadmin');
$$ STABLE LANGUAGE sql SECURITY DEFINER;

-- Function: Check if user is Admin
CREATE OR REPLACE FUNCTION is_user_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS(SELECT 1 FROM teachers WHERE id = auth.uid() AND role IN ('admin', 'superadmin'));
$$ STABLE LANGUAGE sql SECURITY DEFINER;

-- Calculate Fairness Index for a teacher
CREATE OR REPLACE FUNCTION calculate_fairness_index(teacher_uuid UUID, target_week DATE)
RETURNS INTEGER AS $$
DECLARE
  teaching_count INTEGER;
  substitution_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO teaching_count
  FROM periods
  WHERE teacher_id = teacher_uuid
    AND period_type = 'teaching'
    AND day_of_week BETWEEN 0 AND 6;
  
  SELECT COUNT(*) INTO substitution_count
  FROM substitution_requests sr
  JOIN periods p ON sr.period_id = p.id
  WHERE sr.assigned_teacher_id = teacher_uuid
    AND sr.status = 'accepted'
    AND p.start_time >= target_week
    AND p.start_time < target_week + INTERVAL '7 days';
  
  RETURN teaching_count + substitution_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- Trigger: Check consecutive teaching periods
CREATE OR REPLACE FUNCTION check_consecutive_periods()
RETURNS TRIGGER AS $$
DECLARE
  consecutive_count INTEGER;
BEGIN
  IF NEW.period_type != 'teaching' THEN
    RETURN NEW;
  END IF;
  
  SELECT COUNT(*) INTO consecutive_count
  FROM periods
  WHERE teacher_id = NEW.teacher_id
    AND day_of_week = NEW.day_of_week
    AND period_number < NEW.period_number
    AND period_number >= NEW.period_number - 2
    AND period_type = 'teaching';
  
  IF consecutive_count >= 3 THEN
    RAISE EXCEPTION 'Cannot assign fourth consecutive teaching period. Teacher needs rest after 3 consecutive periods.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_consecutive_limit
  BEFORE INSERT OR UPDATE ON periods
  FOR EACH ROW
  EXECUTE FUNCTION check_consecutive_periods();

-- Trigger: Auto-insert rest period after 3 consecutive teaching periods
CREATE OR REPLACE FUNCTION auto_insert_rest_period()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.period_type = 'teaching' AND
     (SELECT COUNT(*) FROM periods
      WHERE teacher_id = NEW.teacher_id
        AND day_of_week = NEW.day_of_week
        AND period_number < NEW.period_number
        AND period_number >= NEW.period_number - 2
        AND period_type = 'teaching') = 2 THEN
    
    INSERT INTO periods (tenant_id, teacher_id, class_id, wing_id, subject, day_of_week, period_number, start_time, end_time, period_type)
    SELECT NEW.tenant_id, NEW.teacher_id, NEW.class_id, NEW.wing_id, 'Rest', NEW.day_of_week, NEW.period_number + 1,
           NEW.end_time, NEW.end_time + INTERVAL '45 minutes', 'rest'
    WHERE NOT EXISTS (
      SELECT 1 FROM periods
      WHERE teacher_id = NEW.teacher_id
        AND day_of_week = NEW.day_of_week
        AND period_number = NEW.period_number + 1
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_rest_after_three
  AFTER INSERT OR UPDATE ON periods
  FOR EACH ROW
  EXECUTE FUNCTION auto_insert_rest_period();

-- Trigger: Audit log for all timetable changes
CREATE OR REPLACE FUNCTION log_timetable_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (tenant_id, table_name, record_id, action, old_data, changed_by)
    VALUES (OLD.tenant_id, TG_TABLE_NAME, OLD.id, 'DELETE', row_to_json(OLD), auth.uid());
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (tenant_id, table_name, record_id, action, old_data, new_data, changed_by)
    VALUES (NEW.tenant_id, TG_TABLE_NAME, NEW.id, 'UPDATE', row_to_json(OLD), row_to_json(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (tenant_id, table_name, record_id, action, new_data, changed_by)
    VALUES (NEW.tenant_id, TG_TABLE_NAME, NEW.id, 'INSERT', row_to_json(NEW), auth.uid());
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_periods
  AFTER INSERT OR UPDATE OR DELETE ON periods
  FOR EACH ROW
  EXECUTE FUNCTION log_timetable_changes();

CREATE TRIGGER audit_substitution_requests
  AFTER INSERT OR UPDATE OR DELETE ON substitution_requests
  FOR EACH ROW
  EXECUTE FUNCTION log_timetable_changes();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE wings ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE substitution_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Tenants: Superadmin can see all, others can only see their own
CREATE POLICY tenant_isolation_tenants ON tenants 
  FOR SELECT 
  USING (is_user_superadmin() OR id = get_current_tenant_id());

-- Teachers: Restricted to Tenant, Admins can write
CREATE POLICY tenant_isolation_teachers_read ON teachers FOR SELECT 
  USING (is_user_superadmin() OR tenant_id = get_current_tenant_id());
CREATE POLICY tenant_isolation_teachers_all ON teachers FOR ALL 
  USING (is_user_superadmin() OR (tenant_id = get_current_tenant_id() AND is_user_admin()));

-- Wings, Classes, Rooms: Read-only for teachers, writable for admins
CREATE POLICY tenant_read_wings ON wings FOR SELECT USING (is_user_superadmin() OR tenant_id = get_current_tenant_id());
CREATE POLICY admin_write_wings ON wings FOR ALL USING (is_user_superadmin() OR (tenant_id = get_current_tenant_id() AND is_user_admin()));

CREATE POLICY tenant_read_classes ON classes FOR SELECT USING (is_user_superadmin() OR tenant_id = get_current_tenant_id());
CREATE POLICY admin_write_classes ON classes FOR ALL USING (is_user_superadmin() OR (tenant_id = get_current_tenant_id() AND is_user_admin()));

CREATE POLICY tenant_read_rooms ON rooms FOR SELECT USING (is_user_superadmin() OR tenant_id = get_current_tenant_id());
CREATE POLICY admin_write_rooms ON rooms FOR ALL USING (is_user_superadmin() OR (tenant_id = get_current_tenant_id() AND is_user_admin()));

-- Periods: Read-only for teachers, writable for admins
CREATE POLICY tenant_read_periods ON periods FOR SELECT USING (is_user_superadmin() OR tenant_id = get_current_tenant_id());
CREATE POLICY admin_write_periods ON periods FOR ALL USING (is_user_superadmin() OR (tenant_id = get_current_tenant_id() AND is_user_admin()));

-- Substitutions: Teachers can read tenant, but only update if assigned to them. Admins can do all.
CREATE POLICY tenant_read_subs ON substitution_requests FOR SELECT USING (is_user_superadmin() OR tenant_id = get_current_tenant_id());
CREATE POLICY admin_all_subs ON substitution_requests FOR ALL USING (is_user_superadmin() OR (tenant_id = get_current_tenant_id() AND is_user_admin()));
CREATE POLICY teacher_create_subs_self ON substitution_requests FOR INSERT 
  WITH CHECK (tenant_id = get_current_tenant_id() AND original_teacher_id = auth.uid());
CREATE POLICY teacher_update_subs_self ON substitution_requests FOR UPDATE 
  USING (tenant_id = get_current_tenant_id() AND assigned_teacher_id = auth.uid())
  WITH CHECK (status IN ('accepted', 'declined'));

-- Audit Logs: Admin/Superadmin only
CREATE POLICY admin_read_audit ON audit_logs FOR SELECT USING (is_user_superadmin() OR (tenant_id = get_current_tenant_id() AND is_user_admin()));

-- Tenant Configs: Restricted to Tenant, Admins can write
CREATE POLICY tenant_read_config ON tenant_configs FOR SELECT 
  USING (is_user_superadmin() OR tenant_id = get_current_tenant_id());
CREATE POLICY admin_write_config ON tenant_configs FOR ALL 
  USING (is_user_superadmin() OR (tenant_id = get_current_tenant_id() AND is_user_admin()));

-- ============================================================================
-- INITIAL SEED
-- ============================================================================
-- See seed.ts for actual data generation to ensure deterministic UUID mapping.

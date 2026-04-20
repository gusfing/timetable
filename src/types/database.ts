export type Wing = 'Blossom' | 'Scholar' | 'Master';

export interface Tenant {
    id: string;
    name: string;
    domain: string | null;
    subscription_status: 'active' | 'inactive' | 'trial';
    created_at: string;
    updated_at: string;
}

export interface Teacher {
    id: string;
    tenant_id?: string;
    employee_id: string;
    name: string;
    telegram_user_id?: string | null;
    telegram_linked_at?: string | null;
    subjects: string[];
    role?: 'teacher' | 'admin' | 'superadmin';
    wing?: Wing; // UI convenience
    is_onboarded?: boolean;
    title?: string; // Mr., Mrs., Dr., etc.
    post?: string;  // HOD, Coordinator, PT Teacher, etc.
    created_at?: string;
    updated_at?: string;
    classTeacher?: string; // UI convenience for mock data
    workload_score?: number; // Calculated field
}

export interface TimetableEntry {
    id: string;
    tenant_id: string;
    teacher_id: string;
    class_id: string;
    room_id: string | null;
    wing_id: string;
    subject: string;
    day_of_week: number;
    period_number: number;
    start_time: string;
    end_time: string;
    is_period_zero: boolean;
    period_type: 'teaching' | 'rest' | 'prep' | 'break' | 'lunch';
    created_at: string;
    updated_at: string;
    // UI dynamic fields
    class_name?: string;
    is_substitution?: boolean;
    day?: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri';
}

export interface SubstitutionRequest {
    id: string;
    tenant_id: string;
    original_teacher_id: string;
    period_id: string;
    requested_by: string;
    assigned_teacher_id: string | null;
    status: 'pending' | 'assigned' | 'accepted' | 'declined' | 'expired' | 'cancelled';
    fairness_ranking: any | null; 
    expiration_time: string; 
    created_at: string; 
    updated_at: string; 
}

export interface AuditLog {
    id: string;
    tenant_id: string;
    table_name: string;
    record_id: string;
    action: string;
    old_data: any;
    new_data: any;
    changed_by: string | null;
    changed_at: string;
    ip_address: string | null;
}

export interface Class {
    id: string;
    tenant_id: string;
    name: string;
    wing_id: string;
    class_teacher_id: string | null;
    grade_level: number | null;
    created_at: string;
}

export interface Room {
    id: string;
    tenant_id: string;
    name: string;
    capacity: number | null;
    wing_id: string | null;
    created_at: string;
}

export interface WingEntity {
    id: string;
    tenant_id: string;
    name: Wing;
    description: string | null;
    created_at: string;
}

export interface Database {
    public: {
        Tables: {
            tenants: {
                Row: Tenant;
                Insert: Omit<Tenant, 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Omit<Tenant, 'id' | 'created_at' | 'updated_at'>>;
            };
            wings: {
                Row: WingEntity;
                Insert: Omit<WingEntity, 'id' | 'created_at'>;
                Update: Partial<Omit<WingEntity, 'id' | 'created_at'>>;
            };
            teachers: {
                Row: Teacher;
                Insert: Omit<Teacher, 'id' | 'created_at' | 'updated_at' | 'workload_score' | 'wing'>;
                Update: Partial<Omit<Teacher, 'id' | 'created_at' | 'updated_at' | 'workload_score' | 'wing'>>;
            };
            classes: {
                Row: Class;
                Insert: Omit<Class, 'id' | 'created_at'>;
                Update: Partial<Omit<Class, 'id' | 'created_at'>>;
            };
            rooms: {
                Row: Room;
                Insert: Omit<Room, 'id' | 'created_at'>;
                Update: Partial<Omit<Room, 'id' | 'created_at'>>;
            };
            periods: {
                Row: TimetableEntry;
                Insert: Omit<TimetableEntry, 'id' | 'created_at' | 'updated_at' | 'class_name' | 'is_substitution' | 'day'>;
                Update: Partial<Omit<TimetableEntry, 'id' | 'created_at' | 'updated_at' | 'class_name' | 'is_substitution' | 'day'>>;
            };
            substitution_requests: {
                Row: SubstitutionRequest;
                Insert: Omit<SubstitutionRequest, 'id' | 'created_at' | 'updated_at'>;
                Update: Partial<Omit<SubstitutionRequest, 'id' | 'created_at' | 'updated_at'>>;
            };
            audit_logs: {
                Row: AuditLog;
                Insert: Omit<AuditLog, 'id' | 'changed_at'>;
                Update: Partial<Omit<AuditLog, 'id' | 'changed_at'>>;
            };
        };
    };
}

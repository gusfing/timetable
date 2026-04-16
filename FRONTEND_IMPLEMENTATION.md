# Frontend Implementation - Task 4

This document describes the Next.js frontend components implemented for the Anti-Gravity Timetable System.

## Implemented Components

### 1. Reusable Components

#### TimetableGrid Component (`src/components/TimetableGrid.tsx`)
- **Purpose**: Reusable timetable grid with drag-and-drop functionality
- **Features**:
  - Weekly view with 8 periods per day
  - Drag-and-drop period assignment
  - Wing-based color coding
  - Substitution indicators
  - Smart substitution dialog
  - Forbidden zone detection (burnout protection)
- **Props**:
  - `teachers`: Array of teacher objects
  - `timetable`: Array of timetable entries
  - `selectedDay`: Currently selected day
  - `onDragEnd`: Callback for drag-and-drop events
  - `editable`: Enable/disable drag-and-drop

#### SubstitutionCard Component (`src/components/SubstitutionCard.tsx`)
- **Purpose**: Display substitution requests with fairness ranking
- **Features**:
  - Status badges (pending, assigned, accepted, declined, expired)
  - Fairness ranking display with top 3 candidates
  - Expertise match indicators
  - Accept/Decline actions for assigned teachers
  - Expiration warnings
- **Props**:
  - `request`: Substitution request object with period and ranking data
  - `onAssign`: Callback for assigning a substitute
  - `onAccept`: Callback for accepting a substitution
  - `onDecline`: Callback for declining a substitution
  - `showActions`: Show/hide action buttons

### 2. Pages

#### Substitution Marketplace (`src/app/admin/substitutions/page.tsx`)
- **Route**: `/admin/substitutions`
- **Features**:
  - Browse all substitution requests
  - Filter by status (pending, assigned, accepted, declined, expired)
  - Search by teacher, subject, or class
  - Assign substitutes with fairness ranking
  - Real-time updates with SWR
- **Requirements Validated**: 4.1, 4.2, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4

#### Audit Log Viewer (`src/app/admin/audit-logs/page.tsx`)
- **Route**: `/admin/audit-logs`
- **Features**:
  - Complete audit trail of all timetable changes
  - Filter by table name and action type
  - Search functionality
  - Detailed view of before/after states
  - Export to CSV
  - Timestamp and user tracking
- **Requirements Validated**: 17.1, 17.4, 17.5

#### Teacher Profile Page (`src/app/teacher/profile/page.tsx`)
- **Route**: `/teacher/profile`
- **Features**:
  - View personal profile information
  - Weekly schedule view
  - Telegram account linking with Employee ID verification
  - Pending substitution requests
  - Accept/Decline substitution actions
- **Requirements Validated**: 6.1, 6.2, 6.3, 6.4, 6.5, 7.1, 7.2, 7.3

#### Login Page (`src/app/login/page.tsx`)
- **Route**: `/login`
- **Features**:
  - Employee ID authentication
  - Role-based redirection (admin vs teacher)
  - Supabase authentication integration
  - Redirect to original requested page after login

### 3. Authentication & Middleware

#### Middleware (`src/middleware.ts`)
- **Purpose**: Protect routes and enforce role-based access control
- **Features**:
  - Session validation
  - Protected route enforcement
  - Role-based access (admin vs teacher)
  - Automatic redirection to login
- **Requirements Validated**: 11.1, 11.2, 11.3, 11.4, 11.5

### 4. Data Fetching Hooks (SWR)

#### useTimetable Hook (`src/lib/hooks/useTimetable.ts`)
- **Purpose**: Fetch and cache timetable data
- **Features**:
  - Automatic revalidation every 30 seconds
  - Wing-based filtering
  - Optimistic updates
  - Error handling

#### useTeachers Hook (`src/lib/hooks/useTeachers.ts`)
- **Purpose**: Fetch and cache teacher data
- **Features**:
  - Automatic revalidation every 60 seconds
  - Sorted by name
  - Optimistic updates

#### useSubstitutions Hook (`src/lib/hooks/useSubstitutions.ts`)
- **Purpose**: Fetch and cache substitution requests
- **Features**:
  - Automatic revalidation every 15 seconds
  - Status-based filtering
  - Includes related teacher and period data

## Architecture Decisions

### 1. Component Extraction
The existing admin dashboard had timetable grid logic embedded. We extracted it into a reusable `TimetableGrid` component that can be used in both admin and teacher views with different permission levels.

### 2. SWR for Data Fetching
Implemented SWR (stale-while-revalidate) for:
- Automatic background revalidation
- Optimistic UI updates
- Reduced server load with intelligent caching
- Better user experience with instant data display

### 3. Authentication Flow
- Middleware-based route protection
- Role-based access control at the middleware level
- Supabase auth integration with Employee ID verification
- Automatic redirection based on user role

### 4. Real-time Updates
- SWR polling for near real-time updates
- Optimistic updates for immediate UI feedback
- Webhook integration for Telegram notifications

## Installation

1. Install new dependencies:
```bash
npm install swr @supabase/auth-helpers-nextjs
```

2. Set up environment variables in `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

3. Run the development server:
```bash
npm run dev
```

## Routes

### Admin Routes (Protected, Admin Role Required)
- `/admin/dashboard` - Main admin dashboard with live timetable grid
- `/admin/substitutions` - Substitution marketplace
- `/admin/audit-logs` - Audit log viewer

### Teacher Routes (Protected, Teacher Role Required)
- `/teacher/profile` - Teacher profile and schedule

### Public Routes
- `/login` - Authentication page

## Performance Optimizations

1. **SWR Caching**: Reduces API calls with intelligent caching
2. **Optimistic Updates**: Immediate UI feedback before server confirmation
3. **Deduplication**: Prevents duplicate requests within 5-10 seconds
4. **Background Revalidation**: Keeps data fresh without blocking UI
5. **Component Code Splitting**: Next.js automatic code splitting for faster page loads

## Security Features

1. **Middleware Protection**: All protected routes require authentication
2. **Role-Based Access**: Admin routes restricted to admin users
3. **RLS Policies**: Database-level security with Supabase RLS
4. **Employee ID Verification**: Telegram linking requires valid Employee ID
5. **Audit Logging**: All changes tracked with user and timestamp

## Requirements Validation

This implementation validates the following requirements:

- **10.1**: Real-time timetable synchronization with optimistic updates
- **10.2**: Admin dashboard with timetable grid and AI Commander
- **10.3**: Teacher profile with schedule view
- **11.5**: API authentication middleware
- **12.4**: UI data masking for sensitive fields
- **14.1-14.5**: System scalability with SWR caching and optimistic updates

## Next Steps

1. Add unit tests for components
2. Implement property-based tests for data validation
3. Add E2E tests for critical workflows
4. Enhance error handling and retry logic
5. Add loading skeletons for better UX
6. Implement real-time subscriptions with Supabase Realtime

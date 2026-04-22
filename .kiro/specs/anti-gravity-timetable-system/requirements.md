# Requirements Document

## Introduction

The Anti-Gravity School Timetable Management System is a comprehensive timetable management platform that enforces scheduling rules at the database level, provides real-time Telegram notifications through edge functions, and uses AI-powered scheduling with RAG for intelligent decision-making. The system manages three distinct wings (Nursery, Scholar, Master) with automated burnout protection, substitution marketplace, and natural language administrative commands.

## Glossary

- **Timetable_System**: The complete school timetable management platform
- **Database**: Supabase PostgreSQL instance serving as the source of truth
- **Edge_Function**: Supabase Edge Function serving as the bridge for real-time notifications
- **AI_Commander**: RAG-based AI interface using Gemini 1.5 Flash for natural language commands
- **Telegram_Bot**: grammY-based bot for teacher communication
- **Wing**: Academic division (Blossom for Nursery, Scholar for Grades 1-10, Master for Grades 11-12)
- **Period**: A scheduled time slot for teaching
- **Consecutive_Period**: Periods occurring sequentially without breaks
- **Class_Teacher**: Teacher assigned primary responsibility for a specific class
- **Period_Zero**: Morning period before regular schedule begins
- **Substitution_Request**: Request for a teacher to cover another teacher's period
- **Fairness_Index**: Calculated metric representing teacher's weekly workload for equitable distribution
- **Expertise_Match**: Alignment between teacher's subject expertise and substitution requirement
- **Employee_ID**: Unique identifier linking teacher profile to Telegram account
- **Daily_Briefing**: Personalized timetable summary sent via Telegram
- **RLS**: Row Level Security policies enforcing data access rules
- **Admin**: User with full system access and modification privileges
- **Teacher**: User with access to personal timetable and substitution features
- **RAG**: Retrieval-Augmented Generation pattern for context-aware AI responses

## Requirements

### Requirement 1: Wing-Based Timetable Management

**User Story:** As a school administrator, I want separate timetables for each academic wing, so that age-appropriate scheduling rules apply to each group.

#### Acceptance Criteria

1. THE Timetable_System SHALL maintain three distinct timetables for Blossom_Wing, Scholar_Wing, and Master_Wing
2. WHEN a timetable entry is created, THE Database SHALL enforce wing-specific constraints through RLS policies
3. THE Timetable_System SHALL prevent cross-wing period assignments for teachers
4. FOR ALL timetable queries, filtering by wing then retrieving periods SHALL produce the same result as retrieving all periods then filtering by wing (confluence property)

### Requirement 2: Teacher Burnout Protection

**User Story:** As a teacher, I want automatic rest periods after consecutive teaching, so that I avoid burnout and maintain teaching quality.

#### Acceptance Criteria

1. WHEN a teacher is assigned three consecutive periods, THE Database SHALL automatically designate the fourth slot as Rest_Period or Prep_Period
2. THE Database SHALL reject any period assignment that would create four consecutive teaching periods for a teacher
3. WHEN calculating consecutive periods, THE Timetable_System SHALL treat only teaching periods as consecutive (excluding breaks and lunch)
4. FOR ALL valid teacher schedules, the count of consecutive teaching periods SHALL be less than or equal to three (invariant property)

### Requirement 3: Morning Period Assignment

**User Story:** As a class teacher, I want automatic Period_Zero assignment, so that I can conduct morning activities with my class.

#### Acceptance Criteria

1. THE Timetable_System SHALL assign Period_Zero to the designated Class_Teacher for each class
2. WHEN a Class_Teacher is marked absent, THE Timetable_System SHALL generate substitution suggestions for Period_Zero within 3 seconds
3. THE Timetable_System SHALL prioritize teachers with availability during Period_Zero for substitution suggestions
4. WHEN a Class_Teacher returns from absence, THE Timetable_System SHALL restore Period_Zero assignment to the original Class_Teacher

### Requirement 4: Substitution Marketplace with Fairness Index

**User Story:** As a school administrator, I want fair distribution of substitution work, so that no teacher is overburdened with extra periods.

#### Acceptance Criteria

1. WHEN a Substitution_Request is created, THE Timetable_System SHALL calculate Fairness_Index for all eligible teachers within 3 seconds
2. THE Timetable_System SHALL rank substitution candidates by ascending Fairness_Index (lowest workload first)
3. THE Fairness_Index SHALL represent the total weekly teaching periods including accepted substitutions
4. FOR ALL teachers, adding a substitution period then recalculating Fairness_Index SHALL increase the index value (monotonic property)
5. WHEN two teachers have equal Fairness_Index, THE Timetable_System SHALL apply Expertise_Match as the tiebreaker

### Requirement 5: Expertise-Based Substitution Matching

**User Story:** As a student, I want subject-expert substitutes when possible, so that learning continuity is maintained during teacher absences.

#### Acceptance Criteria

1. WHEN ranking substitution candidates, THE Timetable_System SHALL prioritize teachers with Expertise_Match for the subject
2. THE Timetable_System SHALL assign higher priority to exact subject matches than to general supervisors
3. WHERE no subject-expert is available, THE Timetable_System SHALL suggest general supervisors with lowest Fairness_Index
4. THE Timetable_System SHALL include both expertise level and Fairness_Index in substitution suggestions

### Requirement 6: Teacher Identity Verification

**User Story:** As a teacher, I want to link my Telegram account securely, so that I receive personalized timetable notifications.

#### Acceptance Criteria

1. WHEN a teacher initiates Telegram linking, THE Telegram_Bot SHALL request Employee_ID verification
2. THE Telegram_Bot SHALL validate Employee_ID against the Database before establishing the link
3. IF Employee_ID validation fails, THEN THE Telegram_Bot SHALL reject the linking request and log the attempt
4. THE Database SHALL store the Telegram user ID only after successful Employee_ID verification
5. THE Timetable_System SHALL encrypt Telegram user IDs at rest using database-level encryption

### Requirement 7: Daily Timetable Briefing

**User Story:** As a teacher, I want my daily schedule delivered to Telegram each morning, so that I can plan my day effectively.

#### Acceptance Criteria

1. THE Telegram_Bot SHALL send Daily_Briefing to all linked teachers at 7:30 AM local time
2. THE Daily_Briefing SHALL include all scheduled periods, room assignments, and class details for the current day
3. WHEN a teacher has no scheduled periods, THE Telegram_Bot SHALL send a confirmation message indicating a free day
4. THE Edge_Function SHALL retrieve timetable data from the Database and format it within 5 seconds

### Requirement 8: Interactive Substitution Notifications

**User Story:** As a teacher, I want to accept or decline substitution requests via Telegram, so that I can respond quickly without opening a web interface.

#### Acceptance Criteria

1. WHEN a Substitution_Request is assigned to a teacher, THE Edge_Function SHALL send a Telegram notification within 5 seconds
2. THE Telegram notification SHALL include Accept and Decline interactive buttons
3. WHEN a teacher clicks Accept, THE Telegram_Bot SHALL update the Database and confirm the assignment within 3 seconds
4. WHEN a teacher clicks Decline, THE Telegram_Bot SHALL notify the Admin and suggest the next candidate
5. IF a teacher does not respond within 10 minutes, THEN THE Telegram_Bot SHALL escalate to the next candidate automatically

### Requirement 9: Natural Language Admin Commands

**User Story:** As a school administrator, I want to update timetables using natural language, so that I can make complex changes without navigating multiple screens.

#### Acceptance Criteria

1. WHEN an Admin sends a natural language command, THE AI_Commander SHALL retrieve relevant context from the Database using RAG
2. THE AI_Commander SHALL parse the command and generate a structured database operation within 3 seconds
3. WHEN the command is ambiguous, THE AI_Commander SHALL request clarification before executing changes
4. THE AI_Commander SHALL log all executed commands with timestamp and Admin identifier for audit purposes
5. IF a command would violate scheduling constraints, THEN THE AI_Commander SHALL reject the command and explain the constraint violation

### Requirement 10: Real-Time Timetable Synchronization

**User Story:** As a teacher, I want immediate updates when my timetable changes, so that I am always aware of my current schedule.

#### Acceptance Criteria

1. WHEN a timetable entry is modified in the Database, THE Edge_Function SHALL trigger notifications to affected teachers within 5 seconds
2. THE Timetable_System SHALL use database triggers to detect changes and invoke Edge_Functions
3. THE Edge_Function SHALL send change notifications via Telegram to all teachers impacted by the modification
4. FOR ALL timetable changes, the notification timestamp SHALL be within 5 seconds of the database commit timestamp (performance property)

### Requirement 11: Role-Based Access Control

**User Story:** As a school administrator, I want different access levels for admins and teachers, so that sensitive data is protected and users can only perform authorized actions.

#### Acceptance Criteria

1. THE Database SHALL enforce RLS policies that restrict Teacher access to personal timetable data only
2. THE Database SHALL grant Admin full read and write access to all timetable data
3. WHEN a Teacher attempts to access another teacher's data, THE Database SHALL reject the query
4. WHEN an Admin accesses any timetable data, THE Database SHALL permit the operation and log the access
5. THE Timetable_System SHALL authenticate all API requests before executing database operations

### Requirement 12: Data Encryption and Security

**User Story:** As a school administrator, I want all sensitive data encrypted, so that teacher and student information is protected from unauthorized access.

#### Acceptance Criteria

1. THE Database SHALL encrypt all data at rest using AES-256 encryption
2. THE Timetable_System SHALL encrypt all data in transit using TLS 1.3 or higher
3. THE Timetable_System SHALL mask Employee_ID and Telegram user IDs in application logs
4. WHEN displaying teacher data in the UI, THE Timetable_System SHALL mask sensitive fields for non-Admin users
5. THE Database SHALL rotate encryption keys every 90 days automatically

### Requirement 13: AI Substitution Performance

**User Story:** As a school administrator, I want fast AI-powered substitution suggestions, so that I can quickly fill urgent teacher absences.

#### Acceptance Criteria

1. WHEN a substitution request is created, THE AI_Commander SHALL generate ranked suggestions within 3 seconds
2. THE AI_Commander SHALL consider Fairness_Index, Expertise_Match, and availability in ranking calculations
3. THE AI_Commander SHALL retrieve teacher context from the Database before generating suggestions (RAG pattern)
4. FOR ALL substitution requests, the response time SHALL be less than or equal to 3 seconds measured from request creation to suggestion delivery (performance property)

### Requirement 14: System Scalability

**User Story:** As a school administrator, I want the system to handle our entire staff and schedule, so that performance remains consistent as we grow.

#### Acceptance Criteria

1. THE Timetable_System SHALL support at least 100 concurrent teacher users without performance degradation
2. THE Database SHALL efficiently query and update at least 700 weekly period slots
3. WHEN the number of teachers increases from 50 to 100, THE query response time SHALL increase by no more than 50 percent (scalability property)
4. THE Timetable_System SHALL maintain sub-5-second notification delivery with 100 concurrent users

### Requirement 15: Database Constraint Enforcement

**User Story:** As a developer, I want scheduling rules enforced at the database level, so that invalid states are impossible regardless of UI bugs.

#### Acceptance Criteria

1. THE Database SHALL implement check constraints for the three-consecutive-period rule
2. THE Database SHALL implement foreign key constraints linking periods to valid teachers and classes
3. THE Database SHALL implement unique constraints preventing double-booking of teachers or rooms
4. IF an application attempts to insert invalid data, THEN THE Database SHALL reject the transaction and return a descriptive error
5. FOR ALL database states, the constraints SHALL be satisfied (invariant property)

### Requirement 16: Timetable Data Parser and Serializer

**User Story:** As a school administrator, I want to import and export timetables in standard formats, so that I can integrate with other school systems and backup data.

#### Acceptance Criteria

1. WHEN a valid timetable file is provided, THE Timetable_Parser SHALL parse it into database-compatible objects
2. WHEN an invalid timetable file is provided, THE Timetable_Parser SHALL return a descriptive error with line number and issue
3. THE Timetable_Serializer SHALL format database timetable objects into valid export files
4. FOR ALL valid timetable objects, parsing then serializing then parsing SHALL produce an equivalent object (round-trip property)
5. THE Timetable_Parser SHALL validate wing assignments, teacher IDs, and period constraints during parsing

### Requirement 17: Audit Logging

**User Story:** As a school administrator, I want complete audit logs of all timetable changes, so that I can track modifications and resolve disputes.

#### Acceptance Criteria

1. WHEN any timetable data is modified, THE Database SHALL create an audit log entry with timestamp, user, and change details
2. THE Timetable_System SHALL retain audit logs for at least 365 days
3. THE Timetable_System SHALL provide Admin access to audit logs through a searchable interface
4. THE audit log SHALL record the before and after state for all modifications
5. FOR ALL database modifications, an audit entry SHALL exist with matching timestamp (completeness property)

### Requirement 18: Telegram Bot Error Handling

**User Story:** As a teacher, I want clear error messages when bot interactions fail, so that I understand what went wrong and how to proceed.

#### Acceptance Criteria

1. WHEN the Telegram_Bot encounters an error, THE Telegram_Bot SHALL send a user-friendly error message to the teacher
2. IF the Database is unavailable, THEN THE Telegram_Bot SHALL queue the request and retry up to 3 times with exponential backoff
3. WHEN a retry succeeds, THE Telegram_Bot SHALL process the queued request and notify the teacher
4. THE Telegram_Bot SHALL log all errors with stack traces for debugging while masking PII in logs
5. IF all retries fail, THEN THE Telegram_Bot SHALL notify the Admin of the system issue

### Requirement 19: AI Commander Context Retrieval

**User Story:** As a school administrator, I want the AI to use current timetable data, so that commands are executed with accurate information and without hallucinations.

#### Acceptance Criteria

1. WHEN processing a natural language command, THE AI_Commander SHALL retrieve relevant timetable context from the Database before generating a response
2. THE AI_Commander SHALL include teacher availability, current assignments, and constraint rules in the retrieved context
3. THE AI_Commander SHALL use the RAG pattern to ground responses in actual database state
4. WHEN the Database returns no matching context, THE AI_Commander SHALL inform the Admin that insufficient information is available
5. FOR ALL AI responses, the generated operations SHALL reference only entities present in the retrieved context (correctness property)

### Requirement 20: Substitution Request Expiration

**User Story:** As a school administrator, I want old substitution requests to expire automatically, so that the system doesn't accumulate stale requests.

#### Acceptance Criteria

1. WHEN a Substitution_Request is created, THE Timetable_System SHALL set an expiration timestamp based on the period start time
2. WHEN the current time exceeds the expiration timestamp, THE Database SHALL mark the Substitution_Request as expired
3. THE Timetable_System SHALL exclude expired requests from active substitution queries
4. THE Database SHALL archive expired requests for audit purposes rather than deleting them
5. FOR ALL active Substitution_Requests, the current time SHALL be less than the expiration timestamp (invariant property)


# Design Document: Anti-Gravity System Architecture

## 1. System Components
- **The Grid (Web):** A real-time Drag-and-Drop timetable built with `dnd-kit`.
- **The Messenger (Telegram):** A P2P notification layer where teachers "Accept" or "Decline" swaps.
- **The Commander (AI API):** A POST endpoint `/api/ai/process` that converts "Teacher Rahul is sick" into a JSON database patch.

## 2. Database Schema (Supabase)
- **teachers:** id, name, wing, employee_id, telegram_id, workload_score, subjects[].
- **timetable:** id, teacher_id, day, period_number (0-7), class_id, is_substitution.
- **swap_requests:** requester_id, recipient_id, period_id, status (pending/approved/rejected).

## 3. Communication Flow
1. Admin enters prompt -> Gemini 1.5 Flash parses intent.
2. Logic checks against `Brain.md` rules.
3. Database updates -> Supabase "Edge Function" triggers.
4. Telegram Bot sends private message to affected Teacher(s).
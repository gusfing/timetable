# Requirements & Deliverables

## 1. Functional Requirements
- **FR1: Automated Morning Briefing:** Every teacher receives their schedule via Telegram at 7:30 AM daily.
- **FR2: Smart Substitution:** AI must suggest 3 optimal replacements for any absent teacher based on 'Fairness Index'.
- **FR3: Peer Swap Marketplace:** Teachers can initiate a swap; Peer must click 'Accept' on Telegram to update the Master Timetable.
- **FR4: The Admin Chatbot:** Admin must be able to change the entire school's timing (e.g., for a function) via a single prompt.

## 2. Technical Requirements
- **Performance:** Schedule re-calculation must happen in < 2 seconds.
- **Privacy:** Teacher phone numbers must never be stored; only `telegram_id` linked via Employee ID.
- **Cost:** Must operate entirely within the Free Tiers of Vercel, Supabase, and Google AI Studio.

## 3. Success Metrics
- Zero "4-in-a-row" teaching streaks.
- 100% of substitutions notified within 1 minute of Admin entry.
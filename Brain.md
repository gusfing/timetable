# Anti-Gravity Project Brain & Rules

## 1. The Human-Centric Mission
You are building a school scheduler that treats teachers as humans, not resources. The goal is to reduce "Gravity" (burnout/stress).

## 2. Core Logic Rules (Non-Negotiable)
- **Burnout Protocol:** Max 3 consecutive periods. The 4th period MUST be a 'Rest Period' (Free/Buffer).
- **Wing Isolation:** Teachers must stay within their assigned Wing (Blossom: Nursery-Primary, Scholar: 1-10, Master: 11-12).
- **Fairness Index:** Substitution logic must prioritize teachers with the lowest cumulative periods taught in the current week.
- **The "Morning Grace":** Class teachers have Period 0 (Assembly). If they are absent, the AI must first look for 'Co-class teachers' before general substitution.

## 3. UI/UX "Zen" Vibe
- **Colors:** Sage Green (#B2AC88) for Free, Soft Cream (#F5F5DC) for Background, Muted Coral (#E9967A) for Warnings.
- **Interface:** Minimalist, rounded corners (rounded-2xl), glassmorphism effects for modals.
- **Feedback:** Use gentle toasts instead of aggressive alerts.

## 4. Technical Constraints
- Next.js 14 (App Router) + Supabase + Tailwind CSS + shadcn/ui.
- Telegram Bot API (grammY) for all teacher notifications.
- Gemini 1.5 Flash for Natural Language Admin commands.
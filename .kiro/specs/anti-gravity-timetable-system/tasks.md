# Implementation Plan: Anti-Gravity School Timetable Management System

## Overview

This implementation plan breaks down the Anti-Gravity Timetable System into 6 major phases, each representing a complete subsystem. The system uses TypeScript for the Next.js frontend, Deno/TypeScript for Supabase Edge Functions, and PostgreSQL for the database layer. Each phase builds upon the previous one, starting with the database foundation and ending with testing and deployment.

## Tasks

- [x] 1. Database Foundation - Set up Supabase PostgreSQL with complete schema, RLS policies, triggers, constraints, and database functions
  - Create all database tables (wings, teachers, classes, rooms, periods, substitution_requests, audit_logs)
  - Implement check constraints for consecutive period limits and data validation
  - Create unique constraints for double-booking prevention (teacher-time, room-time)
  - Implement database triggers for automatic rest period insertion and audit logging
  - Create database functions for Fairness Index calculation and consecutive period checking
  - Configure Row Level Security (RLS) policies for role-based access control
  - Set up database indexes for query performance optimization
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 4.3, 11.1, 11.2, 11.3, 11.4, 15.1, 15.2, 15.3, 15.4, 15.5, 17.1, 17.4, 17.5_

- [x] 2. Telegram Bot Integration - Implement grammY bot with identity verification, daily briefings, and interactive substitution notifications
  - Set up grammY bot with webhook configuration
  - Implement Employee ID verification flow for account linking
  - Create daily briefing scheduler and message formatter
  - Build interactive substitution notification system with Accept/Decline buttons
  - Implement callback query handlers for button interactions
  - Add retry logic with exponential backoff for reliability
  - Create user-friendly error message formatting
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 7.1, 7.2, 7.3, 7.4, 7.5, 8.1, 8.2, 8.3, 8.4, 8.5, 18.1, 18.2, 18.3, 18.4, 18.5_

- [x] 3. Supabase Edge Functions - Create edge functions for real-time notifications, substitution processing, and database event handling
  - Implement notify-timetable-change edge function for real-time period updates
  - Create process-substitution-request edge function with fairness ranking calculation
  - Build database webhook handlers for change events (INSERT, UPDATE, DELETE)
  - Implement connection pooling and batch notification sending
  - Add timeout enforcement for 5-second notification target
  - Create escalation logic for declined/expired substitution requests
  - _Requirements: 4.1, 4.2, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4, 9.1, 9.2, 9.3, 9.4, 9.5, 20.1, 20.2, 20.3, 20.4, 20.5_

- [x] 4. Next.js Frontend - Build admin dashboard with timetable grid, substitution marketplace, and audit log viewer
  - Set up Next.js 14 project with App Router and Supabase authentication
  - Create TimetableGrid component with weekly view and period cards
  - Build SubstitutionCard component with fairness ranking display
  - Implement admin dashboard with AI Commander interface
  - Create audit log viewer with filtering and search
  - Add teacher profile page with Telegram linking UI
  - Implement optimistic updates and SWR caching for performance
  - Configure API routes with authentication middleware
  - _Requirements: 10.1, 10.2, 10.3, 11.5, 12.4, 14.1, 14.2, 14.3, 14.4, 14.5_

- [x] 5. AI Commander with RAG - Implement natural language command interface using Gemini 1.5 Flash with context retrieval
  - Set up Google Gemini 1.5 Flash API integration
  - Implement context retrieval system for teacher availability and current assignments
  - Create entity extraction for parsing natural language commands
  - Build command parser that generates structured database operations
  - Implement constraint validation before executing operations
  - Add command caching with LRU cache for performance
  - Create timeout enforcement for 3-second response target
  - Implement graceful degradation for AI failures
  - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 19.1, 19.2, 19.3, 19.4, 19.5_

- [x] 6. Testing & Deployment - Set up property-based tests, unit tests, integration tests, and deploy to production
  - Configure fast-check for property-based testing with 100 iterations per property
  - Implement unit tests for database constraints and edge cases
  - Create integration tests for substitution workflow and AI Commander
  - Add performance tests for 3-second AI and 5-second notification targets
  - Set up CI/CD pipeline with GitHub Actions
  - Configure Vercel deployment for Next.js frontend
  - Deploy Supabase Edge Functions and database migrations
  - Create monitoring and error tracking setup
  - _Requirements: All requirements validated through comprehensive test coverage_

## Notes

- Each task represents a complete subsystem that can be implemented independently
- Tasks should be executed in order as later phases depend on earlier infrastructure
- All database constraints are enforced at the PostgreSQL level for data integrity
- Real-time notifications target 5-second delivery through edge functions
- AI Commander targets 3-second response time through caching and parallel queries
- Property-based tests validate all 63 correctness properties from the design document
- The system uses TypeScript throughout for type safety and developer experience

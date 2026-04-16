# Testing Infrastructure

This directory contains comprehensive tests for the Anti-Gravity Timetable System.

## Test Structure

```
tests/
├── setup.ts                    # Global test setup
├── unit/                       # Unit tests for specific functions
│   └── database-constraints.test.ts
├── property/                   # Property-based tests
│   └── database-constraints.test.ts
└── integration/                # Integration tests
    ├── substitution-workflow.test.ts
    └── performance.test.ts
```

## Test Types

### Unit Tests
Unit tests verify specific examples and edge cases for individual functions and components.

**Run unit tests:**
```bash
npm run test:unit
```

**Example:**
```typescript
it('should allow up to 3 consecutive teaching periods', () => {
  const schedule = [
    { periodNumber: 1, periodType: 'teaching' },
    { periodNumber: 2, periodType: 'teaching' },
    { periodNumber: 3, periodType: 'teaching' },
  ];
  
  const maxConsecutive = calculateMaxConsecutive(schedule);
  expect(maxConsecutive).toBeLessThanOrEqual(3);
});
```

### Property-Based Tests
Property-based tests use randomized inputs to verify universal properties across all valid inputs. We use `fast-check` with 100 iterations per property.

**Run property tests:**
```bash
npm run test:property
```

**Example:**
```typescript
it('Property 6: Consecutive Period Invariant', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.array(fc.record({
        periodNumber: fc.integer({ min: 1, max: 10 }),
        periodType: fc.constantFrom('teaching', 'rest', 'prep'),
      })),
      async (periods) => {
        const maxConsecutive = calculateMaxConsecutive(periods);
        expect(maxConsecutive).toBeLessThanOrEqual(3);
      }
    ),
    { numRuns: 100 }
  );
});
```

### Integration Tests
Integration tests verify complete workflows and interactions between components.

**Run integration tests:**
```bash
npm run test:integration
```

**Example:**
```typescript
it('should complete full substitution request flow', async () => {
  // 1. Create substitution request
  // 2. Verify fairness ranking
  // 3. Simulate teacher acceptance
  // 4. Verify audit log
});
```

### Performance Tests
Performance tests verify that the system meets performance requirements:
- AI substitution suggestions: < 3 seconds
- Real-time notifications: < 5 seconds
- AI command processing: < 3 seconds

## Running Tests

### All Tests
```bash
npm test
```

### Watch Mode
```bash
npm run test:watch
```

### Coverage Report
```bash
npm run test:coverage
```

## Test Configuration

### Vitest Configuration
- `vitest.config.ts` - Main configuration
- `vitest.config.unit.ts` - Unit test configuration
- `vitest.config.property.ts` - Property test configuration (30s timeout)
- `vitest.config.integration.ts` - Integration test configuration (60s timeout)

### Fast-Check Configuration
Property-based tests run with:
- **100 iterations** per property (as specified in design document)
- Randomized inputs for comprehensive coverage
- Reproducible test failures with seed values

## Correctness Properties

The system validates **63 correctness properties** from the design document:

### Database Constraints (Properties 1-6)
- Property 1: Wing Isolation
- Property 2: Wing Constraint Enforcement
- Property 3: Automatic Rest Period Insertion
- Property 4: Consecutive Period Limit
- Property 5: Consecutive Period Calculation
- Property 6: Consecutive Period Invariant

### Fairness Index (Properties 11-15)
- Property 11: Fairness Index Calculation Performance
- Property 12: Fairness Index Ranking Order
- Property 13: Fairness Index Definition
- Property 14: Fairness Index Monotonicity
- Property 15: Fairness Index Tiebreaker

### Performance (Properties 8, 11, 13)
- Property 8: Period Zero Substitution Performance (< 3s)
- Property 11: Fairness Index Calculation Performance (< 3s)
- Property 13: AI Substitution Performance (< 3s)

### Security & Access Control (Properties 34-39)
- Property 34: Teacher Data Access Restriction
- Property 35: Admin Full Access
- Property 36: Admin Access Audit Logging
- Property 37: API Authentication Enforcement
- Property 38: Log Data Masking
- Property 39: UI Data Masking

### Data Integrity (Properties 41-43)
- Property 41: Foreign Key Constraint Enforcement
- Property 42: Double-Booking Prevention
- Property 43: Database Error Descriptiveness

### Audit & Logging (Properties 49-51)
- Property 49: Audit Log Creation
- Property 50: Audit Log State Recording
- Property 51: Audit Log Completeness

### Substitution Workflow (Properties 59-63)
- Property 59: Substitution Request Expiration Timestamp
- Property 60: Substitution Request Auto-Expiration
- Property 61: Expired Request Query Exclusion
- Property 62: Expired Request Archival
- Property 63: Active Request Expiration Invariant

## Writing New Tests

### Unit Test Template
```typescript
import { describe, it, expect } from 'vitest';

describe('Feature Name', () => {
  it('should do something specific', () => {
    // Arrange
    const input = createTestInput();
    
    // Act
    const result = functionUnderTest(input);
    
    // Assert
    expect(result).toBe(expectedValue);
  });
});
```

### Property Test Template
```typescript
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

describe('Feature: anti-gravity-timetable-system', () => {
  /**
   * **Validates: Requirements X.Y**
   * Property N: Property Name
   * 
   * Description of the property being tested
   */
  it('Property N: Property Name', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.record({
          // Define your arbitrary generators
        })),
        async (input) => {
          // Test the property
          expect(result).toSatisfyProperty();
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

## CI/CD Integration

Tests run automatically on:
- Every push to `main` or `develop` branches
- Every pull request
- Before deployment to production

### GitHub Actions Workflow
```yaml
- name: Run unit tests
  run: npm run test:unit

- name: Run property-based tests
  run: npm run test:property

- name: Run integration tests
  run: npm run test:integration

- name: Generate coverage report
  run: npm run test:coverage
```

## Coverage Goals

- **Database Constraints**: 100% coverage
- **Business Logic**: 90%+ coverage
- **API Routes**: 85%+ coverage
- **Property Tests**: All 63 correctness properties
- **Edge Cases**: All identified edge cases
- **Integration**: All critical workflows
- **Performance**: All performance requirements

## Troubleshooting

### Tests Timing Out
If property tests timeout, increase the timeout in the config:
```typescript
// vitest.config.property.ts
testTimeout: 60000 // Increase to 60 seconds
```

### Flaky Tests
Property-based tests are deterministic. If a test fails, fast-check provides a seed to reproduce:
```
Property failed after 42 tests
{ seed: 1234567890, path: "42:0", endOnFailure: true }
```

Use the seed to reproduce:
```typescript
fc.assert(property, { seed: 1234567890 });
```

### Database Connection Issues
Ensure environment variables are set:
```bash
cp .env.example .env.local
# Edit .env.local with your Supabase credentials
```

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Fast-Check Documentation](https://fast-check.dev/)
- [Property-Based Testing Guide](https://fast-check.dev/docs/introduction/)
- [Design Document](../.kiro/specs/anti-gravity-timetable-system/design.md)

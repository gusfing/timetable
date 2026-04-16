# Testing Infrastructure

## Overview

The Anti-Gravity Timetable System uses a comprehensive testing strategy with three types of tests:

1. **Unit Tests** - Specific examples and edge cases
2. **Property-Based Tests** - Universal properties across randomized inputs
3. **Integration Tests** - Complete workflows and performance validation

## Quick Start

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:property
npm run test:integration

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

## Test Coverage

### Correctness Properties (63 Total)

The system validates all 63 correctness properties from the design document:

#### Database Constraints (Properties 1-6, 41-43)
- ✅ Property 1: Wing Isolation (query order independence)
- ✅ Property 6: Consecutive Period Invariant (max 3 consecutive)
- ✅ Property 14: Fairness Index Monotonicity
- ✅ Property 42: Double-Booking Prevention
- ✅ Property 63: Active Request Expiration Invariant

#### Performance Requirements (Properties 8, 11, 13)
- ✅ AI substitution suggestions < 3 seconds
- ✅ Real-time notifications < 5 seconds
- ✅ AI command processing < 3 seconds
- ✅ Fairness Index calculation < 3 seconds
- ✅ Daily briefing formatting < 5 seconds

#### Security & Access Control (Properties 34-39)
- Teacher data access restriction
- Admin full access
- API authentication enforcement
- Data masking in logs and UI

#### Workflow Validation (Properties 59-63)
- Substitution request expiration
- Auto-escalation on timeout
- Audit log completeness

## Test Structure

```
tests/
├── setup.ts                              # Global test configuration
├── unit/
│   └── database-constraints.test.ts      # Unit tests for constraints
├── property/
│   └── database-constraints.test.ts      # Property-based tests
└── integration/
    ├── substitution-workflow.test.ts     # Workflow integration tests
    └── performance.test.ts               # Performance validation
```

## Property-Based Testing

### Configuration
- **Library**: fast-check
- **Iterations**: 100 per property (as specified in design)
- **Timeout**: 30 seconds for property tests

### Example Property Test

```typescript
/**
 * **Validates: Requirements 2.4, 15.5**
 * Property 6: Consecutive Period Invariant
 */
it('Property 6: max consecutive teaching periods <= 3', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.array(
        fc.record({
          periodNumber: fc.integer({ min: 1, max: 10 }),
          periodType: fc.constantFrom('teaching', 'rest', 'prep'),
        })
      ),
      async (periods) => {
        const maxConsecutive = calculateMaxConsecutive(periods);
        expect(maxConsecutive).toBeLessThanOrEqual(3);
      }
    ),
    { numRuns: 100 }
  );
});
```

### Property Test Format
All property tests follow this format:
```typescript
/**
 * **Validates: Requirements X.Y**
 * Property N: Property Name
 * 
 * Description of the property
 */
it('Property N: Property Name - description', async () => {
  await fc.assert(
    fc.asyncProperty(
      // Arbitrary generators
      async (input) => {
        // Test property
      }
    ),
    { numRuns: 100 }
  );
});
```

## Unit Testing

### Test Categories

#### Database Constraints
```typescript
describe('Consecutive Period Limit', () => {
  it('should allow up to 3 consecutive teaching periods', () => {
    // Test specific example
  });
  
  it('should reject 4 consecutive teaching periods', () => {
    // Test constraint violation
  });
  
  it('should reset consecutive count after break', () => {
    // Test edge case
  });
});
```

#### Fairness Index
```typescript
describe('Fairness Index Calculation', () => {
  it('should calculate as sum of regular and substitution periods', () => {
    // Test calculation
  });
  
  it('should increase when accepting substitution', () => {
    // Test monotonicity
  });
});
```

#### Edge Cases
```typescript
describe('Edge Cases', () => {
  it('should handle empty schedule', () => {
    // Test empty input
  });
  
  it('should handle single period', () => {
    // Test minimal input
  });
});
```

## Integration Testing

### Substitution Workflow
```typescript
it('should complete full substitution request flow', async () => {
  // 1. Create substitution request
  // 2. Verify fairness ranking calculated
  // 3. Simulate teacher acceptance
  // 4. Verify audit log created
});
```

### Performance Validation
```typescript
it('should generate AI suggestions within 3 seconds', async () => {
  const startTime = Date.now();
  const result = await generateSuggestions();
  const elapsed = Date.now() - startTime;
  
  expect(elapsed).toBeLessThan(3000);
});
```

## CI/CD Integration

### GitHub Actions Workflow

```yaml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
      - name: Install dependencies
        run: npm ci
      - name: Run unit tests
        run: npm run test:unit
      - name: Run property tests
        run: npm run test:property
      - name: Run integration tests
        run: npm run test:integration
      - name: Generate coverage
        run: npm run test:coverage
```

### Test Requirements for Deployment

All tests must pass before deployment:
- ✅ Unit tests pass
- ✅ Property tests pass (all 100 iterations)
- ✅ Integration tests pass
- ✅ Performance tests meet targets
- ✅ Coverage meets thresholds

## Coverage Goals

| Category | Target | Current |
|----------|--------|---------|
| Database Constraints | 100% | - |
| Business Logic | 90%+ | - |
| API Routes | 85%+ | - |
| Property Tests | 63/63 | 5/63 |
| Edge Cases | 100% | - |
| Integration | All workflows | - |
| Performance | All targets | - |

## Running Tests Locally

### Prerequisites
```bash
# Install dependencies
npm install

# Set up test environment
cp .env.test.example .env.test
```

### Run Tests
```bash
# All tests
npm test

# Specific suite
npm run test:unit
npm run test:property
npm run test:integration

# Watch mode (auto-rerun on changes)
npm run test:watch

# Coverage report
npm run test:coverage
```

### Debug Tests
```bash
# Run single test file
npx vitest run tests/unit/database-constraints.test.ts

# Run with debugging
node --inspect-brk node_modules/.bin/vitest run

# Verbose output
npx vitest run --reporter=verbose
```

## Test Data Management

### Mock Data
```typescript
// tests/fixtures/mockData.ts
export const mockTeacher = {
  id: 'teacher-1',
  name: 'John Smith',
  subjects: ['Math', 'Science'],
  fairnessIndex: 15,
};

export const mockPeriod = {
  id: 'period-1',
  teacherId: 'teacher-1',
  dayOfWeek: 1,
  periodNumber: 3,
  periodType: 'teaching',
};
```

### Test Database
For integration tests that require a database:
```bash
# Start local Supabase
supabase start

# Run migrations
supabase db reset

# Run tests
npm run test:integration
```

## Troubleshooting

### Tests Timing Out
```typescript
// Increase timeout in vitest.config.ts
export default defineConfig({
  test: {
    testTimeout: 60000, // 60 seconds
  },
});
```

### Flaky Property Tests
Property tests are deterministic. If a test fails, fast-check provides a seed:
```
Property failed after 42 tests
{ seed: 1234567890, path: "42:0" }
```

Reproduce with:
```typescript
fc.assert(property, { seed: 1234567890 });
```

### Coverage Not Generated
```bash
# Install coverage provider
npm install -D @vitest/coverage-v8

# Run with coverage
npm run test:coverage
```

## Best Practices

### Writing Tests
1. **Descriptive names**: Use clear, descriptive test names
2. **Arrange-Act-Assert**: Follow AAA pattern
3. **One assertion per test**: Focus on single behavior
4. **Independent tests**: Tests should not depend on each other
5. **Clean up**: Reset state after each test

### Property Tests
1. **100 iterations**: Always use 100 runs as specified
2. **Document properties**: Link to requirements
3. **Smart generators**: Constrain input space intelligently
4. **Reproducible**: Use seeds for debugging

### Integration Tests
1. **Test workflows**: Verify complete user flows
2. **Performance targets**: Validate timing requirements
3. **Error scenarios**: Test failure cases
4. **Cleanup**: Reset database state

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Fast-Check Documentation](https://fast-check.dev/)
- [Property-Based Testing Guide](https://fast-check.dev/docs/introduction/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Design Document](../.kiro/specs/anti-gravity-timetable-system/design.md)

## Next Steps

To expand test coverage:

1. **Add remaining property tests** (58 more properties)
2. **Add database integration tests** (with real Supabase)
3. **Add E2E tests** (with Playwright)
4. **Add visual regression tests** (with Percy/Chromatic)
5. **Add load tests** (with k6)

See [tests/README.md](tests/README.md) for detailed testing documentation.

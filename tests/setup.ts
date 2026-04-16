import { beforeAll, afterAll, afterEach } from 'vitest';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

// Global test setup
beforeAll(() => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
});

afterEach(() => {
  // Clean up after each test
});

afterAll(() => {
  // Global cleanup
});

import { beforeEach } from 'vitest';
import { resetDatabase, getDatabase } from '@/db/db-factory';
import { seedTestDatabase } from './seed-data';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.VITEST = 'true';

beforeEach(async () => {
  // Reset the database instance first
  await resetDatabase();
  
  // Get fresh database instance and seed it
  const db = await getDatabase();
  await seedTestDatabase(db);
});

// Export the database getter for use in tests
export { getDatabase as getTestDb }; 
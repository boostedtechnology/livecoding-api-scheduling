import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import type { PgliteDatabase } from 'drizzle-orm/pglite';
import * as schema from '@/db/schema';

let dbInstance: PgliteDatabase<typeof schema> | null = null;
let pgliteClient: PGlite | null = null;

export async function getDatabase(): Promise<PgliteDatabase<typeof schema>> {
  if (dbInstance) {
    return dbInstance;
  }
  
  // Create in-memory PGLite instance
  pgliteClient = new PGlite();
  dbInstance = drizzle(pgliteClient, { schema });
  
  // Create tables
  await createTables();
  
  return dbInstance;
}

async function createTables() {
  if (!pgliteClient) return;
  
  // Create tables manually since PGLite doesn't use migration files
  await pgliteClient.exec(`
    CREATE TABLE IF NOT EXISTS doctors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      specialty TEXT
    );

    CREATE TABLE IF NOT EXISTS patients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT
    );

    CREATE TABLE IF NOT EXISTS availability (
      id TEXT PRIMARY KEY,
      doctor_id TEXT NOT NULL REFERENCES doctors(id),
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      is_booked BOOLEAN DEFAULT FALSE
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id TEXT PRIMARY KEY,
      doctor_id TEXT NOT NULL REFERENCES doctors(id),
      patient_id TEXT NOT NULL REFERENCES patients(id),
      availability_id TEXT REFERENCES availability(id),
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      status TEXT DEFAULT 'scheduled'
    );
  `);
}

export async function resetDatabase() {
  if (pgliteClient) {
    await pgliteClient.close();
  }
  dbInstance = null;
  pgliteClient = null;
} 
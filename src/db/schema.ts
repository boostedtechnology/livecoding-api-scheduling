import { pgTable, text, integer, boolean } from 'drizzle-orm/pg-core';

export const doctors = pgTable('doctors', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  specialty: text('specialty'),
});

export const patients = pgTable('patients', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
});

export const availability = pgTable('availability', {
  id: text('id').primaryKey(),
  doctorId: text('doctor_id').notNull().references(() => doctors.id),
  date: text('date').notNull(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  isBooked: boolean('is_booked').default(false),
});

export const appointments = pgTable('appointments', {
  id: text('id').primaryKey(),
  doctorId: text('doctor_id').notNull().references(() => doctors.id),
  patientId: text('patient_id').notNull().references(() => patients.id),
  availabilityId: text('availability_id').references(() => availability.id),
  date: text('date').notNull(),
  startTime: text('start_time').notNull(),
  durationMinutes: integer('duration_minutes').notNull(),
  status: text('status').default('scheduled'),
});

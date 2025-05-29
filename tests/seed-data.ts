import * as schema from '@/db/schema';
import type { PgliteDatabase } from 'drizzle-orm/pglite';

export async function seedTestDatabase(db: PgliteDatabase<typeof schema>) {
  // Insert sample doctors
  await db.insert(schema.doctors).values([
    { id: 'doc123', name: 'Jane Doe', email: 'jane@example.com', specialty: 'Cardiology' },
    { id: 'doc456', name: 'John Smith', email: 'john@example.com', specialty: 'Dermatology' },
    { id: 'doc789', name: 'Alice Johnson', email: 'alice@example.com', specialty: 'Pediatrics' },
    { id: 'doc999', name: 'Dr. Emergency', email: 'emergency@example.com', specialty: 'Emergency Medicine' },
  ]);

  // Insert sample patients
  await db.insert(schema.patients).values([
    { id: 'pat456', name: 'Bob Wilson', email: 'bob@example.com', phone: '+1234567890' },
    { id: 'pat789', name: 'Carol Brown', email: 'carol@example.com', phone: '+1234567891' },
    { id: 'pat101', name: 'David Lee', email: 'david@example.com', phone: '+1234567892' },
    { id: 'pat202', name: 'Emily Chen', email: 'emily@example.com', phone: '+1234567893' },
    // Additional patients for test cases
    { id: 'pat102', name: 'Test Patient 102', email: 'test102@example.com', phone: '+1234567894' },
    { id: 'pat201', name: 'Test Patient 201', email: 'test201@example.com', phone: '+1234567895' },
    { id: 'pat301', name: 'Test Patient 301', email: 'test301@example.com', phone: '+1234567896' },
    { id: 'pat302', name: 'Test Patient 302', email: 'test302@example.com', phone: '+1234567897' },
    { id: 'pat501', name: 'Test Patient 501', email: 'test501@example.com', phone: '+1234567898' },
    { id: 'pat502', name: 'Test Patient 502', email: 'test502@example.com', phone: '+1234567899' },
    { id: 'pat601', name: 'Test Patient 601', email: 'test601@example.com', phone: '+1234567900' },
    { id: 'pat602', name: 'Test Patient 602', email: 'test602@example.com', phone: '+1234567901' },
    { id: 'pat603', name: 'Test Patient 603', email: 'test603@example.com', phone: '+1234567902' },
    { id: 'pat604', name: 'Test Patient 604', email: 'test604@example.com', phone: '+1234567903' },
    { id: 'pat605', name: 'Test Patient 605', email: 'test605@example.com', phone: '+1234567904' },
    { id: 'pat606', name: 'Test Patient 606', email: 'test606@example.com', phone: '+1234567905' },
    { id: 'pat607', name: 'Test Patient 607', email: 'test607@example.com', phone: '+1234567906' },
    { id: 'pat608', name: 'Test Patient 608', email: 'test608@example.com', phone: '+1234567907' },
    { id: 'pat609', name: 'Test Patient 609', email: 'test609@example.com', phone: '+1234567908' },
    { id: 'pat6010', name: 'Test Patient 6010', email: 'test6010@example.com', phone: '+1234567909' },
    { id: 'pat700', name: 'Test Patient 700', email: 'test700@example.com', phone: '+1234567910' },
  ]);

  // Insert sample availability - multiple slots for different days and times
  await db.insert(schema.availability).values([
    // June 15, 2050 - Multiple doctors and slots
    { id: 'avail1', doctorId: 'doc123', date: '2050-06-15', startTime: '09:00', endTime: '09:30', isBooked: false },
    { id: 'avail2', doctorId: 'doc123', date: '2050-06-15', startTime: '09:30', endTime: '10:00', isBooked: false },
    { id: 'avail3', doctorId: 'doc123', date: '2050-06-15', startTime: '10:00', endTime: '10:30', isBooked: false },
    { id: 'avail4', doctorId: 'doc456', date: '2050-06-15', startTime: '10:00', endTime: '10:30', isBooked: false },
    { id: 'avail5', doctorId: 'doc456', date: '2050-06-15', startTime: '10:30', endTime: '11:00', isBooked: false },
    { id: 'avail6', doctorId: 'doc789', date: '2050-06-15', startTime: '14:00', endTime: '14:30', isBooked: false },
    
    // June 16, 2050 - Additional availability for rescheduling tests
    { id: 'avail7', doctorId: 'doc123', date: '2050-06-16', startTime: '09:00', endTime: '09:30', isBooked: false },
    { id: 'avail8', doctorId: 'doc456', date: '2050-06-16', startTime: '09:30', endTime: '10:00', isBooked: false },
    { id: 'avail9', doctorId: 'doc789', date: '2050-06-16', startTime: '10:00', endTime: '10:30', isBooked: false },
    { id: 'avail10', doctorId: 'doc999', date: '2050-06-16', startTime: '11:00', endTime: '11:30', isBooked: false },
    
    // June 17, 2050 - More future availability
    { id: 'avail11', doctorId: 'doc123', date: '2050-06-17', startTime: '09:00', endTime: '09:30', isBooked: false },
    { id: 'avail12', doctorId: 'doc456', date: '2050-06-17', startTime: '10:00', endTime: '10:30', isBooked: false },
    { id: 'avail13', doctorId: 'doc789', date: '2050-06-17', startTime: '11:00', endTime: '11:30', isBooked: false },
    
    // Some booked slots for testing edge cases
    { id: 'avail14', doctorId: 'doc123', date: '2050-06-15', startTime: '11:00', endTime: '11:30', isBooked: true },
    { id: 'avail15', doctorId: 'doc456', date: '2050-06-15', startTime: '11:30', endTime: '12:00', isBooked: true },
  ]);

  // Insert some initial appointments for testing
  await db.insert(schema.appointments).values([
    {
      id: 'appt1',
      doctorId: 'doc123',
      patientId: 'pat456',
      availabilityId: 'avail14',
      date: '2050-06-15',
      startTime: '11:00',
      durationMinutes: 30,
      status: 'scheduled'
    },
    {
      id: 'appt2',
      doctorId: 'doc456',
      patientId: 'pat789',
      availabilityId: 'avail15',
      date: '2050-06-15',
      startTime: '11:30',
      durationMinutes: 30,
      status: 'scheduled'
    }
  ]);
} 
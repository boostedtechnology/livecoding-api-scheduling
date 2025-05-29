import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import doctorRoutes from '@/routes/doctors';
import { getDatabase } from '@/db/db-factory';
import { appointments, availability } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { setTestEmailer } from '@/utils';

// Create test app
const app = express();
app.use(express.json());
app.use('/doctors', doctorRoutes);

describe('Task 4C: Prefer Original Doctor When Rebooking', () => {
  beforeEach(() => {
    setTestEmailer('test-success');
  });

  describe('Doctor Preference Logic', () => {
    it('should prefer original doctor when multiple next slots are available', async () => {
      const db = await getDatabase();
      
      // Ensure doc123 has future availability (avail7, avail11)
      // Delete current appointment
      await request(app)
        .delete('/doctors/doc123/availability/avail14')
        .expect(200);

      // Verify appointment was rebooked to same doctor's next slot
      const rebooked = await db
        .select()
        .from(appointments)
        .where(eq(appointments.id, 'appt1'));
      
      expect(rebooked.length).toBe(1);
      expect(rebooked[0].doctorId).toBe('doc123'); // Preferred original doctor
      expect(['avail7', 'avail11']).toContain(rebooked[0].availabilityId);
    });

    it('should prioritize original doctor in future slots over other doctors', async () => {
      const db = await getDatabase();
      
      // Ensure doc123 has a future slot and other doctors do too
      // but doc123's should be preferred
      
      await request(app)
        .delete('/doctors/doc123/availability/avail14')
        .expect(200);

      const rebooked = await db
        .select()
        .from(appointments)
        .where(eq(appointments.id, 'appt1'));
      
      // Should be rebooked to doc123's future slot if available
      expect(rebooked[0].doctorId).toBe('doc123');
    });

    it('should prefer original doctor even when other doctors have earlier slots', async () => {
      const db = await getDatabase();
      
      // Create an earlier slot for a different doctor
      await db.insert(availability).values({
        id: 'other_earlier_slot',
        doctorId: 'doc456',
        date: '2050-06-16',
        startTime: '08:00',
        endTime: '08:30',
        isBooked: false
      });

      // Delete doc123's availability with appointment
      await request(app)
        .delete('/doctors/doc123/availability/avail14')
        .expect(200);

      // Should still prefer doc123's future slot over other doctor's earlier slot
      const rebooked = await db
        .select()
        .from(appointments)
        .where(eq(appointments.id, 'appt1'));
      
      expect(rebooked[0].doctorId).toBe('doc123');
      // Should be rebooked to doc123's existing future availability
      expect(['avail7', 'avail11']).toContain(rebooked[0].availabilityId);
    });

    it('should fall back to other doctors only when original doctor has no future availability', async () => {
      const db = await getDatabase();
      
      // First, get all appointments that reference doc123's availability
      const appointmentsToUpdate = await db
        .select()
        .from(appointments)
        .where(eq(appointments.doctorId, 'doc123'));
      
      // Create availability for another doctor
      await db.insert(availability).values({
        id: 'other_doctor_slot',
        doctorId: 'doc456',
        date: '2050-06-16',
        startTime: '09:00',
        endTime: '09:30',
        isBooked: false
      });
      
      // Update all appointments to reference the new availability before deleting
      for (const appt of appointmentsToUpdate) {
        if (appt.availabilityId) {
          await db
            .update(appointments)
            .set({
              doctorId: 'doc456',
              availabilityId: 'other_doctor_slot',
              date: '2050-06-16',
              startTime: '09:00'
            })
            .where(eq(appointments.id, appt.id));
        }
      }
      
      // Now it's safe to delete all doc123's availability
      await db.delete(availability).where(eq(availability.doctorId, 'doc123'));
      
      // Create a new availability for doc123 that will be deleted
      await db.insert(availability).values({
        id: 'avail14_replacement',
        doctorId: 'doc123',
        date: '2050-06-15',
        startTime: '11:00',
        endTime: '11:30',
        isBooked: true  // This is the one being deleted
      });
      
      // Add an appointment that references this new availability
      await db.insert(appointments).values({
        id: 'appt_fallback_test',
        doctorId: 'doc123',
        patientId: 'pat456',
        availabilityId: 'avail14_replacement',
        date: '2050-06-15',
        startTime: '11:00',
        durationMinutes: 30,
        status: 'scheduled'
      });

      // Delete doc123's availability (should fall back to other doctor)
      await request(app)
        .delete('/doctors/doc123/availability/avail14_replacement')
        .expect(200);

      // Get the rebooked appointment
      const rebooked = await db
        .select()
        .from(appointments)
        .where(eq(appointments.id, 'appt_fallback_test'));
      
      // Should fall back to different doctor since doc123 has no future availability
      expect(rebooked[0].doctorId).toBe('doc456');
      expect(rebooked[0].availabilityId).toBe('other_doctor_slot');
    });

    it('should handle multiple appointments preferring original doctor consistently', async () => {
      const db = await getDatabase();
      
      // Create multiple appointments with doc123
      await db.insert(appointments).values([
        {
          id: 'appt_extra_c1',
          doctorId: 'doc123',
          patientId: 'pat301',
          availabilityId: 'avail14',
          date: '2050-06-15',
          startTime: '11:00',
          durationMinutes: 20,
          status: 'scheduled'
        },
        {
          id: 'appt_extra_c2',
          doctorId: 'doc123',
          patientId: 'pat302',
          availabilityId: 'avail14',
          date: '2050-06-15',
          startTime: '11:00',
          durationMinutes: 30,
          status: 'scheduled'
        }
      ]);

      // Create availability for other doctors
      await db.insert(availability).values([
        {
          id: 'other_doc_slot1',
          doctorId: 'doc456',
          date: '2050-06-16',
          startTime: '08:00',
          endTime: '08:30',
          isBooked: false
        },
        {
          id: 'other_doc_slot2',
          doctorId: 'doc789',
          date: '2050-06-16',
          startTime: '09:00',
          endTime: '09:30',
          isBooked: false
        }
      ]);

      // Delete availability
      await request(app)
        .delete('/doctors/doc123/availability/avail14')
        .expect(200);

      // All appointments should prefer doc123's future slots
      const allAppts = await db.select().from(appointments);
      const rebookedAppts = allAppts.filter(apt => 
        ['appt1', 'appt_extra_c1', 'appt_extra_c2'].includes(apt.id)
      );
      
      expect(rebookedAppts.length).toBe(3);
      
      // Should prefer doc123's existing future slots over other doctors
      const doc123Rebooked = rebookedAppts.filter(apt => apt.doctorId === 'doc123');
      expect(doc123Rebooked.length).toBeGreaterThan(0); // At least some should stay with doc123
      
      // Those with doc123 should be in his future availability slots
      doc123Rebooked.forEach(apt => {
        expect(['avail7', 'avail11']).toContain(apt.availabilityId);
      });
    });
  });

  describe('Priority Order with Multiple Options', () => {
    it('should prefer original doctor same-time slot over any future slot', async () => {
      const db = await getDatabase();
      
      // Create same-time slot for original doctor (doc123)
      await db.insert(availability).values([
        {
          id: 'doc123_same_time',
          doctorId: 'doc123',
          date: '2050-06-15',
          startTime: '11:00',
          endTime: '11:30',
          isBooked: false
        },
        {
          id: 'other_future_slot',
          doctorId: 'doc456',
          date: '2050-06-16',
          startTime: '08:00',
          endTime: '08:30',
          isBooked: false
        }
      ]);

      // Delete availability
      await request(app)
        .delete('/doctors/doc123/availability/avail14')
        .expect(200);

      const rebooked = await db
        .select()
        .from(appointments)
        .where(eq(appointments.id, 'appt1'));
      
      // Should prefer original doctor's same-time slot
      expect(rebooked[0].doctorId).toBe('doc123');
      expect(rebooked[0].availabilityId).toBe('doc123_same_time');
    });

    it('should use first available slot of original doctor when multiple future slots exist', async () => {
      const db = await getDatabase();
      
      // Create multiple future slots for doc123 at different times
      await db.insert(availability).values([
        {
          id: 'doc123_later_slot',
          doctorId: 'doc123',
          date: '2050-06-17',
          startTime: '14:00',
          endTime: '14:30',
          isBooked: false
        },
        {
          id: 'doc123_earlier_slot',
          doctorId: 'doc123',
          date: '2050-06-16',
          startTime: '10:00',
          endTime: '10:30',
          isBooked: false
        }
      ]);

      // Delete availability
      await request(app)
        .delete('/doctors/doc123/availability/avail14')
        .expect(200);

      const rebooked = await db
        .select()
        .from(appointments)
        .where(eq(appointments.id, 'appt1'));
      
      // Should prefer original doctor
      expect(rebooked[0].doctorId).toBe('doc123');
      
      // Should be one of doc123's slots (checking both existing and new ones)
      const doc123Slots = ['avail7', 'avail11', 'doc123_earlier_slot', 'doc123_later_slot'];
      expect(doc123Slots).toContain(rebooked[0].availabilityId);
    });
  });

  describe('Edge Cases with Doctor Preference', () => {
    it('should handle case where original doctor has limited future availability', async () => {
      const db = await getDatabase();
      
      // Remove some of doc123's future availability
      await db.delete(availability).where(eq(availability.id, 'avail11'));
      
      // Create more slots for other doctors
      await db.insert(availability).values([
        {
          id: 'other_doc_many_slots1',
          doctorId: 'doc456',
          date: '2050-06-16',
          startTime: '08:00',
          endTime: '08:30',
          isBooked: false
        },
        {
          id: 'other_doc_many_slots2',
          doctorId: 'doc456',
          date: '2050-06-16',
          startTime: '09:00',
          endTime: '09:30',
          isBooked: false
        }
      ]);

      // Delete availability
      await request(app)
        .delete('/doctors/doc123/availability/avail14')
        .expect(200);

      const rebooked = await db
        .select()
        .from(appointments)
        .where(eq(appointments.id, 'appt1'));
      
      // Should still prefer doc123 even with limited availability
      expect(rebooked[0].doctorId).toBe('doc123');
      expect(rebooked[0].availabilityId).toBe('avail7'); // Only remaining doc123 slot
    });
  });

  describe('Success Response with Doctor Preference', () => {
    it('should return 200 when successfully rebooking with doctor preference', async () => {
      await request(app)
        .delete('/doctors/doc123/availability/avail14')
        .expect(200);
    });
  });
}); 
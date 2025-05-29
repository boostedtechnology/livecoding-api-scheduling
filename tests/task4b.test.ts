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

describe('Task 4B: Rebook Patient to Next Available Slot', () => {
  beforeEach(() => {
    setTestEmailer('test-success');
  });

  describe('Next Available Slot Rebooking', () => {
    it('should rebook to next available slot when no same-time alternative exists', async () => {
      const db = await getDatabase();

      // Delete availability with appointment (no same-time alternative)
      await request(app)
        .delete('/doctors/doc123/availability/avail14')
        .expect(200);

      // Verify appointment was rebooked to next available slot
      const rebooked = await db
        .select()
        .from(appointments)
        .where(eq(appointments.id, 'appt1'));
      
      expect(rebooked.length).toBe(1);
      expect(rebooked[0].patientId).toBe('pat456'); // Same patient
      
      // Should be rebooked to a future availability slot
      expect(['avail7', 'avail8', 'avail9', 'avail10', 'avail11', 'avail12', 'avail13'])
        .toContain(rebooked[0].availabilityId);
    });

    it('should handle multiple appointments in same availability slot for future rebooking', async () => {
      const db = await getDatabase();
      
      // Create second appointment in same slot
      await db.insert(appointments).values({
        id: 'appt_extra',
        doctorId: 'doc123',
        patientId: 'pat101',
        availabilityId: 'avail14',
        date: '2050-06-15',
        startTime: '11:00',
        durationMinutes: 15,
        status: 'scheduled'
      });

      // Delete availability
      await request(app)
        .delete('/doctors/doc123/availability/avail14')
        .expect(200);

      // Verify both appointments were rebooked
      const rebookedAppts = await db
        .select()
        .from(appointments)
        .where(eq(appointments.availabilityId, 'avail14'));
      expect(rebookedAppts.length).toBe(0); // None should remain with deleted availability

      const allAppts = await db.select().from(appointments);
      const patientAppts = allAppts.filter(apt => 
        apt.id === 'appt1' || apt.id === 'appt_extra'
      );
      expect(patientAppts.length).toBe(2);
      patientAppts.forEach(apt => {
        expect(apt.availabilityId).not.toBe('avail14');
        // Should be rebooked to future slots
        expect(['avail7', 'avail8', 'avail9', 'avail10', 'avail11', 'avail12', 'avail13'])
          .toContain(apt.availabilityId);
      });
    });

    it('should assign patients to different available slots when multiple patients need rebooking', async () => {
      const db = await getDatabase();
      
      // Create multiple appointments in the same slot
      await db.insert(appointments).values([
        {
          id: 'appt_extra1',
          doctorId: 'doc123',
          patientId: 'pat201',
          availabilityId: 'avail14',
          date: '2050-06-15',
          startTime: '11:00',
          durationMinutes: 20,
          status: 'scheduled'
        },
        {
          id: 'appt_extra2',
          doctorId: 'doc123',
          patientId: 'pat202',
          availabilityId: 'avail14',
          date: '2050-06-15',
          startTime: '11:00',
          durationMinutes: 30,
          status: 'scheduled'
        }
      ]);

      // Delete availability with multiple appointments
      await request(app)
        .delete('/doctors/doc123/availability/avail14')
        .expect(200);

      // Verify all appointments were rebooked to different future slots
      const allAppts = await db.select().from(appointments);
      const rebookedAppts = allAppts.filter(apt => 
        ['appt1', 'appt_extra1', 'appt_extra2'].includes(apt.id)
      );
      
      expect(rebookedAppts.length).toBe(3);
      
      // Each should be rebooked to a different availability slot
      const rebookedSlots = rebookedAppts.map(apt => apt.availabilityId);
      const uniqueSlots = new Set(rebookedSlots);
      expect(uniqueSlots.size).toBe(3); // All different slots
      
      // All should be future slots
      rebookedSlots.forEach(slotId => {
        expect(['avail7', 'avail8', 'avail9', 'avail10', 'avail11', 'avail12', 'avail13'])
          .toContain(slotId);
      });
    });

    it('should maintain appointment integrity when rebooking to next available slots', async () => {
      const db = await getDatabase();

      // Get original appointment details
      const originalAppt = await db
        .select()
        .from(appointments)
        .where(eq(appointments.id, 'appt1'));
      
      const originalPatientId = originalAppt[0].patientId;
      const originalDurationMinutes = originalAppt[0].durationMinutes;

      // Delete availability
      await request(app)
        .delete('/doctors/doc123/availability/avail14')
        .expect(200);

      // Verify appointment was rebooked with same patient and duration
      const rebooked = await db
        .select()
        .from(appointments)
        .where(eq(appointments.id, 'appt1'));
      
      expect(rebooked.length).toBe(1);
      expect(rebooked[0].patientId).toBe(originalPatientId);
      expect(rebooked[0].durationMinutes).toBe(originalDurationMinutes);
      expect(rebooked[0].status).toBe('scheduled');
      expect(rebooked[0].availabilityId).not.toBe('avail14');
    });

    it('should update availability slot to booked when appointment is rescheduled to it', async () => {
      const db = await getDatabase();

      // Delete availability with appointment
      await request(app)
        .delete('/doctors/doc123/availability/avail14')
        .expect(200);

      // Get the rebooked appointment
      const rebooked = await db
        .select()
        .from(appointments)
        .where(eq(appointments.id, 'appt1'));
      
      const newAvailabilityId = rebooked[0].availabilityId;

      // Verify the new availability slot is marked as booked
      const newAvailability = await db
        .select()
        .from(availability)
        .where(eq(availability.id, newAvailabilityId!));
      
      expect(newAvailability.length).toBe(1);
      expect(newAvailability[0].isBooked).toBe(true);
    });
  });

  describe('Chronological Ordering', () => {
    it('should rebook to earliest available future slot', async () => {
      const db = await getDatabase();

      // Create multiple future availability slots with different dates/times
      await db.insert(availability).values([
        {
          id: 'future_early',
          doctorId: 'doc456',
          date: '2050-06-16',
          startTime: '08:00',
          endTime: '08:30',
          isBooked: false
        },
        {
          id: 'future_late',
          doctorId: 'doc789',
          date: '2050-06-17',
          startTime: '10:00',
          endTime: '10:30',
          isBooked: false
        }
      ]);

      // Delete availability with appointment
      await request(app)
        .delete('/doctors/doc123/availability/avail14')
        .expect(200);

      // Should be rebooked to the earliest available slot
      const rebooked = await db
        .select()
        .from(appointments)
        .where(eq(appointments.id, 'appt1'));
      
      // Check if it was rebooked to one of the existing earliest slots or our test slots
      const acceptableSlots = [
        'avail7', 'avail8', 'avail9', 'avail10', 'avail11', 'avail12', 'avail13',
        'future_early'  // Should prefer this over future_late due to earlier time
      ];
      expect(acceptableSlots).toContain(rebooked[0].availabilityId);
    });
  });

  describe('Success Response', () => {
    it('should return 200 when successfully rebooking to next available slot', async () => {
      await request(app)
        .delete('/doctors/doc123/availability/avail14')
        .expect(200);
    });
  });
}); 
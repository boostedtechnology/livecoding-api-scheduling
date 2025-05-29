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

describe('Task 4A: Assign Patient to Free Doctor in Same Time Slot', () => {
  beforeEach(() => {
    setTestEmailer('test-success');
  });

  describe('Basic Availability Deletion', () => {
    it('should delete availability that has no booked appointments', async () => {
      const db = await getDatabase();
      
      // Verify availability exists before deletion
      const beforeDeletion = await db
        .select()
        .from(availability)
        .where(eq(availability.id, 'avail1'));
      expect(beforeDeletion.length).toBe(1);

      // Delete availability
      await request(app)
        .delete('/doctors/doc123/availability/avail1')
        .expect(200);

      // Verify availability is deleted
      const afterDeletion = await db
        .select()
        .from(availability)
        .where(eq(availability.id, 'avail1'));
      expect(afterDeletion.length).toBe(0);
    });

    it('should not affect other availability slots when deleting', async () => {
      const db = await getDatabase();
      
      // Get count of other availability
      const beforeCount = await db.select().from(availability);
      const initialCount = beforeCount.length;

      // Delete one availability
      await request(app)
        .delete('/doctors/doc123/availability/avail2')
        .expect(200);

      // Verify only one was deleted
      const afterCount = await db.select().from(availability);
      expect(afterCount.length).toBe(initialCount - 1);
    });

    it('should return 200 when successfully deleting availability without appointment', async () => {
      await request(app)
        .delete('/doctors/doc123/availability/avail1')
        .expect(200);
    });
  });

  describe('Same Time Slot Rebooking', () => {
    it('should rebook patient to alternative doctor in same time slot', async () => {
      const db = await getDatabase();
      
      // Setup: Create availability for doc456 at same time as avail14 (11:00-11:30)
      await db.insert(availability).values({
        id: 'avail_same_time',
        doctorId: 'doc456',
        date: '2050-06-15',
        startTime: '11:00',
        endTime: '11:30',
        isBooked: false
      });

      // Delete doc123's availability with appointment
      await request(app)
        .delete('/doctors/doc123/availability/avail14')
        .expect(200);

      // Verify original availability is deleted
      const deletedAvail = await db
        .select()
        .from(availability)
        .where(eq(availability.id, 'avail14'));
      expect(deletedAvail.length).toBe(0);

      // Verify appointment was rebooked to doc456's same time slot
      const rebooked = await db
        .select()
        .from(appointments)
        .where(eq(appointments.id, 'appt1'));
      
      expect(rebooked.length).toBe(1);
      expect(rebooked[0].doctorId).toBe('doc456');
      expect(rebooked[0].availabilityId).toBe('avail_same_time');
      expect(rebooked[0].date).toBe('2050-06-15');
      expect(rebooked[0].startTime).toBe('11:00');

      // Verify the alternative slot is now booked
      const bookedSlot = await db
        .select()
        .from(availability)
        .where(eq(availability.id, 'avail_same_time'));
      expect(bookedSlot[0].isBooked).toBe(true);
    });

    it('should prioritize same time slot over future slots', async () => {
      const db = await getDatabase();
      
      // Create multiple options: same time + future slots
      await db.insert(availability).values([
        {
          id: 'same_time_option',
          doctorId: 'doc456',
          date: '2050-06-15',
          startTime: '11:00',
          endTime: '11:30',
          isBooked: false
        },
        {
          id: 'future_option',
          doctorId: 'doc789',
          date: '2050-06-16',
          startTime: '09:00',
          endTime: '09:30',
          isBooked: false
        }
      ]);

      await request(app)
        .delete('/doctors/doc123/availability/avail14')
        .expect(200);

      const rebooked = await db
        .select()
        .from(appointments)
        .where(eq(appointments.id, 'appt1'));
      
      // Should prefer same time slot
      expect(rebooked[0].availabilityId).toBe('same_time_option');
    });

    it('should handle multiple appointments in same availability slot for same-time rebooking', async () => {
      const db = await getDatabase();
      
      // Create same-time alternative
      await db.insert(availability).values([
        {
          id: 'same_time_slot1',
          doctorId: 'doc456',
          date: '2050-06-15',
          startTime: '11:00',
          endTime: '11:30',
          isBooked: false
        },
        {
          id: 'same_time_slot2',
          doctorId: 'doc789',
          date: '2050-06-15',
          startTime: '11:00',
          endTime: '11:30',
          isBooked: false
        }
      ]);

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

      // Verify both appointments were rebooked to same time slots
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
        // Should be rebooked to same time slots
        expect(['same_time_slot1', 'same_time_slot2']).toContain(apt.availabilityId);
      });
    });
  });

  describe('Error Handling for Use Case A', () => {
    it('should return 404 when doctor not found', async () => {
      await request(app)
        .delete('/doctors/nonexistent/availability/avail1')
        .expect(404);
    });

    it('should return 404 when availability not found', async () => {
      await request(app)
        .delete('/doctors/doc123/availability/nonexistent')
        .expect(404);
    });

    it('should return 404 when availability belongs to different doctor', async () => {
      await request(app)
        .delete('/doctors/doc456/availability/avail1')  // avail1 belongs to doc123
        .expect(404);
    });
  });
}); 
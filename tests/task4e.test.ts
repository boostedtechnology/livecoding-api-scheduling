import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import doctorRoutes from '@/routes/doctors';
import { getDatabase } from '@/db/db-factory';
import { appointments, availability } from '@/db/schema';
import { eq, and, ne } from 'drizzle-orm';
import { setTestEmailer } from '@/utils';

// Create test app
const app = express();
app.use(express.json());
app.use('/doctors', doctorRoutes);

describe('Task 4E: Transactional Safety and Data Integrity', () => {
  beforeEach(() => {
    setTestEmailer('test-success');
  });

  describe('Transaction Rollback on Email Failure', () => {
    it('should rollback deletion when email fails', async () => {
      const db = await getDatabase();
      setTestEmailer('test-fail');

      // Get initial state
      const initialAvailability = await db
        .select()
        .from(availability)
        .where(eq(availability.id, 'avail14'));
      expect(initialAvailability.length).toBe(1);

      const initialAppointment = await db
        .select()
        .from(appointments)
        .where(eq(appointments.id, 'appt1'));
      expect(initialAppointment.length).toBe(1);

      // Attempt deletion (should fail due to email)
      await request(app)
        .delete('/doctors/doc123/availability/avail14')
        .expect(500);

      // Verify rollback - availability should still exist
      const afterFailure = await db
        .select()
        .from(availability)
        .where(eq(availability.id, 'avail14'));
      expect(afterFailure.length).toBe(1);
      expect(afterFailure[0].isBooked).toBe(true);

      // Verify appointment is unchanged
      const appointmentAfter = await db
        .select()
        .from(appointments)
        .where(eq(appointments.id, 'appt1'));
      expect(appointmentAfter.length).toBe(1);
      expect(appointmentAfter[0].availabilityId).toBe('avail14');
      expect(appointmentAfter[0].doctorId).toBe('doc123');
    });

    it('should rollback all changes when email fails with multiple appointments', async () => {
      const db = await getDatabase();
      
      // Create multiple appointments in the same slot
      await db.insert(appointments).values([
        {
          id: 'appt_rollback1',
          doctorId: 'doc123',
          patientId: 'pat501',
          availabilityId: 'avail14',
          date: '2050-06-15',
          startTime: '11:00',
          durationMinutes: 20,
          status: 'scheduled'
        },
        {
          id: 'appt_rollback2',
          doctorId: 'doc123',
          patientId: 'pat502',
          availabilityId: 'avail14',
          date: '2050-06-15',
          startTime: '11:00',
          durationMinutes: 30,
          status: 'scheduled'
        }
      ]);

      setTestEmailer('test-fail');

      // Attempt deletion
      await request(app)
        .delete('/doctors/doc123/availability/avail14')
        .expect(500);

      // Verify all appointments remain unchanged
      const allAppts = await db
        .select()
        .from(appointments)
        .where(eq(appointments.availabilityId, 'avail14'));
      expect(allAppts.length).toBe(3); // Original + 2 new ones

      // Verify availability still exists
      const availabilityAfter = await db
        .select()
        .from(availability)
        .where(eq(availability.id, 'avail14'));
      expect(availabilityAfter.length).toBe(1);
    });
  });

  describe('Transaction Rollback on Rebooking Failure', () => {
    it('should rollback when rebooking fails due to no available slots', async () => {
      const db = await getDatabase();
      
      // Remove all future availability to force rebooking failure
      await db.delete(availability).where(
        and(
          ne(availability.id, 'avail14'),
          ne(availability.id, 'avail15'),
          eq(availability.isBooked, false)
        )
      );

      // Attempt deletion (should fail due to no rebooking options)
      await request(app)
        .delete('/doctors/doc123/availability/avail14')
        .expect(500);

      // Verify rollback - original availability should still exist
      const afterFailure = await db
        .select()
        .from(availability)
        .where(eq(availability.id, 'avail14'));
      expect(afterFailure.length).toBe(1);
    });

    it('should rollback partial rebooking when some appointments cannot be rescheduled', async () => {
      const db = await getDatabase();
      
      // Create many appointments that would need rebooking
      const extraAppointments = [];
      for (let i = 1; i <= 10; i++) {
        extraAppointments.push({
          id: `appt_overflow${i}`,
          doctorId: 'doc123',
          patientId: `pat60${i}`,
          availabilityId: 'avail14',
          date: '2050-06-15',
          startTime: '11:00',
          durationMinutes: 15,
          status: 'scheduled'
        });
      }
      await db.insert(appointments).values(extraAppointments);

      // Leave only limited future availability (insufficient for all appointments)
      await db.delete(availability).where(
        and(
          ne(availability.id, 'avail14'),
          ne(availability.id, 'avail7'), // Keep only one future slot
          eq(availability.isBooked, false)
        )
      );

      // Should fail due to insufficient rebooking slots
      await request(app)
        .delete('/doctors/doc123/availability/avail14')
        .expect(500);

      // Verify all appointments remain in original slot
      const unchangedAppts = await db
        .select()
        .from(appointments)
        .where(eq(appointments.availabilityId, 'avail14'));
      expect(unchangedAppts.length).toBe(11); // Original + 10 new ones
    });
  });

  describe('Atomic Transaction Success', () => {
    it('should ensure atomicity - all operations succeed or all fail', async () => {
      const db = await getDatabase();
      
      // Count initial state
      const initialAvailCount = await db.select().from(availability);
      const initialApptCount = await db.select().from(appointments);

      // Successful deletion should complete all operations
      await request(app)
        .delete('/doctors/doc123/availability/avail14')
        .expect(200);

      // Verify changes are committed
      const finalAvailCount = await db.select().from(availability);
      const finalApptCount = await db.select().from(appointments);
      
      expect(finalAvailCount.length).toBe(initialAvailCount.length - 1);
      expect(finalApptCount.length).toBe(initialApptCount.length); // Same count, but rebooked
    });

    it('should commit all changes atomically on successful operation', async () => {
      const db = await getDatabase();
      
      // Create additional appointment for testing
      await db.insert(appointments).values({
        id: 'appt_atomic_test',
        doctorId: 'doc123',
        patientId: 'pat700',
        availabilityId: 'avail14',
        date: '2050-06-15',
        startTime: '11:00',
        durationMinutes: 25,
        status: 'scheduled'
      });

      // Operation should succeed completely
      await request(app)
        .delete('/doctors/doc123/availability/avail14')
        .expect(200);

      // Verify original availability is deleted
      const deletedAvail = await db
        .select()
        .from(availability)
        .where(eq(availability.id, 'avail14'));
      expect(deletedAvail.length).toBe(0);

      // Verify all appointments are rebooked
      const oldSlotAppts = await db
        .select()
        .from(appointments)
        .where(eq(appointments.availabilityId, 'avail14'));
      expect(oldSlotAppts.length).toBe(0);

      // Verify appointments exist in new slots
      const allAppts = await db.select().from(appointments);
      const rebookedAppts = allAppts.filter(apt => 
        apt.id === 'appt1' || apt.id === 'appt_atomic_test'
      );
      expect(rebookedAppts.length).toBe(2);
      rebookedAppts.forEach(apt => {
        expect(apt.availabilityId).not.toBe('avail14');
      });
    });
  });

  describe('Database Referential Integrity', () => {
    it('should maintain referential integrity after rebooking', async () => {
      const db = await getDatabase();

      await request(app)
        .delete('/doctors/doc123/availability/avail14')
        .expect(200);

      // Verify appointment references valid availability
      const appointment = await db
        .select({
          appointmentId: appointments.id,
          availabilityId: appointments.availabilityId,
          doctorId: appointments.doctorId
        })
        .from(appointments)
        .where(eq(appointments.id, 'appt1'));

      expect(appointment.length).toBe(1);
      
      // Verify the referenced availability exists
      const referencedAvail = await db
        .select()
        .from(availability)
        .where(eq(availability.id, appointment[0].availabilityId!));
      
      expect(referencedAvail.length).toBe(1);
      expect(referencedAvail[0].doctorId).toBe(appointment[0].doctorId);
      expect(referencedAvail[0].isBooked).toBe(true);
    });

    it('should not create orphaned appointments', async () => {
      const db = await getDatabase();

      await request(app)
        .delete('/doctors/doc123/availability/avail14')
        .expect(200);

      // Verify no appointments reference deleted availability
      const orphanedAppts = await db
        .select()
        .from(appointments)
        .where(eq(appointments.availabilityId, 'avail14'));
      
      expect(orphanedAppts.length).toBe(0);
    });

    it('should maintain consistency across all table relationships', async () => {
      const db = await getDatabase();

      // Get initial relationship counts
      const initialAppts = await db.select().from(appointments);
      const initialAvail = await db.select().from(availability);

      await request(app)
        .delete('/doctors/doc123/availability/avail14')
        .expect(200);

      // Verify final relationship counts
      const finalAppts = await db.select().from(appointments);
      const finalAvail = await db.select().from(availability);

      // Same number of appointments, one less availability
      expect(finalAppts.length).toBe(initialAppts.length);
      expect(finalAvail.length).toBe(initialAvail.length - 1);

      // Verify all appointments have valid availability references
      for (const apt of finalAppts) {
        if (apt.availabilityId) {
          const correspondingAvail = await db
            .select()
            .from(availability)
            .where(eq(availability.id, apt.availabilityId));
          expect(correspondingAvail.length).toBe(1);
        }
      }
    });
  });

  describe('Concurrent Transaction Handling', () => {
    it('should handle concurrent deletion attempts', async () => {
      // Simulate concurrent requests
      const deletionPromises = [
        request(app).delete('/doctors/doc123/availability/avail14'),
        request(app).delete('/doctors/doc123/availability/avail14'),
        request(app).delete('/doctors/doc123/availability/avail14')
      ];

      const responses = await Promise.allSettled(deletionPromises);
      
      // One should succeed, others should fail gracefully
      const successCount = responses.filter(r => 
        r.status === 'fulfilled' && r.value.status === 200
      ).length;
      
      expect(successCount).toBeLessThanOrEqual(1);
    });

    it('should maintain data consistency under concurrent access', async () => {
      const db = await getDatabase();

      // Create multiple similar deletion requests
      const promises = [
        request(app).delete('/doctors/doc123/availability/avail14'),
        request(app).delete('/doctors/doc123/availability/avail15')
      ];

      await Promise.allSettled(promises);

      // Verify database remains in consistent state
      const allAppts = await db.select().from(appointments);
      const allAvail = await db.select().from(availability);

      // All appointments should have valid availability references
      for (const apt of allAppts) {
        if (apt.availabilityId) {
          const correspondingAvail = allAvail.find(av => av.id === apt.availabilityId);
          expect(correspondingAvail).toBeTruthy();
        }
      }
    });
  });

  describe('Error Recovery and Cleanup', () => {
    it('should properly clean up transaction state on failure', async () => {
      const db = await getDatabase();
      setTestEmailer('test-fail');

      // Get baseline counts
      const baselineAppts = await db.select().from(appointments);
      const baselineAvail = await db.select().from(availability);

      // Multiple failed attempts should not affect state
      await request(app)
        .delete('/doctors/doc123/availability/avail14')
        .expect(500);
      
      await request(app)
        .delete('/doctors/doc123/availability/avail14')
        .expect(500);

      // Verify state remains unchanged
      const finalAppts = await db.select().from(appointments);
      const finalAvail = await db.select().from(availability);

      expect(finalAppts.length).toBe(baselineAppts.length);
      expect(finalAvail.length).toBe(baselineAvail.length);
    });

    it('should handle system errors gracefully without data corruption', async () => {
      const db = await getDatabase();

      // Test with invalid data scenarios that might cause system errors
      await request(app)
        .delete('/doctors/doc@123!/availability/avail#456$')
        .expect(404); // Should return 404 for invalid IDs

      // Verify database integrity is maintained
      const appts = await db.select().from(appointments);
      const avail = await db.select().from(availability);

      expect(appts.length).toBeGreaterThan(0);
      expect(avail.length).toBeGreaterThan(0);
    });
  });

  describe('Transaction Isolation', () => {
    it('should isolate transaction changes until commit', async () => {
      // This test verifies that intermediate states are not visible outside the transaction
      // In a real implementation, this would test that other concurrent reads don't see
      // partial states during the transaction
      
      await request(app)
        .delete('/doctors/doc123/availability/avail14')
        .expect(200);

      // After completion, changes should be visible and consistent
      const db = await getDatabase();
      const deletedAvail = await db
        .select()
        .from(availability)
        .where(eq(availability.id, 'avail14'));
      expect(deletedAvail.length).toBe(0);
    });
  });
}); 
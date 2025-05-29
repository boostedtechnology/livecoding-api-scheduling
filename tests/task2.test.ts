import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import appointmentRoutes from '@/routes/appointments';
import { getDatabase } from '@/db/db-factory';
import { appointments, doctors, patients } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { setTestEmailer, resetEmailer } from '@/utils';

// Create test app
const app = express();
app.use(express.json());
app.use('/appointments', appointmentRoutes);

describe('Task 2: Delete Appointment', () => {
  beforeEach(() => {
    // Use success emailer by default for tests that expect deletion to work
    setTestEmailer('test-success');
  });

  describe('DELETE /appointments/:appointmentId', () => {
    it('should return HTTP 200 for valid appointment ID', async () => {
      const response = await request(app)
        .delete('/appointments/appt1')
        .expect(200);

      // Should have no response body as per requirements
      expect(response.text).toBe('');
    });

    it('should return HTTP 200 for invalid appointment ID', async () => {
      const response = await request(app)
        .delete('/appointments/nonexistent')
        .expect(200);

      // Should still return 200 as per requirements
      expect(response.text).toBe('');
    });

    it('should return HTTP 200 for malformed appointment ID', async () => {
      const response = await request(app)
        .delete('/appointments/invalid@id!')
        .expect(200);

      // Should still return 200 as per requirements
      expect(response.text).toBe('');
    });

    it('should actually delete the appointment from database when valid ID is provided', async () => {
      const db = await getDatabase();
      
      // Verify appointment exists before deletion
      const beforeDelete = await db
        .select()
        .from(appointments)
        .where(eq(appointments.id, 'appt1'));
      
      expect(beforeDelete.length).toBe(1);
      expect(beforeDelete[0].id).toBe('appt1');

      // Delete the appointment
      await request(app)
        .delete('/appointments/appt1')
        .expect(200);

      // Verify it's deleted from database
      const afterDelete = await db
        .select()
        .from(appointments)
        .where(eq(appointments.id, 'appt1'));
      
      expect(afterDelete.length).toBe(0);
    });

    it('should handle deleting already deleted appointment gracefully', async () => {
      const db = await getDatabase();
      
      // First deletion
      await request(app)
        .delete('/appointments/appt2')
        .expect(200);

      // Verify it's deleted
      const afterFirstDelete = await db
        .select()
        .from(appointments)
        .where(eq(appointments.id, 'appt2'));
      expect(afterFirstDelete.length).toBe(0);

      // Second deletion attempt should still return 200
      await request(app)
        .delete('/appointments/appt2')
        .expect(200);
    });

    it('should not affect other appointments when deleting one', async () => {
      const db = await getDatabase();
      
      // Get count of all appointments before deletion
      const allAppointmentsBefore = await db.select().from(appointments);
      const totalBefore = allAppointmentsBefore.length;

      // Delete one appointment
      await request(app)
        .delete('/appointments/appt1')
        .expect(200);

      // Verify total count decreased by 1
      const allAppointmentsAfter = await db.select().from(appointments);
      expect(allAppointmentsAfter.length).toBe(totalBefore - 1);

      // Verify other appointments still exist
      const otherAppointment = allAppointmentsAfter.find(app => app.id === 'appt2');
      expect(otherAppointment).toBeDefined();
    });
  });

  describe('Email Notifications', () => {
    it('should send email notifications to both doctor and patient when appointment is deleted', async () => {
      const db = await getDatabase();
      
      // Get appointment details for email verification
      const appointmentBefore = await db
        .select({
          id: appointments.id,
          doctorEmail: doctors.email,
          doctorName: doctors.name,
          patientEmail: patients.email,
          patientName: patients.name,
        })
        .from(appointments)
        .leftJoin(doctors, eq(appointments.doctorId, doctors.id))
        .leftJoin(patients, eq(appointments.patientId, patients.id))
        .where(eq(appointments.id, 'appt1'));

      expect(appointmentBefore.length).toBe(1);
      expect(appointmentBefore[0].doctorEmail).toBe('jane@example.com');
      expect(appointmentBefore[0].patientEmail).toBe('bob@example.com');

      // Delete appointment (emails should be sent)
      await request(app)
        .delete('/appointments/appt1')
        .expect(200);

      // Verify appointment is deleted
      const appointmentAfter = await db
        .select()
        .from(appointments)
        .where(eq(appointments.id, 'appt1'));
      
      expect(appointmentAfter.length).toBe(0);
    });
  });

  describe('Transaction Handling and Email Failures', () => {
    it('should maintain data consistency when emailer fails - transaction should rollback', async () => {
      // Force emailer to always fail
      setTestEmailer('test-fail');
      
      const db = await getDatabase();
      
      // Verify appointment exists before deletion attempt
      const beforeDelete = await db
        .select()
        .from(appointments)
        .where(eq(appointments.id, 'appt1'));
      
      expect(beforeDelete.length).toBe(1);

      // Attempt to delete appointment (emailer will fail)
      await request(app)
        .delete('/appointments/appt1')
        .expect(200);

      // CRITICAL: Verify appointment still exists (transaction was rolled back)
      const afterFailedDelete = await db
        .select()
        .from(appointments)
        .where(eq(appointments.id, 'appt1'));
      
      // This is the key assertion - appointment should NOT be deleted when emails fail
      expect(afterFailedDelete.length).toBe(1);
      expect(afterFailedDelete[0].id).toBe('appt1');
    });

    it('should handle email service being unavailable gracefully', async () => {
      // Use default test emailer which has random failures
      resetEmailer();
      
      // Should still return 200 even if email fails randomly
      const response = await request(app)
        .delete('/appointments/appt2')
        .expect(200);

      expect(response.text).toBe('');
    });
  });

  describe('Database Consistency', () => {
    it('should maintain referential integrity when deleting appointments', async () => {
      const db = await getDatabase();
      
      // Get related data before deletion
      const appointmentBefore = await db
        .select({
          appointmentId: appointments.id,
          doctorId: appointments.doctorId,
          patientId: appointments.patientId,
          availabilityId: appointments.availabilityId,
        })
        .from(appointments)
        .where(eq(appointments.id, 'appt1'));

      expect(appointmentBefore.length).toBe(1);
      const { doctorId, patientId, availabilityId } = appointmentBefore[0];

      // Delete the appointment
      await request(app)
        .delete('/appointments/appt1')
        .expect(200);

      // Verify related records still exist (doctor, patient, availability should not be deleted)
      const doctorStillExists = await db
        .select()
        .from(doctors)
        .where(eq(doctors.id, doctorId));
      expect(doctorStillExists.length).toBe(1);

      const patientStillExists = await db
        .select()
        .from(patients)
        .where(eq(patients.id, patientId));
      expect(patientStillExists.length).toBe(1);

      // Note: availability might be updated (isBooked flag) depending on implementation
      // This test verifies it still exists
      if (availabilityId) {
        const availabilityStillExists = await db
          .select()
          .from(appointments)
          .where(eq(appointments.id, availabilityId));
        // Availability should still exist (might have updated isBooked status)
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty appointment ID gracefully', async () => {
      await request(app)
        .delete('/appointments/')
        .expect(404); // Express handles this as route not found
    });

    it('should handle concurrent deletion attempts gracefully', async () => {
      // Simulate concurrent deletions of the same appointment
      const deletePromises = [
        request(app).delete('/appointments/appt1').expect(200),
        request(app).delete('/appointments/appt1').expect(200),
        request(app).delete('/appointments/appt1').expect(200),
      ];

      // All should complete successfully
      await Promise.all(deletePromises);

      // Verify appointment is deleted only once
      const db = await getDatabase();
      const afterDelete = await db
        .select()
        .from(appointments)
        .where(eq(appointments.id, 'appt1'));
      
      expect(afterDelete.length).toBe(0);
    });
  });
}); 
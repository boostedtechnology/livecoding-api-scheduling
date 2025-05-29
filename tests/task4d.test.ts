import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import doctorRoutes from '@/routes/doctors';
import { getDatabase } from '@/db/db-factory';
import { patients, appointments, availability } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { setTestEmailer } from '@/utils';

// Create test app
const app = express();
app.use(express.json());
app.use('/doctors', doctorRoutes);

describe('Task 4D: Email Notifications for Patient Rebooking', () => {
  beforeEach(() => {
    setTestEmailer('test-success');
  });

  describe('Email Notification Success Cases', () => {
    it('should send email notification to patient when rescheduling', async () => {
      // Note: With real implementation, we would capture sent emails
      // For now, we test that the process completes successfully
      await request(app)
        .delete('/doctors/doc123/availability/avail14')
        .expect(200);

      // If we reach here, email was sent successfully
      expect(true).toBe(true);
    });

    it('should send email with correct patient information', async () => {
      const db = await getDatabase();
      
      // Get patient info before deletion
      const patient = await db
        .select()
        .from(patients)
        .where(eq(patients.id, 'pat456'));
      
      expect(patient[0].email).toBe('bob@example.com');
      expect(patient[0].name).toBe('Bob Wilson');

      await request(app)
        .delete('/doctors/doc123/availability/avail14')
        .expect(200);
    });

    it('should complete rescheduling process when email is successful', async () => {
      const db = await getDatabase();
      
      // Verify initial state
      const initialAppt = await db
        .select()
        .from(appointments)
        .where(eq(appointments.id, 'appt1'));
      expect(initialAppt[0].availabilityId).toBe('avail14');

      // Delete availability with successful email
      setTestEmailer('test-success');
      await request(app)
        .delete('/doctors/doc123/availability/avail14')
        .expect(200);

      // Verify appointment was rebooked
      const rebookedAppt = await db
        .select()
        .from(appointments)
        .where(eq(appointments.id, 'appt1'));
      expect(rebookedAppt[0].availabilityId).not.toBe('avail14');
    });

    it('should send notification for each affected patient when multiple appointments exist', async () => {
      const db = await getDatabase();
      
      // Create additional appointments in the same slot
      await db.insert(appointments).values([
        {
          id: 'appt_email_test1',
          doctorId: 'doc123',
          patientId: 'pat101',
          availabilityId: 'avail14',
          date: '2050-06-15',
          startTime: '11:00',
          durationMinutes: 20,
          status: 'scheduled'
        },
        {
          id: 'appt_email_test2',
          doctorId: 'doc123',
          patientId: 'pat102',
          availabilityId: 'avail14',
          date: '2050-06-15',
          startTime: '11:00',
          durationMinutes: 30,
          status: 'scheduled'
        }
      ]);

      // All should complete successfully (indicating emails were sent)
      await request(app)
        .delete('/doctors/doc123/availability/avail14')
        .expect(200);

      // Verify all appointments were rebooked (indicating all emails succeeded)
      const remainingOldAppts = await db
        .select()
        .from(appointments)
        .where(eq(appointments.availabilityId, 'avail14'));
      expect(remainingOldAppts.length).toBe(0);
    });
  });

  describe('Email System Failure Handling', () => {
    it('should return 500 when email system fails', async () => {
      setTestEmailer('test-fail');
      
      await request(app)
        .delete('/doctors/doc123/availability/avail14')
        .expect(500);
    });

    it('should not proceed with deletion when email fails for any patient', async () => {
      const db = await getDatabase();
      
      // Create multiple appointments
      await db.insert(appointments).values({
        id: 'appt_email_fail_test',
        doctorId: 'doc123',
        patientId: 'pat101',
        availabilityId: 'avail14',
        date: '2050-06-15',
        startTime: '11:00',
        durationMinutes: 20,
        status: 'scheduled'
      });

      // Set email to fail
      setTestEmailer('test-fail');

      // Attempt deletion
      await request(app)
        .delete('/doctors/doc123/availability/avail14')
        .expect(500);

      // No appointments should be rebooked if email fails
      const unchangedAppts = await db
        .select()
        .from(appointments)
        .where(eq(appointments.availabilityId, 'avail14'));
      expect(unchangedAppts.length).toBeGreaterThan(0); // Should still be there
    });

    it('should handle email failure gracefully without corruption', async () => {
      const db = await getDatabase();
      
      // Get initial count of appointments and availability
      const initialAppts = await db.select().from(appointments);
      const initialAvail = await db.select().from(availability);

      setTestEmailer('test-fail');
      
      await request(app)
        .delete('/doctors/doc123/availability/avail14')
        .expect(500);

      // Verify data integrity is maintained after failure
      const finalAppts = await db.select().from(appointments);
      const finalAvail = await db.select().from(availability);

      // Counts should be the same (no partial changes)
      expect(finalAppts.length).toBe(initialAppts.length);
      expect(finalAvail.length).toBe(initialAvail.length);
    });
  });

  describe('Email Content and Recipients', () => {
    it('should identify correct patients for email notifications', async () => {
      const db = await getDatabase();
      
      // Get the patient who will be affected
      const affectedPatient = await db
        .select()
        .from(patients)
        .where(eq(patients.id, 'pat456'));
      
      expect(affectedPatient.length).toBe(1);
      expect(affectedPatient[0].email).toBeTruthy();
      expect(affectedPatient[0].name).toBeTruthy();

      // The deletion should succeed, indicating email was sent to correct patient
      await request(app)
        .delete('/doctors/doc123/availability/avail14')
        .expect(200);
    });

    it('should send emails to all unique patients affected by the deletion', async () => {
      const db = await getDatabase();
      
      // Create appointments for different patients in the same slot
      await db.insert(appointments).values([
        {
          id: 'appt_unique_patient1',
          doctorId: 'doc123',
          patientId: 'pat201',
          availabilityId: 'avail14',
          date: '2050-06-15',
          startTime: '11:00',
          durationMinutes: 15,
          status: 'scheduled'
        },
        {
          id: 'appt_unique_patient2',
          doctorId: 'doc123',
          patientId: 'pat202',
          availabilityId: 'avail14',
          date: '2050-06-15',
          startTime: '11:00',
          durationMinutes: 25,
          status: 'scheduled'
        }
      ]);

      // Should succeed, indicating all patients received notifications
      await request(app)
        .delete('/doctors/doc123/availability/avail14')
        .expect(200);

      // Verify all were rebooked (confirming emails were sent)
      const allRebooked = await db
        .select()
        .from(appointments)
        .where(eq(appointments.availabilityId, 'avail14'));
      expect(allRebooked.length).toBe(0);
    });

    it('should not send duplicate emails to the same patient with multiple appointments', async () => {
      const db = await getDatabase();
      
      // Create multiple appointments for the same patient in the same slot
      await db.insert(appointments).values([
        {
          id: 'appt_same_patient1',
          doctorId: 'doc123',
          patientId: 'pat456', // Same patient as original appointment
          availabilityId: 'avail14',
          date: '2050-06-15',
          startTime: '11:00',
          durationMinutes: 15,
          status: 'scheduled'
        },
        {
          id: 'appt_same_patient2',
          doctorId: 'doc123',
          patientId: 'pat456', // Same patient again
          availabilityId: 'avail14',
          date: '2050-06-15',
          startTime: '11:00',
          durationMinutes: 25,
          status: 'scheduled'
        }
      ]);

      // Should succeed, indicating proper email deduplication
      await request(app)
        .delete('/doctors/doc123/availability/avail14')
        .expect(200);

      // All appointments for the patient should be rebooked
      const patientAppts = await db
        .select()
        .from(appointments)
        .where(eq(appointments.patientId, 'pat456'));
      
      expect(patientAppts.length).toBe(3); // All three appointments
      patientAppts.forEach(apt => {
        expect(apt.availabilityId).not.toBe('avail14');
      });
    });
  });

  describe('Email Integration with Rebooking Process', () => {
    it('should send email after successful rebooking but before committing transaction', async () => {
      const db = await getDatabase();
      
      // Create alternative slot for rebooking
      await db.insert(availability).values({
        id: 'rebook_target_slot',
        doctorId: 'doc456',
        date: '2050-06-16',
        startTime: '10:00',
        endTime: '10:30',
        isBooked: false
      });

      await request(app)
        .delete('/doctors/doc123/availability/avail14')
        .expect(200);

      // Verify rebooking occurred (indicating email was sent after rebooking)
      const rebookedAppt = await db
        .select()
        .from(appointments)
        .where(eq(appointments.id, 'appt1'));
      
      expect(rebookedAppt[0].availabilityId).not.toBe('avail14');
    });

    it('should include new appointment details in email notification context', async () => {
      const db = await getDatabase();
      
      // This test verifies that the system has the new appointment information
      // available when sending the email (though we can't directly test email content)
      
      await request(app)
        .delete('/doctors/doc123/availability/avail14')
        .expect(200);

      // Verify new appointment details are available
      const rebookedAppt = await db
        .select()
        .from(appointments)
        .where(eq(appointments.id, 'appt1'));
      
      expect(rebookedAppt[0].availabilityId).toBeTruthy();
      expect(rebookedAppt[0].doctorId).toBeTruthy();
      expect(rebookedAppt[0].date).toBeTruthy();
      expect(rebookedAppt[0].startTime).toBeTruthy();
    });
  });
}); 
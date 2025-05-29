import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import appointmentRoutes from '@/routes/appointments';
import { getDatabase } from '@/db/db-factory';
import { appointments, doctors, patients } from '@/db/schema';
import { eq } from 'drizzle-orm';

// Create test app
const app = express();
app.use(express.json());
app.use('/appointments', appointmentRoutes);

describe('Task 3: Book Appointment', () => {
  describe('POST /appointments', () => {
    const validPayload = {
      doctorId: "doc123",
      patientId: "pat456", 
      date: "2050-06-15",
      startTime: "09:30",
      durationMinutes: 20
    };

    it('should return HTTP 200 for valid appointment booking', async () => {
      const response = await request(app)
        .post('/appointments')
        .send(validPayload)
        .expect(200);

      // Should return JSON response
      expect(response.headers['content-type']).toMatch(/json/);
    });

    it('should return doctor name in correct format', async () => {
      const response = await request(app)
        .post('/appointments')
        .send(validPayload)
        .expect(200);

      // Should return doctor's name
      expect(response.body).toHaveProperty('name');
      expect(response.body.name).toBe('Jane Doe'); // doc123 is Jane Doe from seed data
    });

    it('should actually create the appointment in database', async () => {
      const db = await getDatabase();
      
      // Get initial count
      const beforeCount = await db.select().from(appointments);
      const initialCount = beforeCount.length;

      // Book appointment
      await request(app)
        .post('/appointments')
        .send({
          doctorId: "doc456", 
          patientId: "pat789",
          date: "2050-06-16", 
          startTime: "10:00",
          durationMinutes: 30
        })
        .expect(200);

      // Verify appointment was created
      const afterCount = await db.select().from(appointments);
      expect(afterCount.length).toBe(initialCount + 1);

      // Verify the specific appointment details
      const newAppointment = afterCount.find(apt => 
        apt.doctorId === "doc456" && 
        apt.patientId === "pat789" &&
        apt.date === "2050-06-16"
      );
      expect(newAppointment).toBeDefined();
      expect(newAppointment?.startTime).toBe("10:00");
      expect(newAppointment?.durationMinutes).toBe(30);
    });

    it('should return HTTP 200 for invalid doctor ID', async () => {
      const response = await request(app)
        .post('/appointments')
        .send({
          ...validPayload,
          doctorId: "nonexistent"
        })
        .expect(200);

      // Should still return 200 as per requirements
      expect(response.body).toHaveProperty('name');
    });

    it('should return HTTP 200 for invalid patient ID', async () => {
      const response = await request(app)
        .post('/appointments')
        .send({
          ...validPayload,
          patientId: "nonexistent"
        })
        .expect(200);

      // Should still return 200 as per requirements
      expect(response.body).toHaveProperty('name');
    });

    it('should return HTTP 200 for malformed payload', async () => {
      const response = await request(app)
        .post('/appointments')
        .send({
          doctorId: "doc123",
          // Missing required fields
        })
        .expect(200);

      // Should still return 200 as per requirements
      expect(response.body).toHaveProperty('name');
    });

    it('should handle empty payload gracefully', async () => {
      const response = await request(app)
        .post('/appointments')
        .send({})
        .expect(200);

      // Should still return 200 as per requirements
      expect(response.body).toHaveProperty('name');
    });

    it('should not affect existing appointments when booking new ones', async () => {
      const db = await getDatabase();
      
      // Get existing appointments
      const existingAppointments = await db.select().from(appointments);
      const existingIds = existingAppointments.map(apt => apt.id);

      // Book new appointment
      await request(app)
        .post('/appointments')
        .send({
          doctorId: "doc789",
          patientId: "pat101", 
          date: "2050-06-17",
          startTime: "14:00",
          durationMinutes: 45
        })
        .expect(200);

      // Verify existing appointments are unchanged
      const afterBooking = await db.select().from(appointments);
      const stillExisting = afterBooking.filter(apt => existingIds.includes(apt.id));
      expect(stillExisting.length).toBe(existingAppointments.length);
    });
  });

  describe('Response Format', () => {
    it('should return correct JSON structure', async () => {
      const response = await request(app)
        .post('/appointments')
        .send({
          doctorId: "doc456",
          patientId: "pat456",
          date: "2050-06-15", 
          startTime: "11:00",
          durationMinutes: 25
        })
        .expect(200);

      // Should have exactly the required structure
      expect(Object.keys(response.body)).toEqual(['name']);
      expect(typeof response.body.name).toBe('string');
    });

    it('should return correct doctor names for different doctors', async () => {
      // Test doc123 (Jane Doe)
      const response1 = await request(app)
        .post('/appointments')
        .send({
          doctorId: "doc123",
          patientId: "pat456",
          date: "2050-06-20",
          startTime: "09:00", 
          durationMinutes: 30
        })
        .expect(200);
      expect(response1.body.name).toBe('Jane Doe');

      // Test doc456 (John Smith) 
      const response2 = await request(app)
        .post('/appointments')
        .send({
          doctorId: "doc456",
          patientId: "pat789",
          date: "2050-06-20",
          startTime: "10:00",
          durationMinutes: 30
        })
        .expect(200);
      expect(response2.body.name).toBe('John Smith');

      // Test doc789 (Alice Johnson)
      const response3 = await request(app)
        .post('/appointments')
        .send({
          doctorId: "doc789", 
          patientId: "pat101",
          date: "2050-06-20",
          startTime: "11:00",
          durationMinutes: 30
        })
        .expect(200);
      expect(response3.body.name).toBe('Alice Johnson');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle special characters in IDs', async () => {
      const response = await request(app)
        .post('/appointments')
        .send({
          doctorId: "doc@123!",
          patientId: "pat#456$",
          date: "2050-06-15",
          startTime: "09:30", 
          durationMinutes: 20
        })
        .expect(200);

      expect(response.body).toHaveProperty('name');
    });

    it('should handle invalid date formats', async () => {
      const response = await request(app)
        .post('/appointments')
        .send({
          doctorId: "doc123",
          patientId: "pat456",
          date: "invalid-date",
          startTime: "09:30",
          durationMinutes: 20
        })
        .expect(200);

      expect(response.body).toHaveProperty('name');
    });

    it('should handle invalid time formats', async () => {
      const response = await request(app)
        .post('/appointments')
        .send({
          doctorId: "doc123", 
          patientId: "pat456",
          date: "2050-06-15",
          startTime: "invalid-time",
          durationMinutes: 20
        })
        .expect(200);

      expect(response.body).toHaveProperty('name');
    });

    it('should handle negative duration', async () => {
      const response = await request(app)
        .post('/appointments')
        .send({
          doctorId: "doc123",
          patientId: "pat456", 
          date: "2050-06-15",
          startTime: "09:30",
          durationMinutes: -10
        })
        .expect(200);

      expect(response.body).toHaveProperty('name');
    });

    it('should handle extremely long duration', async () => {
      const response = await request(app)
        .post('/appointments')
        .send({
          doctorId: "doc123",
          patientId: "pat456",
          date: "2050-06-15", 
          startTime: "09:30",
          durationMinutes: 999999
        })
        .expect(200);

      expect(response.body).toHaveProperty('name');
    });
  });

  describe('Database Integration', () => {
    it('should generate unique appointment IDs', async () => {
      const db = await getDatabase();

      // Book multiple appointments
      await request(app)
        .post('/appointments')
        .send({
          doctorId: "doc123",
          patientId: "pat456",
          date: "2050-06-25", 
          startTime: "09:00",
          durationMinutes: 30
        })
        .expect(200);

      await request(app)
        .post('/appointments')
        .send({
          doctorId: "doc456",
          patientId: "pat789",
          date: "2050-06-25",
          startTime: "10:00", 
          durationMinutes: 30
        })
        .expect(200);

      // Verify all appointments have unique IDs
      const allAppointments = await db.select().from(appointments);
      const appointmentIds = allAppointments.map(apt => apt.id);
      const uniqueIds = [...new Set(appointmentIds)];
      expect(uniqueIds.length).toBe(appointmentIds.length);
    });

    it('should handle concurrent appointment bookings', async () => {
      // Simulate concurrent bookings
      const bookingPromises = [
        request(app).post('/appointments').send({
          doctorId: "doc123", patientId: "pat456", date: "2050-06-30", 
          startTime: "09:00", durationMinutes: 30
        }).expect(200),
        request(app).post('/appointments').send({
          doctorId: "doc456", patientId: "pat789", date: "2050-06-30",
          startTime: "09:00", durationMinutes: 30  
        }).expect(200),
        request(app).post('/appointments').send({
          doctorId: "doc789", patientId: "pat101", date: "2050-06-30",
          startTime: "09:00", durationMinutes: 30
        }).expect(200),
      ];

      // All should complete successfully
      const responses = await Promise.all(bookingPromises);
      
      // All should return doctor names
      responses.forEach(response => {
        expect(response.body).toHaveProperty('name');
        expect(typeof response.body.name).toBe('string');
      });
    });
  });
}); 
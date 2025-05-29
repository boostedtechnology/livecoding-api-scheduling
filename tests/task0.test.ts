import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import doctorRoutes from '@/routes/doctors';
import patientRoutes from '@/routes/patients';
import appointmentRoutes from '@/routes/appointments';

// Create test app
const app = express();
app.use(express.json());
app.use('/doctors', doctorRoutes);
app.use('/patients', patientRoutes);
app.use('/appointments', appointmentRoutes);

describe('Task 0: Basic API Routes', () => {
  describe('GET /doctors', () => {
    it('should return all doctors', async () => {
      const response = await request(app)
        .get('/doctors')
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThan(0);
      
      // Check if response contains expected doctor data
      const firstDoctor = response.body[0];
      expect(firstDoctor).toHaveProperty('id');
      expect(firstDoctor).toHaveProperty('name');
      expect(firstDoctor).toHaveProperty('email');
      expect(firstDoctor).toHaveProperty('specialty');
    });

    it('should return doctor with id doc123', async () => {
      const response = await request(app)
        .get('/doctors')
        .expect(200);

      const janeDoctor = response.body.find((doc: any) => doc.id === 'doc123');
      expect(janeDoctor).toBeDefined();
      expect(janeDoctor.name).toBe('Jane Doe');
      expect(janeDoctor.email).toBe('jane@example.com');
    });
  });

  describe('GET /doctors/:doctorId/availability', () => {
    it('should return availability for a specific doctor', async () => {
      const response = await request(app)
        .get('/doctors/doc123/availability')
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      
      if (response.body.length > 0) {
        const firstAvailability = response.body[0];
        expect(firstAvailability).toHaveProperty('id');
        expect(firstAvailability).toHaveProperty('doctorId');
        expect(firstAvailability).toHaveProperty('date');
        expect(firstAvailability).toHaveProperty('startTime');
        expect(firstAvailability).toHaveProperty('endTime');
        expect(firstAvailability.doctorId).toBe('doc123');
      }
    });

    it('should return empty array for doctor with no availability', async () => {
      const response = await request(app)
        .get('/doctors/nonexistent/availability')
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(0);
    });

    it('should return availability for doc123 on 2050-06-15', async () => {
      const response = await request(app)
        .get('/doctors/doc123/availability')
        .expect(200);

      const june15Availability = response.body.filter((avail: any) => 
        avail.date === '2050-06-15' && avail.doctorId === 'doc123'
      );
      
      expect(june15Availability.length).toBeGreaterThan(0);
    });
  });

  describe('GET /patients', () => {
    it('should return all patients', async () => {
      const response = await request(app)
        .get('/patients')
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThan(0);
      
      // Check if response contains expected patient data
      const firstPatient = response.body[0];
      expect(firstPatient).toHaveProperty('id');
      expect(firstPatient).toHaveProperty('name');
      expect(firstPatient).toHaveProperty('email');
      expect(firstPatient).toHaveProperty('phone');
    });

    it('should return patient with id pat456', async () => {
      const response = await request(app)
        .get('/patients')
        .expect(200);

      const bobPatient = response.body.find((patient: any) => patient.id === 'pat456');
      expect(bobPatient).toBeDefined();
      expect(bobPatient.name).toBe('Bob Wilson');
      expect(bobPatient.email).toBe('bob@example.com');
    });
  });

  describe('GET /appointments', () => {
    it('should return all appointments', async () => {
      const response = await request(app)
        .get('/appointments')
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      
      // Even if no appointments exist initially, it should return an empty array
      if (response.body.length > 0) {
        const firstAppointment = response.body[0];
        expect(firstAppointment).toHaveProperty('id');
        expect(firstAppointment).toHaveProperty('doctorId');
        expect(firstAppointment).toHaveProperty('patientId');
        expect(firstAppointment).toHaveProperty('date');
        expect(firstAppointment).toHaveProperty('startTime');
        expect(firstAppointment).toHaveProperty('durationMinutes');
      }
    });

    it('should return appointments with doctor and patient names', async () => {
      const response = await request(app)
        .get('/appointments')
        .expect(200);

      // Test structure even if no appointments exist
      expect(response.body).toBeInstanceOf(Array);
      
      if (response.body.length > 0) {
        const appointment = response.body[0];
        expect(appointment).toHaveProperty('doctorName');
        expect(appointment).toHaveProperty('patientName');
      }
    });
  });

  describe('API Integration Tests', () => {
    it('should have consistent doctor IDs between /doctors and availability', async () => {
      const doctorsResponse = await request(app).get('/doctors');
      const doctors = doctorsResponse.body;

      for (const doctor of doctors) {
        const availabilityResponse = await request(app)
          .get(`/doctors/${doctor.id}/availability`);
        
        expect(availabilityResponse.status).toBe(200);
        
        // All availability should belong to this doctor
        const availability = availabilityResponse.body;
        availability.forEach((avail: any) => {
          if (avail.doctorId) {
            expect(avail.doctorId).toBe(doctor.id);
          }
        });
      }
    });

    it('should return proper JSON content types', async () => {
      const endpoints = ['/doctors', '/patients', '/appointments'];
      
      for (const endpoint of endpoints) {
        const response = await request(app).get(endpoint);
        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toMatch(/application\/json/);
      }
    });
  });
}); 
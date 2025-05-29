import { Router } from 'express';
import { getDatabase } from '@/db/db-factory';
import { appointments, doctors, patients } from '@/db/schema';
import { eq } from 'drizzle-orm';

const router = Router();

// GET /appointments
router.get('/', async (req, res) => {
  try {
    const db = await getDatabase();
    const allAppointments = await db
      .select({
        id: appointments.id,
        doctorId: appointments.doctorId,
        patientId: appointments.patientId,
        date: appointments.date,
        startTime: appointments.startTime,
        durationMinutes: appointments.durationMinutes,
        status: appointments.status,
        doctorName: doctors.name,
        patientName: patients.name,
      })
      .from(appointments)
      .leftJoin(doctors, eq(appointments.doctorId, doctors.id))
      .leftJoin(patients, eq(appointments.patientId, patients.id));
    
    res.json(allAppointments);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

export default router; 
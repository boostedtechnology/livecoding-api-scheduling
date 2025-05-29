import express from 'express';
import { getDatabase } from '@/db/db-factory';
import doctorRoutes from '@/routes/doctors';
import patientRoutes from '@/routes/patients';
import appointmentRoutes from '@/routes/appointments';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Initialize database
getDatabase();

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Doctor Scheduling API' });
});

app.use('/doctors', doctorRoutes);
app.use('/patients', patientRoutes);
app.use('/appointments', appointmentRoutes);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

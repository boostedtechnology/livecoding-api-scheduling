import { Router } from 'express';
import getDoctors from './get-doctors';
import getDoctorAvailability from './get-doctor-availability';
import deleteDoctorAvailability from './delete-doctor-availability';

const router = Router();

// Combine all doctor routes
router.use(getDoctors);
router.use(getDoctorAvailability);
router.use(deleteDoctorAvailability);

export default router; 
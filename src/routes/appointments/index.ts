import { Router } from 'express';
import getAppointments from './get-appointments';
import postAppointments from './post-appointments';
import deleteAppointment from './delete-appointment';

const router = Router();

// Combine all appointment routes
router.use(getAppointments);
router.use(postAppointments);
router.use(deleteAppointment);

export default router; 
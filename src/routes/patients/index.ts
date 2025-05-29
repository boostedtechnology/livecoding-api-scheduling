import { Router } from 'express';
import getPatients from './get-patients';

const router = Router();

// Combine all patient routes
router.use(getPatients);

export default router; 
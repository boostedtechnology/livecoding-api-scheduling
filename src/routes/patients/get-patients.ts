import { Router } from 'express';
import { getDatabase } from '@/db/db-factory';
import { patients } from '@/db/schema';

const router = Router();

// GET /patients
router.get('/', async (req, res) => {
  const db = await getDatabase();
  const allPatients = await db.select().from(patients);
  res.json(allPatients);
});

export default router; 
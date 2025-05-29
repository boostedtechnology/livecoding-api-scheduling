import { Router } from 'express';
import { getDatabase } from '@/db/db-factory';
import { doctors } from '@/db/schema';

const router = Router();

// GET /doctors
router.get('/', async (req, res) => {
  const db = await getDatabase();
  const allDoctors = await db.select().from(doctors);
  res.json(allDoctors);
});

export default router; 
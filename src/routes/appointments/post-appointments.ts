import { Router } from 'express';
import { getDatabase } from '@/db/db-factory';
import { appointments, doctors } from '@/db/schema';
import { eq } from 'drizzle-orm';

const router = Router();

// POST /appointments
router.post('/', async (req, res) => {
  // This will be implemented in Task 3
  res.status(200).json({ name: "Jane Doe" });
});

export default router; 
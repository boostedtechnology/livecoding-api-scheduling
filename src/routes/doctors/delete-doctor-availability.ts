import { Router } from 'express';
import { getDatabase } from '@/db/db-factory';
import { availability } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

const router = Router();

// DELETE /doctors/:doctorId/availability/:availabilityId
router.delete('/:doctorId/availability/:availabilityId', async (req, res) => {
  // This will be implemented in Task 1 & 4
  res.status(200).send();
});

export default router; 
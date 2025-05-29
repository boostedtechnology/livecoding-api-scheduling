import { Router } from 'express';
import { getDatabase } from '@/db/db-factory';
import { availability } from '@/db/schema';
import { eq } from 'drizzle-orm';

const router = Router();

// GET /doctors/:doctorId/availability
router.get('/:doctorId/availability', async (req, res) => {
  try {
    const { doctorId } = req.params;
    const db = await getDatabase();
    const doctorAvailability = await db
      .select()
      .from(availability)
      .where(eq(availability.doctorId, doctorId));
    
    res.json(doctorAvailability);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch doctor availability' });
  }
});

export default router; 
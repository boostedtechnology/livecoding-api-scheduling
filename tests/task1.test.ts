import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import doctorRoutes from '@/routes/doctors';
import { getDatabase } from '@/db/db-factory';
import { availability } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

// Create test app
const app = express();
app.use(express.json());
app.use('/doctors', doctorRoutes);

describe('Task 1: Delete Doctor Availability', () => {
  describe('DELETE /doctors/:doctorId/availability/:availabilityId', () => {
    it('should return HTTP 200 for valid doctor and availability ID', async () => {
      const response = await request(app)
        .delete('/doctors/doc123/availability/avail1')
        .expect(200);

      // Should have no response body as per requirements
      expect(response.text).toBe('');
    });

    it('should return HTTP 200 for valid doctor but invalid availability ID', async () => {
      const response = await request(app)
        .delete('/doctors/doc123/availability/nonexistent')
        .expect(200);

      // Should still return 200 as per requirements
      expect(response.text).toBe('');
    });

    it('should return HTTP 200 for invalid doctor ID', async () => {
      const response = await request(app)
        .delete('/doctors/nonexistent/availability/avail1')
        .expect(200);

      // Should still return 200 as per requirements
      expect(response.text).toBe('');
    });

    it('should return HTTP 200 for both invalid doctor and availability ID', async () => {
      const response = await request(app)
        .delete('/doctors/nonexistent/availability/nonexistent')
        .expect(200);

      // Should still return 200 as per requirements
      expect(response.text).toBe('');
    });

    it('should actually delete the availability from database when valid IDs are provided', async () => {
      const db = await getDatabase();
      const beforeDelete = await db
        .select()
        .from(availability)
        .where(and(
          eq(availability.doctorId, 'doc123'),
          eq(availability.id, 'avail1')
        ));
      
      expect(beforeDelete.length).toBe(1);
      expect(beforeDelete[0].id).toBe('avail1');

      // Delete the availability
      await request(app)
        .delete('/doctors/doc123/availability/avail1')
        .expect(200);

      // Verify it's deleted from database
      const afterDelete = await db
        .select()
        .from(availability)
        .where(and(
          eq(availability.doctorId, 'doc123'),
          eq(availability.id, 'avail1')
        ));
      
      expect(afterDelete.length).toBe(0);
    });

    it('should not delete availability if doctor ID does not match', async () => {
      const db = await getDatabase();
      
      // Verify availability exists before deletion attempt
      const beforeDelete = await db
        .select()
        .from(availability)
        .where(eq(availability.id, 'avail3'));
      
      expect(beforeDelete.length).toBe(1);
      expect(beforeDelete[0].doctorId).toBe('doc123'); // avail3 belongs to doc123

      // Try to delete using wrong doctor ID
      await request(app)
        .delete('/doctors/doc456/availability/avail3')
        .expect(200);

      // Verify it's NOT deleted (security check)
      const afterDelete = await db
        .select()
        .from(availability)
        .where(eq(availability.id, 'avail3'));
      
      expect(afterDelete.length).toBe(1); // Should still exist
    });

    it('should handle deleting already deleted availability gracefully', async () => {
      const db = await getDatabase();
      
      // First deletion
      await request(app)
        .delete('/doctors/doc456/availability/avail4')
        .expect(200);

      // Verify it's deleted
      const afterFirstDelete = await db
        .select()
        .from(availability)
        .where(eq(availability.id, 'avail4'));
      expect(afterFirstDelete.length).toBe(0);

      // Second deletion attempt should still return 200
      await request(app)
        .delete('/doctors/doc456/availability/avail4')
        .expect(200);
    });

    it('should handle special characters in IDs gracefully', async () => {
      // Test with URL-encoded special characters
      await request(app)
        .delete('/doctors/doc%20123/availability/avail%20@%20test!')
        .expect(200);
    });

    it('should not affect other doctor\'s availability when deleting', async () => {
      const db = await getDatabase();
      
      // Get count of doc456's availability before deletion
      const doc456AvailBefore = await db
        .select()
        .from(availability)
        .where(eq(availability.doctorId, 'doc456'));
      
      const doc456CountBefore = doc456AvailBefore.length;

      // Delete availability for doc123
      await request(app)
        .delete('/doctors/doc123/availability/avail2')
        .expect(200);

      // Verify doc456's availability count is unchanged
      const doc456AvailAfter = await db
        .select()
        .from(availability)
        .where(eq(availability.doctorId, 'doc456'));
      
      expect(doc456AvailAfter.length).toBe(doc456CountBefore);
    });
  });

  describe('Integration with availability listing', () => {
    it('should show deleted availability is no longer in doctor availability list', async () => {
      // Get initial availability count for doc123
      const initialResponse = await request(app)
        .get('/doctors/doc123/availability')
        .expect(200);
      
      const initialCount = initialResponse.body.length;

      // Delete one availability
      await request(app)
        .delete('/doctors/doc123/availability/avail3')
        .expect(200);

      // Verify count decreased by 1
      const afterDeleteResponse = await request(app)
        .get('/doctors/doc123/availability')
        .expect(200);
      
      expect(afterDeleteResponse.body.length).toBe(initialCount - 1);
      
      // Verify the specific availability is not in the list
      const deletedAvailabilityStillExists = afterDeleteResponse.body.find((avail: any) => 
        avail.id === 'avail3'
      );
      expect(deletedAvailabilityStillExists).toBeUndefined();
    });
  });
}); 
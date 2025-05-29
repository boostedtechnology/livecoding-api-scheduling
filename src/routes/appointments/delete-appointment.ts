import { Router } from "express";
import { getDatabase } from "@/db/db-factory";
import { appointments, doctors, patients } from "@/db/schema";
import { eq } from "drizzle-orm";
import { emailer } from "@/utils";

const router = Router();

// DELETE /appointments/:appointmentId
router.delete("/:appointmentId", async (req, res) => {
  // This will be implemented in Task 2, but here is a helpful pseudocode:
  
  /*try {
    const db = await getDatabase();
    await db.transaction(async (tx) => {
      // Delete appointment
      await tx.delete(appointments).where(eq(appointments.id, appointmentId));

      // Send emails - if this throws, transaction auto-rolls back
      await Promise.all(emailPromises);

      // If we reach here, both deletion AND emails succeeded
    });

    console.log("Appointment deleted and emails sent successfully");
  } catch (transactionError) {
    // This catch specifically handles transaction failures
    // The transaction has already been rolled back by PGLite
    // You do not have to do anything to roll back the transaction, 
    // it is done automatically
    console.error("Transaction failed and rolled back:", transactionError);
  }*/

  res.status(200).send();
});

export default router;

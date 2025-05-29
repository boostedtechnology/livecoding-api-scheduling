# Live Coding Test: Doctor Scheduling (TypeScript/Node.js)

> ‼️ **IMPORTANT:** Please read this carefully before starting.
>
> This is a time-sensitive test. Try to complete all tasks. Each task has associated time guideline. Manage your own time.
>
> This test was designed to be self-serve, but if you are stuck, feel free to ask us questions.
>
> You are allowed to use internet search engines during the test, but you must disable the AI code assist.

Implement a scheduling backend for a telemedicine platform that allows doctors to manage availability, patients to book and cancel appointments, and the system to handle operational integrity, utilization tracking, and real-time rescheduling under disruptions.

Relaxed TypeScript typing is fine.

### Prerequisites:
- Node v22+

### Packages used:
- Express.js
- DrizzleORM
- Vitest

## Setup

```bash
npm i
npm run dev # It should serve at http://localhost:3000
            # But, you actually will never need to run it!
            # Read on.
```

## ✅ Task 0: Run the setup

_Time guideline: 5 minutes_

```bash
npm test -- task0
```

See tests succeed. Check the routes and schemas:
- `src/routes`
- `src/db/schema.ts`

Also, fetch the following to see what is available:
- `GET /doctors`
- `GET /doctors/:doctorId/availability`
- `GET /patients`
- `GET /appointments`

## ✅ Task 1: Delete a doctor's availability

_Time guideline: 5 minutes_

Find the `DELETE /doctors/:doctorId/availability/:availabilityId` route in code.

Implement deletion of availability.

Drizzle documentation on delete: https://orm.drizzle.team/docs/delete

For now, return `HTTP 200` in any case! No response body is required.

Check your work:

```bash
npm test -- task1
```

## ✅ Task 2: Delete an appointment

_Time guideline: 10 minutes_

Implement in `DELETE /appointments/:appointmentId` route:

Find the utilities such as `src/utils/emailer`. We need to send (albeit, fake) notifications to both patients and doctors using the `emailer` once an appointment is deleted. 

However, because the email is an external system, handle the case for `emailer` crash. If the appointment is deleted, but the `emailer` crashes, that would put the system into an inconsistent state, wouldn't it?

For now, return `HTTP 200` in any case! No response body required.

Relevant documentation: 
- Drizzle: https://orm.drizzle.team/docs/transactions
- We are using PGLite as the database: https://pglite.dev/docs/api#transaction 

But, most importantly, we left a pesudocode for you at `src/routes/appointments/delete-appointment.ts`

Check your work:

```
npm test -- task2
```

## ✅ Task 3: Book an appointment

_Time guideline: 10 minutes_

So far so good! 

Find the `POST /appointments` route in code and implement the following.

Book an appointment with the following payload:

```json
{
  "doctorId": "doc123",
  "patientId": "pat456",
  "date": "2025-06-15",
  "startTime": "09:30",
  "durationMinutes": 20
}
```

It should return the doctor's name as a response like so:

```json
{
  "name": "Jane Doe"
}
```

Do not worry about payload validation. We trust our frontend, today. 🙂

At this time, always return a `HTTP 200` status regardless of the outcome, even in error!

Drizzle documentation on:
- insert: https://orm.drizzle.team/docs/insert
- join: https://orm.drizzle.team/docs/joins
  - We already implemented a sample join for you in `src/routes/appointments/get-appointments.ts`

Watch out for the edge cases!

Check your work:

```
npm test -- task3
```

## ✅ Task 4: Revisiting deletion of doctor's availability

_Time guideline: 25 minutes_

Find the `DELETE /doctors/:doctorId/availability/:availabilityId` route in code.

Implement proper error codes like so:

```bash
200: if successful
404: if not found
500: if error
```

Still, no response body is required.

However, you must implement the following use-cases:
a. Assign the patient impacted by this deletion to a free doctor
b. If there is no free doctor found in that slot, rebook the patient for **any** doctor's next availability
c. However, when rebooking, prefer the current doctor (who is canceling the appointment) over others if there are more than one slots available
d. Use the `emailer` to send a (albeit, fake) notification to the patient about the change. Remember, being an external system, it may crash.
e. Remember `transactions`? We need to ensure integrity of the system. Provide transactional safety, i.e., all-or-nothing rescheduling.

Check your work:

```
npm test -- task4a    # Test patient rebook at the same slot with a different doctor
npm test -- task4b    # Test patient rebook at a different slot
npm test -- task4c    # Test preference of current doctor
npm test -- task4d    # Test emailer
npm test -- task4e    # Test transactions
```

## Good luck! 🚀🚀

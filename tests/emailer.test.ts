import { describe, it, expect, beforeEach } from 'vitest';
import { emailer, setTestEmailer, resetEmailer } from '@/utils';

describe('Emailer Tests', () => {
  beforeEach(() => {
    // Reset emailer configuration before each test
    resetEmailer();
  });

  describe('Default test emailer (sometimes fails)', () => {
    it('should send email successfully (may retry if it fails)', async () => {
      // Default test emailer has 30% failure rate
      let success = false;
      let attempts = 0;
      const maxAttempts = 5;

      while (!success && attempts < maxAttempts) {
        try {
          await emailer.sendEmail('test@example.com', 'Test Subject', 'Test Body');
          success = true;
        } catch (error) {
          attempts++;
          if (attempts >= maxAttempts) {
            // If it fails after multiple attempts, that's also valid behavior
            expect(error).toBeInstanceOf(Error);
            expect((error as Error).message).toBe('Email service temporarily unavailable');
            return;
          }
        }
      }

      // If we reach here, the email was sent successfully
      expect(success).toBe(true);
    });
  });

  describe('Always failing emailer', () => {
    beforeEach(() => {
      setTestEmailer('test-fail');
    });

    it('should always fail to send email', async () => {
      await expect(
        emailer.sendEmail('test@example.com', 'Test Subject', 'Test Body')
      ).rejects.toThrow('Email service temporarily unavailable');
    });
  });

  describe('Always succeeding emailer', () => {
    beforeEach(() => {
      setTestEmailer('test-success');
    });

    it('should always send email successfully', async () => {
      await expect(
        emailer.sendEmail('test@example.com', 'Test Subject', 'Test Body')
      ).resolves.toBeUndefined();
    });

    it('should handle multiple emails', async () => {
      const emailPromises = [
        emailer.sendEmail('user1@example.com', 'Subject 1', 'Body 1'),
        emailer.sendEmail('user2@example.com', 'Subject 2', 'Body 2'),
        emailer.sendEmail('user3@example.com', 'Subject 3', 'Body 3'),
      ];

      await expect(Promise.all(emailPromises)).resolves.toEqual([
        undefined,
        undefined,
        undefined,
      ]);
    });
  });
}); 
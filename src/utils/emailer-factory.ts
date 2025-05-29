import { emailer } from './emailer';
import { testEmailer, alwaysFailEmailer, alwaysSuccessEmailer } from './test-emailer';

export type EmailerType = 'production' | 'test' | 'test-fail' | 'test-success';

interface Emailer {
  sendEmail: (to: string, subject: string, body: string) => Promise<void>;
}

// Global emailer configuration for tests
let currentEmailerType: EmailerType | null = null;

export function getEmailer(): Emailer {
  // Check if we're in test environment
  const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
  
  if (isTest) {
    // In test environment, use the configured test emailer
    switch (currentEmailerType) {
      case 'test-fail':
        return alwaysFailEmailer;
      case 'test-success':
        return alwaysSuccessEmailer;
      case 'test':
      default:
        return testEmailer; // Default faulty emailer for tests
    }
  } else {
    // Production environment - use reliable emailer
    return emailer;
  }
}

// Test utilities to control emailer behavior
export function setTestEmailer(type: EmailerType) {
  currentEmailerType = type;
}

export function resetEmailer() {
  currentEmailerType = null;
}

// Export the default emailer instance
export const currentEmailer = {
  sendEmail: (to: string, subject: string, body: string) => {
    return getEmailer().sendEmail(to, subject, body);
  }
}; 
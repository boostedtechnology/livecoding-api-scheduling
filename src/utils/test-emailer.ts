export const testEmailer = {
  sendEmail: async (to: string, subject: string, body: string) => {
    // Faulty email service for testing error handling
    console.log(`[TEST] Sending email to ${to}: ${subject}`);
    
    // Simulate potential crash (30% chance for more predictable testing)
    if (Math.random() < 0.3) {
      throw new Error('Email service temporarily unavailable');
    }
    
    // Simulate async operation
    await new Promise(resolve => setTimeout(resolve, 50));
    console.log('[TEST] Email sent successfully');
  }
};

// Force failure emailer for specific test scenarios
export const alwaysFailEmailer = {
  sendEmail: async (to: string, subject: string, body: string) => {
    console.log(`[TEST-FAIL] Attempting to send email to ${to}: ${subject}`);
    await new Promise(resolve => setTimeout(resolve, 10));
    throw new Error('Email service temporarily unavailable');
  }
};

// Always success emailer for tests that shouldn't fail
export const alwaysSuccessEmailer = {
  sendEmail: async (to: string, subject: string, body: string) => {
    console.log(`[TEST-SUCCESS] Sending email to ${to}: ${subject}`);
    await new Promise(resolve => setTimeout(resolve, 10));
    console.log('[TEST-SUCCESS] Email sent successfully');
  }
}; 
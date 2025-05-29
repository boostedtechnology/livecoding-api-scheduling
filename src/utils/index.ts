// Export the emailer factory as the main emailer interface
export { currentEmailer as emailer, setTestEmailer, resetEmailer } from './emailer-factory';
export type { EmailerType } from './emailer-factory'; 
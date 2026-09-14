import { runAutomationTask } from '../automation_worker.js';

console.log("🧪 Running Playwright Automation Test...");

runAutomationTask('Navigate to https://example.com and inspect page', (logData) => {
    console.log(`[LOG]`, logData.log);
}).then((result) => {
    console.log("Result:", result);
    process.exit(0);
}).catch(err => {
    console.error("Test Error:", err);
    process.exit(1);
});

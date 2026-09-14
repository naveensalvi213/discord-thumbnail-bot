import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const userDataDir = path.join(__dirname, 'user_data', 'chrome_profile');

if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
}

console.log("==================================================");
console.log("🌐 Opening Browser in Login Mode...");
console.log("==================================================");
console.log("User Data Directory:", userDataDir);
console.log("Instructions: Log into your Discord or target accounts in the browser window.");
console.log("Once logged in, your session cookies will be saved automatically.");
console.log("You can close the browser window when done.\n");

async function launchLoginSession() {
    const context = await chromium.launchPersistentContext(userDataDir, {
        headless: false,
        viewport: { width: 1280, height: 800 },
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled'
        ]
    });

    const page = await context.newPage();
    await page.goto('https://discord.com/login');

    console.log("👉 Login session active. Close the browser window when you finish logging in.");
}

launchLoginSession().catch(err => {
    console.error("❌ Failed to launch browser:", err.message);
});

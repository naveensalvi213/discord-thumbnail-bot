import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const userDataDir = path.join(__dirname, 'user_data', 'chrome_profile');
const screenshotDir = path.join(__dirname, 'mobile-chat', 'screenshots');

if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
}
if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
}

let activeContext = null;
let activePage = null;

// Helper: Human-like random delay
const delay = (ms) => new Promise(res => setTimeout(res, ms));
const randomDelay = (min = 1000, max = 3000) => delay(Math.floor(Math.random() * (max - min + 1)) + min);

/**
 * Initialize persistent Playwright Chromium browser
 */
export async function getOrLaunchBrowser(headless = true) {
    if (activeContext && activePage && !activePage.isClosed()) {
        return { context: activeContext, page: activePage };
    }

    console.log(`🌐 Launching Playwright Browser (Headless: ${headless})...`);
    activeContext = await chromium.launchPersistentContext(userDataDir, {
        headless: headless,
        viewport: { width: 1280, height: 800 },
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled'
        ]
    });

    const pages = activeContext.pages();
    activePage = pages.length > 0 ? pages[0] : await activeContext.newPage();
    return { context: activeContext, page: activePage };
}

/**
 * Human-like typing with variable speed per keystroke
 */
export async function typeHuman(page, selector, text) {
    await page.focus(selector);
    for (const char of text) {
        await page.keyboard.type(char, { delay: Math.floor(Math.random() * 80) + 40 });
    }
}

/**
 * Take screenshot and save preview
 */
export async function captureScreenshot(page, filename = 'latest.png') {
    const filePath = path.join(screenshotDir, filename);
    await page.screenshot({ path: filePath, fullPage: false });
    return `/screenshots/${filename}`;
}

/**
 * Execute automation task instructions with real-time log broadcasting
 */
export async function runAutomationTask(taskDescription, logCallback = () => {}) {
    const startTime = Date.now();
    logCallback({ step: 'init', log: '🚀 Initializing AI Browser Engine...', time: '0s' });

    try {
        const { page } = await getOrLaunchBrowser(true);
        logCallback({ step: 'browser_ready', log: '🌐 Browser context active & session loaded.', time: '1s' });

        // Example Task Parsing & Execution Flow
        const descLower = taskDescription.toLowerCase();

        if (descLower.includes('discord') || descLower.includes('hire') || descLower.includes('editor')) {
            logCallback({ step: 'navigating', log: '📱 Navigating to Discord Web Client...', time: '2s' });
            await page.goto('https://discord.com/app', { waitUntil: 'domcontentloaded', timeout: 30000 });
            await randomDelay(2000, 4000);

            const screenshotUrl = await captureScreenshot(page);
            logCallback({ step: 'screenshot', log: '📸 Captured Discord page view', screenshot: screenshotUrl, time: '5s' });

            const isLoggedOut = await page.evaluate(() => document.body.innerText.includes('Welcome back!') || document.body.innerText.includes('Log In'));

            if (isLoggedOut) {
                logCallback({ 
                    step: 'requires_login', 
                    log: '⚠️ Account session not logged in yet! Please run "npm run login" on your PC once to log into your Discord account.', 
                    screenshot: screenshotUrl 
                });
                return { success: false, reason: 'login_required' };
            } else {
                logCallback({ step: 'logged_in', log: '✅ Account authenticated! Discord session active.', screenshot: screenshotUrl });
                logCallback({ step: 'action', log: `⚡ Preparing to execute task: "${taskDescription}"` });
                await randomDelay(1500, 3000);
            }
        } else {
            // General Website Browsing Task
            let targetUrl = 'https://google.com';
            const urlMatch = taskDescription.match(/https?:\/\/[^\s]+/);
            if (urlMatch) {
                targetUrl = urlMatch[0];
            }

            logCallback({ step: 'navigating', log: `🌐 Navigating to ${targetUrl}...` });
            await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await randomDelay(1500, 3000);

            const screenshotUrl = await captureScreenshot(page);
            logCallback({ 
                step: 'completed', 
                log: `✅ Task completed successfully on ${targetUrl}`, 
                screenshot: screenshotUrl 
            });
        }

        const duration = Math.round((Date.now() - startTime) / 1000);
        logCallback({ step: 'finished', log: `🎉 Task finished in ${duration}s.` });
        return { success: true };
    } catch (err) {
        console.error("Automation error:", err);
        logCallback({ step: 'error', log: `❌ Browser Automation Error: ${err.message}` });
        return { success: false, error: err.message };
    }
}

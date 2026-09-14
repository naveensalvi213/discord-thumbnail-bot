import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

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
 * Capture base64 screenshot for instant WebSocket streaming preview & Gemini Vision
 */
export async function captureScreenshotBase64(page) {
    try {
        const buffer = await page.screenshot({ type: 'jpeg', quality: 55 });
        fs.writeFileSync(path.join(screenshotDir, 'latest.jpg'), buffer);
        return `data:image/jpeg;base64,${buffer.toString('base64')}`;
    } catch (e) {
        console.error("Screenshot error:", e);
        return null;
    }
}

/**
 * Extract interactive DOM elements summary
 */
async function extractPageElements(page) {
    try {
        return await page.evaluate(() => {
            const elements = [];
            const interactive = document.querySelectorAll('button, a, input, textarea, [role="button"], [contenteditable="true"]');
            
            interactive.forEach((el, index) => {
                const rect = el.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.left >= 0) {
                    const text = el.innerText || el.placeholder || el.value || el.getAttribute('aria-label') || el.name || el.id || 'Element';
                    const tag = el.tagName.toLowerCase();
                    const selector = el.id ? `#${el.id}` : (el.className ? `.${el.className.trim().replace(/\s+/g, '.')}` : tag);
                    elements.push({ id: index + 1, tag, text: text.trim().slice(0, 50), selector });
                }
            });
            return elements.slice(0, 25);
        });
    } catch (e) {
        return [];
    }
}

/**
 * Ask Gemini Vision API for the next browser action with multi-model fallback
 */
async function getNextActionFromGemini(screenshotBase64, pageElements, pageTitle, pageUrl, goalPrompt) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return { action: 'finish', reason: 'Missing GEMINI_API_KEY in .env' };
    }

    const cleanBase64 = screenshotBase64.replace(/^data:image\/(png|jpeg);base64,/, '');

    const promptText = `You are an AI Browser Automation Agent driving a web browser.
User Goal: "${goalPrompt}"
Current Page Title: "${pageTitle}"
Current Page URL: "${pageUrl}"

Interactive Page Elements Available:
${JSON.stringify(pageElements, null, 2)}

Analyze the screenshot and page elements. Determine the single NEXT action to perform towards the goal.
CRITICAL RULE: DO NOT return action: "finish" until the goal is 100% complete and verified on the screenshot. If you need to click buttons, open menus, edit profile settings, or click Save, return action "click" or "type".

Respond strictly in JSON format (no markdown fences, just pure JSON):
{
  "action": "click" | "type" | "press_enter" | "scroll" | "navigate" | "finish",
  "selector": "CSS selector or exact element text to click",
  "text": "text to type if action is type or target url if navigate",
  "reason": "short explanation of why this step is taken"
}`;

    const candidateModels = ['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-pro-latest'];

    for (const model of candidateModels) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const body = {
            contents: [{
                parts: [
                    { inline_data: { mime_type: "image/jpeg", data: cleanBase64 } },
                    { text: promptText }
                ]
            }]
        };

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (res.status === 429 || res.status === 503) {
                console.warn(`⚠️ Vision API ${model} HTTP ${res.status}. Fallback to next model...`);
                await delay(1000);
                continue;
            }

            if (!res.ok) {
                console.error(`Gemini Vision API ${model} error: ${res.status}`);
                continue;
            }

            const data = await res.json();
            const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        } catch (err) {
            console.error("Gemini decision error:", err);
        }
    }

    return { action: 'finish', reason: 'Max reasoning attempts reached' };
}

/**
 * Execute full multi-step AI browser automation task
 */
export async function runAutomationTask(taskDescription, logCallback = () => {}) {
    const startTime = Date.now();
    logCallback({ step: 'init', log: '🚀 Initializing Playwright Browser Engine...' });

    try {
        const { page } = await getOrLaunchBrowser(true);
        logCallback({ step: 'browser_ready', log: '🌐 Chrome Persistent Profile active & ready.' });

        // Step 1: Initial Navigation
        let targetUrl = 'https://google.com';
        const urlMatch = taskDescription.match(/https?:\/\/[^\s]+/);
        const descLower = taskDescription.toLowerCase();

        if (urlMatch) {
            targetUrl = urlMatch[0];
        } else if (descLower.includes('discord')) {
            targetUrl = 'https://discord.com/app';
        }

        logCallback({ step: 'navigating', log: `🌐 Navigating to ${targetUrl}...` });
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
        await randomDelay(2000, 3500);

        let screenshot = await captureScreenshotBase64(page);
        logCallback({ step: 'page_loaded', log: `📄 Loaded ${page.url()}`, screenshot });

        // Step 2: Multi-step AI Action Execution Loop (Up to 25 steps for complete tasks!)
        const maxSteps = 25;
        for (let step = 1; step <= maxSteps; step++) {
            const pageTitle = await page.title();
            const currentUrl = page.url();
            const elements = await extractPageElements(page);

            logCallback({ step: `ai_reasoning_${step}`, log: `🤖 [Step ${step}/${maxSteps}] Gemini analyzing page state...` });

            const decision = await getNextActionFromGemini(screenshot, elements, pageTitle, currentUrl, taskDescription);
            console.log(`Step ${step} Decision:`, decision);

            if (decision.action === 'finish' || !decision.action) {
                logCallback({ step: 'completed', log: `✅ Goal achieved: ${decision.reason || 'Task finished.'}`, screenshot });
                break;
            }

            logCallback({ step: `action_${step}`, log: `⚡ Action (${decision.action}): ${decision.reason || decision.selector}` });

            // Execute Decision with multi-strategy click fallbacks
            try {
                if (decision.action === 'navigate' && decision.text) {
                    await page.goto(decision.text, { waitUntil: 'domcontentloaded' });
                } else if (decision.action === 'click') {
                    const target = decision.selector || decision.text;
                    if (target) {
                        let clicked = await page.click(target, { timeout: 3000 }).then(() => true).catch(() => false);
                        if (!clicked) {
                            clicked = await page.click(`text="${target}"`, { timeout: 3000 }).then(() => true).catch(() => false);
                        }
                        if (!clicked) {
                            clicked = await page.click(`text=${target}`, { timeout: 3000 }).then(() => true).catch(() => false);
                        }
                        if (!clicked) {
                            // Fallback: evaluate document click by text content
                            await page.evaluate((textToClick) => {
                                const elements = Array.from(document.querySelectorAll('button, a, div, span, li'));
                                const match = elements.find(e => e.innerText && e.innerText.trim().toLowerCase().includes(textToClick.toLowerCase()));
                                if (match) match.click();
                            }, target).catch(() => {});
                        }
                    }
                } else if (decision.action === 'type' && decision.text) {
                    if (decision.selector) {
                        await page.focus(decision.selector).catch(() => {});
                        await page.keyboard.type(decision.text, { delay: 60 });
                    } else {
                        await page.keyboard.type(decision.text, { delay: 60 });
                    }
                } else if (decision.action === 'press_enter') {
                    await page.keyboard.press('Enter');
                } else if (decision.action === 'scroll') {
                    await page.evaluate(() => window.scrollBy(0, 400));
                }
            } catch (execErr) {
                console.warn(`Execution action warning step ${step}:`, execErr.message);
            }

            await randomDelay(2000, 3000);
            screenshot = await captureScreenshotBase64(page);
            logCallback({ step: `step_result_${step}`, log: `📸 Captured page state after step ${step}`, screenshot });
        }

        const duration = Math.round((Date.now() - startTime) / 1000);
        logCallback({ step: 'finished', log: `🎉 Task process complete in ${duration}s.`, screenshot });
        return { success: true };
    } catch (err) {
        console.error("Automation error:", err);
        logCallback({ step: 'error', log: `❌ Browser Automation Error: ${err.message}` });
        return { success: false, error: err.message };
    }
}

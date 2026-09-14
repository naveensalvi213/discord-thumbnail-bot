import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { runAutomationTask } from './automation_worker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const PUBLIC_DIR = path.join(__dirname, 'mobile-chat');

// Helper to get local network IP address
function getLocalIpAddress() {
    const interfaces = os.networkInterfaces();
    for (const devName in interfaces) {
        const iface = interfaces[devName];
        for (let i = 0; i < iface.length; i++) {
            const alias = iface[i];
            if (alias.family === 'IPv4' && !alias.internal) {
                return alias.address;
            }
        }
    }
    return '127.0.0.1';
}

const server = http.createServer((req, res) => {
    // Enable CORS for API requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // API Endpoint: Serve server configuration securely
    if (req.method === 'GET' && req.url === '/api/config') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            apiKey: process.env.GEMINI_API_KEY || ''
        }));
        return;
    }

    // API Endpoint: Trigger Browser Automation Task
    if (req.method === 'POST' && req.url === '/api/automation/run') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body || '{}');
                const taskText = data.task || 'Default automation task';
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'queued', message: 'Task queued for execution' }));

                // Run task in background and stream via WebSocket
                runAutomationTask(taskText, (logPayload) => {
                    broadcastWS(logPayload);
                });
            } catch (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
        return;
    }

    // Static File Serving
    let filePath = path.join(PUBLIC_DIR, req.url === '/' ? 'index.html' : req.url);
    
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(PUBLIC_DIR, 'index.html');
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpg',
        '.svg': 'image/svg+xml',
    };

    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 Not Found</h1>', 'utf-8');
            } else {
                res.writeHead(500);
                res.end('Server Error: ' + error.code, 'utf-8');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

// Setup WebSocket Server for Live Real-Time Logs Streaming
const wss = new WebSocketServer({ server });
const connectedClients = new Set();

wss.on('connection', (ws) => {
    connectedClients.add(ws);
    ws.send(JSON.stringify({ type: 'connected', log: 'Connected to Antigravity WebSocket Server' }));

    ws.on('message', (msg) => {
        try {
            const data = JSON.parse(msg.toString());
            if (data.type === 'run_task') {
                runAutomationTask(data.task, (logPayload) => {
                    broadcastWS(logPayload);
                });
            }
        } catch (err) {
            console.error('WS Error:', err);
        }
    });

    ws.on('close', () => connectedClients.delete(ws));
});

function broadcastWS(data) {
    const payload = JSON.stringify({ type: 'automation_log', data });
    for (const client of connectedClients) {
        if (client.readyState === 1) {
            client.send(payload);
        }
    }
}

server.listen(PORT, '0.0.0.0', () => {
    const localIp = getLocalIpAddress();
    console.log(`\n==================================================`);
    console.log(`🚀 Antigravity Mobile Chat & Automation Engine Running!`);
    console.log(`==================================================`);
    console.log(`💻 Localhost (PC):      http://localhost:${PORT}`);
    console.log(`📱 Mobile (Same Wi-Fi): http://${localIp}:${PORT}`);
    console.log(`⚡ WebSocket Bridge:    ws://localhost:${PORT}`);
    console.log(`==================================================\n`);
});

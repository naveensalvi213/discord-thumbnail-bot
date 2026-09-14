import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error("❌ GEMINI_API_KEY is missing from .env");
    process.exit(1);
}

console.log("🔑 Testing Gemini API Key...");

async function testGemini() {
    const candidateModels = [
        'gemini-flash-latest',
        'gemini-pro-latest',
        'gemini-flash-lite-latest'
    ];

    for (const model of candidateModels) {
        console.log(`\n🧪 Testing model: ${model}...`);
        const genUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        
        // Test without system_instruction first
        try {
            const genRes = await fetch(genUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: "Respond in 3 words: 'Gemini is working'" }] }]
                })
            });
            const genData = await genRes.json();
            console.log(`Status ${genRes.status}:`, JSON.stringify(genData).slice(0, 300));
        } catch (err) {
            console.log(`❌ ${model} error:`, err.message);
        }
    }
}

testGemini();




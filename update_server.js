import fs from 'fs';

const code = fs.readFileSync('server.ts', 'utf-8');

const newEndpoint = `
  app.post("/api/gemini", async (req, res) => {
    const { prompt } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        res.status(400).json({ error: "Missing API Key" });
        return;
    }

    try {
        const ai = new GoogleGenAI({ 
            apiKey: apiKey,
            httpOptions: {
                headers: { 'User-Agent': 'aistudio-build' }
            }
        });
        
        const response = await ai.models.generateContent({
            model: "gemini-3.1-pro",
            contents: prompt + "\\n\\nProszę, użyj języka polskiego (Polish).",
        });

        res.json({ result: response.text });
    } catch (error: any) {
        console.error("AI analysis failed:", error);
        res.status(500).json({ error: "AI analysis failed", message: error.message });
    }
  });
`;

const updatedCode = code.replace(
  '// Proxy endpoint for Riot API',
  newEndpoint + '\\n  // Proxy endpoint for Riot API'
);

fs.writeFileSync('server.ts', updatedCode);
console.log("Updated server.ts with /api/gemini");

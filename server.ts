import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // AI Summary endpoint
  app.post("/api/ai-summary", async (req, res) => {
    const { matchData, language, customApiKey } = req.body;
    
    const apiKey = (customApiKey && customApiKey.trim() !== "") ? customApiKey : process.env.GEMINI_API_KEY;
    
    console.log("Using custom key?", !!(customApiKey && customApiKey.trim() !== ""));
    console.log("API Key prefix:", apiKey ? apiKey.substring(0, 5) : "none");

    if (!apiKey) {
        res.status(400).json({ 
            error: "API Key missing", 
            message: "No Gemini API key provided. Please set GEMINI_API_KEY environment variable or provide a custom key." 
        });
        return;
    }

    try {
        const ai = new GoogleGenAI({ 
            apiKey: apiKey,
            httpOptions: {
                headers: {
                    'User-Agent': 'aistudio-build',
                }
            }
        });
        
        const ourChampion = matchData?.ourChampion || "Cho'Gath";
        const prompt = `Analyze this League of Legends match data and evaluate the power curve of each champion in early, mid, and late game phases on a scale of 0 to 100. Also estimate the exact or approximate base cooldown of their Ultimate (R) ability in seconds at ranks 1, 2, 3 (levels 6, 11, 16) as a string formatted like "120/100/80".

You are an expert League of Legends coach. Write your analysis strictly from the perspective of the player playing ${ourChampion}, advising them on how to play their role, deal with matchups, and win.

Provide a comprehensive tactical analysis strictly in ${language === 'PL' ? 'Polish (Polski)' : 'English'}.
Your analysis must detail:
1. EARLY GAME: Lane strategy with ${ourChampion} and overall early macro.
2. MID GAME: Mid-game transition, objective focus, and side-lane / macro control with ${ourChampion}.
3. LATE GAME: Late-game scaling, teamfighting, or split-pushing with ${ourChampion}.
4. TEAM COMPOSITION & TEAMFIGHTS: Deep dive into the allied and enemy team compositions, explaining why they are structured this way, what their win/loss dynamics are, and how they interact in teamfights.
5. OPTIMAL WINNING PLAN: The absolute best, most optimal step-by-step strategy/plan to secure a win.

Return your response strictly in the following JSON structure:
{
  "earlyGame": "Detailed tactical advice for early game in ${language === 'PL' ? 'Polish' : 'English'}...",
  "midGame": "Detailed tactical advice for mid game in ${language === 'PL' ? 'Polish' : 'English'}...",
  "lateGame": "Detailed tactical advice for late game in ${language === 'PL' ? 'Polish' : 'English'}...",
  "teamComp": "Deep analysis of the team compositions in ${language === 'PL' ? 'Polish' : 'English'}...",
  "optimalPlan": "Step-by-step optimal winning plan in ${language === 'PL' ? 'Polish' : 'English'}...",
  "powerCurves": {
    "championname": {
      "early": <number 0-100>,
      "mid": <number 0-100>,
      "late": <number 0-100>,
      "rCooldown": "cooldown in seconds at level 6/11/16, e.g. '120/100/80'",
      "earlyTip": "Brief early-game matchup advice from the perspective of ${ourChampion} in ${language === 'PL' ? 'Polish' : 'English'}...",
      "lateTip": "Brief late-game matchup/teamfight advice from the perspective of ${ourChampion} in ${language === 'PL' ? 'Polish' : 'English'}...",
      "killable": "Yes or No",
      "killableReason": "Brief reason why they are/aren't killable by ${ourChampion} in ${language === 'PL' ? 'Polish' : 'English'}..."
    }
  }
}

Use lowercase, alphanumeric-only champion names as keys in the powerCurves map (e.g. "garen", "leesin", "missfortune", "jarvaniv"). Evaluate all 10 participants in the game.
Data: ${JSON.stringify(matchData)}`;
        
        const response = await ai.models.generateContent({
          model: "gemini-3.1-flash-lite",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
          }
        });

        const resultText = response.text;
        if (!resultText) {
          throw new Error("No response text received from Gemini");
        }

        const data = JSON.parse(resultText);
        res.json(data);
    } catch (error: any) {
        console.error("AI generation failed:", error);
        res.status(500).json({ 
            error: "AI generation failed", 
            message: error?.message || String(error) 
        });
    }
  });

  // Proxy endpoint for Riot API to handle CORS
  app.post("/api/riot", async (req, res) => {
    const { url } = req.body;
    const apiKey = req.headers["x-riot-token"] as string;

    if (!url || !apiKey) {
      res.status(400).json({ error: "Missing url or API key" });
      return;
    }

    try {
      const parsedUrl = new URL(url);
      const allowedHosts = [
        "europe.api.riotgames.com",
        "americas.api.riotgames.com",
        "asia.api.riotgames.com",
        "sea.api.riotgames.com",
      ];
      
      if (!parsedUrl.host.endsWith(".api.riotgames.com")) {
        res.status(403).json({ error: "Invalid Riot API host" });
        return;
      }

      const response = await fetch(url, {
        headers: {
          "X-Riot-Token": apiKey,
        },
      });

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        res.status(response.status).json(data);
      } else {
        const text = await response.text();
        res.status(response.status).json({ error: "Non-JSON response from Riot", details: text });
      }
    } catch (error: any) {
      console.error("Proxy error:", error);
      res.status(500).json({ error: "Server proxy error", details: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

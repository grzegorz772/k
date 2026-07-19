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
        const selectedRole = matchData?.selectedRole || "Środek (Mid)";
        const selectedOpponent = matchData?.selectedOpponent || "Przeciwnik";

        const prompt = `Analyze this League of Legends match data and evaluate the power curve of each champion in early, mid, and late game phases on a scale of 0 to 100. Also estimate the exact or approximate base cooldown of their Ultimate (R) ability in seconds at ranks 1, 2, 3 (levels 6, 11, 16) as a string formatted like "120/100/80".

Jesteś elitarnym analitykiem i trenerem League of Legends. Przygotowujesz gracza grającego jako **${ourChampion}** na pozycji/roli **${selectedRole}** do nadchodzącego meczu przeciwko **${selectedOpponent}**.

Provide a comprehensive tactical analysis strictly in ${language === 'PL' ? 'Polish (Polski)' : 'English'}.
Address the player directly using personal pronouns ("Ty", "Twój", "Twoim zadaniem", "Musisz"). Make the tone highly professional, objective, coaching, engaging, and direct. Base your analysis on the "Best Case vs Worst Case scenario" methodology and temporal windows (okienka czasowe).

Your analysis must detail:
1. EARLY GAME (Analiza Linii i Okienek Czasowych): Lane strategy with ${ourChampion} against **${selectedOpponent}** in ${selectedRole}. Kiedy masz "okienka" na trade/push/roam? Jak zarządzać falami i timingiem powrotów (recall) na tej linii?
2. MID GAME (Tempo i Obiektywy): Mid-game transition, objective focus. Jak planować wyjścia z bazy na 30-60s przed obiektywem? Jak unikać "pustych przebiegów" w zdobywaniu zasobów (Gold/XP)?
3. LATE GAME (Najlepszy vs Najgorszy Scenariusz): Zdefiniuj jasno: Co jest Twoim "Najlepszym Scenariuszem" w walkach (Idealna realizacja roli z uwzględnieniem umiejętności przeciwników)? Co jest "Najgorszym Scenariuszem" i jak go uniknąć?
4. TEAM COMPOSITION & TEAMFIGHTS: Deep dive into the allied and enemy team compositions. Jak Wasz team współdziała z Twoim Najlepszym Scenariuszem? Kto ze strony wroga jest największym zagrożeniem?
5. OPTIMAL WINNING PLAN: Syntetyczne podsumowanie w formie checklisty - 3 najważniejsze zadania makro/mikro do zrealizowania, aby wygrać ten mecz.

Return your response strictly in the following JSON structure:
{
  "earlyGame": "Detailed tactical advice for early game against ${selectedOpponent} in ${language === 'PL' ? 'Polish' : 'English'}...",
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

  
  app.post("/api/gemini", async (req, res) => {
    const { prompt, customApiKey } = req.body;
    const apiKey = (customApiKey && customApiKey.trim() !== "") ? customApiKey : process.env.GEMINI_API_KEY;

    if (!apiKey) {
        res.status(400).json({ error: "Missing API Key", message: "No Gemini API key provided. Please set GEMINI_API_KEY environment variable or provide a custom key." });
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
            contents: prompt + "\n\nProszę, użyj języka polskiego (Polish).",
        });

        res.json({ result: response.text });
    } catch (error: any) {
        console.error("AI analysis failed:", error);
        res.status(500).json({ error: "AI analysis failed", message: error.message });
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

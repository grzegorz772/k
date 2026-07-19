import React, { useState, useMemo, useEffect } from "react";
import { Check, Copy, Download, Loader2, Search, Swords, Code } from "lucide-react";
import { fetchAccount, fetchMatchIds, fetchMatchDetails, fetchMatchTimeline, fetchDDragonData, fetchCurrentMatch, fetchRunesData } from "./lib/riot-api";
import { processMatchForAI, processLiveMatchForAI } from "./lib/timeline-processor";
import ReplayViewer from "./components/ReplayViewer";
import PreMatchPlan from "./components/PreMatchPlan";

export default function App() {
  const [apiKey, setApiKey] = useState("");
  const [geminiApiKey, setGeminiApiKey] = useState(() => {
    return localStorage.getItem("gemini_api_key") || "";
  });
  const [gameName, setGameName] = useState("Aethos");
  const [tagLine, setTagLine] = useState("ghfhg");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    localStorage.setItem("gemini_api_key", geminiApiKey);
  }, [geminiApiKey]);
  const [error, setError] = useState<string | null>(null);

  const [matches, setMatches] = useState<string[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<string | null>(null);
  const [finalJson, setFinalJson] = useState<any | null>(null);

  // Raw data for ReplayViewer
  const [rawMatchDetails, setRawMatchDetails] = useState<any>(null);
  const [rawMatchTimeline, setRawMatchTimeline] = useState<any>(null);
  const [rawDDragon, setRawDDragon] = useState<any>(null);

  const [copied, setCopied] = useState(false);
  const [currentAccount, setCurrentAccount] = useState<{ puuid: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"history" | "live" | "replay">("history");
  const [includePrompt, setIncludePrompt] = useState(true);
  const [includeLivePrompt, setIncludeLivePrompt] = useState(true);
  const [matchSubTab, setMatchSubTab] = useState<"plan" | "json">("plan");

  const handleFetchMatches = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey || !gameName || !tagLine) return;

    setLoading(true);
    setError(null);
    setMatches([]);
    setFinalJson(null);
    setSelectedMatch(null);
    setRawMatchDetails(null);
    setRawMatchTimeline(null);

    try {
      const account = await fetchAccount(gameName, tagLine.replace("#", ""), apiKey);
      setCurrentAccount(account);
      const matchIds = await fetchMatchIds(account.puuid, apiKey);
      setMatches(matchIds);
      setActiveTab("history");
    } catch (err: any) {
      setError(err.message || "Błąd pobierania danych");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectMatch = async (matchId: string) => {
    if (!currentAccount || !apiKey) return;
    setSelectedMatch(matchId);
    setLoading(true);
    setError(null);
    setFinalJson(null);
    setRawMatchDetails(null);
    setRawMatchTimeline(null);

    try {
      const [matchDetail, matchTimeline, dDragon] = await Promise.all([
        fetchMatchDetails(matchId, apiKey),
        fetchMatchTimeline(matchId, apiKey),
        fetchDDragonData()
      ]);

      setRawMatchDetails(matchDetail);
      setRawMatchTimeline(matchTimeline);
      setRawDDragon(dDragon);

      const processed = processMatchForAI(
        matchDetail,
        matchTimeline,
        currentAccount.puuid,
        dDragon.championMap,
        dDragon.itemMap
      );

      setFinalJson(processed);
      setMatchSubTab("plan");
      // Default to history tab if they were on live or replay
      if (activeTab === "live") setActiveTab("history");
    } catch (err: any) {
      setError(err.message || "Błąd pobierania danych meczu");
    } finally {
      setLoading(false);
    }
  };

  const handleFetchLiveMatch = async () => {
    if (!apiKey || !gameName || !tagLine) return;
    setLoading(true);
    setError(null);
    setFinalJson(null);
    setActiveTab("live");

    try {
      const account = await fetchAccount(gameName, tagLine.replace("#", ""), apiKey);
      setCurrentAccount(account);
      const [liveData, dDragon, runes] = await Promise.all([
        fetchCurrentMatch(account.puuid, tagLine, apiKey),
        fetchDDragonData(),
        fetchRunesData()
      ]);
      
      const processed = processLiveMatchForAI(liveData, account.puuid, dDragon.championMap, runes);
      setFinalJson(processed);
      setMatchSubTab("plan");
    } catch (err: any) {
      setError(err.message === "Riot API Error" ? "Gracz nie jest obecnie w meczu lub klucz API wygasł." : err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (finalJson) {
      navigator.clipboard.writeText(getExportContent());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const historyParticipants = useMemo(() => {
    if (!rawMatchDetails) return [];
    return rawMatchDetails.info.participants.map((p: any) => {
      const isPlayer = p.puuid === currentAccount?.puuid;
      const primaryRune = p.perks?.styles?.[0]?.selections?.[0]?.perk ? `Rune_${p.perks.styles[0].selections[0].perk}` : "Rune";
      return {
        name: p.riotIdGameName ? `${p.riotIdGameName}#${p.riotIdTagline}` : p.summonerName || p.championName,
        champion: p.championName,
        team: p.teamId === 100 ? ("Blue" as const) : ("Red" as const),
        is_player: isPlayer,
        runy: {
          glowne: primaryRune,
          sciezka: "Primary"
        }
      };
    });
  }, [rawMatchDetails, currentAccount]);

  const getExportContent = () => {
    if (!finalJson) return "";
    const jsonStr = JSON.stringify(finalJson, null, 2);
    
    if (activeTab === "live") {
      if (!includeLivePrompt) return jsonStr;
      return `Analizuj poniższe zestawienie meczu na żywo w League of Legends. 
Twoim zadaniem jest przeprowadzić głęboką analizę bocznego zestawienia (MATCHUP) skupiając się WYŁĄCZNIE na bohaterach z DRUŻYNY PRZECIWNEJ (Enemy Team).

Dla każdego bohatera przeciwnika przygotuj wyczerpujący opis w następującym formacie:
- BOHATER: [Nazwa]
- ZESTAW UMIEJĘTNOŚCI:
  * P (Pasywna): dokładny opis i na co uważać.
  * Q, W, E, R: opis działania każdej umiejętności i ich interakcji.
- ANALIZA FAZ GRY (Power Spikes):
  * EARLY GAME: Opisz siłę na poziomach 1-6. Czy ma silny lvl 1? Kiedy szuka trade'ów? Czy jest podatny na ganki?
  * MID GAME: Jak radzi sobie w walkach o smoki/herolda? Kiedy osiąga swój główny power-spike przedmiotowy?
  * LATE GAME: Czy skaluje się w potwora, czy traci na znaczeniu? Jaką rolę pełni w pełnych walkach 5v5?
- JAK KONTROWAĆ:
  * Strategia walki: jakich skilli unikać, kiedy go atakować (window of opportunity).
  * Przedmioty: co kupić, aby ograniczyć jego skuteczność (np. Anti-heal, Armor, MR).

Na koniec podsumuj ogólną strategię zwycięstwa dla gracza (grającego jako ${finalJson?.nasz_bohater || 'postać gracza'}) - wskaż, kogo musi unikać, kogo może focusować i jakie jest jego główne zadanie w tym meczu.
Odpowiadaj w języku polskim.

MECZ DATA:
${jsonStr}`;
    }

    if (!includePrompt) return jsonStr;

    const prompt = `Analizuj poniższy zapis meczu League of Legends (format JSON). 
Jesteś analitykiem e-sportowym wysokiej klasy. 
Twoim zadaniem jest znalezienie i szczegółowe wypunktowanie jak największej liczby błędów popełnionych przez gracza podczas tego meczu. 

Zamiast robić chronologiczny log minuta po minucie, skup się na identyfikacji i analizie konkretnych pomyłek w następujących kategoriach:
1. POZYCJONOWANIE I MAPA: Złe strefy, narażanie się na śmierć, brak obecności przy kluczowych celach (Smok, Baron), błędy w rotacji.
2. ROZWÓJ I ZASOBY: Nieoptymalne zakupy przedmiotów, marnowanie złota, zbyt niski poziom lub farma (CS) w stosunku do czasu gry.
3. WALKA I SKUTECZNOŚĆ: Złe decyzje o wejściu w walkę, brak wsparcia drużyny, nieefektywne zadawanie obrażeń, błędy w używaniu umiejętności.
4. WIZJA I KONTROLA: Słabe zarządzanie wardami, ignorowanie zagrożeń widocznych na mapie.

Dla każdego zidentyfikowanego błędu:
- Podaj czas lub fazę gry, w której wystąpił.
- Wyjaśnij merytorycznie, dlaczego było to błędem.
- Wskaż, jak w tej konkretnej sytuacji zachowałby się gracz z poziomu Challenger/Pro.

Bądź bardzo surowy, szukaj nawet drobnych uchybień i braku optymalizacji. Na koniec podsumuj 3 najważniejsze obszary, nad którymi gracz musi popracować.
Odpowiadaj w języku polskim.

MECZ DATA:
`;
    return prompt + jsonStr;
  };

  const downloadJson = () => {
    const content = getExportContent();
    if (content) {
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = activeTab === "live" ? `live_match_${gameName}.txt` : `match_${selectedMatch || "history"}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="bg-[#0b0c10] text-[#c5c6c7] font-sans h-screen w-full flex flex-col overflow-hidden">
      {/* Header Section */}
      <header className="h-14 border-b border-[#1f2833] flex items-center justify-between px-6 bg-[#0b0c10] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-[#66fcf1] rounded-full shadow-[0_0_8px_#66fcf1]"></div>
          <h1 className="text-sm font-bold tracking-widest uppercase text-[#66fcf1]">
            Riot Match Analyzer <span className="text-[#45a29e] opacity-50 px-2">v1.4.1</span>
          </h1>
        </div>
        <div className="flex gap-2">
            <button 
              onClick={() => setActiveTab("history")}
              className={`text-[10px] px-3 py-1 rounded border transition-colors font-bold ${activeTab === "history" ? "bg-[#66fcf1] text-[#0b0c10] border-[#66fcf1]" : "text-[#45a29e] border-[#1f2833] hover:border-[#45a29e]"}`}
            >
              START
            </button>
            <button 
              onClick={() => setActiveTab("live")}
              className={`text-[10px] px-3 py-1 rounded border transition-colors font-bold ${activeTab === "live" ? "bg-[#66fcf1] text-[#0b0c10] border-[#66fcf1]" : "text-[#45a29e] border-[#1f2833] hover:border-[#45a29e]"}`}
            >
              LIVE GAME START
            </button>
            <button 
              onClick={() => setActiveTab("replay")}
              disabled={!rawMatchDetails}
              className={`text-[10px] px-3 py-1 rounded border transition-colors font-bold ${activeTab === "replay" ? "bg-[#66fcf1] text-[#0b0c10] border-[#66fcf1]" : "text-[#45a29e] border-[#1f2833] hover:border-[#45a29e] disabled:opacity-30 disabled:cursor-not-allowed"}`}
            >
              ANALYZE MATCH
            </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden p-4 gap-4 flex-col md:flex-row">
        {/* Left Panel: Configuration & Match History */}
        <aside className={`w-full md:w-64 flex-col gap-4 shrink-0 overflow-y-auto ${(finalJson || activeTab === "replay") ? 'hidden md:flex' : 'flex'}`}>
          {/* Config Form */}
          <form onSubmit={handleFetchMatches} className="bg-[#1f2833]/50 border border-[#45a29e]/20 p-4 rounded-lg shrink-0">
            <h2 className="text-[11px] font-bold text-[#66fcf1] mb-3 uppercase tracking-wider">Identity Config</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-[9px] text-[#45a29e] mb-1 uppercase">Riot API Key</label>
                <input 
                  type="password" 
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  required
                  placeholder="RGAPI-..." 
                  className="w-full bg-[#0b0c10] border border-[#1f2833] text-[11px] p-2 rounded focus:border-[#66fcf1] outline-none" 
                />
              </div>
              <div>
                <label className="block text-[9px] text-[#45a29e] mb-1 uppercase">Gemini API Key (Zapisywany)</label>
                <input 
                  type="password" 
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  placeholder="AIzaSy..." 
                  className="w-full bg-[#0b0c10] border border-[#1f2833] text-[11px] p-2 rounded focus:border-[#66fcf1] outline-none" 
                />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-[9px] text-[#45a29e] mb-1 uppercase">Summoner Name</label>
                  <input 
                    type="text" 
                    value={gameName}
                    onChange={(e) => setGameName(e.target.value)}
                    required
                    placeholder="TheShy" 
                    className="w-full bg-[#0b0c10] border border-[#1f2833] text-[11px] p-2 rounded focus:border-[#66fcf1] outline-none" 
                  />
                </div>
                <div className="w-16">
                  <label className="block text-[9px] text-[#45a29e] mb-1 uppercase">Tag</label>
                  <input 
                    type="text" 
                    value={tagLine}
                    onChange={(e) => setTagLine(e.target.value)}
                    required
                    placeholder="EUNE" 
                    className="w-full bg-[#0b0c10] border border-[#1f2833] text-[11px] p-2 rounded focus:border-[#66fcf1] outline-none" 
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <button 
                  type="submit" 
                  disabled={loading}
                  className={`w-full py-2 ${activeTab === 'history' ? 'bg-[#45a29e] text-[#0b0c10]' : 'bg-[#1f2833] text-white'} text-xs font-bold rounded hover:bg-[#66fcf1] transition-colors uppercase flex items-center justify-center gap-2 disabled:opacity-50`}
                >
                  {loading && activeTab === "history" ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Fetch History
                </button>
                <button 
                  type="button"
                  onClick={handleFetchLiveMatch}
                  disabled={loading}
                  className={`w-full py-2 ${activeTab === 'live' ? 'bg-[#45a29e] text-[#0b0c10]' : 'bg-[#1f2833] text-white'} text-xs font-bold rounded hover:bg-[#66fcf1] transition-colors uppercase flex items-center justify-center gap-2 disabled:opacity-50`}
                >
                  {loading && activeTab === "live" ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Check Live Match
                </button>
              </div>
            </div>
          </form>

          {/* Matches List */}
          {activeTab === "history" && (matches.length > 0 || error) && (
            <div className="flex-1 bg-[#1f2833]/30 border border-[#45a29e]/10 rounded-lg flex flex-col overflow-hidden min-h-[200px]">
              <h2 className="text-[11px] font-bold text-[#45a29e] p-3 border-b border-[#1f2833] uppercase shrink-0">Match History</h2>
              
              {error && (
                <div className="p-3 bg-red-900/20 text-red-400 text-[10px] border-b border-red-900/50">
                  {error}
                </div>
              )}

              <div className="flex-1 overflow-y-auto overflow-x-hidden">
                {matches.map((matchId) => (
                  <div 
                    key={matchId} 
                    onClick={() => handleSelectMatch(matchId)}
                    className={`p-3 border-b border-[#1f2833] cursor-pointer transition-colors ${
                      selectedMatch === matchId ? "bg-[#66fcf1]/5 border-l-2 border-l-[#66fcf1]" : "hover:bg-[#1f2833]"
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] text-gray-400 font-mono break-all">{matchId}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "live" && error && (
            <div className="bg-[#1f2833]/30 border border-red-900/50 p-4 rounded-lg text-red-400 text-[10px] uppercase">
              {error}
            </div>
          )}
        </aside>

        {/* Main Content: Analysis View */}
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          {loading && selectedMatch && (
            <div className="bg-[#1f2833]/50 border border-[#45a29e]/20 p-4 rounded-lg flex items-center gap-3 text-[11px] text-[#66fcf1] uppercase">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>SYNCHRONIZING TIMELINE DATA AND SPATIAL COORDS...</span>
            </div>
          )}

          {!finalJson ? (
            <div className="flex-1 bg-[#0b0c10] border border-[#1f2833] rounded-lg flex items-center justify-center text-[#45a29e] text-[10px] uppercase tracking-wider relative overflow-hidden">
              <div className="absolute w-full h-full opacity-5 bg-[radial-gradient(#66fcf1_1px,transparent_1px)] bg-[size:16px_16px]"></div>
              AWAITING MATCH SELECTION...
            </div>
          ) : activeTab === "replay" && rawMatchDetails && rawMatchTimeline ? (
            <div className="flex-1 bg-[#0b0c10] border border-[#1f2833] rounded-lg overflow-hidden relative">
              <ReplayViewer matchDetails={rawMatchDetails} matchTimeline={rawMatchTimeline} dDragon={rawDDragon} playerPuuid={currentAccount?.puuid} geminiApiKey={geminiApiKey} />
            </div>
          ) : (
            <div className="flex-1 bg-[#0b0c10] border border-[#1f2833] rounded-lg flex flex-col overflow-hidden relative">
              <div className="absolute w-full h-full opacity-[0.03] bg-[radial-gradient(#66fcf1_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none"></div>
              
              <div className="flex justify-between items-center p-3 border-b border-[#1f2833] shrink-0 bg-[#0b0c10] z-10 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setFinalJson(null)}
                    className="md:hidden text-[#45a29e] hover:text-[#66fcf1] p-1 mr-1"
                  >
                    ← Back
                  </button>
                  <div className="flex bg-[#1f2833]/50 p-0.5 rounded-md border border-[#45a29e]/20">
                    <button
                      onClick={() => setMatchSubTab("plan")}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded text-[10px] font-bold tracking-wider transition-colors uppercase ${matchSubTab === "plan" ? "bg-[#66fcf1] text-[#0b0c10]" : "text-[#45a29e] hover:text-white"}`}
                    >
                      <Swords className="w-3.5 h-3.5" /> PLAN NA MECZ
                    </button>
                    <button
                      onClick={() => setMatchSubTab("json")}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded text-[10px] font-bold tracking-wider transition-colors uppercase ${matchSubTab === "json" ? "bg-[#66fcf1] text-[#0b0c10]" : "text-[#45a29e] hover:text-white"}`}
                    >
                      <Code className="w-3.5 h-3.5" /> DANE DLA AI (JSON)
                    </button>
                  </div>
                </div>

                {matchSubTab === "json" && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="flex items-center gap-2 cursor-pointer text-[10px] text-[#45a29e] hover:text-[#66fcf1]">
                      <input 
                        type="checkbox" 
                        checked={activeTab === "live" ? includeLivePrompt : includePrompt} 
                        onChange={(e) => activeTab === "live" ? setIncludeLivePrompt(e.target.checked) : setIncludePrompt(e.target.checked)} 
                      />
                      {activeTab === "live" ? "Include Pre-Match Analysis" : "Include Analysis Prompt"}
                    </label>
                    <button 
                      onClick={downloadJson}
                      className="flex items-center gap-2 text-[10px] font-bold tracking-wider px-3 py-1.5 bg-[#1f2833] text-[#66fcf1] border border-[#66fcf1]/30 rounded hover:bg-[#66fcf1] hover:text-[#0b0c10] transition-colors uppercase"
                    >
                      <Download className="w-3 h-3" />
                      DOWNLOAD
                    </button>
                    <button 
                      onClick={copyToClipboard}
                      className="flex items-center gap-2 text-[10px] font-bold tracking-wider px-3 py-1.5 bg-[#1f2833] text-[#66fcf1] border border-[#66fcf1]/30 rounded hover:bg-[#66fcf1] hover:text-[#0b0c10] transition-colors uppercase"
                    >
                      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copied ? "COPIED" : "COPY"}
                    </button>
                  </div>
                )}
              </div>
              
              <div className="flex-1 overflow-auto p-4 z-10 relative">
                {matchSubTab === "plan" ? (
                  <PreMatchPlan 
                    participants={activeTab === "live" ? (finalJson.uczestnicy || []) : historyParticipants}
                    ourChampion={activeTab === "live" ? finalJson.nasz_bohater : (rawMatchDetails?.info?.participants?.find((p: any) => p.puuid === currentAccount?.puuid)?.championName)}
                    latestVersion={rawDDragon?.latest}
                    isLive={activeTab === "live"}
                    customApiKey={geminiApiKey}
                    setCustomApiKey={setGeminiApiKey}
                  />
                ) : (
                  <pre className="text-[11px] font-mono leading-relaxed text-[#c5c6c7] whitespace-pre-wrap">
                    {getExportContent()}
                  </pre>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer Status Bar */}
      <footer className="h-8 border-t border-[#1f2833] bg-[#0b0c10] flex items-center px-6 shrink-0">
        <div className="flex-1 flex gap-6 text-[9px] font-mono text-[#45a29e]">
          <span>REGION: {tagLine || "-"}</span>
          <span>MATCH_ID: {selectedMatch || "-"}</span>
        </div>
        <div className="text-[9px] text-[#66fcf1] opacity-70 tracking-widest font-bold">
          READY FOR AI ANALYTICS INGESTION
        </div>
      </footer>
    </div>
  );
}


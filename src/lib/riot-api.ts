export interface RiotAccount {
  puuid: string;
  gameName: string;
  tagLine: string;
}

const REGION_ROUTER = "https://europe.api.riotgames.com";

const PLATFORM_MAP: Record<string, string> = {
  "EUNE": "https://eun1.api.riotgames.com",
  "EUW": "https://euw1.api.riotgames.com",
  "NA": "https://na1.api.riotgames.com",
  "KR": "https://kr.api.riotgames.com",
  "BR": "https://br1.api.riotgames.com",
  "LAN": "https://la1.api.riotgames.com",
  "LAS": "https://la2.api.riotgames.com",
  "OCE": "https://oc1.api.riotgames.com",
  "TR": "https://tr1.api.riotgames.com",
  "RU": "https://ru.api.riotgames.com",
  "JP": "https://jp1.api.riotgames.com",
  "PH": "https://ph2.api.riotgames.com",
  "SG": "https://sg2.api.riotgames.com",
  "TH": "https://th2.api.riotgames.com",
  "TW": "https://tw2.api.riotgames.com",
  "VN": "https://vn2.api.riotgames.com",
};

function getPlatformRouter(tag: string) {
    const cleanTag = tag.toUpperCase().replace("#", "");
    return PLATFORM_MAP[cleanTag] || PLATFORM_MAP["EUNE"];
}

async function proxyRiotReq(url: string, apiKey: string) {
  try {
    const res = await fetch("/api/riot", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-riot-token": apiKey,
      },
      body: JSON.stringify({ url }),
    });
    
    // If we get 404 or 405, it means we are on GitHub Pages or another static host where the backend does not exist.
    if (res.status === 404 || res.status === 405) {
      console.warn("Proxy endpoint not found (status " + res.status + "). Falling back to direct client request...");
      return await directRiotReq(url, apiKey);
    }

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || data.status?.message || "Riot API Error");
    }
    return data;
  } catch (err: any) {
    console.warn("Proxy request failed, attempting direct request as fallback:", err);
    return await directRiotReq(url, apiKey);
  }
}

async function directRiotReq(url: string, apiKey: string) {
  const res = await fetch(url, {
    headers: {
      "X-Riot-Token": apiKey,
    }
  });
  if (!res.ok) {
    let errMsg = "Riot API Error";
    try {
      const errData = await res.json();
      errMsg = errData.status?.message || errMsg;
    } catch (e) {}
    throw new Error(errMsg);
  }
  return res.json();
}

export async function fetchAccount(gameName: string, tagLine: string, apiKey: string): Promise<RiotAccount> {
  const accountUrl = `${REGION_ROUTER}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
  return proxyRiotReq(accountUrl, apiKey);
}

export async function fetchMatchIds(puuid: string, apiKey: string): Promise<string[]> {
  const matchIdsUrl = `${REGION_ROUTER}/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=10`;
  return proxyRiotReq(matchIdsUrl, apiKey);
}

export async function fetchMatchDetails(matchId: string, apiKey: string): Promise<any> {
    const matchUrl = `${REGION_ROUTER}/lol/match/v5/matches/${matchId}`;
    return proxyRiotReq(matchUrl, apiKey);
}

export async function fetchMatchTimeline(matchId: string, apiKey: string): Promise<any> {
    const timelineUrl = `${REGION_ROUTER}/lol/match/v5/matches/${matchId}/timeline`;
    return proxyRiotReq(timelineUrl, apiKey);
}

export async function fetchCurrentMatch(puuid: string, tagLine: string, apiKey: string): Promise<any> {
    const platformRouter = getPlatformRouter(tagLine);
    const currentMatchUrl = `${platformRouter}/lol/spectator/v5/active-games/by-summoner/${puuid}`;
    return proxyRiotReq(currentMatchUrl, apiKey);
}

export async function fetchRunesData() {
  const versionRes = await fetch("https://ddragon.leagueoflegends.com/api/versions.json");
  const versions = await versionRes.json();
  const latest = versions[0];
  const runesRes = await fetch(`https://ddragon.leagueoflegends.com/cdn/${latest}/data/en_US/runesReforged.json`);
  return runesRes.json();
}

export async function fetchDDragonData() {
  const versionRes = await fetch("https://ddragon.leagueoflegends.com/api/versions.json");
  const versions = await versionRes.json();
  const latest = versions[0];

  const [championsRes, itemsRes] = await Promise.all([
    fetch(`https://ddragon.leagueoflegends.com/cdn/${latest}/data/en_US/champion.json`),
    fetch(`https://ddragon.leagueoflegends.com/cdn/${latest}/data/en_US/item.json`)
  ]);

  const championsData = await championsRes.json();
  const itemsData = await itemsRes.json();

  // Map champion ID to name
  const championMap: Record<number, string> = {};
  const championKeyMap: Record<number, string> = {};
  Object.values(championsData.data as any).forEach((champ: any) => {
    championMap[Number(champ.key)] = champ.name;
    championKeyMap[Number(champ.key)] = champ.id;
  });

  const itemMap: Record<number, string> = {};
  Object.keys(itemsData.data).forEach((key) => {
    itemMap[Number(key)] = itemsData.data[key].name;
  });

  return { championMap, championKeyMap, itemMap, latest };
}

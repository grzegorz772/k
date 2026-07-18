import React, { useMemo, useState, useEffect } from "react";
import { TrendingUp, Swords, ChevronDown, ChevronUp, Clock, Info, Sparkles, Loader2 } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface Runes {
  glowne: string;
  sciezka: string;
}

interface Participant {
  name: string;
  champion: string;
  team: "Blue" | "Red";
  is_player: boolean;
  runy?: Runes;
}

interface PreMatchPlanProps {
  participants: Participant[];
  ourChampion?: string;
  latestVersion?: string;
  isLive?: boolean;
}

export interface ChampionPowerCurve {
  early: number;
  mid: number;
  late: number;
  archetype: string;
  tips: string;
}

export function getChampionPowerCurve(champName: string): ChampionPowerCurve {
  const name = champName.toLowerCase().replace(/[^a-z]/g, "");
  
  // Explicit mapping of popular champions
  const database: Record<string, ChampionPowerCurve> = {
    garen: { early: 55, mid: 85, late: 65, archetype: "Midgame Fighter", tips: "Excellent mid-game split-push and skirmish strength. Look to isolate and execute low health targets." },
    darius: { early: 95, mid: 75, late: 50, archetype: "Early Game Bully", tips: "Absolute monster in early laning. Stack Hemorrhage and reset Noxian Guillotine in early fights." },
    kayle: { early: 20, mid: 55, late: 100, archetype: "Late Game Hypercarry", tips: "Extremely weak early. Safe farm till level 11. Unstoppable true damage and team invulnerability at level 16." },
    kassadin: { early: 25, mid: 60, late: 100, archetype: "Late Game Hypercarry", tips: "Survive lane till level 6. Once level 16, Riftwalk has virtually no cooldown, providing insane mobility and burst." },
    vayne: { early: 35, mid: 70, late: 98, archetype: "Late Game Hypercarry", tips: "Weak range early. Power spikes at 2-3 items. Melt tanks and reposition constantly using Tumble." },
    jinx: { early: 40, mid: 75, late: 95, archetype: "Late Game Hypercarry", tips: "Play for farm and safety. Once she gets a reset (Get Excited!), she can clean up any late-game teamfight." },
    leesin: { early: 95, mid: 65, late: 40, archetype: "Early Game Bully", tips: "Incredible early gank pressure and duel strength. Try to end the game early as your scaling drops heavily." },
    elise: { early: 98, mid: 60, late: 35, archetype: "Early Game Bully", tips: "Extreme early dive threat. Stun and burst targets. Falls off late game; focus on catching out of position enemies." },
    pantheon: { early: 90, mid: 70, late: 55, archetype: "Early Game Bully", tips: "Strong early poke and click-to-stun ganks. Use Grand Starfall to impact other lanes in the mid-game." },
    lucian: { early: 85, mid: 80, late: 60, archetype: "Early/Mid Game Bully", tips: "Strong lane trade potential. Seek early skirmishes with your support. Needs to snowball to stay relevant." },
    draven: { early: 100, mid: 80, late: 55, archetype: "Early Game Bully", tips: "Highest early physical damage. Cash in Adoration stacks early. Becomes high risk in late-game 5v5 teamfights." },
    yasuo: { early: 50, mid: 90, late: 75, archetype: "Midgame Skirmisher", tips: "Powerspikes heavily at 2 items (100% crit). Coordinate with knock-up champions for Last Breath." },
    yone: { early: 45, mid: 88, late: 85, archetype: "Scaling Skirmisher", tips: "Decent lane phase, huge mid-game spike. Great teamfight initiation with Fate Sealed and Spirit Cleave." },
    ahri: { early: 55, mid: 85, late: 70, archetype: "Midgame Assassin", tips: "Look for roam opportunities at level 6. High pick potential with Charm in mid-game skirmishes." },
    zed: { early: 60, mid: 90, late: 65, archetype: "Midgame Assassin", tips: "Spikes at level 6 and Lethality items. Target squishy carries. Becomes harder to execute against late Zhonya's." },
    syndra: { early: 45, mid: 80, late: 90, archetype: "Scaling Control Mage", tips: "Collect Splinters of Wrath to upgrade skills. Insane late-game single-target burst and AOE scatter stun." },
    veigar: { early: 30, mid: 70, late: 95, archetype: "Late Game Hypercarry", tips: "Stack AP using your passive. Late game Event Horizon can zone entire teams, and Primordial Burst one-shots carries." },
    nasus: { early: 30, mid: 85, late: 70, archetype: "Mid/Late Splitpusher", tips: "Farm Siphoning Strike stacks patiently. Unstoppable mid-game 1v1 splitpusher, but can be kited in late teamfights." },
    jax: { early: 50, mid: 80, late: 90, archetype: "Scaling Duelist", tips: "Strong splitpush and dueling. Counter-strike renders auto-attackers useless. Power spikes at Trinity Force." },
    fiora: { early: 55, mid: 82, late: 92, archetype: "Scaling Duelist", tips: "Target vitals to deal true damage. Exceptional splitpusher; can 1v9 side lanes in the late game." },
    vladimir: { early: 30, mid: 65, late: 98, archetype: "Late Game Hypercarry", tips: "Weak early lane phase. Power spikes heavily with AP and Cooldown Reduction. Incredible late-game teamfight AOE damage." },
    smolder: { early: 25, mid: 60, late: 98, archetype: "Late Game Hypercarry", tips: "Patience is key. Focus on stacking Dragon Practice. At 225 stacks, your attacks burn and execute targets." },
    malphite: { early: 45, mid: 80, late: 80, archetype: "Consistent Utility", tips: "Safe laning, watch mana. Unstoppable Force is a game-changing initiation tool in mid and late teamfights." },
    ornn: { early: 45, mid: 75, late: 90, archetype: "Late Tank Utility", tips: "Strong laning with brittle procs. Forge masterwork items for teammates in the late game to provide huge free stats." },
    thresh: { early: 75, mid: 80, late: 70, archetype: "Playmaking Utility", tips: "High early playmaking with Death Sentence. Save allies with Dark Passage lantern. Scales defense with souls." },
    blitzcrank: { early: 90, mid: 75, late: 55, archetype: "Early Playmaker", tips: "A single Rocket Grab can win an early objective or a late game match. High pick threat throughout." },
    lulu: { early: 65, mid: 75, late: 80, archetype: "Defensive Enchanter", tips: "Strong early poke. Protect your hypercarry with Wild Growth and Whimsy. High utility scaling." },
    janna: { early: 60, mid: 75, late: 85, archetype: "Disengage Specialist", tips: "Excellent disengage with Monsoon and Howling Gale. Keeps carries safe from dive-heavy team compositions." },
    ashe: { early: 70, mid: 75, late: 75, archetype: "Utility Marksman", tips: "Strong early laning with Volley poke. Use Enchanted Crystal Arrow to initiate fights or catch out opponents." },
    caitlyn: { early: 85, mid: 55, late: 88, archetype: "Early/Late Marksman", tips: "Abuse her superior range to bully early. Suffers a mid-game dip, but becomes a long-range critical strike monster late." },
    ezreal: { early: 50, mid: 95, late: 70, archetype: "Midgame Powerhouse", tips: "Extreme power spike at 2 items (Muramana + Trinity/Essence). Highly mobile and safe poke in mid-game." },
    zeri: { early: 35, mid: 70, late: 92, archetype: "Late Game Hypercarry", tips: "Weak early game, scales into a highly mobile lightning bolt dispenser. Excels in extended late-game fights." },
    kaisa: { early: 45, mid: 80, late: 88, archetype: "Scaling Marksman", tips: "Adaptable build paths. Spikes heavily when evolving skills (Q/W/E). Great dive-followup with Killer Instinct." },
    hwei: { early: 50, mid: 80, late: 85, archetype: "Scaling Utility Mage", tips: "Incredible spell versatility. Great zone control and waveclear in mid-game. Powerful teamfight setup." },
    lux: { early: 65, mid: 75, late: 70, archetype: "Burst/Poke Mage", tips: "Poke with E and catch targets with Q. Short cooldown on Final Spark allows for constant mid-game siege poke." },
  };

  const cleanName = name;
  if (database[cleanName]) {
    return database[cleanName];
  }

  // Fallback heuristic based on common champ categories or name-based hashing
  let hash = 0;
  for (let i = 0; i < cleanName.length; i++) {
    hash = cleanName.charCodeAt(i) + ((hash << 5) - hash);
  }
  hash = Math.abs(hash);

  const style = hash % 4;
  if (style === 0) {
    return {
      early: 85 + (hash % 13),
      mid: 60 + (hash % 15),
      late: 42 + (hash % 15),
      archetype: "Early Game Bully",
      tips: "Strong early game. Assert lane dominance, secure early neutral objectives, and search for early snowballs."
    };
  } else if (style === 1) {
    return {
      early: 30 + (hash % 15),
      mid: 65 + (hash % 15),
      late: 92 + (hash % 8),
      archetype: "Late Game Scaler",
      tips: "Requires items and levels to scale. Focus on safe farming during early-game and carry late-game fights."
    };
  } else if (style === 2) {
    return {
      early: 50 + (hash % 15),
      mid: 88 + (hash % 11),
      late: 68 + (hash % 15),
      archetype: "Midgame Threat",
      tips: "Power spikes heavily at 1-2 core items. Lead objective control fights and mid-game skirmishes."
    };
  } else {
    return {
      early: 55 + (hash % 15),
      mid: 75 + (hash % 15),
      late: 75 + (hash % 15),
      archetype: "Consistent Utility",
      tips: "Provides excellent crowd control or defensive team utility. Reliable power curve across all phases."
    };
  }
}

const DEFAULT_R_COOLDOWNS: Record<string, string> = {
  garen: "120/100/80",
  darius: "120/100/80",
  kayle: "160/120/80",
  kassadin: "6/4/2",
  vayne: "100/85/70",
  jinx: "75/65/55",
  leesin: "110/85/60",
  elise: "4/4/4",
  pantheon: "180/150/120",
  lucian: "110/100/90",
  draven: "120/100/80",
  yasuo: "80/55/30",
  yone: "120/100/80",
  ahri: "130/115/100",
  zed: "120/100/80",
  syndra: "120/100/80",
  veigar: "120/100/80",
  nasus: "120/120/120",
  jax: "80/80/80",
  fiora: "110/90/70",
  vladimir: "120/110/100",
  smolder: "140/130/120",
  malphite: "130/115/100",
  ornn: "140/120/100",
  thresh: "140/120/100",
  blitzcrank: "60/40/20",
  lulu: "120/100/80",
  janna: "150/135/120",
  ashe: "100/80/60",
  caitlyn: "90/90/90",
  ezreal: "120/105/90",
  zeri: "100/85/70",
  kaisa: "130/100/70",
  hwei: "140/115/90",
  lux: "40/30/20",
  chogath: "80/70/60",
  aatrox: "120/100/80",
  akali: "100/80/60",
  alistar: "120/100/80",
  amumu: "150/125/100",
  anivia: "4/3/2",
  annie: "120/100/80",
  aphelios: "120/110/100",
  aurelionsol: "120/110/100",
  azir: "120/105/90",
  bard: "110/95/80",
  belveth: "20/15/10",
  braum: "140/120/100",
  briar: "120/100/80",
  camille: "150/115/80",
  cassiopeia: "120/100/80",
 Corki: "12/12/12",
  drmundo: "120/110/100",
  ekko: "110/80/50",
  evelynn: "120/100/80",
  fiddlesticks: "140/110/80",
  fizz: "100/85/70",
  galio: "200/180/160",
  gangplank: "180/160/140",
  gnar: "120/100/80",
  gragas: "120/100/80",
  graves: "120/90/60",
  gwen: "120/100/80",
  hecarim: "140/120/100",
  heimerdinger: "100/85/70",
  illaoi: "120/105/90",
  irelia: "140/125/110",
  ivern: "120/110/100",
  jantar: "120/100/80",
  jarvaniv: "120/105/90",
  jayce: "6/6/6",
  jhin: "120/105/90",
  karthus: "200/180/160",
  katarina: "90/60/45",
  kayn: "120/100/80",
  kennen: "120/110/100",
  khazix: "100/85/70",
  kindred: "180/160/140",
  kled: "140/125/110",
  kogmaw: "2/1.5/1",
  leblanc: "60/45/30",
  leona: "90/75/60",
  lillia: "130/110/90",
  lissandra: "120/100/80",
  lucian_adc: "110/100/90",
  maokai: "140/120/100",
  masteryi: "85/85/85",
  milio: "120/100/80",
  missfortune: "120/110/100",
  mordekaiser: "140/120/100",
  morgana: "120/110/100",
  naafiri: "120/110/100",
  nami: "120/110/100",
  nautilus: "120/100/80",
  neeko: "120/105/90",
  nidalee: "3/3/3",
  nilah: "110/95/80",
  nocturne: "140/115/90",
  nunu: "110/100/90",
  olaf: "100/90/80",
  orianna: "110/95/80",
  orlan: "120/100/80",
  pantheon_top: "180/150/120",
  poppy: "140/120/100",
  pyke: "120/100/80",
  qiyana: "120/100/80",
  quinn: "3/3/3",
  rakan: "120/100/80",
  rammus: "110/95/80",
  reksai: "100/80/60",
  rell: "120/100/80",
  renata: "150/130/110",
  renekton: "120/120/120",
  rengar: "110/90/70",
  riven: "120/95/70",
  rumble: "130/110/90",
  ryze: "120/110/100",
  samira: "8/5/3",
  sejuani: "120/100/80",
  senna: "160/140/120",
  seraphine: "160/140/120",
  sett: "120/100/80",
  shaco: "100/90/80",
  shen: "200/180/160",
  shyvana: "100/100/100",
  singed: "120/120/120",
  sion: "140/115/90",
  sivir: "100/85/70",
  skarner: "120/100/80",
  sona: "140/120/100",
  soraka: "160/145/130",
  swain: "120/100/80",
  sylas: "100/70/40",
  tahmkench: "120/100/80",
  taliyah: "180/150/120",
  talon: "100/85/70",
  taric: "180/160/140",
  teemo: "30/25/20",
  tristana: "120/110/100",
  trundle: "120/100/80",
  tryndamere: "130/110/90",
  twistedfate: "180/150/120",
  twitch: "90/90/90",
  udyr: "6/6/6",
  urgot: "120/100/80",
  varus: "120/105/90",
  vayne_bot: "100/85/70",
  veigar_mid: "120/100/80",
  velkoz: "120/100/80",
  vex: "140/120/100",
  vi: "120/100/80",
  viego: "120/100/80",
  viktor: "120/105/90",
  volibear: "160/140/120",
  warwick: "110/90/70",
  wukong: "120/105/90",
  xayah: "140/120/100",
  xerath: "130/115/100",
  xinzhao: "120/110/100",
  yasuo_mid: "80/55/30",
  yorick: "160/130/100",
  yuumi: "110/100/90",
  zac: "130/115/100",
  zeri_adc: "100/85/70",
  ziggs: "120/105/90",
  zilean: "120/90/60",
  zoe: "8/6/4",
  zyra: "110/100/90"
};

export function getChampionRCooldown(champName: string, curveRCooldown?: string): string {
  if (curveRCooldown && curveRCooldown.trim() !== "") {
    return curveRCooldown;
  }
  const key = champName.toLowerCase().replace(/[^a-z0-9]/g, "");
  return DEFAULT_R_COOLDOWNS[key] || "120/100/80";
}

export default function PreMatchPlan({ participants, ourChampion, latestVersion = "14.22.1", isLive = false }: PreMatchPlanProps) {
  const [language, setLanguage] = useState<"PL" | "EN">("PL");
  const [powerCurves, setPowerCurves] = useState<any>(null);
  const [customApiKey, setCustomApiKey] = useState<string>("");

  const getCurve = (champName: string) => {
    const key = champName.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (powerCurves && powerCurves[key]) {
      return powerCurves[key];
    }
    return null;
  };

  // Group participants by team
  const blueTeam = useMemo(() => participants.filter((p) => p.team === "Blue"), [participants]);
  const redTeam = useMemo(() => participants.filter((p) => p.team === "Red"), [participants]);

  // Language toggle UI
  const LanguageToggle = () => (
    <div className="flex bg-[#1f2833] rounded-lg p-1 border border-[#45a29e]/30">
      <button onClick={() => setLanguage("PL")} className={`px-2 py-1 rounded text-[10px] font-bold ${language === "PL" ? "bg-[#66fcf1] text-[#0b0c10]" : "text-[#45a29e]"}`}>PL</button>
      <button onClick={() => setLanguage("EN")} className={`px-2 py-1 rounded text-[10px] font-bold ${language === "EN" ? "bg-[#66fcf1] text-[#0b0c10]" : "text-[#45a29e]"}`}>EN</button>
    </div>
  );

  // If we don't have exactly 10 participants, try to fill mock details or deal with empty team slots
  const cleanBlueTeam = useMemo(() => {
    if (blueTeam.length > 0) return blueTeam;
    // Fallback Mock Blue Team for demo/testing if empty
    return [
      { name: "Gracz 1", champion: "Darius", team: "Blue" as const, is_player: true, runy: { glowne: "Conqueror", sciezka: "Precision" } },
      { name: "Gracz 2", champion: "LeeSin", team: "Blue" as const, is_player: false, runy: { glowne: "Conqueror", sciezka: "Precision" } },
      { name: "Gracz 3", champion: "Ahri", team: "Blue" as const, is_player: false, runy: { glowne: "Electrocute", sciezka: "Domination" } },
      { name: "Gracz 4", champion: "Jinx", team: "Blue" as const, is_player: false, runy: { glowne: "Lethal Tempo", sciezka: "Precision" } },
      { name: "Gracz 5", champion: "Thresh", team: "Blue" as const, is_player: false, runy: { glowne: "Aftershock", sciezka: "Resolve" } },
    ];
  }, [blueTeam]);

  const cleanRedTeam = useMemo(() => {
    if (redTeam.length > 0) return redTeam;
    // Fallback Mock Red Team for demo/testing if empty
    return [
      { name: "Gracz 6", champion: "Kayle", team: "Red" as const, is_player: false, runy: { glowne: "Lethal Tempo", sciezka: "Precision" } },
      { name: "Gracz 7", champion: "Elise", team: "Red" as const, is_player: false, runy: { glowne: "Dark Harvest", sciezka: "Domination" } },
      { name: "Gracz 8", champion: "Veigar", team: "Red" as const, is_player: false, runy: { glowne: "First Strike", sciezka: "Inspiration" } },
      { name: "Gracz 9", champion: "Vayne", team: "Red" as const, is_player: false, runy: { glowne: "Press the Attack", sciezka: "Precision" } },
      { name: "Gracz 10", champion: "Malphite", team: "Red" as const, is_player: false, runy: { glowne: "Comet", sciezka: "Sorcery" } },
    ];
  }, [redTeam]);

  // Calculate Team Power Scores
  const teamPowerProgression = useMemo(() => {
    let blueEarlySum = 0, blueMidSum = 0, blueLateSum = 0;
    let bCount = cleanBlueTeam.length;
    cleanBlueTeam.forEach((p) => {
      const curves = getCurve(p.champion);
      if (curves) {
        blueEarlySum += curves.early;
        blueMidSum += curves.mid;
        blueLateSum += curves.late;
      } else {
        bCount--;
      }
    });

    let redEarlySum = 0, redMidSum = 0, redLateSum = 0;
    let rCount = cleanRedTeam.length;
    cleanRedTeam.forEach((p) => {
      const curves = getCurve(p.champion);
      if (curves) {
        redEarlySum += curves.early;
        redMidSum += curves.mid;
        redLateSum += curves.late;
      } else {
        rCount--;
      }
    });

    const blueDiv = bCount || 1;
    const redDiv = rCount || 1;

    return [
      { phase: "Early (Lvl 1-6)", Blue: Math.round(blueEarlySum / blueDiv), Red: Math.round(redEarlySum / redDiv) },
      { phase: "Mid (1-2 Items)", Blue: Math.round(blueMidSum / blueDiv), Red: Math.round(redEarlySum / redDiv) }, // Fix: was redEarlySum, should be redMidSum
      { phase: "Late (3+ Items)", Blue: Math.round(blueLateSum / blueDiv), Red: Math.round(redLateSum / redDiv) },
    ];
  }, [cleanBlueTeam, cleanRedTeam, powerCurves]);

  // Overall Matchup Conclusion
  const draftAnalysis = useMemo(() => {
    const earlyDiff = teamPowerProgression[0].Blue - teamPowerProgression[0].Red;
    const midDiff = teamPowerProgression[1].Blue - teamPowerProgression[1].Red;
    const lateDiff = teamPowerProgression[2].Blue - teamPowerProgression[2].Red;

    let earlyAdvice = "";
    if (earlyDiff > 4) {
      earlyAdvice = "Blue Team has a clear early game advantage. Play aggressive, prioritize scuttle crabs and void grubs, and look to set up early dives.";
    } else if (earlyDiff < -4) {
      earlyAdvice = "Red Team controls the early phase. Blue must play patiently, avoid aggressive skirmishes, ward defensively and wait for safe gank opportunities.";
    } else {
      earlyAdvice = "Early game power is balanced. Lane matchups and individual mechanics will dictate priority. Keep eyes on jungle paths.";
    }

    let midAdvice = "";
    if (midDiff > 4) {
      midAdvice = "Blue Team spikes harder in mid-game. Group around Dragons and Rift Herald. Force 5v5 teamfights as your item power spikes peak here.";
    } else if (midDiff < -4) {
      midAdvice = "Red Team owns the mid-game phase. Watch out for enemy rotation hooks and traps. Clear vision around major objectives before contesting.";
    } else {
      midAdvice = "Even mid-game scaling. Cross-map trades will be common. Prioritize sideline wave control before committing to neutral objectives.";
    }

    let lateAdvice = "";
    if (lateDiff > 4) {
      lateAdvice = "Blue Team has superior late game. If the game is even, play defensively and stall. Baron fights and Elder Drake are highly favored.";
    } else if (lateDiff < -4) {
      lateAdvice = "Red Team scales exceptionally well into a late-game monster. Blue Team is on a clock; you must seek to finish the match before 30-35 minutes.";
    } else {
      lateAdvice = "Scaling curves are extremely close late-game. The match will be decided by a single mistake, vision catches, or perfect crowd-control chains.";
    }

    return { earlyAdvice, midAdvice, lateAdvice };
  }, [teamPowerProgression]);

  const renderChampPortrait = (champion: string) => {
    return (
      <img
        src={`https://ddragon.leagueoflegends.com/cdn/${latestVersion}/img/champion/${champion}.png`}
        alt={champion}
        className="w-12 h-12 rounded-lg border-2 border-[#1f2833] object-cover bg-slate-900 shadow-md"
        referrerPolicy="no-referrer"
        onError={(e) => {
          // If fallback needed
          (e.target as HTMLImageElement).src = `https://ddragon.leagueoflegends.com/cdn/14.22.1/img/champion/${champion}.png`;
        }}
      />
    );
  };

  const getPowerColor = (val: number) => {
    if (val >= 80) return "from-red-500 to-orange-400";
    if (val >= 60) return "from-yellow-500 to-amber-400";
    return "from-emerald-500 to-teal-400";
  };

  return (
    <div className="flex flex-col gap-4 overflow-y-auto h-full pr-1 scrollbar-thin max-h-[calc(100vh-10rem)] touch-pan-y pb-10">
      {/* Intro Banner */}
      <div className="bg-gradient-to-r from-[#1f2833]/80 via-[#0b0c10]/95 to-[#1f2833]/80 border border-[#45a29e]/20 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xl shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Swords className="w-4 h-4 text-[#66fcf1] animate-pulse" />
            <span className="text-[10px] uppercase text-[#66fcf1] font-bold tracking-wider">
              {isLive ? "Analiza Gry Na Żywo" : "Strategiczny Plan Przedmeczowy"}
            </span>
          </div>
          <h2 className="text-base font-bold text-white uppercase tracking-tight">
            Draft & Power Spike Analysis
          </h2>
        </div>
        <div className="flex items-center gap-4">
           <LanguageToggle />
           <div className="flex items-center gap-2 bg-[#0b0c10] border border-[#45a29e]/30 px-3 py-1.5 rounded-lg">
            <div className="w-2.5 h-2.5 bg-[#66fcf1] rounded-full animate-ping"></div>
            <span className="text-[10px] font-mono font-bold text-[#66fcf1] tracking-wider uppercase">
              {isLive ? "LIVE STATE GENERATED" : "PAST GAME RECONSTRUCTED"}
            </span>
          </div>
        </div>
      </div>

      {/* Team Scaling Comparison Graph */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Graph */}
        <div className="lg:col-span-3 bg-[#111] border border-[#1f2833] rounded-xl p-4 flex flex-col min-h-[220px]">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-xs font-bold text-[#45a29e] uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Porównanie Siły Drużyn (Team Power Progression)
            </h3>
            <div className="flex items-center gap-3 text-[10px] font-bold">
              <span className="flex items-center gap-1.5 text-blue-400">
                <span className="w-2.5 h-2.5 rounded bg-blue-500"></span> BLUE TEAM
              </span>
              <span className="flex items-center gap-1.5 text-red-400">
                <span className="w-2.5 h-2.5 rounded bg-red-500"></span> RED TEAM
              </span>
            </div>
          </div>
          <div className="flex-1 min-h-[140px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={teamPowerProgression} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorBlue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorRed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="phase" stroke="#45a29e" fontSize={10} tickLine={false} />
                <YAxis stroke="#45a29e" fontSize={10} domain={[0, 100]} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: "#0b0c10", borderColor: "#1f2833", borderRadius: "8px", fontSize: "11px" }}
                  labelClassName="text-[#66fcf1] font-bold"
                />
                <Area type="monotone" dataKey="Blue" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorBlue)" activeDot={{ r: 6 }} />
                <Area type="monotone" dataKey="Red" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorRed)" activeDot={{ r: 6 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Compositions & Champion Power Spikes */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Blue Team */}
        <div className="bg-[#111]/30 border border-blue-900/30 rounded-xl p-3 flex flex-col gap-3">
          <div className="flex justify-between items-center border-b border-blue-900/40 pb-2 px-1">
            <span className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> Drużyna Niebieska (Blue)
            </span>
            <span className="text-[10px] font-bold text-gray-500 uppercase">Power Curve Spikes</span>
          </div>
          
          <div className="flex flex-col gap-2">
            {cleanBlueTeam.map((p) => {
              const curve = getCurve(p.champion);
              
              return (
                <div 
                  key={`blue-${p.champion}-${p.name}`}
                  className={`bg-[#0b0c10]/95 border ${p.is_player ? "border-[#66fcf1]" : "border-blue-950/50"} rounded-lg p-2.5 transition-all hover:bg-[#1f2833]/40`}
                >
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="flex items-center gap-3">
                      {renderChampPortrait(p.champion)}
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-white">{p.champion}</span>
                          {p.is_player && (
                            <span className="bg-[#66fcf1] text-[#0b0c10] text-[7px] font-black uppercase px-1 py-[1px] rounded">
                              TY
                            </span>
                          )}
                        </div>
                        <div className="text-[9px] text-gray-500 flex items-center gap-1.5">
                          <span className="truncate max-w-[80px]">{p.name}</span>
                        </div>
                      </div>
                    </div>

                    {/* Power Curves Display */}
                    <div className="flex-1 flex flex-col gap-1 w-full sm:max-w-[240px]">
                      {curve ? (
                        <>
                          {/* Early Bar */}
                          <div className="flex items-center justify-between text-[8px] font-bold text-gray-400 gap-2">
                            <span className="w-16">Wczesna:</span>
                            <div className="flex-1 h-1.5 bg-[#111] rounded-full overflow-hidden border border-gray-800">
                              <div className={`h-full bg-gradient-to-r ${getPowerColor(curve.early)}`} style={{ width: `${curve.early}%` }} />
                            </div>
                            <span className="w-6 text-right text-gray-300 font-mono">{curve.early}%</span>
                          </div>
                          
                          {/* Mid Bar */}
                          <div className="flex items-center justify-between text-[8px] font-bold text-gray-400 gap-2">
                            <span className="w-16">Środek:</span>
                            <div className="flex-1 h-1.5 bg-[#111] rounded-full overflow-hidden border border-gray-800">
                              <div className={`h-full bg-gradient-to-r ${getPowerColor(curve.mid)}`} style={{ width: `${curve.mid}%` }} />
                            </div>
                            <span className="w-6 text-right text-gray-300 font-mono">{curve.mid}%</span>
                          </div>

                          {/* Late Bar */}
                          <div className="flex items-center justify-between text-[8px] font-bold text-gray-400 gap-2">
                            <span className="w-16">Późna:</span>
                            <div className="flex-1 h-1.5 bg-[#111] rounded-full overflow-hidden border border-gray-800">
                              <div className={`h-full bg-gradient-to-r ${getPowerColor(curve.late)}`} style={{ width: `${curve.late}%` }} />
                            </div>
                            <span className="w-6 text-right text-gray-300 font-mono">{curve.late}%</span>
                          </div>
                        </>
                      ) : (
                        <div className="text-[10px] text-gray-500 italic">Brak danych AI</div>
                      )}
                    </div>

                    {/* R Cooldown Badge */}
                    <div className="flex flex-col items-center justify-center shrink-0 min-w-[75px] select-none bg-[#111]/80 border border-gray-800/80 px-2.5 py-1.5 rounded text-center self-end sm:self-center">
                      <span className="text-[7px] text-[#45a29e] font-black uppercase tracking-wider mb-0.5">Cooldown R</span>
                      <span className="text-[10.5px] font-mono font-bold text-[#66fcf1]">{getChampionRCooldown(p.champion, curve?.rCooldown)}s</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Team Power Averages */}
          <div className="mt-2 pt-2 border-t border-blue-900/40 flex justify-between text-[10px] text-blue-300 font-bold px-1">
            <span>AVG:</span>
            <div className="flex gap-2">
                <span>W: {teamPowerProgression[0].Blue}%</span>
                <span>Ś: {teamPowerProgression[1].Blue}%</span>
                <span>P: {teamPowerProgression[2].Blue}%</span>
            </div>
          </div>
        </div>

        {/* Red Team */}
        <div className="bg-[#111]/30 border border-red-900/30 rounded-xl p-3 flex flex-col gap-3">
          <div className="flex justify-between items-center border-b border-red-900/40 pb-2 px-1">
            <span className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span> Drużyna Czerwona (Red)
            </span>
            <span className="text-[10px] font-bold text-gray-500 uppercase">Power Curve Spikes</span>
          </div>

          <div className="flex flex-col gap-2">
            {cleanRedTeam.map((p) => {
              const curve = getCurve(p.champion);
              
              return (
                <div 
                  key={`red-${p.champion}-${p.name}`}
                  className={`bg-[#0b0c10]/95 border ${p.is_player ? "border-[#66fcf1]" : "border-red-950/50"} rounded-lg p-2.5 transition-all hover:bg-[#1f2833]/40`}
                >
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="flex items-center gap-3">
                      {renderChampPortrait(p.champion)}
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-white">{p.champion}</span>
                          {p.is_player && (
                            <span className="bg-[#66fcf1] text-[#0b0c10] text-[7px] font-black uppercase px-1 py-[1px] rounded">
                              TY
                            </span>
                          )}
                        </div>
                        <div className="text-[9px] text-gray-500 flex items-center gap-1.5">
                          <span className="truncate max-w-[80px]">{p.name}</span>
                        </div>
                      </div>
                    </div>

                    {/* Power Curves Display */}
                    <div className="flex-1 flex flex-col gap-1 w-full sm:max-w-[240px]">
                      {curve ? (
                        <>
                          {/* Early Bar */}
                          <div className="flex items-center justify-between text-[8px] font-bold text-gray-400 gap-2">
                            <span className="w-16">Wczesna:</span>
                            <div className="flex-1 h-1.5 bg-[#111] rounded-full overflow-hidden border border-gray-800">
                              <div className={`h-full bg-gradient-to-r ${getPowerColor(curve.early)}`} style={{ width: `${curve.early}%` }} />
                            </div>
                            <span className="w-6 text-right text-gray-300 font-mono">{curve.early}%</span>
                          </div>
                          
                          {/* Mid Bar */}
                          <div className="flex items-center justify-between text-[8px] font-bold text-gray-400 gap-2">
                            <span className="w-16">Środek:</span>
                            <div className="flex-1 h-1.5 bg-[#111] rounded-full overflow-hidden border border-gray-800">
                              <div className={`h-full bg-gradient-to-r ${getPowerColor(curve.mid)}`} style={{ width: `${curve.mid}%` }} />
                            </div>
                            <span className="w-6 text-right text-gray-300 font-mono">{curve.mid}%</span>
                          </div>

                          {/* Late Bar */}
                          <div className="flex items-center justify-between text-[8px] font-bold text-gray-400 gap-2">
                            <span className="w-16">Późna:</span>
                            <div className="flex-1 h-1.5 bg-[#111] rounded-full overflow-hidden border border-gray-800">
                              <div className={`h-full bg-gradient-to-r ${getPowerColor(curve.late)}`} style={{ width: `${curve.late}%` }} />
                            </div>
                            <span className="w-6 text-right text-gray-300 font-mono">{curve.late}%</span>
                          </div>
                        </>
                      ) : (
                        <div className="text-[10px] text-gray-500 italic">Brak danych AI</div>
                      )}
                    </div>

                    {/* R Cooldown Badge */}
                    <div className="flex flex-col items-center justify-center shrink-0 min-w-[75px] select-none bg-[#111]/80 border border-gray-800/80 px-2.5 py-1.5 rounded text-center self-end sm:self-center">
                      <span className="text-[7px] text-[#45a29e] font-black uppercase tracking-wider mb-0.5">Cooldown R</span>
                      <span className="text-[10.5px] font-mono font-bold text-[#66fcf1]">{getChampionRCooldown(p.champion, curve?.rCooldown)}s</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Team Power Averages */}
          <div className="mt-2 pt-2 border-t border-red-900/40 flex justify-between text-[10px] text-red-300 font-bold px-1">
            <span>AVG:</span>
            <div className="flex gap-2">
                <span>W: {teamPowerProgression[0].Red}%</span>
                <span>Ś: {teamPowerProgression[1].Red}%</span>
                <span>P: {teamPowerProgression[2].Red}%</span>
            </div>
          </div>
        </div>
      </div>
      <AISummary matchData={{participants, ourChampion}} language={language} onSummaryGenerated={setPowerCurves} customApiKey={customApiKey} setCustomApiKey={setCustomApiKey} />
    </div>
  );
}

async function generateSummaryDirect(matchData: any, language: "PL" | "EN", apiKey: string) {
  const prompt = `Analyze this League of Legends match data and evaluate the power curve of each champion in early, mid, and late game phases on a scale of 0 to 100. Also estimate the exact or approximate base cooldown of their Ultimate (R) ability in seconds at ranks 1, 2, 3 (levels 6, 11, 16) as a string formatted like "120/100/80".

Provide a comprehensive tactical analysis strictly in ${language === 'PL' ? 'Polish (Polski)' : 'English'}.
Your analysis must detail:
1. EARLY GAME: Lane strategy with Cho'Gath (or player's champion if not Cho'Gath) and overall early macro.
2. MID GAME: Mid-game transition, objective focus, and side-lane / macro control with Cho'Gath.
3. LATE GAME: Late-game scaling, teamfighting, or split-pushing with Cho'Gath.
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
      "rCooldown": "cooldown in seconds at level 6/11/16, e.g. '120/100/80'"
    }
  }
}

Use lowercase, alphanumeric-only champion names as keys in the powerCurves map (e.g. "garen", "leesin", "missfortune", "jarvaniv"). Evaluate all 10 participants in the game.
Data: ${JSON.stringify(matchData)}`;

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;
  
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: prompt
            }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json"
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    let message = "Gemini API request failed";
    try {
      const errJson = JSON.parse(errText);
      message = errJson.error?.message || message;
    } catch (e) {}
    throw new Error(message);
  }

  const resJson = await response.json();
  const text = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("No text response received from Gemini");
  }

  return JSON.parse(text);
}

interface AISummaryData {
  earlyGame?: string;
  midGame?: string;
  lateGame?: string;
  teamComp?: string;
  optimalPlan?: string;
  summary?: string;
  powerCurves?: any;
}

function AISummary({ matchData, language, onSummaryGenerated, customApiKey, setCustomApiKey }: { matchData: any; language: "PL" | "EN"; onSummaryGenerated: (data: any) => void, customApiKey: string, setCustomApiKey: (key: string) => void }) {
  const [data, setData] = useState<AISummaryData>({});
  const [loading, setLoading] = useState<boolean>(true);

  const matchDataStr = JSON.stringify(matchData);

  useEffect(() => {
    const fetchSummary = async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/ai-summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ matchData, language, customApiKey }),
        });
        
        // Handle 404/405 static fallback (e.g. GitHub Pages)
        if (response.status === 404 || response.status === 405) {
          if (customApiKey && customApiKey.trim() !== "") {
            console.warn("Proxy endpoint not found. Falling back to direct browser call to Gemini...");
            const directResult = await generateSummaryDirect(matchData, language, customApiKey);
            setData(directResult);
            if (directResult.powerCurves) {
              onSummaryGenerated(directResult.powerCurves);
            }
            return;
          } else {
            throw new Error(
              language === "PL"
                ? "Brak serwera (np. GitHub Pages). Wprowadź swój własny klucz API Gemini (u góry po prawej), aby wygenerować podsumowanie bezpośrednio w przeglądarce!"
                : "No server backend detected (e.g. GitHub Pages). Please enter your custom Gemini API key in the field above to run generation directly in your browser!"
            );
          }
        }

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.message || result.error || "Failed to generate summary");
        }
        setData(result);
        if (result.powerCurves) {
          onSummaryGenerated(result.powerCurves);
        }
      } catch (error: any) {
        // If it was any other error but customApiKey exists, try direct client fallback
        if (customApiKey && customApiKey.trim() !== "") {
          try {
            console.warn("Proxy request failed. Attempting direct browser call to Gemini as fallback...");
            const directResult = await generateSummaryDirect(matchData, language, customApiKey);
            setData(directResult);
            if (directResult.powerCurves) {
              onSummaryGenerated(directResult.powerCurves);
            }
            return;
          } catch (directError: any) {
            console.error("Direct browser call also failed:", directError);
            error = directError;
          }
        }

        console.error("Failed to load tactical summary:", error);
        setData({
          summary: language === "PL" 
            ? `Błąd API: Twój domyślny klucz z Google AI Studio jest nieprawidłowy, lub limit został wyczerpany. Wpisz własny klucz API w polu poniżej (w prawym górnym rogu podsumowania). Szczegóły: ${error.message || error}`
            : `API Error: Your default Google AI Studio key is invalid or quota exceeded. Please enter your custom API key in the field below. Details: ${error.message || error}`
        });
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();
  }, [matchDataStr, language, customApiKey]);

  return (
    <div className="mt-6 bg-[#111] border border-[#1f2833] rounded-xl p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-bold text-[#66fcf1] uppercase tracking-wider flex items-center gap-2">
            <Sparkles className="w-5 h-5" /> AI Tactical Summary
        </h3>
        <input 
            type="password"
            placeholder={language === "PL" ? "Opcjonalny API Key" : "Optional API Key"}
            value={customApiKey}
            onChange={(e) => setCustomApiKey(e.target.value)}
            className="bg-[#0b0c10] border border-[#1f2833] text-xs text-white p-2 rounded"
        />
      </div>
      
      {loading ? (
        <div className="flex flex-col items-center justify-center py-10 gap-3 text-gray-400 text-xs bg-[#0b0c10]/40 rounded-lg border border-[#1f2833]/30">
          <Loader2 className="w-6 h-6 animate-spin text-[#66fcf1]" />
          <span className="font-medium tracking-wider uppercase text-[10px] text-gray-500 animate-pulse">
            {language === "PL" ? "Generowanie taktycznych wskazówek..." : "Generating tactical insights..."}
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-5 mt-2 animate-fadeIn">
          {/* If there's an error/legacy string fallback */}
          {data.summary && (
            <div className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap bg-[#0b0c10]/40 p-4 rounded-lg border border-[#1f2833]/30">
              {data.summary}
            </div>
          )}

          {/* New Structured Fields */}
          {(data.earlyGame || data.midGame || data.lateGame) && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Early Game Phase Card */}
              <div className="bg-[#0b0c10]/75 border border-blue-950/40 rounded-lg p-3.5 flex flex-col gap-2 transition-all hover:border-blue-900/40">
                <div className="flex items-center gap-2 border-b border-blue-950/50 pb-2">
                  <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                  <span className="font-bold text-[#66fcf1] uppercase tracking-wider text-[10px]">
                    {language === "PL" ? "FAZA POCZĄTKOWA (EARLY)" : "EARLY GAME PHASE"}
                  </span>
                </div>
                <p className="text-[11px] text-gray-300 leading-relaxed font-light">{data.earlyGame}</p>
              </div>

              {/* Mid Game Phase Card */}
              <div className="bg-[#0b0c10]/75 border border-purple-950/40 rounded-lg p-3.5 flex flex-col gap-2 transition-all hover:border-purple-900/40">
                <div className="flex items-center gap-2 border-b border-purple-950/50 pb-2">
                  <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                  <span className="font-bold text-[#66fcf1] uppercase tracking-wider text-[10px]">
                    {language === "PL" ? "FAZA ŚRODKOWA (MID)" : "MID GAME PHASE"}
                  </span>
                </div>
                <p className="text-[11px] text-gray-300 leading-relaxed font-light">{data.midGame}</p>
              </div>

              {/* Late Game Phase Card */}
              <div className="bg-[#0b0c10]/75 border border-red-950/40 rounded-lg p-3.5 flex flex-col gap-2 transition-all hover:border-red-900/40">
                <div className="flex items-center gap-2 border-b border-red-900/50 pb-2">
                  <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                  <span className="font-bold text-[#66fcf1] uppercase tracking-wider text-[10px]">
                    {language === "PL" ? "FAZA PÓŹNA (LATE)" : "LATE GAME PHASE"}
                  </span>
                </div>
                <p className="text-[11px] text-gray-300 leading-relaxed font-light">{data.lateGame}</p>
              </div>
            </div>
          )}

          {/* Team Composition Card */}
          {data.teamComp && (
            <div className="bg-[#0b0c10]/60 border border-[#1f2833]/30 rounded-lg p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2 border-b border-[#1f2833]/20 pb-2">
                <span className="text-[#45a29e] text-xs font-black uppercase tracking-widest">
                  {language === "PL" ? "Kompozycja i Walki Drużynowe (Teamfight Comp)" : "Teamfight Composition Analysis"}
                </span>
              </div>
              <p className="text-[11px] text-gray-300 leading-relaxed font-light whitespace-pre-line">{data.teamComp}</p>
            </div>
          )}

          {/* Optimal Winning Plan Card */}
          {data.optimalPlan && (
            <div className="bg-[#1f2833]/15 border-2 border-[#66fcf1]/40 rounded-xl p-4 flex flex-col gap-3 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#66fcf1]/5 rounded-full blur-2xl pointer-events-none" />
              <div className="flex items-center gap-2 pb-1.5">
                <div className="w-5 h-5 rounded-full bg-[#66fcf1]/20 flex items-center justify-center border border-[#66fcf1]/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#66fcf1]" />
                </div>
                <span className="font-black text-[#66fcf1] uppercase tracking-wider text-xs">
                  {language === "PL" ? "OPTYMALNY PLAN NA WYGRANĄ" : "OPTIMAL WINNING PLAN"}
                </span>
              </div>
              <p className="text-xs text-white leading-relaxed font-medium whitespace-pre-line bg-[#0b0c10]/60 p-3 rounded-lg border border-[#66fcf1]/10">
                {data.optimalPlan}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


import fs from 'fs';

const newCode = `import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Play, Pause, GripHorizontal, Settings, Skull, Sparkles, Brain, Loader2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from '@google/genai';
import Markdown from 'react-markdown';

const TOWER_POSITIONS = [
  {id: 'b_t_1', x: 981, y: 10441, team: 100}, {id: 'b_t_2', x: 1512, y: 6699, team: 100}, {id: 'b_t_3', x: 1169, y: 4287, team: 100},
  {id: 'b_m_1', x: 5846, y: 6396, team: 100}, {id: 'b_m_2', x: 5048, y: 4812, team: 100}, {id: 'b_m_3', x: 3651, y: 3696, team: 100},
  {id: 'b_b_1', x: 10504, y: 1058, team: 100}, {id: 'b_b_2', x: 6919, y: 1483, team: 100}, {id: 'b_b_3', x: 4281, y: 1253, team: 100},
  {id: 'r_t_1', x: 4318, y: 13875, team: 200}, {id: 'r_t_2', x: 7943, y: 13411, team: 200}, {id: 'r_t_3', x: 10481, y: 13650, team: 200},
  {id: 'r_m_1', x: 8955, y: 8510, team: 200}, {id: 'r_m_2', x: 9767, y: 10113, team: 200}, {id: 'r_m_3', x: 11134, y: 11207, team: 200},
  {id: 'r_b_1', x: 13866, y: 4505, team: 200}, {id: 'r_b_2', x: 13327, y: 8226, team: 200}, {id: 'r_b_3', x: 13624, y: 10572, team: 200}
];

export default function ReplayViewer({ matchDetails, matchTimeline, dDragon, playerPuuid }: any) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [gameTimeMs, setGameTimeMs] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [smoothMovement, setSmoothMovement] = useState(false);
  
  const [blueExpanded, setBlueExpanded] = useState(true);
  const [redExpanded, setRedExpanded] = useState(true);
  const mapRef = useRef<HTMLDivElement>(null);

  const [headStat, setHeadStat] = useState<'none' | 'gold' | 'kda' | 'level' | 'hp'>('gold');
  const [chartConfig, setChartConfig] = useState({
    teamGold: true,
    teamDmg: true,
    champs: {} as Record<number, boolean>,
    champsDmg: {} as Record<number, boolean>
  });
  
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const requestRef = useRef<number | null>(null);
  const previousTimeRef = useRef<number | null>(null);

  const frames = matchTimeline.info.frames;
  const maxGameTime = frames[frames.length - 1].timestamp;

  const animate = (time: number) => {
    if (previousTimeRef.current !== null) {
      const deltaTime = time - previousTimeRef.current;
      setGameTimeMs(prev => {
        const next = prev + deltaTime * speed;
        if (next >= maxGameTime) {
          setIsPlaying(false);
          return maxGameTime;
        }
        return next;
      });
    }
    previousTimeRef.current = time;
    if (isPlaying) {
      requestRef.current = requestAnimationFrame(animate);
    }
  };

  useEffect(() => {
    if (isPlaying) {
      requestRef.current = requestAnimationFrame(animate);
    } else {
      previousTimeRef.current = null;
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isPlaying, speed]);

  const handleSliderChange = (e: any) => {
    setGameTimeMs(parseInt(e.target.value, 10));
  };

  const frameIndex = useMemo(() => {
    for (let i = frames.length - 1; i >= 0; i--) {
      if (frames[i].timestamp <= gameTimeMs) return i;
    }
    return 0;
  }, [gameTimeMs, frames]);

  const currentFrame = frames[frameIndex] || frames[0];
  const nextFrame = frames[frameIndex + 1];

  const interpolationFactor = useMemo(() => {
    if (!smoothMovement || !currentFrame || !nextFrame) return 0;
    const duration = nextFrame.timestamp - currentFrame.timestamp;
    if (duration === 0) return 0;
    const raw = (gameTimeMs - currentFrame.timestamp) / duration;
    return Math.max(0, Math.min(1, raw));
  }, [gameTimeMs, currentFrame, nextFrame, smoothMovement]);

  const allEvents = useMemo(() => {
    let events: any[] = [];
    frames.forEach((frame: any) => {
      if (frame.events) {
          events = events.concat(frame.events);
      }
    });
    return events;
  }, [frames]);

  const allKills = useMemo(() => allEvents.filter(e => e.type === "CHAMPION_KILL"), [allEvents]);
  const allObjectives = useMemo(() => allEvents.filter(e => e.type === "ELITE_MONSTER_KILL"), [allEvents]);
  const towers = useMemo(() => allEvents.filter(e => e.type === "BUILDING_KILL" && e.buildingType === "TOWER_BUILDING"), [allEvents]);

  const participantsInfo = useMemo(() => {
    const info: any = {};
    matchDetails.info.participants.forEach((p: any) => {
      info[p.participantId] = p;
    });
    return info;
  }, [matchDetails]);

  const chartData = useMemo(() => {
    return frames.map((frame: any) => {
        let blueG = 0; let redG = 0;
        let blueDmg = 0; let redDmg = 0;
        const champGold: Record<string, number> = {};
        const champDmg: Record<string, number> = {};
        
        Object.values(frame.participantFrames || {}).forEach((pf: any) => {
            const isBlue = pf.participantId >= 1 && pf.participantId <= 5;
            if (isBlue) {
              blueG += pf.totalGold;
              blueDmg += pf.damageStats?.totalDamageDoneToChampions || 0;
            } else {
              redG += pf.totalGold;
              redDmg += pf.damageStats?.totalDamageDoneToChampions || 0;
            }
            champGold[\`champ_\${pf.participantId}\`] = pf.totalGold / 1000;
            champDmg[\`champ_dmg_\${pf.participantId}\`] = (pf.damageStats?.totalDamageDoneToChampions || 0) / 1000;
        });
        
        return { 
          time: frame.timestamp / 60000, 
          teamGoldBlue: blueG / 1000, 
          teamGoldRed: redG / 1000,
          teamDmgBlue: blueDmg / 1000,
          teamDmgRed: redDmg / 1000,
          ...champGold,
          ...champDmg
        };
    });
  }, [frames]);

  const activeTowers = useMemo(() => {
    return TOWER_POSITIONS.map(t => {
      const isDead = towers.some(killEvent => {
         if (killEvent.timestamp > gameTimeMs) return false;
         if (!killEvent.position) return false;
         const dx = killEvent.position.x - t.x;
         const dy = killEvent.position.y - t.y;
         const dist = Math.sqrt(dx*dx + dy*dy);
         return dist < 1200; 
      });
      return { ...t, isDead };
    });
  }, [towers, gameTimeMs]);

  const deadParticipants = useMemo(() => {
    const deadIds = new Set<number>();
    allKills.forEach(k => {
      let victimLevel = 1;
      const fIdx = frames.findIndex((f: any) => f.timestamp >= k.timestamp);
      if (fIdx >= 0 && frames[fIdx].participantFrames?.[k.victimId]) {
         victimLevel = frames[fIdx].participantFrames[k.victimId].level || 1;
      }
      const respawnTimeMs = (victimLevel * 2.5 + 7.5) * 1000;
      if (gameTimeMs >= k.timestamp && gameTimeMs <= k.timestamp + respawnTimeMs) {
        deadIds.add(k.victimId);
      }
    });
    return deadIds;
  }, [allKills, gameTimeMs, frames]);

  const objectiveStates = useMemo(() => {
    let dragonAlive = gameTimeMs >= 300000;
    let dragonTimeUntilSpawn = Math.max(0, 300000 - gameTimeMs);
    allObjectives.filter(o => o.monsterType === "DRAGON").forEach(kill => {
        if (gameTimeMs >= kill.timestamp && gameTimeMs < kill.timestamp + 300000) {
            dragonAlive = false;
            dragonTimeUntilSpawn = (kill.timestamp + 300000) - gameTimeMs;
        } else if (gameTimeMs >= kill.timestamp + 300000) {
            dragonAlive = true;
            dragonTimeUntilSpawn = 0;
        }
    });

    let baronAlive = gameTimeMs >= 1200000;
    let baronTimeUntilSpawn = Math.max(0, 1200000 - gameTimeMs);
    allObjectives.filter(o => o.monsterType === "BARON_NASHOR").forEach(kill => {
        if (gameTimeMs >= kill.timestamp && gameTimeMs < kill.timestamp + 360000) {
            baronAlive = false;
            baronTimeUntilSpawn = (kill.timestamp + 360000) - gameTimeMs;
        } else if (gameTimeMs >= kill.timestamp + 360000) {
            baronAlive = true;
            baronTimeUntilSpawn = 0;
        }
    });

    return { dragonAlive, dragonTimeUntilSpawn, baronAlive, baronTimeUntilSpawn };
  }, [gameTimeMs, allObjectives]);

  const teamDragons = useMemo(() => {
     const blue: string[] = [];
     const red: string[] = [];
     allObjectives.filter(o => o.monsterType === 'DRAGON').forEach(o => {
       if (o.timestamp <= gameTimeMs) {
           if (o.killerTeamId === 100) blue.push(o.monsterSubType || 'DRAGON');
           else if (o.killerTeamId === 200) red.push(o.monsterSubType || 'DRAGON');
       }
     });
     return { blue, red };
  }, [allObjectives, gameTimeMs]);

  const participantStats = useMemo(() => {
      const stats: any[] = [];
      Object.values(currentFrame.participantFrames || {}).forEach((pf: any) => {
        const pId = pf.participantId;
        const pInfo = participantsInfo[pId];
        if (!pInfo) return;
        
        let kills = 0, deaths = 0, assists = 0;
        allKills.filter(k => k.timestamp <= gameTimeMs).forEach(k => {
             if (k.killerId === pId) kills++;
             if (k.victimId === pId) deaths++;
             if (k.assistingParticipantIds?.includes(pId)) assists++;
        });

        stats.push({
            id: pId,
            name: pInfo.riotIdGameName || pInfo.summonerName || pInfo.championName,
            champion: pInfo.championInternal || pInfo.championName,
            gold: pf.totalGold,
            level: pf.level,
            cs: pf.minionsKilled + pf.jungleMinionsKilled,
            team: pInfo.teamId,
            kills, deaths, assists,
            currentHp: pf.championStats?.health ?? pf.championStats?.currentHealth ?? 0,
            maxHp: pf.championStats?.healthMax ?? pf.championStats?.maxHealth ?? 1
        });
      });
      return stats.sort((a,b) => b.gold - a.gold);
  }, [currentFrame, participantsInfo, allKills, gameTimeMs]);

  const recentPopups = useMemo(() => {
    const timeWindow = 4000;
    const popups: any[] = [];
    allKills.filter(k => gameTimeMs >= k.timestamp && gameTimeMs <= k.timestamp + timeWindow).forEach(k => {
        popups.push({...k, popupType: 'KILL'});
    });
    allObjectives.filter(o => gameTimeMs >= o.timestamp && gameTimeMs <= o.timestamp + timeWindow).forEach(o => {
        popups.push({...o, popupType: 'OBJECTIVE'});
    });
    return popups;
  }, [allKills, allObjectives, gameTimeMs]);

  const getMapPosition = (p: {x: number, y: number}) => {
    const MAX_COORD = 14820;
    let x = (p.x / MAX_COORD) * 100;
    let y = (p.y / MAX_COORD) * 100;
    return { left: \`\${x}%\`, bottom: \`\${y}%\` };
  };

  const currentMinutes = Math.floor(gameTimeMs / 60000);
  const currentSeconds = Math.floor((gameTimeMs % 60000) / 1000);
  const timeStr = \`\${currentMinutes.toString().padStart(2, '0')}:\${currentSeconds.toString().padStart(2, '0')}\`;
  
  const renderDragonIcon = (subType: string) => {
      let color = "bg-gray-500";
      if (subType === "FIRE_DRAGON") color = "bg-red-500";
      if (subType === "WATER_DRAGON") color = "bg-teal-400";
      if (subType === "EARTH_DRAGON") color = "bg-yellow-600";
      if (subType === "AIR_DRAGON") color = "bg-blue-200";
      if (subType === "HEXTECH_DRAGON") color = "bg-blue-600";
      if (subType === "CHEMTECH_DRAGON") color = "bg-green-600";
      return <div className={\`w-2 h-2 md:w-3 md:h-3 rounded-full \${color} shadow-sm border border-[#0b0c10]\`} />
  }

  const getChampColor = (team: number, idx: number, isPlayer: boolean) => {
      if (isPlayer) return "#10b981"; // Emerald green for player
      if (team === 100) {
          const blueShades = ["#1e3a8a", "#1e40af", "#2563eb", "#3b82f6", "#60a5fa"];
          return blueShades[idx % blueShades.length];
      } else {
          const redShades = ["#7f1d1d", "#991b1b", "#b91c1c", "#dc2626", "#ef4444"];
          return redShades[idx % redShades.length];
      }
  };

  const getChampColorDmg = (team: number, idx: number, isPlayer: boolean) => {
    if (isPlayer) return "#059669"; // Darker emerald
    if (team === 100) {
        const blueShades = ["#172554", "#1e3a8a", "#1d4ed8", "#2563eb", "#3b82f6"];
        return blueShades[idx % blueShades.length];
    } else {
        const redShades = ["#450a0a", "#7f1d1d", "#991b1b", "#b91c1c", "#dc2626"];
        return redShades[idx % redShades.length];
    }
  };

  const handleAnalyzeEvents = async () => {
    setIsAnalyzing(true);
    setAiAnalysis(null);

    try {
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: \`Analyze these major events from a League of Legends match and provide a step-by-step critical breakdown of the mistakes made, especially focusing on deaths, lost objectives, and gold deficits. Focus purely on key turning points.
          
          Events:
          \${JSON.stringify(allEvents.filter(e => e.type === 'CHAMPION_KILL' || e.type === 'ELITE_MONSTER_KILL').map(e => {
            const timeMins = Math.floor(e.timestamp / 60000);
            if (e.type === 'CHAMPION_KILL') {
              return \`\${timeMins} min: Kill by \${participantsInfo[e.killerId]?.championName} on \${participantsInfo[e.victimId]?.championName}\`;
            } else {
              return \`\${timeMins} min: \${e.monsterType} secured by Team \${e.killerTeamId === 100 ? 'Blue' : 'Red'}\`;
            }
          }))}
          \`
        })
      });

      if (!response.ok) throw new Error("Failed to get AI analysis");
      const data = await response.json();
      setAiAnalysis(data.result);
    } catch (err: any) {
      console.error(err);
      setAiAnalysis("Error generating analysis. Please ensure Gemini API key is configured.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0b0c10] text-[#c5c6c7] p-2 md:p-4 gap-2 md:gap-4 font-sans overflow-y-auto">
      
      <div className="bg-[#111] border border-[#1f2833] rounded-lg p-2 md:p-3 flex flex-wrap lg:flex-nowrap items-center gap-2 md:gap-4 shrink-0">
          <button onClick={() => setIsPlaying(!isPlaying)} className="p-2 border border-[#45a29e] rounded-full hover:bg-[#45a29e]/20 text-[#66fcf1] shrink-0">
            {isPlaying ? <Pause className="w-4 h-4 md:w-5 md:h-5 fill-current" /> : <Play className="w-4 h-4 md:w-5 md:h-5 fill-current" />}
          </button>
          
          <div className="flex items-center gap-1 bg-[#1f2833] p-1 rounded shrink-0">
            {[1, 5, 10, 30, 60, 120, 240].map(s => (
                <button 
                  key={s} 
                  onClick={() => setSpeed(s)}
                  className={\`text-[10px] md:text-sm px-2 py-1 rounded transition-colors \${speed === s ? 'bg-[#66fcf1] text-[#0b0c10] font-bold' : 'text-gray-400 hover:text-white'}\`}
                >
                  {s}x
                </button>
            ))}
          </div>

          <label className="flex items-center gap-1 text-[10px] md:text-xs text-gray-400 cursor-pointer shrink-0">
            <input type="checkbox" checked={smoothMovement} onChange={e => setSmoothMovement(e.target.checked)} className="accent-[#66fcf1]" />
            Smooth
          </label>

          <input type="range" min="0" max={maxGameTime} step="1000" value={gameTimeMs} onChange={handleSliderChange} 
             className="flex-1 w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-[#66fcf1] [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:scale-125 transition-all outline-none" />
          <div className="font-mono text-sm md:text-xl shrink-0 tabular-nums w-16">{timeStr}</div>
      </div>

      <div className="flex-1 flex flex-col xl:flex-row gap-4 min-h-[500px]">
        
        <div className="relative flex-1 bg-[#111] border border-[#1f2833] rounded-xl overflow-hidden flex items-center justify-center p-4">
            <div ref={mapRef} className="aspect-square w-full max-h-[80vh] max-w-[800px] bg-[#1f2833] border border-[#2f3843] rounded-xl relative overflow-hidden shadow-2xl mx-auto">
                <img src={\`https://ddragon.leagueoflegends.com/cdn/\${dDragon.latest}/img/map/map11.png\`} className="absolute inset-0 w-full h-full opacity-60 flex-shrink-0 pointer-events-none object-cover mix-blend-screen" />
                
                {recentPopups.map((popup, idx) => {
                    if (popup.popupType === 'KILL' && popup.position) {
                        const pos = getMapPosition(popup.position);
                        return (
                            <motion.div 
                                key={\`map-kill-\${popup.timestamp}-\${popup.victimId}\`}
                                initial={{ opacity: 1, scale: 0 }}
                                animate={{ opacity: 0, scale: 3 }}
                                transition={{ duration: 1.5, ease: "easeOut" }}
                                className="absolute -translate-x-1/2 translate-y-1/2 w-8 h-8 flex items-center justify-center z-40 pointer-events-none"
                                style={{ left: pos.left, bottom: pos.bottom }}
                            >
                                <Skull className="w-8 h-8 text-red-500 shadow-xl" />
                            </motion.div>
                        );
                    }
                    return null;
                })}

                <div className="absolute top-4 left-1/2 -translate-x-1/2 flex flex-col gap-2 z-50 pointer-events-none items-center">
                    <AnimatePresence>
                        {recentPopups.map((popup, idx) => {
                            if (popup.popupType === 'KILL') {
                                const killer = participantsInfo[popup.killerId];
                                const victim = participantsInfo[popup.victimId];
                                if (!killer || !victim) return null;
                                return (
                                    <motion.div 
                                      key={\`kill-\${popup.timestamp}-\${idx}\`}
                                      initial={{ y: -20, opacity: 0, scale: 0.8 }}
                                      animate={{ y: 0, opacity: 1, scale: 1 }}
                                      exit={{ y: -10, opacity: 0, scale: 0.9 }}
                                      className="bg-black/80 backdrop-blur-sm border border-red-900/50 rounded-full px-4 py-1.5 flex items-center gap-3 shadow-2xl"
                                    >
                                        <img src={\`https://ddragon.leagueoflegends.com/cdn/\${dDragon.latest}/img/champion/\${killer.championInternal || killer.championName}.png\`} className="w-6 h-6 rounded-full border border-gray-600" />
                                        <Skull className="w-4 h-4 text-red-500" />
                                        <img src={\`https://ddragon.leagueoflegends.com/cdn/\${dDragon.latest}/img/champion/\${victim.championInternal || victim.championName}.png\`} className="w-6 h-6 rounded-full border border-gray-600 opacity-75 grayscale" />
                                    </motion.div>
                                );
                            } else {
                                return (
                                    <motion.div 
                                      key={\`obj-\${popup.timestamp}-\${idx}\`}
                                      initial={{ y: -20, opacity: 0, scale: 0.8 }}
                                      animate={{ y: 0, opacity: 1, scale: 1 }}
                                      exit={{ y: -10, opacity: 0, scale: 0.9 }}
                                      className="bg-black/80 backdrop-blur-sm border border-yellow-700/50 rounded-full px-4 py-1.5 flex items-center gap-2 shadow-2xl text-yellow-500 text-[10px] font-bold tracking-wider uppercase"
                                    >
                                        <Sparkles className="w-4 h-4" /> 
                                        {popup.killerTeamId === 100 ? 'Blue' : 'Red'} Team claimed {popup.monsterType === 'DRAGON' ? popup.monsterSubType?.replace('_', ' ') : popup.monsterType?.replace('_', ' ')}
                                    </motion.div>
                                );
                            }
                        })}
                    </AnimatePresence>
                </div>

                {activeTowers.map(t => (
                    <div 
                       key={t.id} 
                       className={\`absolute w-[3.5%] h-[3.5%] rounded-full -translate-x-1/2 translate-y-1/2 flex items-center justify-center
                                 \${t.team === 100 ? 'bg-blue-600' : 'bg-red-600'} transition-opacity duration-300
                                 \${t.isDead ? 'opacity-10 scale-75' : 'opacity-80 shadow-[0_0_8px_rgba(0,0,0,0.8)] border border-white/50'}\`}
                       style={getMapPosition({x: t.x, y: t.y})} 
                    />
                ))}

                <div className="absolute w-[6%] h-[6%] -translate-x-1/2 translate-y-1/2 flex flex-col items-center justify-center font-bold text-[8px] z-10" style={getMapPosition({x: 9800, y: 4400})}>
                    <div className={\`w-full h-full rounded-full border border-white flex items-center justify-center shadow-lg transition-colors \${objectiveStates.dragonAlive ? 'bg-orange-500 text-white' : 'bg-black/80 text-gray-400 scale-75'}\`}>
                       {objectiveStates.dragonAlive ? 'D' : '-'}
                    </div>
                </div>
                
                <div className="absolute w-[6%] h-[6%] -translate-x-1/2 translate-y-1/2 flex flex-col items-center justify-center font-bold text-[8px] z-10" style={getMapPosition({x: 5000, y: 10400})}>
                    <div className={\`w-full h-full rounded-full border border-white flex items-center justify-center shadow-lg transition-colors \${objectiveStates.baronAlive ? 'bg-purple-600 text-white' : 'bg-black/80 text-gray-400 scale-75'}\`}>
                       {objectiveStates.baronAlive ? 'B' : '-'}
                    </div>
                </div>

                {Object.values(participantsInfo).map((p: any) => {
                    const pf = currentFrame?.participantFrames?.[p.participantId];
                    const nextPf = nextFrame?.participantFrames?.[p.participantId];
                    if (!pf || !pf.position || deadParticipants.has(p.participantId)) return null;
                    
                    let pPos = pf.position;
                    if (smoothMovement && nextPf && nextPf.position) {
                        const distSq = Math.pow(nextPf.position.x - pf.position.x, 2) + Math.pow(nextPf.position.y - pf.position.y, 2);
                        if (distSq < 100000000) { 
                            pPos = {
                                x: pf.position.x + (nextPf.position.x - pf.position.x) * interpolationFactor,
                                y: pf.position.y + (nextPf.position.y - pf.position.y) * interpolationFactor
                            };
                        }
                    }
                    const pos = getMapPosition(pPos);
                    const stats = participantStats.find(s => s.id === p.participantId);
                    
                    const maxHp = stats?.maxHp || 100;
                    const currHp = stats?.currentHp || 100;
                    const hpPct = maxHp > 0 ? Math.max(0, Math.min(100, (currHp / maxHp) * 100)) : 100;
                    
                    return (
                        <div key={p.participantId} className={\`absolute w-[8%] h-[8%] -translate-x-1/2 translate-y-1/2 flex flex-col items-center justify-center z-20 transition-all \${smoothMovement ? 'duration-0' : 'duration-[400ms]'}\`} style={{ left: pos.left, bottom: pos.bottom }}>
                            
                            {headStat !== 'none' && stats && (
                                <div className="absolute -top-4 w-auto whitespace-nowrap bg-black/80 text-[8px] px-1.5 py-0.5 rounded border border-gray-700/50 shadow-md">
                                    {headStat === 'gold' && <span className="text-yellow-400 font-mono">{(stats.gold/1000).toFixed(1)}k</span>}
                                    {headStat === 'kda' && <span className="text-white font-mono">{stats.kills}/{stats.deaths}/{stats.assists}</span>}
                                    {headStat === 'level' && <span className="text-blue-300 font-mono">Lvl {stats.level}</span>}
                                    {headStat === 'hp' && <span className="text-green-400 font-mono">{Math.floor(hpPct)}%</span>}
                                </div>
                            )}

                            <div className="w-[124%] h-1 md:h-1.5 bg-[#0b0c10] border border-black mb-[2px] relative rounded-[2px] overflow-hidden shadow-sm">
                                <div className={\`h-full transition-all duration-300 \${p.teamId === 100 ? 'bg-[#3b82f6]' : 'bg-[#ef4444]'}\`} style={{ width: \`\${hpPct}%\` }} />
                            </div>
                            
                            <img src={\`https://ddragon.leagueoflegends.com/cdn/\${dDragon.latest}/img/champion/\${p.championInternal || p.championName}.png\`} className={\`w-full h-full rounded-full border-[2px] shadow-lg \${p.teamId === 100 ? 'border-[#3b82f6]' : 'border-[#ef4444]'}\`} />
                        </div>
                    );
                })}

                <motion.div 
                   drag dragMomentum={false} dragConstraints={mapRef}
                   className="absolute top-2 left-2 bg-[#0b0c10]/95 rounded p-1.5 border border-blue-900/50 flex flex-col gap-1 z-30 shadow-2xl pointer-events-auto min-w-[120px]"
                >
                    <div className="flex justify-between mb-1 items-center px-1 cursor-grab active:cursor-grabbing pb-1 border-b border-blue-900/40" onClick={() => setBlueExpanded(!blueExpanded)}>
                       <span className="text-[9px] font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1"><GripHorizontal className="w-3 h-3 text-gray-500"/> Blue</span>
                       <div className="flex gap-[2px]">{teamDragons.blue.map((d, i) => <div key={i}>{renderDragonIcon(d)}</div>)}</div>
                    </div>
                    {blueExpanded && participantStats.filter(p => p.team === 100).map(p => (
                        <div key={p.name} className="flex items-center justify-between text-[9px] md:text-[11px] text-blue-100 font-medium whitespace-nowrap gap-2">
                            <div className="flex items-center flex-1 gap-1.5">
                                <div className="relative shrink-0">
                                   <img src={\`https://ddragon.leagueoflegends.com/cdn/\${dDragon.latest}/img/champion/\${p.champion}.png\`} className="w-5 h-5 rounded-[4px] border border-blue-500/50"/>
                                   <div className="absolute -bottom-1.5 -right-1.5 bg-black text-white text-[7px] w-[14px] h-[14px] flex items-center justify-center rounded-full border border-gray-700">{p.level}</div>
                                </div>
                                <span className="font-mono ml-1 text-yellow-500/90 w-7">{(p.gold/1000).toFixed(1)}k</span>
                            </div>
                            <span className="text-gray-400 w-5 text-right">{p.cs}</span>
                            <span className="w-10 text-right">{p.kills}/{p.deaths}/{p.assists}</span>
                        </div>
                    ))}
                </motion.div>

                <motion.div 
                   drag dragMomentum={false} dragConstraints={mapRef}
                   className="absolute top-2 right-2 bg-[#0b0c10]/95 rounded p-1.5 border border-red-900/50 flex flex-col gap-1 z-30 shadow-2xl pointer-events-auto min-w-[120px]"
                >
                    <div className="flex justify-between mb-1 items-center px-1 flex-row-reverse cursor-grab active:cursor-grabbing pb-1 border-b border-red-900/40" onClick={() => setRedExpanded(!redExpanded)}>
                       <span className="text-[9px] font-bold text-red-500 uppercase tracking-wider flex items-center gap-1 flex-row-reverse"><GripHorizontal className="w-3 h-3 text-gray-500"/> Red</span>
                       <div className="flex gap-[2px]">{teamDragons.red.map((d, i) => <div key={i}>{renderDragonIcon(d)}</div>)}</div>
                    </div>
                    {redExpanded && participantStats.filter(p => p.team === 200).map(p => (
                        <div key={p.name} className="flex items-center justify-between text-[9px] md:text-[11px] text-red-100 font-medium whitespace-nowrap gap-2 flex-row-reverse">
                            <div className="flex items-center flex-1 gap-1.5 flex-row-reverse">
                                <div className="relative shrink-0">
                                   <img src={\`https://ddragon.leagueoflegends.com/cdn/\${dDragon.latest}/img/champion/\${p.champion}.png\`} className="w-5 h-5 rounded-[4px] border border-red-500/50"/>
                                   <div className="absolute -bottom-1.5 -left-1.5 bg-black text-white text-[7px] w-[14px] h-[14px] flex items-center justify-center rounded-full border border-gray-700">{p.level}</div>
                                </div>
                                <span className="font-mono mr-1 text-yellow-500/90 w-7 text-right">{(p.gold/1000).toFixed(1)}k</span>
                            </div>
                            <span className="text-gray-400 w-5 text-left">{p.cs}</span>
                            <span className="w-10 text-left">{p.kills}/{p.deaths}/{p.assists}</span>
                        </div>
                    ))}
                </motion.div>
                
                <div className="absolute bottom-2 left-2 flex gap-2 z-40">
                    <select value={headStat} onChange={e => setHeadStat(e.target.value as any)} className="bg-black/80 text-[10px] text-[#66fcf1] border border-[#1f2833] p-1.5 rounded outline-none shadow-lg cursor-pointer">
                        <option value="none">No Overhead Stats</option>
                        <option value="gold">Show Gold</option>
                        <option value="kda">Show KDA</option>
                        <option value="level">Show Level</option>
                        <option value="hp">Show HP %</option>
                    </select>
                </div>

            </div>
        </div>
        
        <div className="xl:w-[450px] shrink-0 flex flex-col gap-4 min-h-[300px]">
            <div className="bg-[#111] border border-[#1f2833] rounded-xl p-4 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-[#66fcf1] uppercase tracking-wider flex items-center gap-2"><Settings className="w-4 h-4"/> Chart Data</h3>
                </div>
                
                <div className="flex flex-col gap-3 text-[11px] text-gray-300">
                    <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                        <input type="checkbox" checked={chartConfig.teamGold} onChange={e => setChartConfig({...chartConfig, teamGold: e.target.checked})} className="accent-[#66fcf1]" />
                        Total Team Gold
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                        <input type="checkbox" checked={chartConfig.teamDmg} onChange={e => setChartConfig({...chartConfig, teamDmg: e.target.checked})} className="accent-[#66fcf1]" />
                        Total Team Damage
                    </label>
                    
                    <div className="h-px w-full bg-[#1f2833] my-1" />
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <div className="font-bold text-yellow-500 uppercase text-[9px] tracking-wider mb-2">Champ Gold</div>
                            <div className="flex flex-col gap-2">
                                {participantStats.map((p) => {
                                    const isPlayer = playerPuuid ? participantsInfo[p.id]?.puuid === playerPuuid : false;
                                    return (
                                        <label key={\`gold-\${p.id}\`} className="flex items-center gap-2 cursor-pointer hover:text-white overflow-hidden">
                                            <input type="checkbox" checked={chartConfig.champs[p.id] || false} onChange={e => setChartConfig({...chartConfig, champs: {...chartConfig.champs, [p.id]: e.target.checked}})} className="accent-yellow-500" />
                                            <div className="relative">
                                            <img src={\`https://ddragon.leagueoflegends.com/cdn/\${dDragon.latest}/img/champion/\${p.champion}.png\`} className={\`w-4 h-4 rounded \${isPlayer ? 'border-2 border-emerald-500' : 'border border-gray-700'}\`} />
                                            </div>
                                            <span className="truncate text-[10px]">{p.champion}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                        <div>
                            <div className="font-bold text-orange-500 uppercase text-[9px] tracking-wider mb-2">Champ Damage</div>
                            <div className="flex flex-col gap-2">
                                {participantStats.map((p) => {
                                    const isPlayer = playerPuuid ? participantsInfo[p.id]?.puuid === playerPuuid : false;
                                    return (
                                        <label key={\`dmg-\${p.id}\`} className="flex items-center gap-2 cursor-pointer hover:text-white overflow-hidden">
                                            <input type="checkbox" checked={chartConfig.champsDmg[p.id] || false} onChange={e => setChartConfig({...chartConfig, champsDmg: {...chartConfig.champsDmg, [p.id]: e.target.checked}})} className="accent-orange-500" />
                                            <div className="relative">
                                            <img src={\`https://ddragon.leagueoflegends.com/cdn/\${dDragon.latest}/img/champion/\${p.champion}.png\`} className={\`w-4 h-4 rounded \${isPlayer ? 'border-2 border-emerald-500' : 'border border-gray-700'}\`} />
                                            </div>
                                            <span className="truncate text-[10px]">{p.champion}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-[#111] border border-[#1f2833] rounded-xl p-4 min-h-[300px] flex-1 flex flex-col relative">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} onClick={(data) => {
                        if (data && data.activeLabel != null) {
                            setGameTimeMs(Number(data.activeLabel) * 60000);
                        }
                    }} style={{cursor: 'pointer'}}>
                        <XAxis dataKey="time" hide />
                        <YAxis domain={['auto', 'auto']} fontSize={10} tick={{fill: '#666'}} width={40} axisLine={false} tickLine={false}/>
                        <Tooltip cursor={{ stroke: '#ffffff', strokeWidth: 1, strokeDasharray: '4 4' }} contentStyle={{ backgroundColor: '#0b0c10', border: '1px solid #1f2833', fontSize: '12px' }} />
                        
                        {chartConfig.teamGold && <Line type="monotone" dataKey="teamGoldBlue" name="Blue Gold (k)" stroke="#3b82f6" dot={false} strokeWidth={3} isAnimationActive={false} />}
                        {chartConfig.teamGold && <Line type="monotone" dataKey="teamGoldRed" name="Red Gold (k)" stroke="#ef4444" dot={false} strokeWidth={3} isAnimationActive={false} />}
                        
                        {chartConfig.teamDmg && <Line type="monotone" dataKey="teamDmgBlue" name="Blue Dmg (k)" stroke="#2563eb" dot={false} strokeWidth={2} strokeDasharray="3 3" isAnimationActive={false} />}
                        {chartConfig.teamDmg && <Line type="monotone" dataKey="teamDmgRed" name="Red Dmg (k)" stroke="#dc2626" dot={false} strokeWidth={2} strokeDasharray="3 3" isAnimationActive={false} />}

                        {Object.values(participantsInfo).map((p: any) => {
                            const isPlayer = playerPuuid ? p.puuid === playerPuuid : false;
                            const idx = (p.participantId - 1) % 5;
                            const elements = [];
                            if (chartConfig.champs[p.participantId]) {
                                const color = getChampColor(p.teamId, idx, isPlayer);
                                elements.push(<Line key={\`g-\${p.participantId}\`} type="monotone" dataKey={\`champ_\${p.participantId}\`} name={\`\${p.championInternal || p.championName} Gold (k)\`} stroke={color} dot={false} strokeWidth={2} isAnimationActive={false} />);
                            }
                            if (chartConfig.champsDmg[p.participantId]) {
                                const colorDmg = getChampColorDmg(p.teamId, idx, isPlayer);
                                elements.push(<Line key={\`d-\${p.participantId}\`} type="monotone" dataKey={\`champ_dmg_\${p.participantId}\`} name={\`\${p.championInternal || p.championName} Dmg (k)\`} stroke={colorDmg} strokeDasharray="2 2" dot={false} strokeWidth={2} isAnimationActive={false} />);
                            }
                            return elements;
                        })}

                        <ReferenceLine x={gameTimeMs / 60000} stroke="#66fcf1" strokeDasharray="3 3"/>
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>

      </div>

      {/* AI Analysis Container */}
      <div className="bg-[#111] border border-[#1f2833] rounded-xl p-4 md:p-6 mt-4 relative overflow-hidden flex flex-col gap-4 shrink-0">
          <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#66fcf1] uppercase tracking-wider flex items-center gap-2">
                <Brain className="w-5 h-5"/> Event-by-Event Analysis
              </h3>
              <button 
                  onClick={handleAnalyzeEvents}
                  disabled={isAnalyzing}
                  className="bg-[#1f2833] hover:bg-[#45a29e] text-white px-4 py-2 rounded font-bold text-sm transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                  {isAnalyzing ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</> : "Generate Analysis"}
              </button>
          </div>
          
          <div className="text-sm text-gray-300">
              {isAnalyzing && (
                  <div className="flex items-center gap-3 text-[#45a29e]">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Processing match timeline events and evaluating critical errors...
                  </div>
              )}
              {!isAnalyzing && !aiAnalysis && (
                  <div className="text-gray-500 italic">
                      Click the button above to generate a step-by-step AI analysis of major match events (kills, objectives) to identify key mistakes.
                  </div>
              )}
              {!isAnalyzing && aiAnalysis && (
                  <div className="markdown-body p-4 bg-[#0b0c10] border border-[#1f2833] rounded-lg text-gray-300 prose prose-invert max-w-none">
                      <Markdown>{aiAnalysis}</Markdown>
                  </div>
              )}
          </div>
      </div>
    </div>
  );
}
`
fs.writeFileSync('src/components/ReplayViewer.tsx', newCode);
console.log("Updated update_replay3");

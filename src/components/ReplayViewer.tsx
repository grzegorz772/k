import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, ChevronDown, ChevronUp, Layers, MousePointerClick, GripHorizontal } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';

const TOWER_POSITIONS = [
  {id: 'b_t_1', x: 981, y: 10441, team: 100}, {id: 'b_t_2', x: 1512, y: 6699, team: 100}, {id: 'b_t_3', x: 1169, y: 4287, team: 100},
  {id: 'b_m_1', x: 5846, y: 6396, team: 100}, {id: 'b_m_2', x: 5048, y: 4812, team: 100}, {id: 'b_m_3', x: 3651, y: 3696, team: 100},
  {id: 'b_b_1', x: 10504, y: 1058, team: 100}, {id: 'b_b_2', x: 6919, y: 1483, team: 100}, {id: 'b_b_3', x: 4281, y: 1253, team: 100},
  {id: 'r_t_1', x: 4318, y: 13875, team: 200}, {id: 'r_t_2', x: 7943, y: 13411, team: 200}, {id: 'r_t_3', x: 10481, y: 13650, team: 200},
  {id: 'r_m_1', x: 8955, y: 8510, team: 200}, {id: 'r_m_2', x: 9767, y: 10113, team: 200}, {id: 'r_m_3', x: 11134, y: 11207, team: 200},
  {id: 'r_b_1', x: 13866, y: 4505, team: 200}, {id: 'r_b_2', x: 13327, y: 8226, team: 200}, {id: 'r_b_3', x: 13624, y: 10572, team: 200}
];

export default function ReplayViewer({ matchDetails, matchTimeline, dDragon }: any) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [gameTimeMs, setGameTimeMs] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [smoothMovement, setSmoothMovement] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  
  // Collapse state for scoreboards
  const [blueExpanded, setBlueExpanded] = useState(true);
  const [redExpanded, setRedExpanded] = useState(true);
  const mapRef = useRef<HTMLDivElement>(null);

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

  // Find frame index using direct comparison for smooth interpolation
  const frameIndex = useMemo(() => {
    for (let i = frames.length - 1; i >= 0; i--) {
      if (frames[i].timestamp <= gameTimeMs) return i;
    }
    return 0;
  }, [gameTimeMs, frames]);

  const currentFrame = frames[frameIndex] || frames[0];
  const nextFrame = frames[frameIndex + 1];
  const participantFramesObj = currentFrame?.participantFrames || {};

  const interpolationFactor = useMemo(() => {
    if (!smoothMovement || !currentFrame || !nextFrame) return 0;
    const duration = nextFrame.timestamp - currentFrame.timestamp;
    if (duration === 0) return 0;
    const raw = (gameTimeMs - currentFrame.timestamp) / duration;
    return Math.max(0, Math.min(1, raw));
  }, [gameTimeMs, currentFrame, nextFrame, smoothMovement]);

  // Pre-calculate all events once
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

  // Caching static Gold Data for the entire match - drastically improves performance
  const goldData = useMemo(() => {
    return frames.map((frame: any) => {
        let blueG = 0; let redG = 0;
        Object.values(frame.participantFrames || {}).forEach((pf: any) => {
            // Early fallback if participantsInfo isn't ready
            if (pf.participantId >= 1 && pf.participantId <= 5) blueG += pf.totalGold;
            else redG += pf.totalGold;
        });
        return { time: frame.timestamp / 60000, blue: blueG / 1000, red: redG / 1000 };
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
         return dist < 1200; // Radius generous enough to catch standard mapped coordinates
      });
      return { ...t, isDead };
    });
  }, [towers, gameTimeMs]);

  const recentKills = useMemo(() => {
    return allKills.filter(k => gameTimeMs >= k.timestamp && gameTimeMs <= k.timestamp + 5000);
  }, [allKills, gameTimeMs]);

  const deadParticipants = useMemo(() => {
    const deadIds = new Set<number>();
    allKills.forEach(k => {
      // Find victim level to estimate respawn timer
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

  // Participation Info
  const participantsInfo = useMemo(() => {
    const info: any = {};
    matchDetails.info.participants.forEach((p: any) => {
      info[p.participantId] = p;
    });
    return info;
  }, [matchDetails]);

  // Automatic Role Matching
  const roleMatchups = useMemo(() => {
    const blueTeam = Object.values(participantsInfo).filter((p: any) => p.teamId === 100);
    const redTeam = Object.values(participantsInfo).filter((p: any) => p.teamId === 200);
    const pairings: any[] = [];
    blueTeam.forEach((blue: any) => {
      const red = redTeam.find((r: any) => r.teamPosition === blue.teamPosition);
      if (red) pairings.push({ blue, red });
    });
    return pairings;
  }, [participantsInfo]);

  // Leaderboard data
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
            name: pInfo.riotIdGameName || pInfo.summonerName || pInfo.championName,
            champion: pInfo.championInternal || pInfo.championName,
            gold: pf.totalGold,
            level: pf.level,
            cs: pf.minionsKilled + pf.jungleMinionsKilled,
            team: pInfo.teamId,
            kills, deaths, assists
        });
      });
      return stats.sort((a,b) => b.gold - a.gold);
  }, [currentFrame, participantFramesObj, participantsInfo, allKills, gameTimeMs]);

  const getMapPosition = (p: {x: number, y: number}) => {
    const MAX_COORD = 14820;
    let x = (p.x / MAX_COORD) * 100;
    let y = (p.y / MAX_COORD) * 100;
    return { left: `${x}%`, bottom: `${y}%` };
  };

  const currentMinutes = Math.floor(gameTimeMs / 60000);
  const currentSeconds = Math.floor((gameTimeMs % 60000) / 1000);
  const timeStr = `${currentMinutes.toString().padStart(2, '0')}:${currentSeconds.toString().padStart(2, '0')}`;
  
  const goldChartPercent = maxGameTime > 0 ? (gameTimeMs / maxGameTime) * 100 : 0;

  const renderDragonIcon = (subType: string) => {
      let color = "bg-gray-500";
      if (subType === "FIRE_DRAGON") color = "bg-red-500";
      if (subType === "WATER_DRAGON") color = "bg-teal-400";
      if (subType === "EARTH_DRAGON") color = "bg-yellow-600";
      if (subType === "AIR_DRAGON") color = "bg-blue-200";
      if (subType === "HEXTECH_DRAGON") color = "bg-blue-600";
      if (subType === "CHEMTECH_DRAGON") color = "bg-green-600";
      return <div className={`w-2 h-2 md:w-3 md:h-3 rounded-full ${color} shadow-sm border border-[#0b0c10]`} />
  }

  return (
    <div className="flex flex-col h-full bg-[#0b0c10] text-[#c5c6c7] p-2 md:p-4 gap-2 md:gap-4 font-sans">
      
      {/* Top Bar: Timeline & Controls */}
      <div className="bg-[#111] border border-[#1f2833] rounded-lg p-2 md:p-3 flex flex-wrap lg:flex-nowrap items-center gap-2 md:gap-4">
          <button onClick={() => setIsPlaying(!isPlaying)} className="p-2 border border-[#45a29e] rounded-full hover:bg-[#45a29e]/20 text-[#66fcf1] shrink-0">
            {isPlaying ? <Pause className="w-4 h-4 md:w-5 md:h-5 fill-current" /> : <Play className="w-4 h-4 md:w-5 md:h-5 fill-current" />}
          </button>
          
          <div className="flex items-center gap-1 bg-[#1f2833] p-1 rounded shrink-0">
            {[1, 5, 10, 30, 60, 120, 240].map(s => (
                <button 
                  key={s} 
                  onClick={() => setSpeed(s)}
                  className={`text-[10px] md:text-sm px-2 py-1 rounded transition-colors ${speed === s ? 'bg-[#66fcf1] text-[#0b0c10] font-bold' : 'text-gray-400 hover:text-white'}`}
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
          <div className="font-mono text-sm md:text-xl shrink-0 tabular-nums">{timeStr}</div>
      </div>

      {/* Main Content Grid */}
      <div className="flex-1 flex flex-col lg:grid lg:grid-cols-4 md:grid-cols-3 gap-2 md:gap-4 overflow-y-auto min-h-0">
        
        {/* Left: Map & Config */}
        <div className="md:col-span-2 lg:col-span-3 flex flex-col gap-2 md:gap-4 h-full relative min-h-0">
            {/* Map */}
            <div ref={mapRef} className="aspect-square w-full bg-[#1f2833] border border-[#45a29e] rounded-lg relative overflow-hidden shrink-0 mx-auto">
                <img src={`https://ddragon.leagueoflegends.com/cdn/${dDragon.latest}/img/map/map11.png`} className="absolute inset-0 w-full h-full opacity-50 flex-shrink-0 pointer-events-none object-cover" />
                
                {/* Towers */}
                {activeTowers.map(t => (
                    <div 
                       key={t.id} 
                       className={`absolute w-[3.5%] h-[3.5%] rounded-full -translate-x-1/2 translate-y-1/2 flex items-center justify-center
                                 ${t.team === 100 ? 'bg-blue-600' : 'bg-red-600'} transition-opacity duration-300
                                 ${t.isDead ? 'opacity-10 scale-75' : 'opacity-80 shadow-[0_0_8px_rgba(0,0,0,0.8)] border border-white/50'}`}
                       style={getMapPosition({x: t.x, y: t.y})} 
                    />
                ))}

                {/* Objectives */}
                <div className="absolute w-[6%] h-[6%] -translate-x-1/2 translate-y-1/2 flex flex-col items-center justify-center font-bold text-[8px] z-10" style={getMapPosition({x: 9800, y: 4400})}>
                    <div className={`w-full h-full rounded-full border border-white flex items-center justify-center shadow-lg transition-colors ${objectiveStates.dragonAlive ? 'bg-orange-500 text-white' : 'bg-black/80 text-gray-400 scale-75'}`}>
                       {objectiveStates.dragonAlive ? 'D' : '-'}
                    </div>
                    {!objectiveStates.dragonAlive && objectiveStates.dragonTimeUntilSpawn > 0 && (
                        <div className="bg-black/90 text-orange-400 text-[9px] md:text-xs font-mono px-1 rounded absolute -bottom-5 shadow-lg border border-gray-800">
                            {Math.floor(objectiveStates.dragonTimeUntilSpawn/60000)}:{Math.floor((objectiveStates.dragonTimeUntilSpawn%60000)/1000).toString().padStart(2, '0')}
                        </div>
                    )}
                </div>
                
                <div className="absolute w-[6%] h-[6%] -translate-x-1/2 translate-y-1/2 flex flex-col items-center justify-center font-bold text-[8px] z-10" style={getMapPosition({x: 5000, y: 10400})}>
                    <div className={`w-full h-full rounded-full border border-white flex items-center justify-center shadow-lg transition-colors ${objectiveStates.baronAlive ? 'bg-purple-600 text-white' : 'bg-black/80 text-gray-400 scale-75'}`}>
                       {objectiveStates.baronAlive ? 'B' : '-'}
                    </div>
                    {!objectiveStates.baronAlive && objectiveStates.baronTimeUntilSpawn > 0 && gameTimeMs >= 1200000 && (
                        <div className="bg-black/90 text-purple-400 text-[9px] md:text-xs font-mono px-1 rounded absolute -bottom-5 shadow-lg border border-gray-800">
                            {Math.floor(objectiveStates.baronTimeUntilSpawn/60000)}:{Math.floor((objectiveStates.baronTimeUntilSpawn%60000)/1000).toString().padStart(2, '0')}
                        </div>
                    )}
                </div>

                {/* Champions */}
                {Object.values(participantsInfo).map((p: any) => {
                    const pf = currentFrame?.participantFrames?.[p.participantId];
                    const nextPf = nextFrame?.participantFrames?.[p.participantId];
                    if (!pf || !pf.position || deadParticipants.has(p.participantId)) return null;
                    
                    let pPos = pf.position;
                    // Interpolate only if enabled and next frame positions are known and relatively close (to prevent jumping across map strangely)
                    if (smoothMovement && nextPf && nextPf.position) {
                        const distSq = Math.pow(nextPf.position.x - pf.position.x, 2) + Math.pow(nextPf.position.y - pf.position.y, 2);
                        if (distSq < 100000000) { // Limit smoothing distance so TP/recall doesn't slide across map slowly
                            pPos = {
                                x: pf.position.x + (nextPf.position.x - pf.position.x) * interpolationFactor,
                                y: pf.position.y + (nextPf.position.y - pf.position.y) * interpolationFactor
                            };
                        }
                    }
                    const pos = getMapPosition(pPos);
                    const stats = pf.championStats;
                    const maxHp = stats?.healthMax ?? stats?.maxHealth ?? 100;
                    const currHp = stats?.health ?? stats?.currentHealth ?? (stats ? maxHp : 100);
                    const hpPct = maxHp > 0 ? Math.max(0, Math.min(100, (currHp / maxHp) * 100)) : 100;
                    
                    const isKiller = recentKills.some(k => k.killerId === p.participantId);
                    
                    return (
                        <div key={p.participantId} className={`absolute w-[8%] h-[8%] -translate-x-1/2 translate-y-1/2 flex flex-col items-center justify-center z-20 transition-all ${smoothMovement ? 'duration-0' : 'duration-[400ms]'} ${isKiller ? 'scale-[1.6]' : 'scale-100'}`} style={{ left: pos.left, bottom: pos.bottom }}>
                            {stats && (
                                <div className="w-[124%] h-1 md:h-1.5 bg-[#0b0c10] border border-black mb-[2px] relative rounded-[2px] overflow-hidden shadow-sm">
                                    <div className={`h-full transition-all ${p.teamId === 100 ? 'bg-[#60a5fa]' : 'bg-[#f87171]'}`} style={{ width: `${hpPct}%` }} />
                                </div>
                            )}
                            <img src={`https://ddragon.leagueoflegends.com/cdn/${dDragon.latest}/img/champion/${p.championInternal || p.championName}.png`} className={`w-full h-full rounded-full border-[2px] shadow-lg ${p.teamId === 100 ? 'border-blue-500' : 'border-red-500'} ${isKiller ? 'animate-pulse ring-2 ring-yellow-400' : ''}`} />
                        </div>
                    );
                })}

                {/* Scoreboard Overlay - Blue Side */}
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
                                   <img src={`https://ddragon.leagueoflegends.com/cdn/${dDragon.latest}/img/champion/${p.champion}.png`} className="w-5 h-5 rounded-[4px] border border-blue-500/50"/>
                                   <div className="absolute -bottom-1.5 -right-1.5 bg-black text-white text-[7px] w-[14px] h-[14px] flex items-center justify-center rounded-full border border-gray-700">{p.level}</div>
                                </div>
                                <span className="font-mono ml-1 text-yellow-500/90 w-7">{(p.gold/1000).toFixed(1)}k</span>
                            </div>
                            <span className="text-gray-400 w-5 text-right">{p.cs}</span>
                            <span className="w-10 text-right">{p.kills}/{p.deaths}/{p.assists}</span>
                        </div>
                    ))}
                </motion.div>

                {/* Scoreboard Overlay - Red Side */}
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
                                   <img src={`https://ddragon.leagueoflegends.com/cdn/${dDragon.latest}/img/champion/${p.champion}.png`} className="w-5 h-5 rounded-[4px] border border-red-500/50"/>
                                   <div className="absolute -bottom-1.5 -left-1.5 bg-black text-white text-[7px] w-[14px] h-[14px] flex items-center justify-center rounded-full border border-gray-700">{p.level}</div>
                                </div>
                                <span className="font-mono mr-1 text-yellow-500/90 w-7 text-right">{(p.gold/1000).toFixed(1)}k</span>
                            </div>
                            <span className="text-gray-400 w-5 text-left">{p.cs}</span>
                            <span className="w-10 text-left">{p.kills}/{p.deaths}/{p.assists}</span>
                        </div>
                    ))}
                </motion.div>
            </div>
            
            {/* Gold Chart */}
            <div className="bg-[#111] border border-[#1f2833] rounded-lg p-2 md:p-4 min-h-[120px] md:min-h-0 md:h-48 shrink-0 relative flex-1 touch-pan-y">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={goldData} onClick={(data) => {
                        if (data && data.activeLabel != null) {
                            setGameTimeMs(Number(data.activeLabel) * 60000);
                        }
                    }} style={{cursor: 'pointer'}}>
                        <defs>
                            <linearGradient id="colorBlueX" x1="0" y1="0" x2="1" y2="0">
                                <stop offset={`${goldChartPercent}%`} stopColor="#3b82f6" stopOpacity={1} />
                                <stop offset={`${goldChartPercent}%`} stopColor="#3b82f6" stopOpacity={0.2} />
                            </linearGradient>
                            <linearGradient id="colorRedX" x1="0" y1="0" x2="1" y2="0">
                                <stop offset={`${goldChartPercent}%`} stopColor="#ef4444" stopOpacity={1} />
                                <stop offset={`${goldChartPercent}%`} stopColor="#ef4444" stopOpacity={0.2} />
                            </linearGradient>
                        </defs>
                        <XAxis dataKey="time" hide />
                        <YAxis domain={['auto', 'auto']} fontSize={10} tick={{fill: '#666'}} width={40} axisLine={false} tickLine={false}/>
                        <Tooltip cursor={{ stroke: '#ffffff', strokeWidth: 1, strokeDasharray: '4 4' }} content={() => null} />
                        <Line type="monotone" dataKey="blue" stroke="url(#colorBlueX)" dot={false} strokeWidth={3} isAnimationActive={false} />
                        <Line type="monotone" dataKey="red" stroke="url(#colorRedX)" dot={false} strokeWidth={3} isAnimationActive={false} />
                        <ReferenceLine x={gameTimeMs / 60000} stroke="#66fcf1" strokeDasharray="3 3"/>
                    </LineChart>
                </ResponsiveContainer>
                <div className="absolute top-2 left-10 text-[10px] text-gray-500/80 pointer-events-none flex items-center gap-1">
                    <MousePointerClick className="w-3 h-3" /> Click chart to seek timeline
                </div>
            </div>
        </div>

        {/* Right: Data Panels */}
        <div className="flex flex-col gap-2 relative md:min-h-0 md:h-full shrink-0 lg:shrink">
            <button onClick={() => setShowConfig(!showConfig)} className="bg-[#1f2833] rounded px-3 py-2 text-[10px] text-[#66fcf1] border border-[#45a29e]/50 font-bold tracking-wider uppercase flex items-center justify-center gap-2 hover:bg-[#45a29e] hover:text-[#0b0c10] lg:hidden mb-2">
                <Layers className="w-4 h-4" /> {showConfig ? 'Hide Matchups' : 'Show Matchups'}
            </button>
            <div className={`${showConfig ? 'flex' : 'hidden lg:flex'} flex-col gap-2 flex-1 w-full`}>
                {/* Leaderboard & Matchups Table */}
                <div className="bg-[#111] border border-[#1f2833] rounded-lg p-2 text-[10px] h-full">
                    <div className="grid grid-cols-[1fr,20px,1fr] gap-2 border-b border-[#1f2833] pb-2 mb-2 font-bold text-gray-500 text-center bg-[#111] z-10 sticky top-0">
                        <div className="text-blue-400">Blue Team</div><div>VS</div><div className="text-red-400">Red Team</div>
                    </div>
                    {roleMatchups.map((m, i) => {
                        const blueStats = participantStats.find(p => p.name === (m.blue.riotIdGameName || m.blue.summonerName || m.blue.championName));
                        const redStats = participantStats.find(p => p.name === (m.red.riotIdGameName || m.red.summonerName || m.red.championName));
                        if (!blueStats || !redStats) return null;
                        
                        const renderItems = (pInfo: any) => (
                          <div className="flex gap-[2px] mt-1 flex-wrap">
                            {[0,1,2,3,4,5,6].map(idx => {
                              const itemId = pInfo[`item${idx}`];
                              return itemId ? 
                                <img key={idx} src={`https://ddragon.leagueoflegends.com/cdn/${dDragon.latest}/img/item/${itemId}.png`} className="w-[18px] h-[18px] md:w-5 md:h-5 rounded-[2px] border border-gray-800" /> :
                                <div key={idx} className="w-[18px] h-[18px] md:w-5 md:h-5 bg-black/40 rounded-[2px]" />;
                            })}
                          </div>
                        );

                        return (
                            <div key={i} className="flex flex-col md:flex-row justify-between items-center py-2 border-b last:border-b-0 border-[#1f2833]/50 gap-2 md:gap-0">
                                {/* Blue Side */}
                                <div className="flex items-center gap-2 flex-1 w-full overflow-hidden text-[#60a5fa] bg-blue-900/10 md:bg-transparent p-1 md:p-0 rounded">
                                  <img src={`https://ddragon.leagueoflegends.com/cdn/${dDragon.latest}/img/champion/${m.blue.championInternal || m.blue.championName}.png`} className="w-8 h-8 rounded-full border border-blue-500 shrink-0" />
                                  <div className="flex flex-col min-w-0 flex-1">
                                     <span className="truncate font-bold text-white text-[11px]">{blueStats.name}</span>
                                     <span className="text-[9px] md:text-[10px] text-gray-400">
                                       {blueStats.kills}/{blueStats.deaths}/{blueStats.assists} | <span className="text-white">{blueStats.cs} CS</span> | <span className="text-yellow-500/80">{(blueStats.gold/1000).toFixed(1)}k</span>
                                     </span>
                                     {renderItems(m.blue)}
                                  </div>
                                </div>
                                
                                <div className="text-gray-600 font-black text-[9px] px-1 shrink-0 hidden md:block">VS</div>
                                
                                {/* Red Side */}
                                <div className="flex items-center gap-2 flex-1 w-full overflow-hidden text-[#f87171] md:flex-row-reverse md:text-right bg-red-900/10 md:bg-transparent p-1 md:p-0 rounded">
                                  <img src={`https://ddragon.leagueoflegends.com/cdn/${dDragon.latest}/img/champion/${m.red.championInternal || m.red.championName}.png`} className="w-8 h-8 rounded-full border border-red-500 shrink-0" />
                                  <div className="flex flex-col min-w-0 flex-1 md:items-end">
                                     <span className="truncate font-bold text-white text-[11px]">{redStats.name}</span>
                                     <span className="text-[9px] md:text-[10px] text-gray-400">
                                       <span className="text-yellow-500/80">{(redStats.gold/1000).toFixed(1)}k</span> | <span className="text-white">{redStats.cs} CS</span> | {redStats.kills}/{redStats.deaths}/{redStats.assists}
                                     </span>
                                     {renderItems(m.red)}
                                  </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>

      </div>
    </div>
  );
}

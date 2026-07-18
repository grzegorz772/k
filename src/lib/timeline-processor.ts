import { getMapZone } from "./map-logic";

export function processMatchForAI(
  matchInfo: any,
  timelineInfo: any,
  puuid: string,
  championMap: Record<number, string>,
  itemMap: Record<number, string>
) {
  // Find the requested player
  const playerInfo = matchInfo.info.participants.find((p: any) => p.puuid === puuid);
  const playerParticipantId = playerInfo?.participantId;
  const playerChampion = playerInfo?.championName;
  const playerWon = playerInfo?.win;

  const participantsInfo = matchInfo.info.participants.reduce((acc: any, p: any) => {
    acc[p.participantId] = {
      champion: championMap[p.championId] || p.championName,
      teamId: p.teamId,
      puuid: p.puuid,
    };
    return acc;
  }, {});

  // Initialize KDA and persistent damage tracking
  const currentKda: Record<number, { kills: number; deaths: number; assists: number }> = {};
  const prevDamageStats: Record<number, { done: number; taken: number }> = {};
  for (let i = 1; i <= 10; i++) {
    currentKda[i] = { kills: 0, deaths: 0, assists: 0 };
    prevDamageStats[i] = { done: 0, taken: 0 };
  }

  const framesForAI = timelineInfo.info.frames.map((frame: any) => {
    // Process events first to update KDA and format events
    const snapshotEvents: string[] = [];

    frame.events.forEach((evt: any) => {
      const min = Math.floor(evt.timestamp / 60000);
      const sec = Math.floor((evt.timestamp % 60000) / 1000);
      const timeStr = `${min}:${sec.toString().padStart(2, "0")}`;

      if (evt.type === "CHAMPION_KILL") {
        if (evt.killerId > 0 && currentKda[evt.killerId]) currentKda[evt.killerId].kills += 1;
        if (evt.victimId > 0 && currentKda[evt.victimId]) currentKda[evt.victimId].deaths += 1;
        if (evt.assistingParticipantIds) {
          evt.assistingParticipantIds.forEach((id: number) => {
            if (currentKda[id]) currentKda[id].assists += 1;
          });
        }

        const killerName = evt.killerId === 0 ? "Minion/Monster/Turret" : participantsInfo[evt.killerId]?.champion;
        const victimName = participantsInfo[evt.victimId]?.champion;
        snapshotEvents.push(`[${timeStr}] ZABÓJSTWO: ${killerName} zabił ${victimName}`);
      } else if (evt.type === "ITEM_PURCHASED") {
        const champ = participantsInfo[evt.participantId]?.champion;
        const itemName = itemMap[evt.itemId] || `Item_${evt.itemId}`;
        snapshotEvents.push(`[${timeStr}] ZAKUP: ${champ} kupił ${itemName}`);
      } else if (evt.type === "ELITE_MONSTER_KILL") {
        const killerName = participantsInfo[evt.killerId]?.champion;
        snapshotEvents.push(`[${timeStr}] POTWÓR: ${killerName} zabił ${evt.monsterType} ${evt.monsterSubType ? '('+evt.monsterSubType+')' : ''}`);
      } else if (evt.type === "BUILDING_KILL") {
        const killerName = participantsInfo[evt.killerId]?.champion;
        snapshotEvents.push(`[${timeStr}] BUDYNEK: ${killerName} zniszczył ${evt.buildingType}`);
      } else if (evt.type === "WARD_PLACED") {
        const champ = participantsInfo[evt.creatorId]?.champion;
        if (champ) snapshotEvents.push(`[${timeStr}] WIZJA: ${champ} postawił warda`);
      } else if (evt.type === "WARD_KILL") {
        const champ = participantsInfo[evt.killerId]?.champion;
        if (champ) snapshotEvents.push(`[${timeStr}] WIZJA: ${champ} zniszczył warda`);
      } else if (evt.type === "SKILL_LEVEL_UP") {
        const champ = participantsInfo[evt.participantId]?.champion;
        let skillSlot = evt.skillSlot;
        let skillName = skillSlot === 1 ? 'Q' : skillSlot === 2 ? 'W' : skillSlot === 3 ? 'E' : skillSlot === 4 ? 'R' : 'Inne';
        snapshotEvents.push(`[${timeStr}] SKILL: ${champ} ulepszył ${skillName}`);
      }
    });

    const timeMin = Math.floor(frame.timestamp / 60000);
    const timeSec = Math.floor((frame.timestamp % 60000) / 1000);

    const championsData: any[] = [];
    
    // Process participant frames (snapshots)
    for (const participantId in frame.participantFrames) {
      const pFrame = frame.participantFrames[participantId];
      const pInfo = participantsInfo[participantId];
      const participantIdNum = Number(participantId);

      const stats = pFrame.championStats || {};
      const dmgStats = pFrame.damageStats || { totalDamageDoneToChampions: 0, totalDamageTaken: 0 };
      
      const deltaDone = dmgStats.totalDamageDoneToChampions - prevDamageStats[participantIdNum].done;
      const deltaTaken = dmgStats.totalDamageTaken - prevDamageStats[participantIdNum].taken;

      prevDamageStats[participantIdNum] = { 
          done: dmgStats.totalDamageDoneToChampions, 
          taken: dmgStats.totalDamageTaken 
      };
      
      championsData.push({
        bohater: pInfo.champion,
        druzyna: pInfo.teamId === 100 ? "Niebieska" : "Czerwona",
        level: pFrame.level,
        kda: `${currentKda[participantIdNum].kills}/${currentKda[participantIdNum].deaths}/${currentKda[participantIdNum].assists}`,
        farma: {
          miniony_zwykle: pFrame.minionsKilled,
          potwory_dzungla: pFrame.jungleMinionsKilled
        },
        gold: {
          aktualny: pFrame.currentGold,
          calkowity: pFrame.totalGold
        },
        obrazenia: {
            zadane: deltaDone,
            otrzymane: deltaTaken
        },
        zdrowie: {
            aktualne: stats.health,
            maksymalne: stats.maxHealth
        },
        statystyki: {
          ad_fizyczne: stats.attackDamage || 0,
          ap_magiczne: stats.abilityPower || 0,
          armor_pancerz: stats.armor || 0,
          mr_odpornosc_magiczna: stats.magicResist || 0,
          szybkosc_ruchu: stats.movementSpeed || 0
        },
        pozycja: getMapZone(pFrame.position?.x, pFrame.position?.y)
      });
    }

    return {
      czas_migawki: `${timeMin}:${timeSec.toString().padStart(2, "0")}`,
      bohaterowie: championsData,
      wydarzenia_w_tej_minucie: snapshotEvents
    };
  });

  return {
    informacje_ogolne: {
      gracz_analizowany: playerChampion,
      wynik_meczu: playerWon ? "ZWYCIĘSTWO" : "PORAŻKA",
      uwagi: "Riot API nie dostarcza dokładnych cooldownów umiejętności podczas meczu. Lista wydarzeń zawiera tylko najważniejsze zdarzenia (zabójstwa, przedmioty, elitarne potwory)."
    },
    przebieg_meczu: framesForAI
  };
}

export function processLiveMatchForAI(
  liveMatch: any,
  puuid: string,
  championMap: Record<number, string>,
  runesData: any[]
) {
  const runeMap: Record<number, string> = {};
  runesData.forEach(tree => {
    runeMap[tree.id] = tree.name;
    tree.slots.forEach((slot: any) => {
      slot.runes.forEach((rune: any) => {
        runeMap[rune.id] = rune.name;
      });
    });
  });

  const participants = liveMatch.participants.map((p: any) => {
    const isMe = p.puuid === puuid;
    const primaryRune = runeMap[p.perks.perkIds[0]] || "Unknown";
    const primaryTree = runeMap[p.perks.perkStyle] || "Unknown";

    return {
      name: p.riotId || p.summonerName,
      champion: championMap[p.championId] || `Champ_${p.championId}`,
      team: p.teamId === 100 ? "Blue" : "Red",
      is_player: isMe,
      runy: {
        glowne: primaryRune,
        sciezka: primaryTree
      }
    };
  });

  const bans = (liveMatch.bannedChampions || []).map((b: any) => championMap[b.championId] || `Champ_${b.championId}`);

  return {
    typ: "LIVE_MATCH_PREVIEW",
    nasz_bohater: participants.find(p => p.is_player)?.champion,
    uczestnicy: participants,
    zbanowani_bohaterowie: bans,
    uwagi: "Analiza przedmeczowa: skup się na counter-pickach i power-spike'ach."
  };
}

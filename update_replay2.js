import fs from 'fs';

let code = fs.readFileSync('src/components/ReplayViewer.tsx', 'utf-8');

code = code.replace(
  'export default function ReplayViewer({ matchDetails, matchTimeline, dDragon }: any) {',
  'export default function ReplayViewer({ matchDetails, matchTimeline, dDragon, playerPuuid }: any) {'
);

code = code.replace(
  /const isPlayer = matchDetails\.playerPuuid \? participantsInfo\[p\.id\]\?\.puuid === matchDetails\.playerPuuid : false;/g,
  'const isPlayer = playerPuuid ? participantsInfo[p.id]?.puuid === playerPuuid : false;'
);

code = code.replace(
  /const isPlayer = matchDetails\.playerPuuid \? p\.puuid === matchDetails\.playerPuuid : false;/g,
  'const isPlayer = playerPuuid ? p.puuid === playerPuuid : false;'
);

fs.writeFileSync('src/components/ReplayViewer.tsx', code);
console.log("Replaced playerPuuid");

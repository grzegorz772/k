export function getMapZone(x: number, y: number): string {
  // Summoner's Rift dimensions are roughly 0 to 14870
  if (x === undefined || y === undefined || x === 0 && y === 0) return "Brak wizji / Nie żyje (Baza)";
  
  const minPos = 0;
  const maxPos = 14870;

  // Clamp values
  const pxRaw = x / maxPos;
  const pyRaw = y / maxPos;
  
  const px = Math.min(100, Math.max(0, pxRaw * 100));
  const py = Math.min(100, Math.max(0, pyRaw * 100));

  // Determine zones
  // Baron pit is around X: 5000, Y: 10400 -> Px: 33%, Py: 70%
  const inBaron = px > 25 && px < 40 && py > 60 && py < 75;
  if (inBaron) return `Baron Pit (X:${Math.round(px)}%, Y:${Math.round(py)}%)`;

  // Dragon pit is around X: 9800, Y: 4400 -> Px: 65%, Py: 29%
  const inDragon = px > 60 && px < 75 && py > 20 && py < 35;
  if (inDragon) return `Smok / Dragon Pit (X:${Math.round(px)}%, Y:${Math.round(py)}%)`;
  
  // Mid lane (diagonal where X is close to Y)
  const distMid = Math.abs(px - py);
  if (distMid < 15) {
      if (px > 20 && px < 80) {
          const progress = Math.round((px + py) / 2); // 0 is bottom left, 100 is top right
          return `Mid (Środkowa Aleja) - ${progress}% od bazy Blue do Red`;
      }
  }

  // Top lane logic (L-shape: along left wall, then along top wall)
  // Left wall goes up to Top-Left corner (~15%, 85%)
  if (px < 25 && py > 20) {
     return `Top (Górna Aleja - Część Blue) - ${Math.round(py)}% w górę`;
  }
  if (py > 75 && px > 20) {
     return `Top (Górna Aleja - Część Red) - ${Math.round(px)}% w prawo`;
  }

  // Bot lane logic (L-shape: along bottom wall, then along right wall)
  if (py < 25 && px > 20) {
     return `Bot (Dolna Aleja - Część Blue) - ${Math.round(px)}% w prawo`;
  }
  if (px > 75 && py > 20) {
     return `Bot (Dolna Aleja - Część Red) - ${Math.round(py)}% w górę`;
  }

  // If not mid and not lanes and not objectives, it's jungle or river.
  // We can distinguish top vs bot jungle by whether Y > X.
  if (py > px) {
      return `Jungle Górna (Top Side) - X:${Math.round(px)}% Y:${Math.round(py)}%`;
  } else {
      return `Jungle Dolna (Bot Side) - X:${Math.round(px)}% Y:${Math.round(py)}%`;
  }
}

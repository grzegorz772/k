import fs from 'fs';

const code = fs.readFileSync('src/components/ReplayViewer.tsx', 'utf-8');

const newCode = code.replace(
  'const [chartConfig, setChartConfig] = useState({',
  `const [chartConfig, setChartConfig] = useState({
    teamGold: true,
    teamDmg: true,
    champs: {} as Record<number, boolean>,
    champsDmg: {} as Record<number, boolean>
  });
  
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);`
).replace(
  /const \[chartConfig, setChartConfig\] = useState\(\{[\s\S]*?\}\);/g,
  `const [chartConfig, setChartConfig] = useState({
    teamGold: true,
    teamDmg: true,
    champs: {} as Record<number, boolean>,
    champsDmg: {} as Record<number, boolean>
  });
  
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);`
);

fs.writeFileSync('src/components/ReplayViewer.tsx', newCode);
console.log("Updated ReplayViewer state");

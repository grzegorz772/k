import fs from 'fs';

let code = fs.readFileSync('server.ts', 'utf-8');

code = code.replace('\\n  // Proxy endpoint for Riot API', '\n  // Proxy endpoint for Riot API');

fs.writeFileSync('server.ts', code);
console.log("Fixed server.ts");

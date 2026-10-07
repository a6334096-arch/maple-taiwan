import {readFile,writeFile} from 'node:fs/promises';
const types={'index.html':'text/html; charset=utf-8','app.js':'text/javascript; charset=utf-8','style.css':'text/css; charset=utf-8','places.json':'application/json; charset=utf-8'};
const assets={};for(const [file,type] of Object.entries(types))assets['/'+file]={type,body:await readFile('web/'+file,'utf8')};
const seed=JSON.parse(await readFile('web/seasons.json','utf8'));
const instructions=await readFile('UPDATE.md','utf8');
const logic=await readFile('worker/logic.js','utf8');
await writeFile('worker/index.js','const ASSETS='+JSON.stringify(assets)+';\nconst SEED='+JSON.stringify(seed)+';\nconst INSTRUCTIONS='+JSON.stringify(instructions)+';\n'+logic);

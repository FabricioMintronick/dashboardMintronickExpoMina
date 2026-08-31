const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const files = ['server.js'];
function walk(dir) { for (const item of fs.readdirSync(dir,{withFileTypes:true})) { const file=path.join(dir,item.name); if(item.isDirectory())walk(file);else if(/\.(js|cjs)$/.test(file))files.push(file); } }
walk('src');walk('public/app');walk('public/legacy');
for(const file of files)execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
for(const file of ['map-explorer.js','compare-history.js','report-explorer.js','alerts.js','maintenance.js','ui.js','main.js','api.js','format.js','styles.css','visual.js','visual.css','interactions.css'])if(!fs.existsSync(path.join('public/app',file)))throw new Error(`Missing asset: ${file}`);
console.log(`Sintaxis verificada: ${files.length} archivos. Assets principales presentes.`);

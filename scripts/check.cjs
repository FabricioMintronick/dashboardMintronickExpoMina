const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const files = ['server.js'];
function walk(dir) { for (const item of fs.readdirSync(dir,{withFileTypes:true})) { const file=path.join(dir,item.name); if(item.isDirectory())walk(file);else if(/\.(js|cjs)$/.test(file))files.push(file); } }
walk('src');walk('public/app');walk('public/legacy');
for(const file of files){const frontend=file.replaceAll('\\','/').startsWith('public/app/');execFileSync(process.execPath,frontend?['--input-type=module','--check']:['--check',file],{stdio:'pipe',...(frontend?{input:fs.readFileSync(file,'utf8')}:{})});}
for(const file of ['map-explorer.js','compare-history.js','report-studio.js','alerts.js','install.js','pwa.js','ui.js','main.js','api.js','format.js','chart-gaps.js','styles.css','visual.js','visual.css','interactions.css','tablet-visibility.css','dashboard-v2.css','install-sync.css','sensors.js','sensors.css'])if(!fs.existsSync(path.join('public','app',file)))throw new Error(`Missing asset: ${file}`);
for(const file of ['manifest.webmanifest','service-worker.js','assets/pwa-icon.svg'])if(!fs.existsSync(path.join('public',file)))throw new Error(`Missing PWA asset: ${file}`);
for(const name of ['mintronick-operaciones.apk','mintronick-sync.apk']){const apk=path.join('public','downloads',name);if(!fs.existsSync(apk)||fs.statSync(apk).size<10000)throw new Error(`Missing or invalid Android APK: ${name}`);}
console.log(`Sintaxis verificada: ${files.length} archivos. Assets principales presentes.`);

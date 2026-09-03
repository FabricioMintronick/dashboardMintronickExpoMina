let installPrompt=null;
const announce=()=>window.dispatchEvent(new Event('pwa-install-change'));
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;announce();});
window.addEventListener('appinstalled',()=>{installPrompt=null;announce();});
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/service-worker.js').catch(()=>{}));
export const installed=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
export const canInstall=()=>Boolean(installPrompt);
export async function installApp(){if(!installPrompt)return {outcome:'unavailable'};const prompt=installPrompt;installPrompt=null;await prompt.prompt();const choice=await prompt.userChoice;announce();return choice;}

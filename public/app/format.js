export const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const number = value => value == null ? '—' : new Intl.NumberFormat('es-PE', { maximumFractionDigits: 1 }).format(value);
export function date(value) { return value ? new Date(value).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'medium' }) : 'Sin fecha'; }
export function age(value) {
  if (!value) return 'Sin lecturas';
  const minutes = Math.floor((Date.now() - new Date(value)) / 60000);
  if (minutes < 0) return 'Fecha futura';
  if (minutes < 1) return 'Hace menos de 1 min';
  if (minutes < 60) return `Hace ${minutes} min`;
  if (minutes < 1440) return `Hace ${Math.floor(minutes / 60)} h`;
  return `Hace ${Math.floor(minutes / 1440)} días`;
}
export function badge(text, color = 'gray') { return `<span class="badge ${color}">${escape(text)}</span>`; }
export function quality(value) {
  if(value==='fresh')return '';
  return badge(({stale:'Sin actualización',missing:'Sin lectura registrada',invalid:'Fecha inválida'})[value] || 'Sin lectura registrada',value==='invalid'?'amber':'gray');
}
export function state(item) {
  if (item.communication !== 'fresh') return badge('Sin conexión','gray');
  const rpm=item.metrics?.rpm,speed=item.metrics?.speed,load=item.metrics?.load,raw=String(item.state?.value||'').toLowerCase();
  const engine=rpm?.quality==='fresh'&&Number(rpm.value)>300,moving=speed?.quality==='fresh'&&Number(speed.value)>1,working=load?.quality==='fresh'&&Number(load.value)>20;
  if(engine&&(moving||working||item.state?.quality==='fresh'&&raw==='duty'))return badge('Operando','teal');
  if(engine||item.state?.quality==='fresh'&&raw==='idle')return badge('Ralentí','amber');
  return badge('Detenido','blue');
}
export function condition(item) {
  return badge(({reported:'! Alarma reportada','last-alert':'! Última alarma · Atrasada','no-reported-alerts':'Sin alarmas reportadas',unknown:'Sin evaluación vigente'})[item.condition], item.condition === 'reported' ? 'red' : item.condition === 'last-alert' ? 'amber' : 'gray');
}

const storageKey='mintronick-theme';
export function setupTheme(topbar){
 let mode='light';try{mode=localStorage.getItem(storageKey)==='dark'?'dark':'light';}catch{}
 const button=document.createElement('button');button.className='button secondary';button.id='theme-toggle';(topbar.querySelector('.topbar-controls')||topbar).append(button);
 function apply(){document.documentElement.dataset.theme=mode;button.innerHTML=`<span class="theme-symbol" aria-hidden="true">${mode==='dark'?'☀':'◐'}</span><span class="theme-label">${mode==='dark'?'Claro':'Oscuro'}</span>`;button.setAttribute('aria-pressed',String(mode==='dark'));button.setAttribute('aria-label','Cambiar a tema '+(mode==='dark'?'claro':'oscuro'));try{localStorage.setItem(storageKey,mode);}catch{}if(window.Chart)Object.values(Chart.instances).forEach(chart=>chart.update('none'));window.dispatchEvent(new Event('theme-change'));}
 if(window.Chart)Chart.register({id:'mintronickTheme',beforeUpdate(chart){const dark=document.documentElement.dataset.theme==='dark',text=dark?'#c3d8d0':'#64786d',grid=dark?'#304640':'#eaf0ec';Object.values(chart.options.scales||{}).forEach(s=>{if(s.ticks)s.ticks.color=text;if(s.title)s.title.color=text;if(s.grid)s.grid.color=grid;});if(chart.options.plugins.legend?.labels)chart.options.plugins.legend.labels.color=text;}});
 button.onclick=()=>{mode=mode==='dark'?'light':'dark';apply();};apply();
}

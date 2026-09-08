import {escape as e} from './format.js';
export function machineImage(item,className=''){
  const source=item?.image||'/tractor-d8-transparent.png';
  const label=item?.model||'Maquinaria pesada';
  return `<img${className?` class="${e(className)}"`:''} src="${e(source)}" alt="${e(label)}" loading="lazy">`;
}

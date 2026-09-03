const guidance={
 HYD_OVERHEATING:['Temperatura hidráulica fuera del umbral','Reduce la carga y revisa temperatura, nivel y posibles fugas. Si persiste, deriva a mantenimiento.'],
 TC_OVERHEATING:['Convertidor con temperatura elevada','Evita continuar bajo carga; comprueba temperatura y transmisión antes de seguir operando.'],
 OVERHEATING:['Refrigerante con temperatura elevada','Detén la operación de forma segura y revisa nivel, ventilación y fugas antes de continuar.'],
 OVERSPEED:['Velocidad superior al umbral','Confirma velocidad y condiciones del terreno con el operador.'],
 LOW_FUEL:['Nivel de combustible bajo','Programa abastecimiento y confirma que la lectura siga vigente.'],
 LOW_BATTERY:['Voltaje de batería bajo','Revisa batería, conexiones y sistema de carga.'],
 HIGH_BATTERY:['Voltaje de batería alto','Revisa regulador y sistema de carga.'],
 HIGH_LOAD_LOW_RPM:['Carga alta con RPM bajas','Reduce la carga y revisa el contexto operativo antes de continuar.'],
 LOW_BOOST:['Presión de turbo baja','Revisa admisión, mangueras y turbo si la condición persiste.'],
 AIR_FILTER_CLOGGED:['Restricción del filtro de aire','Inspecciona el filtro y reemplázalo si corresponde al procedimiento de mantenimiento.'],
 EXCESSIVE_IDLE:['Ralentí por tiempo prolongado','Confirma si el ralentí era necesario y revisa la práctica operativa.'],
 HARSH_EVENT:['Movimiento brusco detectado','Comprueba ubicación, velocidad y contexto con el operador.']
};
export function alarmGuidance(code,label='Aviso reportado'){return guidance[code]||[label,'Confirma la lectura y su contexto. El aviso por sí solo no determina una reparación.'];}

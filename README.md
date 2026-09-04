# MINTRONICK · Operaciones

Para preparar una computadora nueva y trabajar mediante la rama de colaboración, consulta [GUIA_COLABORACION.md](GUIA_COLABORACION.md).

Primera entrega de la evolución del dashboard. Aplicación local conectada a MongoDB; sin datos simulados y sin escrituras a la base operativa.

## Ejecutar

Requiere Node.js 22 y las dependencias de `package-lock.json`.

```powershell
npm ci
# Si .env no existe, copiar .env.example y completar la conexión localmente.
npm start
```

Por defecto abre `http://127.0.0.1:4001`. Para convivir con otra instancia:

```powershell
$env:PORT = '4002'
npm run dev
```

La entrega se verificó en el puerto 4002. `.env` se excluye de Git. La credencial heredada se trasladó sin imprimirla; **requiere rotación en el servidor de base de datos**, pues moverla no invalida copias ni historial de Git.

## Qué funciona

- Inicio con resumen real de flota, equipos de prueba excluidos y estado de comunicación.
- Directorio con búsqueda/filtros y ficha con doce señales normalizadas.
- Mapa con agrupación visual y posición original; búsqueda, filtro, lista y acceso al equipo.
- Lectura de las últimas alarmas emitidas por el origen, conservando las antiguas.
- Historial y reportes con rangos de hasta 183 días; los periodos largos se agregan preservando mínimos y máximos.
- CSV de situación con fechas y calidad por señal. No es reporte de producción ni de turno.
- Vista técnica anterior conservada en `/tecnico.html`. No equivale a una vista validada para cliente.

Inicio, ficha y alarmas consultan cada 15 segundos mientras la pestaña está visible. Las demás vistas se actualizan manualmente para conservar filtros, mapa y periodos de investigación. El estado indica la fecha de consulta. Un fallo de consulta muestra error, no datos simulados.

## Arquitectura

### Navegación e interacción

- Indicadores de Inicio enlazan al directorio, comunicación reciente, alarmas y GPS reciente. Iconos SVG y menú contraíble.
- Fichas rápidas nativas `<dialog>` al pulsar tarjetas/evidencia; cierre por Escape, botón o fondo y retorno del foco. Botón Regresar en rutas secundarias.
- Inicio contiene toda la flota en una franja con flechas y orden alfabético explícito. Los porcentajes del anillo son cantidad de equipos/total, no productividad.
- Mapa 2D: encuadre inicial de la concentración de equipos dentro de 20 km de una posición de referencia, botón para toda la flota, iconos individuales al acercar y acceso a ficha. No son zonas oficiales ni un mapa 3D.
- `/api/telemetry/track`: rango máximo de 24 h, última posición real por intervalo de 30 s, reproducción acelerada por muestras y separación visual de huecos >2 min o saltos >2 km. Estos criterios visuales no clasifican eventos de conducción. No hay escrituras a MongoDB.
- Alertas: tarjetas filtrables, avisos visuales y sonido optativo activado por gesto del usuario. Detecta nuevas banderas recientes observadas mientras el navegador está abierto/visible. No sustituye un servicio persistente de notificaciones. “Revisada” solo dura en la sesión; no resuelve ni reconoce incidentes en un servidor.
- Historial: una a cuatro señales, mismo rango con ejes separados. Área para nivel de combustible, escalones para horómetro y líneas para señales continuas; no se usan gráficos circulares para temperaturas.
- Reportes: filtros por modelo/comunicación, distribución y barras, CSV del subconjunto e impresión/PDF mediante el navegador. La media de nivel usa únicamente lecturas recientes e indica su denominador. No equivale a consumo.

Nuevos módulos: `ui.js`, `map-explorer.js`, `alerts.js`, `compare-history.js`, `report-explorer.js`, `interactions.css`. Las consultas de avisos no reinician los filtros ni formularios de las vistas de investigación.

### Actualización visual de marca

Refinamiento: iconos duotono integrados en el menú; Inicio usa mosaico de flota, anillos de comunicación/GPS y proporción de equipos con alarmas. La distribución de estados prioriza “equipos con estado conocido ahora” y filas explicadas, con enlaces a cada grupo. Duty sigue sin interpretarse como productividad. Campana, bloque de alarmas y aviso emergente abren un diálogo de notificaciones con su última evidencia; cada aviso permite abrir la ficha rápida. La ficha completa reduce cabecera y deja contadores secundarios desplegables, sin ocultar la calidad del dato de los medidores visibles.

La vista principal usa el logo suministrado, negro, amarillo `#fecc16` y turquesa `#1a9a9b`. `public/app/visual.js` y `visual.css` contienen tarjetas de maquinaria, distribución circular de estados, barras de combustible y medidores individuales. Se reutiliza el icono de tractor existente; no es una foto específica de cada activo.

La tendencia en Inicio y ficha consulta datos reales al cambiar equipo, señal o periodo (1/6/24 h). El periodo termina en la última lectura disponible de esa señal y conserva fechas visibles, huecos y avisos de truncamiento. Las selecciones sobreviven a la actualización de 15 s. Los gráficos se destruyen al abandonar la vista y el caché de tendencias está limitado.

Amarillo identifica la marca y el estado de ralentí en el gráfico; no indica por sí solo gravedad. Gris representa señales atrasadas y medidores sin vigencia. Las escalas circulares son visuales, no límites OEM. El directorio permite alternar tarjetas/lista con los mismos filtros.

```text
server.js                      Arranque
src/config.js                  Configuración privada desde entorno/.env
src/app.js                     Servidor y endpoints heredados
src/config/equipment.json      Catálogo inicial derivado del proyecto
src/domain/telemetry.js        Valores, vigencia y alarmas de origen
src/routes/fleet.js            Snapshot compartido de últimos datos
src/routes/history.js          Consulta histórica nueva y acotada
public/index.html              Estructura accesible y navegación
public/app/                   Pantallas, cliente API, formatos y estilos
public/legacy/                Interfaz técnica preservada
tests/                        Casos críticos de semántica y validación
```

El snapshot reutiliza el índice existente `{gateway:1,name:1,date:-1}`. Las lecturas se ejecutan con concurrencia limitada y caché de 5 s por proceso. No es todavía un procesador central de eventos ni un estado materializado en MongoDB. El siguiente escalón dependerá de volumen y usuarios medidos.

## Contrato de datos

- `fresh`: lectura dentro de la vigencia provisional configurada.
- `stale`: última lectura conservada, sin afirmar que representa el presente.
- `missing`: sin valor numérico válido o sin fecha.
- `invalid`: fecha demasiado adelantada.
- La vigencia predeterminada de 120 s es una referencia técnica provisional, no un límite OEM. Debe configurarse por señal después del levantamiento de frecuencias reales.
- Un cero válido se conserva. Una desconexión no pone en cero el horómetro ni resuelve alarmas.
- El GPS tiene una fecha propia; recibir STATE no actualiza su vigencia.
- Privacidad GPS: `GPS_PRIVACY_ENABLED=true` aplica en el servidor `lat'=lat+GPS_LAT_OFFSET` y `lon'=lon+GPS_LON_OFFSET` tanto a marcadores como a recorridos. Usa `false` para restaurar las coordenadas originales. La vista independiente del mapa está disponible en `/mapa`.
- Duty conserva el nombre original: no se afirma producción hasta validar su definición.
- Sin un documento completo de alarmas reciente, la condición es desconocida. No hay diagnóstico de salud del activo.
- Se exige confirmar unidades y sentinelas del protocolo antes del uso comercial; el normalizador actual no sustituye esa auditoría.

## Seguridad y límites de esta entrega

El servidor escucha exclusivamente en loopback y restringe Host a localhost/loopback. No hay autenticación multiusuario ni aislamiento de clientes: **no exponer mediante túneles o proxy público**. Ping de red desactivado por defecto, activable con `ENABLE_PING=true` en el entorno autorizado.

No se crearon índices, usuarios, colecciones ni documentos en MongoDB. No se rotaron credenciales ni se alteró la ingesta. Deben revisarse permisos mínimos, TLS, backups restaurables y retención antes de producción.

La vista técnica y endpoints históricos heredados se preservan por compatibilidad. Sus agregaciones/continuidad y semáforos de referencia no deben usarse para reportes oficiales; la nueva vista usa `/api/telemetry/history` sin arrastrar muestras anteriores al periodo. La vista técnica ya no fuerza ceros ni desplaza posiciones; conserva otras limitaciones documentadas.

Leaflet/Chart.js se cargan desde CDN; el mapa base usa OpenStreetMap. Para producción, fijar/venderizar dependencias y contratar/configurar cartografía con capacidad y permisos adecuados. Las capas de mina no están inventadas.

Sites hosting no es compatible directamente con la conexión TCP del driver MongoDB de este proyecto. No se publicó ni se subió la fuente. Un despliegue requiere un servidor Node adecuado o diseñar una API HTTP protegida antes de integrar otro hosting.

## Validar y continuar

```powershell
npm run check
npm test
# Con el servidor local funcionando en el puerto 4002:
node scripts/smoke.cjs
```

Casos para revisar con el usuario: buscar un D8, abrir ficha, contrastar fecha GPS frente a comunicación, consultar una señal histórica, descargar CSV, confirmar que una alarma vieja se sigue mostrando y un horómetro no se vuelve cero al desconectar.

Siguiente entrega: catálogo editable con identidad del activo independiente del gateway; contratos por señal; autenticación y permisos; reglas versionadas de eventos y flujo de atención; planes preventivos con órdenes persistentes; reportes por turno. Ninguno de esos procesos se presenta como implementado en esta versión.


### Actualización gráfica y reportes históricos (31 agosto)
- Inicio: dona interactiva por estado y barras por tipo de alarma. Los gráficos representan últimas lecturas, no frecuencia histórica de incidentes.
- La sincronización de flota ahora consulta cada 5 s sin remontar la vista activa; Chart.js conserva la instancia de tendencia. No es transmisión push ni tiempo real garantizado. Las consultas históricas y reportes son a demanda; estadísticas del equipo se consultan como máximo cada 30 s.
- Ficha: histogramas reales de RPM y refrigerante en la hora anterior a la última lectura RPM, con extremos y promedio por muestra. No son horas de utilización.
- Alertas: dona de vigencia y barras por tipo, además de evidencia consultable.
- GPS: conserva encuadre al sincronizar; resumen de posiciones recientes, antiguas y ausentes, escala métrica. Continúa siendo cartografía 2D OpenStreetMap.
- Reportes: selección de equipo, señal y fechas (183 días máximo), vista estadística y CSV histórico con fecha, unidad, promedio, extremos y cantidad de muestras por intervalo cuando corresponda. Si un periodo corto supera 5000 lecturas, la API resume automáticamente todo el rango por intervalos y conserva promedio, mínimo, máximo y cantidad; no descarta el final de la consulta ni transforma el histórico agregado en datos crudos.

### Aplicación Android

La vista **Aplicación** descarga `public/downloads/mintronick-operaciones.apk`. El APK abre exclusivamente `https://dashboard-demo.mintronick.com`, requiere Android 7 o posterior e Internet, y utiliza el mismo login del servidor. La interfaz se actualiza desde el servidor sin generar otro APK. El APK incluido está firmado para instalación interna y pruebas; para distribución pública debe firmarse con una clave definitiva que se conserve fuera del repositorio.

La misma vista ofrece **MinTronick Sync** desde `public/downloads/mintronick-sync.apk`. El QR local apunta a `https://dashboard-demo.mintronick.com/downloads/mintronick-sync.apk`. Versión publicada: `1.0.0-eval`; SHA-256: `34EAB16B1D1C26E56461A7E1B4A2635780B64D2754A29F1A2AE0D0912B07E9C7`.


### Experiencia de presentación y exportación múltiple
- Inicio usa command-center.js: mapa de contexto, revisión priorizada (alarmas recientes, después desconexión), matriz de vigencia por señal y tendencia. No calcula productividad ni inventa umbrales.
- El directorio deja de repetir las gráficas de Inicio: resumen, filtros por modelo, comunicación y nombre, tarjetas con señales adicionales.
- Historial comparte catálogo signals.js con Reportes: 12 variables, seis iniciales, selección completa, periodos rápidos y ampliación de gráficos. Solicitudes limitadas a tres en paralelo.
- Reportes usa report-studio.js: equipos y variables múltiples, fechas hasta 183 días, CSV largo y resumen. La resolución agregada es 1 minuto hasta 24 horas, 5 minutos hasta 7 días, 30 minutos hasta 31 días, 2 horas hasta 93 días y 6 horas hasta 183 días. Medias ponderadas por número de muestras válidas; no medias ponderadas por tiempo. Exportación bloqueada ante errores o truncamiento.
- Mapa: selección persistente, seguir posición reciente, ficha contextual, recorrido bajo demanda, pantalla completa y agrupaciones legibles. Sigue siendo OSM 2D; no se agregó un proveedor satelital ni se simula 3D.
- Modo feria amplía el espacio y oculta la barra lateral; se sale desde el mismo botón. No agrega datos de demostración. Requiere conexión con MongoDB y acceso a CDN/mapas.

Las agregaciones usan el índice existente gateway/name/date y hasta 45 s de ejecución; el cliente permite 60 s para historial. Un reporte amplio puede tardar: el progreso cuenta combinaciones completadas. Ante fallo de una combinación, no se habilita una exportación parcial como si fuera completa. La preparación para feria requiere validar conectividad y el comportamiento visual en la pantalla final; las pruebas automatizadas no sustituyen esa revisión.


### Inicio: significado y motivos de cada bloque
- Recepción: identifica por nombre quién envió al menos un dato dentro de la vigencia configurada. No prueba conexión permanente ni motor encendido.
- Atención: solo observaciones reales; prioridad exclusiva alarma reciente, ausencia de datos recientes y alarma antigua. Sin equipos de relleno ni selección arbitraria de cuatro.
- Mapa de Inicio: zona con mayor concentración aproximada dentro de 20 km; contador visible de equipos en el encuadre y botón para toda la flota. Grupos abren la identidad de los equipos sin desplazar coordenadas.
- Estados: distribución de equipos con estado reciente, leyenda interactiva y denominador explícito. Duty conserva su interpretación pendiente; no se llama productividad.
- Alarmas: barras apiladas por tipo separan evidencia reciente de antigua. El total cuenta banderas; un equipo puede tener varios tipos.
- Matriz: últimas lecturas independientes por señal, con unidades y antigüedad. Clic abre significado, fecha y alarmas asociadas; sin umbrales de seguridad inventados.
- Notificaciones: gráficos, selección por tipo y tarjetas agrupadas por equipo. Se actualizan mientras el diálogo permanece abierto; abrir evidencia no reconoce ni resuelve la alarma.


### Inicio compacto y tarjetas visuales
- Resumen en una franja con cuatro indicadores; recepción por equipo en una segunda fila desplegable.
- Atención usa imagen del equipo, contador e iconos específicos por tipo de alarma. El motivo y la evidencia permanecen accesibles; no se inventan curvas ni gravedad.
- Estado añade etiquetas de equipos por estado para que cada cantidad sea identificable. Las lecturas antiguas siguen separadas.
- El mapa conserva OSM y coordenadas; modo oscuro mediante estilo de contraste del mosaico, con retorno a mapa claro. No es satélite.
- Referencias funcionales consultadas: Cat VisionLink (https://www.cat.com/en_US/products/new/technology/visionlink/visionlink/132082.html), Komatsu Telematics (https://www.komatsu.com/en-us/services-and-support/equipment-monitoring-and-analysis/telematics). Se toma la jerarquía mapa/indicadores/acceso a equipos, sin copiar marcas ni atribuir capacidades no implementadas.

### Comunicación, tema y GPS (31 agosto)
El inicio usa un indicador «Datos recibidos» y deja el detalle por equipo plegado. Atención agrupa alarmas y ausencia de comunicación; no interpreta ausencia de datos como motor apagado. El estado separa transmisión y estado operativo y oculta categorías vacías. La distribución de alarmas queda desplegable.
Tema claro/oscuro persistente mediante mintronick-theme. Las fichas rápidas se actualizan con la consulta de flota; sus accesos de alarma filtran el centro de avisos por equipo. Los avisos por equipo/código tienen un intervalo mínimo de 120 segundos, además de detección de cambios.
El GPS consulta al seleccionar equipo. Permite terminar el periodo ahora o en la última posición histórica, reproducir muestras reales y activar actualización del recorrido cada 30 segundos sin mover la vista. La flota se consulta cada 5 segundos mientras la pestaña está visible; las señales conservan su propia fecha. No es recepción simultánea de sensores.
Verificación: 17 pruebas automatizadas, revisión sintáctica y smoke de API local. Consultas de recorrido devolvieron 2871 posiciones recientes de D8T-2 y 2881 históricas de D8T-1. Sin inspección visual de navegador en esta iteración.

### Ajustes de presentación y alcance (31 agosto)
- `equipment.json` es la lista autorizada: la API ya no incorpora gateways desconocidos encontrados en MongoDB.
- Estado de flota muestra Duty, Ralentí, Encendido, Apagado y Sin comunicación; las lecturas que no permiten inferir estado operativo se omiten de la distribución sin convertirlas en apagado.
- Distribución de alarmas visible, tarjetas de equipo compactas con símbolos de estado y alarma, alarmas con iconografía, tema oscuro neutro y mapa con menos texto.
- Historial con rangos rápidos y selector personalizado; reportes de hasta 183 días con agregación de 6 horas para seis meses. Para rangos superiores a 30 días se limitan a seis combinaciones equipo-variable por generación.
- Breakpoints añadidos para móvil, tablet, escritorio y pantallas de 1900 px o más.
- Recorrido validado en la API con 2868 muestras reales de D8T-2; el proceso local fue reiniciado para cargar la ruta.

### Correcciones de instancia y navegación (31 agosto)
La instancia antigua de 4001 fue reemplazada por el servidor actual. `/api/fleet` devuelve 17 entradas del catálogo, ninguna sin catalogar; la vista operativa oculta TEST y muestra 16. Historial acepta todas las 12 variables (antes el selector capturaba otros controles y bloqueaba el resultado). API verificada con 3113 puntos RPM y 2872 posiciones GPS para D8T-4. El mapa actualiza marcadores con cada consulta de flota de 5 s y destaca GPS reciente; no interpola posiciones no transmitidas.

### Trazo, historial y CSV (31 agosto)
- El mapa ofrece Último desplazamiento por defecto. Ordena muestras, elimina saltos GPS que regresan al punto anterior, reduce jitter inferior a 8 m y corta discontinuidades; 1/6/24 h siguen disponibles. En D8T-2 redujo 2864 muestras a 174 puntos para 24 h y 33 para el último movimiento, conservando muestras reales.
- Historial corregido: Aplicar ahora es un submit identificable y el estado de carga se libera al terminar. Consulta real RPM validada con 787 puntos.
- El CSV de datos cambió a formato ancho: una fila por equipo y fecha, encabezados descriptivos en español y bloques valor/mínimo/máximo/muestras por variable. El CSV resumen permanece separado.

### Clasificación de estado operativo (1 septiembre)
La comunicación general mantiene vigencia de 120 s y cada señal conserva su propia vigencia. La vista combina los documentos STATE, RPM, carga y velocidad sin alterar los valores originales: Operando requiere motor activo y movimiento, carga o Duty; Ralentí requiere motor activo con baja velocidad y sin evidencia de trabajo; Apagado exige un Off reciente; Sin conexión significa que no llega ninguna señal; Estado no confirmado cubre GPS u otros datos recientes sin evidencia vigente del motor. GPS y velocidad cero, por sí solos, no prueban ralentí.

La interfaz se actualiza cada 5 s sin botones manuales. Los recorridos eliminan vibración estacionaria y separan saltos mayores a 2 min o incompatibles con una velocidad máxima de 25 km/h, evitando dibujar teletransportes como trayectos. Alertas permite descargar un CSV de avisos y abrir evidencia, historial o equipo desde cada tarjeta.

### Prueba temporal desde un celular
Con el PC y el celular en la misma red Wi-Fi, ejecuta `npm run dev:lan` y abre en el celular `http://IP-DE-TU-PC:4001` (por ejemplo, `http://192.168.100.10:4001`). Windows puede pedir permiso de firewall para redes privadas. Este modo expone la telemetría a otros dispositivos de esa red y no tiene autenticación; se debe usar solo para pruebas y detener con Ctrl+C. `npm run dev` conserva el acceso exclusivo desde el PC. No se necesita VPN para la misma red; para producción se requiere HTTPS, autenticación y un servidor o túnel administrado.

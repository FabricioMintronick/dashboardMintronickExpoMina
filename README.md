# MINTRONICK · Operaciones

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
- Historial de una señal por consulta, hasta 31 días, límites explícitos y mínimos/máximos al agregar.
- CSV de situación con fechas y calidad por señal. No es reporte de producción ni de turno.
- Mantenimiento: inventario de horómetros y requisitos pendientes, **no ejecuta planes ni órdenes**.
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
- Mantenimiento: motivos derivados de alarmas y ausencia de planes. Nunca afirma que un equipo esté en taller, tenga una orden abierta o un servicio vencido sin esos registros.

Nuevos módulos: `ui.js`, `map-explorer.js`, `alerts.js`, `compare-history.js`, `report-explorer.js`, `maintenance.js`, `interactions.css`. Las consultas de avisos no reinician los filtros ni formularios de las vistas de investigación.

### Actualización visual de marca

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

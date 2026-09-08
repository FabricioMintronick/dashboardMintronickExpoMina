# Integración mínima de encoder y sensor lineal

No se necesita otra API ni otra colección. El servicio `mtk-ingest-service` existente ya recibe MQTT, normaliza `TS`, convierte cadenas numéricas y guarda los documentos con `IotDataModel` en la colección `iotdatas`. El dashboard consulta esa misma colección.

## Mensajes MQTT

Agregar estos dos tópicos a `mqtt/TOPIC_LIST.json`, conservando el formato que ya usa el archivo:

```text
1/Gateway01/ENCODER/R
1/Gateway01/SENSOR_LINEAL/R
```

Publicar un objeto JSON por sensor. `TS` debe ser una fecha ISO con zona horaria.

```text
Tópico: 1/Gateway01/ENCODER/R
Payload: {"TS":"2026-09-08T15:30:00Z","ANGULO":"37.4"}
```

```text
Tópico: 1/Gateway01/SENSOR_LINEAL/R
Payload: {"TS":"2026-09-08T15:30:01Z","DISTANCIA":"428.2"}
```

El flujo actual produce documentos equivalentes a:

```javascript
{customer: 1, gateway: "Gateway01", name: "ENCODER", ANGULO: 37.4, date: ISODate("2026-09-08T15:30:00Z"), received_at: ISODate(...), source: "R"}
{customer: 1, gateway: "Gateway01", name: "SENSOR_LINEAL", DISTANCIA: 428.2, date: ISODate("2026-09-08T15:30:01Z"), received_at: ISODate(...), source: "R"}
```

No hay que cambiar `models/data.js`, `messageHandler.js` ni `dataBufferManager.js`: el esquema usa `strict: false` y el buffer ya admite `ANGULO` y `DISTANCIA` como campos dinámicos numéricos.

## Índice recomendado

Crear una sola vez en la base configurada por `MONGODB_DATABASE`:

```javascript
db.iotdatas.createIndex({gateway: 1, name: 1, date: -1})
```

El dashboard usa `MONGO_COLLECTION=iotdatas`, elige automáticamente el primer gateway con estas lecturas y actualiza las tarjetas cada dos segundos. Una lectura ausente se presenta como `—`, nunca como cero.

## Comprobación rápida

Después de publicar ambos mensajes:

```javascript
db.iotdatas.find(
  {gateway: "Gateway01", name: {$in: ["ENCODER", "SENSOR_LINEAL"]}},
  {gateway: 1, name: 1, ANGULO: 1, DISTANCIA: 1, date: 1}
).sort({date: -1}).limit(4)
```

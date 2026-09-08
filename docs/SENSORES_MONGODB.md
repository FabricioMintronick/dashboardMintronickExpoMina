# Colección MongoDB para sensores

El dashboard consulta por defecto la colección `sensors` de la misma base definida en `MONGO_DB`. El nombre puede cambiarse con `MONGO_SENSORS_COLLECTION`.

Cada lectura debe guardarse como un documento independiente:

```javascript
{
  gateway: "Gateway01",
  sensorId: "ENC-01",
  type: "ENCODER",
  variable: "ANGULO",
  value: 37.4,
  unit: "°",
  date: ISODate("2026-09-08T15:30:00Z")
}
```

```javascript
{
  gateway: "Gateway01",
  sensorId: "LIN-01",
  type: "SENSOR_LINEAL",
  variable: "DISTANCIA",
  value: 428.2,
  unit: "mm",
  date: ISODate("2026-09-08T15:30:01Z")
}
```

Campos obligatorios: `gateway`, `sensorId`, `type`, `variable`, `value` y `date`. `value` debe ser numérico y `date` debe ser una fecha BSON, no texto. El dashboard no transforma una lectura ausente en cero.

Crear la colección y su índice desde `mongosh`:

```javascript
use MTKDATA
db.createCollection("sensors", {
  validator: {$jsonSchema: {
    bsonType: "object",
    required: ["gateway", "sensorId", "type", "variable", "value", "date"],
    properties: {
      gateway: {bsonType: "string"},
      sensorId: {bsonType: "string"},
      type: {enum: ["ENCODER", "SENSOR_LINEAL"]},
      variable: {enum: ["ANGULO", "DISTANCIA"]},
      value: {bsonType: ["double", "int", "long", "decimal"]},
      unit: {bsonType: "string"},
      date: {bsonType: "date"}
    }
  }},
  validationLevel: "strict",
  validationAction: "error"
})
db.sensors.createIndex({gateway: 1, variable: 1, date: -1})
```

El proceso que reciba MQTT será responsable de insertar estas lecturas. La página web solo consulta MongoDB y refresca las dos tarjetas cada dos segundos.

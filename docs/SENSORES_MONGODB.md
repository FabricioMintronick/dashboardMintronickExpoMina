# Integración mínima de encoder y sensor lineal

No se necesita otra API ni otra colección. El servicio `mtk-ingest-service` existente ya recibe MQTT, normaliza `TS`, convierte cadenas numéricas y guarda los documentos con `IotDataModel` en la colección `iotdatas`. El dashboard consulta esa misma colección.

## Mensajes MQTT

La suscripción existente ya cubre ambos sensores y no necesita cambios:

```text
["1/+/+/+"]
```

Publicar un objeto JSON por sensor mediante la acción de respaldo `/B`. `TS` debe ser una fecha ISO con zona horaria.

```text
Tópico: 1/Gateway01/ENCODER/B
Payload: {"TS":"2026-09-08T15:30:00Z","ANGULO":"37.4"}
```

```text
Tópico: 1/Gateway01/SENSOR_LINEAL/B
Payload: {"TS":"2026-09-08T15:30:01Z","DISTANCIA":"428.2"}
```

El flujo actual produce documentos equivalentes a:

```javascript
{customer: 1, gateway: "Gateway01", name: "ENCODER", ANGULO: 37.4, date: ISODate("2026-09-08T15:30:00Z"), received_at: ISODate(...), source: "B"}
{customer: 1, gateway: "Gateway01", name: "SENSOR_LINEAL", DISTANCIA: 428.2, date: ISODate("2026-09-08T15:30:01Z"), received_at: ISODate(...), source: "B"}
```

No hay que cambiar `TOPIC_LIST.json`, `models/data.js`, `messageHandler.js` ni `dataBufferManager.js`: el comodín ya recibe estos tópicos, el esquema usa `strict: false` y el flujo `/B` guarda `ANGULO` y `DISTANCIA`, evita duplicados por fecha y publica el ACK existente.

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

## Ejemplo del publicador en C

Este ejemplo usa `libmosquitto`, publica con QoS 1 y mantiene las credenciales fuera del código. Las funciones `leer_angulo()` y `leer_distancia()` deben reemplazarse por la lectura real del hardware.

```c
#include <mosquitto.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

static void fecha_iso_utc(char *destino, size_t capacidad) {
    time_t ahora = time(NULL);
    struct tm utc;
    gmtime_r(&ahora, &utc);
    strftime(destino, capacidad, "%Y-%m-%dT%H:%M:%SZ", &utc);
}

static int publicar(struct mosquitto *cliente, const char *topico,
                    const char *variable, double valor) {
    char fecha[32], payload[160];
    fecha_iso_utc(fecha, sizeof fecha);
    snprintf(payload, sizeof payload,
             "{\"TS\":\"%s\",\"%s\":\"%.2f\"}",
             fecha, variable, valor);
    return mosquitto_publish(cliente, NULL, topico,
                             (int)strlen(payload), payload, 1, false);
}

int main(void) {
    const char *host = getenv("MQTT_HOST");
    const char *usuario = getenv("MQTT_USERNAME");
    const char *clave = getenv("MQTT_PASSWORD");
    int puerto = getenv("MQTT_PORT") ? atoi(getenv("MQTT_PORT")) : 1883;

    mosquitto_lib_init();
    struct mosquitto *cliente = mosquitto_new("gateway01-sensores", true, NULL);
    if (!cliente || !host) return 1;
    if (usuario && *usuario)
        mosquitto_username_pw_set(cliente, usuario, clave);
    if (mosquitto_connect(cliente, host, puerto, 30) != MOSQ_ERR_SUCCESS)
        return 2;
    mosquitto_loop_start(cliente);

    publicar(cliente, "1/Gateway01/ENCODER/B", "ANGULO", 37.4);
    publicar(cliente, "1/Gateway01/SENSOR_LINEAL/B", "DISTANCIA", 428.2);

    /* En producción, mantener el loop activo y publicar cada nueva lectura. */
    mosquitto_disconnect(cliente);
    mosquitto_loop_stop(cliente, false);
    mosquitto_destroy(cliente);
    mosquitto_lib_cleanup();
    return 0;
}
```

Compilar en Linux con:

```bash
gcc sensores.c -o sensores -lmosquitto
```

Para TLS, configurar `mosquitto_tls_set()` con la CA antes de conectar. No desactivar la verificación del certificado en producción.

## Pruebas del dashboard

Para comprobar primero MongoDB y la lectura web sin depender del hardware:

```powershell
$env:SENSOR_TEST_GATEWAY="Gateway01"
npm run sensors:test-data -- write
```

Abrir `#sensors`; los valores 37.4° y 428.2 mm deben aparecer en un máximo aproximado de dos segundos. Después se eliminan únicamente los documentos marcados por esta prueba:

```powershell
npm run sensors:test-data -- clean
```

Para comprobar después el recorrido completo por MQTT, publicar manualmente:

```bash
mosquitto_pub -h BROKER -p 1883 -u USUARIO -P CLAVE -q 1 \
  -t '1/Gateway01/ENCODER/B' \
  -m '{"TS":"2026-09-08T15:30:00Z","ANGULO":"37.4"}'

mosquitto_pub -h BROKER -p 1883 -u USUARIO -P CLAVE -q 1 \
  -t '1/Gateway01/SENSOR_LINEAL/B' \
  -m '{"TS":"2026-09-08T15:30:01Z","DISTANCIA":"428.2"}'
```

Usar la fecha UTC actual al ejecutar la prueba; una fecha antigua aparecerá como lectura atrasada. No escribir la contraseña real dentro de scripts o del repositorio.

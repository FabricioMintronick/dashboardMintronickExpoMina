# Guía de instalación y colaboración

Esta rama está preparada para que otra persona desarrolle sin modificar directamente la rama de trabajo principal. Las credenciales, secretos y conexiones privadas deben mantenerse únicamente en el archivo local `.env`.

## 1. Programas necesarios

Instala lo siguiente en Windows:

1. **Git para Windows:** https://git-scm.com/download/win
2. **Node.js 22 LTS:** https://nodejs.org/
3. **Visual Studio Code:** https://code.visualstudio.com/

Durante la instalación de Git y Node.js se pueden conservar las opciones predeterminadas. Después, cierra y vuelve a abrir PowerShell y verifica:

```powershell
git --version
node --version
npm.cmd --version
```

La versión principal de Node debe ser `22`.

## 2. Descargar la rama de colaboración

Solicita acceso al repositorio de GitHub antes de continuar. En PowerShell:

```powershell
cd "$HOME\Desktop"
git clone https://github.com/FabricioMintronick/dashboardMintronickExpoMina.git mintronick-dashboard-colaboracion
cd mintronick-dashboard-colaboracion
git switch ingenieria-desarrollo
git pull --ff-only origin ingenieria-desarrollo
```

Confirma que estás en la rama correcta:

```powershell
git branch --show-current
```

Debe responder `ingenieria-desarrollo`.

## 3. Instalar las dependencias

```powershell
npm.cmd ci
```

Se usa `npm.cmd` porque algunas instalaciones de Windows bloquean `npm.ps1` mediante la política de PowerShell. No es necesario desactivar esa protección.

## 4. Crear la configuración local

Copia el archivo de ejemplo:

```powershell
Copy-Item .env.example .env
```

Genera un secreto compatible con Windows PowerShell 5 y PowerShell 7:

```powershell
$bytes = New-Object byte[] 32
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$rng.Dispose()
$secret = ($bytes | ForEach-Object { $_.ToString('x2') }) -join ''
$secret
```

Abre `.env` en Visual Studio Code:

```powershell
code .env
```

Configuración mínima para abrir la interfaz sin telemetría:

```dotenv
MONGO_URI=
MONGO_DB=MTKDATA
MONGO_COLLECTION=iotdatas
PORT=4100
ALLOW_LAN=false
DASHBOARD_USER=colaboradora
DASHBOARD_PASSWORD=reemplazar-por-clave-segura
AUTH_SECRET=pegar-aqui-el-secreto-generado
AUTH_COOKIE_SECURE=false
```

Para ver datos reales se necesita una cadena `MONGO_URI` entregada por la persona responsable del servidor. No debe enviarse por Git, mensajes públicos ni capturas de pantalla.

Para configurar varios usuarios manualmente, reemplaza `DASHBOARD_USER` y `DASHBOARD_PASSWORD` por una sola línea JSON:

```dotenv
DASHBOARD_USERS_JSON={"colaboradora":"clave-segura-1","revision":"clave-segura-2"}
```

El archivo `.env` está excluido de Git. Cada desarrollador mantiene su propia configuración.

## 5. Ejecutar y validar

Inicia el servidor con recarga automática:

```powershell
npm.cmd run dev
```

Abre `http://127.0.0.1:4100`. Para detenerlo, vuelve a PowerShell y pulsa `Ctrl+C`.

Antes de guardar cambios ejecuta:

```powershell
npm.cmd test
npm.cmd run check
```

Si aparece `EADDRINUSE`, el puerto ya está ocupado. Puedes cerrar el proceso anterior o cambiar `PORT` en `.env`, por ejemplo a `4101`.

## 6. Probar desde una tablet en la misma red

La computadora y la tablet deben estar conectadas a la misma red Wi-Fi. Cambia temporalmente en `.env`:

```dotenv
ALLOW_LAN=true
AUTH_COOKIE_SECURE=false
```

Reinicia el servidor y consulta la dirección IPv4 del equipo:

```powershell
ipconfig
```

Si la dirección es `192.168.100.10` y el puerto es `4100`, abre en Chrome de la tablet:

```text
http://192.168.100.10:4100
```

Autoriza Node.js en el Firewall de Windows únicamente para redes privadas. Al terminar la prueba, detén el servidor y vuelve a `ALLOW_LAN=false`.

La APK incluida abre el servidor publicado. Para probar cambios locales en la tablet se usa esta dirección del navegador; la APK solo reflejará cambios cuando consulte una web que ya los tenga disponibles.

## 7. Flujo de trabajo diario

Antes de comenzar:

```powershell
git switch ingenieria-desarrollo
git pull --ff-only origin ingenieria-desarrollo
```

Después de modificar y validar:

```powershell
git status
git add ruta\del\archivo-modificado
git commit -m "tipo: descripción breve del cambio"
git push origin ingenieria-desarrollo
```

Ejemplos de tipos: `feat`, `fix`, `docs`, `refactor` y `test`. Se deben agregar solamente los archivos relacionados con el cambio; nunca `.env`, contraseñas, archivos `.keystore`, logs, paquetes `.tgz` ni bases de datos.

## 8. Cómo entregar cambios al responsable

La colaboradora debe abrir un Pull Request en GitHub:

- Rama de origen: `ingenieria-desarrollo`
- Rama de destino: la rama que indique el responsable
- Incluir qué problema resuelve, qué cambió y cómo se validó
- Adjuntar capturas para cambios visuales en laptop, tablet horizontal y tablet vertical

No se debe fusionar directamente ni desplegar en el servidor sin revisión. Si ambas ramas cambian el mismo archivo, el conflicto se resuelve en el Pull Request sin reemplazar todo el archivo.

## 9. Reglas del proyecto

- No escribir, borrar ni modificar datos de MongoDB desde el dashboard.
- No convertir datos ausentes o inválidos en cero.
- Conservar la fecha y vigencia de cada señal.
- No inventar estados, producción, alarmas ni umbrales técnicos.
- Mantener el diseño usable en laptop, tablet horizontal, tablet vertical y móvil.
- No subir secretos ni credenciales.
- Ejecutar pruebas y revisión de sintaxis antes de cada entrega.

## 10. Problemas frecuentes

**PowerShell bloquea `npm.ps1`:** usa `npm.cmd`.

**`EADDRINUSE`:** ya existe un servidor usando el puerto. Cambia `PORT` o detén el proceso anterior.

**Falta `AUTH_SECRET`:** confirma que `.env` esté en la raíz, que el secreto tenga al menos 32 caracteres y que no haya espacios antes del nombre de la variable.

**El login funciona pero no hay equipos:** falta `MONGO_URI`, la red no permite llegar a MongoDB o la cuenta no tiene permisos de lectura.

**La tablet no abre la página:** confirma la misma red Wi-Fi, `ALLOW_LAN=true`, la IPv4 correcta y el permiso de Firewall para red privada.

**Cambios visuales no aparecen:** recarga sin caché con `Ctrl+F5` en Windows. En tablet, cierra y vuelve a abrir la pestaña; si se prueba una versión publicada, primero debe desplegarse esa versión.


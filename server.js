require('./src/app').main().catch(() => { console.error('No se pudo iniciar la aplicación'); process.exitCode = 1; });

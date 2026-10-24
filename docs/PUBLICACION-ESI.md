# ESI: entrega para publicar — 24/10/2026

## Estado comprobado

Código local: `C:\Users\lorbe\Desktop\DESARROLLO\ESI CRIS\ESI`.
Repositorio: https://github.com/munozalbelonicolas/ESI
Firebase de producción: `esienescuelas-1b97b`. Sitio: https://esiensecundaria.com.ar

El trabajo permanece local: no hubo commit, push, deploy, migración ni modificación de datos/reglas de producción. La cuenta Vercel disponible en este equipo (lorbeafus / nilo-tech) no administra ESI. La usuaria confirmó que Nico tiene el acceso.

La entrega ZIP es una copia del código revisado, incluidos los archivos nuevos. No contiene .env, claves, node_modules, dist, .git ni la sesión Vercel. No equivale a una publicación.

### Validaciones locales

- Compilación TypeScript/Vite: correcta.
- `npm run test:local`: 26/26 pruebas correctas, código de salida 0. Incluye Auth y Firestore Emulator, reglas reales de Firestore, reserva concurrente del último cupón, handlers reales de pago/descarga y contenido del correo con proveedor simulado.
- `npm run lint`: 0 errores, 11 advertencias previas.
- `git diff --check`: correcto.
- El paquete del navegador fue revisado: no contiene los secretos de servidor de .env.local.
- La migración de enlaces fue probada con productos ficticios gratuitos y pagos: la vista previa no escribió y la migración conservó los enlaces completos en la colección privada.
- Una credencial válida de Mercado Pago respondió a GET /users/me. Esto no prueba un cobro ni un webhook real.
- No se envió correo real ni se cobró dinero. Resend sigue pendiente; Correo Argentino no es necesario para el catálogo actual, compuesto por productos digitales.

### Lectura de producción, sin cambios

El 24/10/2026 se consultó Firebase de producción con campos limitados, mediante la sesión Firebase CLI autorizada:

- 42 productos activos y digitales: 29 pagos y 13 gratuitos.
- 42 enlaces HTTPS válidos para trasladar a productDownloads.
- 0 enlaces inválidos.
- 8 pedidos pendientes; ninguno tiene cupón.
- El inventario por nombre/ID está en INVENTARIO-ENLACES-2026-10-24.md.
- Se guardó un respaldo privado de enlaces fuera del repositorio, en el equipo de Lorbe. No se incluye en el ZIP ni se debe subir a Git. Crear un respaldo actualizado antes del corte real.

Las reglas de producción copiadas por la usuaria permiten leer products completos, incluido digitalFileUrl. Las correcciones locales no protegen producción hasta efectuar el corte.

## Qué cambió

- Los enlaces pasan de products/digitalFileUrl a la colección privada productDownloads.
- Los gratuitos usan un endpoint público que valida que el producto sea gratuito y activo.
- Los pagos requieren sesión, titularidad y pedido con pago aprobado.
- Cristina sigue pegando la URL en el formulario de producto. El almacenamiento privado es automático. La migración se ejecuta una sola vez para los productos existentes y tiene vista previa y confirmación.
- El catálogo público consulta solo productos activos con publicCatalogReady=true; no muestra datos ficticios en producción ante un error.
- Los pedidos y sus importes se crean en servidor; el cupón se reserva atómicamente para respetar siempre maxUses.
- El pago valida firma, referencia, moneda, importe e idempotencia. Un aviso pendiente atrasado ya no puede sobrescribir una aprobación concurrente.
- Transferencias requieren aprobación administrativa y comprobante. El correo no se marca enviado si falta Resend o falla su entrega. Mercado Pago envía el correo con estado aprobado.

## Pasos de Nico

1. Abrir el proyecto Vercel existente de ESI desde su cuenta. No crear otro proyecto ni cambiar el dominio. Integrar todos los archivos revisados, incluidos api nuevos, reglas, índices y tests. Revisar que el commit no incluya .env ni respaldos privados.

2. Verificar variables en Vercel, por entorno:
   - VITE_SITE_URL=https://esiensecundaria.com.ar; VITE_API_BASE_URL vacío si las API se sirven en el mismo sitio.
   - VITE_FIREBASE_* y FIREBASE_PROJECT_ID apuntan al mismo proyecto esienescuelas-1b97b.
   - FIREBASE_CLIENT_EMAIL y FIREBASE_PRIVATE_KEY válidos del Admin SDK.
   - MP_ACCESS_TOKEN, VITE_MP_PUBLIC_KEY y MP_WEBHOOK_SECRET de la misma integración de Mercado Pago.
   - CRON_SECRET aleatorio y privado para ambas tareas programadas.
   - RESEND_API_KEY, FROM_EMAIL con dominio validado y ADMIN_EMAIL, cuando se habilite correo.

   MP_WEBHOOK_SECRET, CRON_SECRET y RESEND_API_KEY no estaban configurados en el archivo local. El estado de esas variables en Vercel es desconocido. La clave privada local no pasó la validación PEM: no copiarla sin comprobarla. No imprimir ni compartir secretos.

3. Crear un deployment candidato y comprobar que el build de Vercel, las API y la credencial Firebase Admin funcionan. No promover una compilación fallida. La compilación local no sustituye este build. Comprobar el flujo de Mercado Pago con credenciales/cuentas de prueba en un entorno separado de producción, incluidos retorno, firma del webhook y descarga posterior. No probar compras sobre datos reales sin coordinarlo.

4. Publicar solo los índices y esperar a que estén disponibles:
   `firebase deploy --only firestore:indexes --project esienescuelas-1b97b`
   Las consultas nuevas necesitan firestore.indexes.json. No desplegar todavía hosting ni reglas de forma aislada.

5. Crear un respaldo fresco de los enlaces. Se puede usar scripts/release-preflight.mjs con un archivo local de variables válido:
   `node scripts/release-preflight.mjs --production-read-only --env-file=.env.production.local --backup-output=RUTA_ABSOLUTA_FUERA_DEL_REPOSITORIO.json`
   El script solo consulta datos. El respaldo contiene URLs privadas y debe guardarse fuera del repositorio; no enviarlo por canales públicos. El inventario visible no incluye URLs completas ni datos personales de compradores. Confirmar nuevamente que no hay pedidos pendientes con cupones; si aparecieron, conciliarlos antes de activar la nueva reserva.

6. Coordinar una ventana breve de mantenimiento para el corte. No hacer la migración con el sitio anterior operando normalmente: el código anterior depende del campo digitalFileUrl. Preparar el deployment nuevo y los accesos de publicación antes de iniciar. Pausar cambios de productos durante el corte.

7. Desde el panel administrativo del deployment candidato configurado intencionalmente para ese Firebase, abrir “Revisar enlaces existentes”. Primero ejecutar la vista previa. El resultado leído era 42 enlaces válidos y 0 inválidos; si cambió, revisar la diferencia. Confirmar la migración solo después de revisar esa vista previa y tener el respaldo.

8. Después de migrar, sin prolongar el mantenimiento:
   - Publicar reglas nuevas: `firebase deploy --only firestore:rules --project esienescuelas-1b97b`.
   - Promover el deployment nuevo en Vercel.
   - Verificar que el catálogo carga y retirar el mantenimiento.

   Mantener coordinados ambos cambios. El código nuevo filtra publicCatalogReady; las reglas nuevas impiden crear pedidos directamente desde el navegador. Durante el corte, clientes con pestañas antiguas podrían necesitar recargar.

9. Verificar con datos autorizados:
   - 42 documentos migrados (o el número confirmado por la vista previa actualizada); products sin digitalFileUrl, enlaces conservados en productDownloads y marcadores de catálogo correctos.
   - Un visitante ve productos y puede descargar un gratuito, pero no obtiene enlaces pagos leyendo products ni productDownloads.
   - Una cuenta cliente no puede cambiar su rol a admin ni acceder al pedido o archivo de otra cuenta.
   - Pago pendiente no habilita descarga; el aprobado del titular sí.
   - Un mismo pago notificado varias veces no duplica usos de cupones ni descuenta stock varias veces.
   - MP_WEBHOOK_SECRET valida las notificaciones reales y la URL de webhook es https://esiensecundaria.com.ar/api/mp-webhook.
   - Ambos cron autentican con CRON_SECRET. Sin ese secreto no se liberan automáticamente las reservas vencidas.
   - Si Resend sigue sin clave, avisar que el correo continúa deshabilitado. Las descargas aprobadas siguen disponibles en Mis pedidos. No anunciar correo operativo hasta comprobarlo.

## Recuperación

Guardar la URL/versión del deployment anterior y el respaldo antes del corte. Tras mover los enlaces, el código anterior no es compatible con el esquema privado. Si falla el corte, mantener el mantenimiento y corregir o restaurar una versión compatible con productDownloads. No volver a las reglas permisivas ni hacer públicos los enlaces para resolver una caída.

No usar firebase deploy sin --only: Firebase Hosting no ejecuta estas API Vercel y no es el destino de esta publicación.

## Verificación reproducible

```text
npm ci
npm run build
npm run lint
npm run test:local
```

La última prueba local usó exclusivamente demo-esi-local; requiere Java 21 y Firebase CLI. No conecta esos tests a Firebase real.

El paso pendiente de publicación requiere a Nico o acceso delegado por él al proyecto correcto. Este documento y la entrega no se enviaron a terceros automáticamente.

Guía consultada para preparar el despliegue: deploy-to-vercel, instalada en C:/Users/lorbe/.agents/skills/deploy-to-vercel/SKILL.md.

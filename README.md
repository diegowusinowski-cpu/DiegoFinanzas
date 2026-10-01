# DWF — Dieto Wusinowski Finanzas

Aplicación web mobile-first (PWA) de finanzas personales. Etapa 1: acceso por PIN y dashboard
(saldo, ingresos/gastos, recordatorios, últimos movimientos, Dólar Blue).

## Comandos

```bash
npm install
npm run dev        # desarrollo (http://localhost:5173, expuesto en la red)
npm run build      # typecheck + build de producción (PWA)
npm run preview    # sirve el build (incluye /api/dolar-blue)
npm run typecheck && npm run lint && npm test
npm run e2e        # prueba en Chromium móvil contra BASE_URL (por defecto localhost:5173)
```

## Arquitectura

| Capa | Ubicación | Responsabilidad |
|---|---|---|
| Dominio | `src/domain` | Modelos (`Account`, `Transaction`, `Category`, `Reminder`) y lógica financiera pura (saldo, validación, estados, recordatorios). Sin React ni I/O. |
| Persistencia | `src/data` | Contratos `Repositories` asíncronos sobre un `DocumentStore`: base de datos real vía backend (`RemoteDocumentStore`) o, solo sin servidor, respaldo local (`LocalDocumentStore`). Sin `delete`: los movimientos se cancelan. |
| Servicios | `src/services` | `AuthService` (PIN verificado en el servidor; PIN local solo en el respaldo), `ExchangeRateProvider` (cotización del dólar). Interfaces intercambiables. |
| Estado | `src/state` | Contextos de React que orquestan dominio + repositorios. |
| UI | `src/ui` | Componentes reutilizables y pantallas. |
| Servidor | `api`, `server` | `api/dwf.ts` (base de datos, acceso y datos) y `api/dolar-blue.ts` (cotización) como funciones de Vercel; `server/` los sirve en `vite dev`/`preview` y trae scripts y pruebas. |

El saldo nunca se guarda: se deriva de los movimientos `COMPLETED`.

## Próximos pasos previstos

- Préstamos, cuotas y cobros: generar recordatorios implementando `ReminderGenerator` (`src/domain/reminders.ts`).
- Cuentas múltiples: `Transaction.accountId` y `computeBalance(tx, accountId)` ya existen.
- Producción: `/api/dolar-blue` es una función de Vercel (`api/dolar-blue.ts`); en `vite dev`/`vite preview` lo sirve el plugin `server/ratesApi.ts` con la misma lectura.

## Producción: base de datos, acceso y despliegue

**Cómo se guardan los datos.** La fuente de verdad es una base PostgreSQL (Neon) detrás del backend `api/dwf.ts`. Movimientos (con sus estados COMPLETED / SCHEDULED / CANCELLED), préstamos, cuotas, ahorros, recordatorios y el saldo en dólares se guardan ahí; el saldo en pesos siempre se calcula desde los movimientos guardados. El navegador no guarda datos (localStorage solo guarda la caché de la última cotización). Los datos no dependen de la versión publicada: redeployar no los toca. No existe ninguna operación de borrado en la app ni en la API.

**Seguridad básica.** PIN guardado solo como hash PBKDF2 con sal; intentos fallidos contados en la base (bloqueo progresivo de 30 s hasta 15 min, también contra intentos en paralelo); sesión en cookie firmada HttpOnly + SameSite=Strict + Secure (12 h); la API acepta solo POST JSON con una cabecera propia, sin CORS; solo existe una cuenta (después del primer ingreso nadie más puede crear otra); cabeceras de seguridad (CSP, HSTS, X-Frame-Options, etc.) definidas en `vercel.json`.

**Variables de entorno.** Solo `DATABASE_URL` (Postgres de Neon). La integración de Neon en Vercel la carga sola; no hay que escribirla a mano. Opcional: `SESSION_SECRET`. Ver `.env.example`.

**Schema y migraciones.** Se crean y actualizan solas: `api/dwf.ts` aplica las migraciones pendientes (`MIGRATIONS`) la primera vez que recibe una solicitud. También se pueden aplicar a mano con `npm run db:migrate`. Para cambiar el schema se agrega una migración nueva al final de la lista.

### Publicar (pasos que tenés que hacer vos, una sola vez)

1. En [vercel.com](https://vercel.com) → *Add New… → Project* → importar el repositorio `diegowusinowski-cpu/diegofinanzas` (rama a publicar). Framework: Vite (ya lo define `vercel.json`). *Deploy*.
2. En el proyecto de Vercel → pestaña **Storage** → *Create Database* → **Neon (Postgres)** → plan gratuito → conectarla a este proyecto (marcar Production, Preview y Development). Eso crea `DATABASE_URL` automáticamente.
3. **Redeploy** (Deployments → ⋯ → Redeploy) para que la app tome la variable.
4. Abrir la URL de producción desde el celular. En el primer ingreso cargás tu teléfono y tu PIN: esa pasa a ser tu cuenta. Si Inicio muestra "La base de datos no está configurada", falta el paso 2 o el 3.
5. Instalar como app (PWA): en el celular, menú del navegador → *Agregar a pantalla de inicio*.

### Administrar la base (desde tu computadora)

Con `DATABASE_URL` definida (por ejemplo `vercel env pull .env.local` y `export $(cat .env.local | xargs)`) actúan sobre producción; sin ella, sobre la base local `.data/pglite`.

| Comando | Qué hace |
| --- | --- |
| `npm run db:status` | Cuántos datos hay en cada colección. |
| `npm run db:list -- transactions` | Lista los datos de una colección (id y resumen). |
| `npm run db:clean -- --yes` | Borra los datos cargados (movimientos, préstamos, cuotas, ahorros y dólares). Conserva la cuenta y el PIN. |
| `npm run db:delete -- <colección> <id> --yes` | Borra UN dato puntual. |
| `npm run db:reset-pin -- 1234` | Cambia el PIN sin tocar los datos (la app no permite "crear un PIN nuevo" porque cualquiera podría quedarse con tus datos). |

### Local

`npm run dev` levanta la app con una base PostgreSQL embebida (PGlite, en `.data/pglite`): el mismo SQL y el mismo backend que en producción, sin instalar nada. Para probar contra Neon, definir `DATABASE_URL`.

## Tasas de conversión (Dólar Blue) — sin configuración

La cotización se obtiene sola, sin variables de entorno ni pasos en el hosting. Orden de fuentes:

1. **Servidor propio** `/api/dolar-blue` (si existe: `npm run dev`, `npm run preview` o Vercel): lee **DolarHoy.com** (portada y `/cotizaciondolarblue`) y, si falla, **DolarAPI.com** y **Bluelytics**.
2. **Directo desde el navegador** (hosting estático, sin servidor): **DolarAPI.com** y, si falla, **Bluelytics** (APIs públicas con CORS).

Siempre se guarda la última cotización válida en el dispositivo: si todas las fuentes fallan se muestra esa, con su fecha y fuente. Se actualiza al abrir la app, cada 30 minutos y al volver a la pestaña. Un dato con más de 72 h se descarta mientras otra fuente tenga uno más reciente. Nunca hay valores de ejemplo en producción.

- Lectura y respaldo: `api/dolar-blue.ts` (autocontenido; es además la función de Vercel). Navegador: `src/services/liveRateProvider.ts`. Caché: `src/services/rateCache.ts`.
- Opcional: `VITE_RATES_ENDPOINT` apunta la app a otro servidor propio (la función responde con CORS abierto).
- Despliegue en Vercel: importar el repositorio y *Deploy* (no hay nada más que configurar). Cualquier otro hosting estático (Netlify, GitHub Pages, un `dist/` subido a un servidor) también funciona: la cotización llega por las fuentes públicas.

La app usa HTTPS, requisito de la PWA y del cifrado del PIN (`crypto.subtle`).

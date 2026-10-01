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
| Persistencia | `src/data` | Contratos `Repositories` asíncronos + implementación localStorage versionada. Sin `delete`: los movimientos se cancelan. |
| Servicios | `src/services` | `AuthService` (PIN local con PBKDF2), `ExchangeRateProvider` (DolarHoy). Interfaces intercambiables. |
| Estado | `src/state` | Contextos de React que orquestan dominio + repositorios. |
| UI | `src/ui` | Componentes reutilizables y pantallas. |
| Servidor | `server` | Endpoint `/api/dolar-blue` (lee y parsea dolarhoy.com; el navegador no puede por CORS). |

El saldo nunca se guarda: se deriva de los movimientos `COMPLETED`.

## Próximos pasos previstos

- Backend/DB: implementar `Repositories` y `AuthService` remotos y cambiarlos en `src/services/container.ts`.
- Préstamos, cuotas y cobros: generar recordatorios implementando `ReminderGenerator` (`src/domain/reminders.ts`).
- Cuentas múltiples: `Transaction.accountId` y `computeBalance(tx, accountId)` ya existen.
- Producción: `/api/dolar-blue` es una función de Vercel (`api/dolar-blue.ts`); en `vite dev`/`vite preview` lo sirve el plugin `server/ratesApi.ts` con la misma lectura.

## Tasas de conversión (Dólar Blue) — sin configuración

La cotización se obtiene sola, sin variables de entorno ni pasos en el hosting. Orden de fuentes:

1. **Servidor propio** `/api/dolar-blue` (si existe: `npm run dev`, `npm run preview` o Vercel): lee **DolarHoy.com** (portada y `/cotizaciondolarblue`) y, si falla, **DolarAPI.com** y **Bluelytics**.
2. **Directo desde el navegador** (hosting estático, sin servidor): **DolarAPI.com** y, si falla, **Bluelytics** (APIs públicas con CORS).

Siempre se guarda la última cotización válida en el dispositivo: si todas las fuentes fallan se muestra esa, con su fecha y fuente. Se actualiza al abrir la app, cada 30 minutos y al volver a la pestaña. Un dato con más de 72 h se descarta mientras otra fuente tenga uno más reciente. Nunca hay valores de ejemplo en producción.

- Lectura y respaldo: `api/dolar-blue.ts` (autocontenido; es además la función de Vercel). Navegador: `src/services/liveRateProvider.ts`. Caché: `src/services/rateCache.ts`.
- Opcional: `VITE_RATES_ENDPOINT` apunta la app a otro servidor propio (la función responde con CORS abierto).
- Despliegue en Vercel: importar el repositorio y *Deploy* (no hay nada más que configurar). Cualquier otro hosting estático (Netlify, GitHub Pages, un `dist/` subido a un servidor) también funciona: la cotización llega por las fuentes públicas.

La app usa HTTPS, requisito de la PWA y del cifrado del PIN (`crypto.subtle`).

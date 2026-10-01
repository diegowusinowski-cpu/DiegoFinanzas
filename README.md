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

## Despliegue (Vercel) y Dólar Blue

1. En vercel.com → *Add New Project* → importar este repositorio (rama a publicar). Framework: Vite (lo define `vercel.json`).
2. **No hace falta ninguna variable de entorno.** `api/dolar-blue.ts` se publica solo como función (Node, `maxDuration` 15 s), lee DolarHoy.com del lado del servidor y la app lo consume en `/api/dolar-blue` (mismo origen: sin CORS).
3. Verificación después del deploy: abrir `https://TU-DOMINIO/api/dolar-blue`. Debe devolver JSON con `buy`, `sell`, `updatedAt`, `fetchedAt` y `source` (`DolarHoy.com`). Si devuelve `502 {"error":"source_unavailable"|"parse_failed"}`, DolarHoy no respondió o cambió su HTML (ver los logs de la función en Vercel → *Logs*); la app sigue mostrando la última cotización válida guardada.
4. Si la app se sirve desde OTRO dominio que la función, definir en el build `VITE_RATES_ENDPOINT=https://TU-DOMINIO-VERCEL/api/dolar-blue` (la función ya responde con CORS abierto).

La lectura usa la estructura actual de DolarHoy (`.title a[href="/cotizaciondolarblue"]` + `.values .compra/.venta .val` + `.update`), con la portada y la página `/cotizaciondolarblue` como fuentes, y un respaldo por texto. Cubierta por `server/dolarhoy.test.ts`.

La app usa HTTPS, requisito de la PWA y del cifrado del PIN (`crypto.subtle`).

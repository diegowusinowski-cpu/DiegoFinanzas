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
- Producción: `/api/dolar-blue` hoy lo sirve el plugin de Vite (`dev` y `preview`); en un hosting real hay que desplegar el mismo handler (`server/ratesApi.ts`) como función/servidor.

// La lectura de DolarHoy.com vive en `api/dolar-blue.ts` (función de Vercel, autocontenida).
// Se reexporta acá para el servidor de Vite (dev/preview) y las pruebas.
export * from '../api/dolar-blue.ts'

import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach } from 'vitest'
import { resetLucaGreeting } from '@/ui/luca/greeting'

// jsdom/vitest no manejan bien blob: URLs de Blobs propios; se usan para mostrar la imagen del comprobante.
URL.createObjectURL = () => 'blob:dwf-test'
URL.revokeObjectURL = () => undefined

afterEach(() => cleanup())

// Luca saluda una vez por sesión: cada prueba arranca como una sesión nueva.
beforeEach(() => resetLucaGreeting())

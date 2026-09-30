import { describe, expect, it } from 'vitest'
import { DEFAULT_CATEGORIES } from './categories'
import type { Transaction } from './models'
import { buildTransaction, sortByRecency, type NewTransactionInput } from './transactions'
import { filterMovements, groupMovements, matchesQuery, normalizeText, periodLabel } from './movementsView'

// Miércoles 7 de octubre de 2026.
const TODAY = '2026-10-07'
const NOW = new Date(2026, 9, 7, 12, 0)
let seq = 0
const make = (over: Partial<NewTransactionInput> = {}): Transaction =>
  buildTransaction(
    {
      accountId: 'a',
      type: 'EXPENSE',
      amount: 1_000_000,
      description: 'Colectivo',
      categoryId: 'exp-transport',
      date: TODAY,
      time: '09:00',
      ...over,
    },
    { id: `t${++seq}`, now: new Date(NOW.getTime() + seq) },
  )

describe('normalizeText', () => {
  it('ignora mayúsculas y tildes', () => {
    expect(normalizeText('Préstamos Ñandú')).toBe('prestamos nandu')
  })
})

describe('búsqueda', () => {
  const t = make({ description: 'Netflix', categoryId: 'exp-subscriptions', amount: 1_250_050, date: '2026-10-02' })
  const cat = 'Suscripciones y tecnología'
  it.each([
    ['netflix', 'concepto'],
    ['NETFLIX', 'mayúsculas'],
    ['suscripciones', 'categoría'],
    ['tecnologia', 'categoría sin tilde'],
    ['gasto', 'tipo'],
    ['gastos', 'tipo plural'],
    ['12.500,50', 'importe con formato'],
    ['12500', 'importe sin formato'],
    ['12.500', 'importe sin decimales'],
    ['$ 12.500,50', 'importe con símbolo'],
    ['2026-10-02', 'fecha ISO'],
    ['02/10/2026', 'fecha dd/mm/aaaa'],
    ['2 de octubre', 'fecha larga'],
    ['octubre', 'mes'],
    ['netflix octubre', 'varias palabras'],
  ])('%s → coincide (%s)', (query) => {
    expect(matchesQuery(t, cat, query, TODAY)).toBe(true)
  })

  it.each(['spotify', 'ingreso', '999', '2026-11-02', 'netflix noviembre'])('%s → no coincide', (query) => {
    expect(matchesQuery(t, cat, query, TODAY)).toBe(false)
  })

  it('una búsqueda vacía coincide con todo', () => {
    expect(matchesQuery(t, cat, '   ', TODAY)).toBe(true)
  })

  it('"hoy" y "ayer" funcionan como fecha', () => {
    expect(matchesQuery(make(), 'x', 'hoy', TODAY)).toBe(true)
    expect(matchesQuery(make({ date: '2026-10-06' }), 'x', 'ayer', TODAY)).toBe(true)
    expect(matchesQuery(make({ date: '2026-10-06' }), 'x', 'hoy', TODAY)).toBe(false)
  })
})

describe('filtro + búsqueda', () => {
  const list = [
    make({ description: 'Netflix', categoryId: 'exp-subscriptions' }),
    make({ description: 'Netflix reembolso', type: 'INCOME', categoryId: 'inc-loans' }),
    make({ description: 'Sueldo', type: 'INCOME', categoryId: 'inc-employment' }),
    make({ description: 'Nafta', categoryId: 'exp-transport' }),
  ]
  const run = (filter: 'ALL' | 'EXPENSE' | 'INCOME', query = '') =>
    filterMovements(list, { filter, query }, DEFAULT_CATEGORIES, TODAY).map((t) => t.description)

  it('Todos', () => expect(run('ALL')).toHaveLength(4))
  it('Gastos', () => expect(run('EXPENSE')).toEqual(['Netflix', 'Nafta']))
  it('Ingresos', () => expect(run('INCOME')).toEqual(['Netflix reembolso', 'Sueldo']))
  it('Gastos + "Netflix" solo trae gastos que coinciden', () => expect(run('EXPENSE', 'Netflix')).toEqual(['Netflix']))
  it('Ingresos + "Netflix" solo trae ingresos que coinciden', () => expect(run('INCOME', 'netflix')).toEqual(['Netflix reembolso']))
  it('Todos + "Netflix" trae ambos', () => expect(run('ALL', 'netflix')).toHaveLength(2))
  it('sin resultados', () => expect(run('EXPENSE', 'sueldo')).toEqual([]))

  it('una frase exacta tiene prioridad sobre palabras sueltas', () => {
    const dated = [make({ description: 'A', date: '2026-10-02' }), make({ description: 'B', date: '2026-10-20' }), make({ description: 'C', date: '2026-10-06' })]
    const out = filterMovements(dated, { filter: 'ALL', query: '2 de octubre' }, DEFAULT_CATEGORIES, TODAY)
    expect(out.map((t) => t.description)).toEqual(['A'])
  })

  it('si la frase no existe, cada palabra puede coincidir en un dato distinto', () => {
    const out = filterMovements(list, { filter: 'ALL', query: 'nafta gasto' }, DEFAULT_CATEGORIES, TODAY)
    expect(out.map((t) => t.description)).toEqual(['Nafta'])
  })
})

describe('períodos', () => {
  it.each([
    ['2026-10-08', 'Próximos'],
    ['2026-10-07', 'Hoy'],
    ['2026-10-06', 'Ayer'],
    ['2026-10-05', 'Esta semana'], // lunes de la semana actual
    ['2026-10-04', 'Este mes'], // domingo anterior: otra semana
    ['2026-10-01', 'Este mes'],
    ['2026-09-30', 'Septiembre'],
    ['2026-01-15', 'Enero'],
    ['2025-12-31', 'Diciembre 2025'],
  ])('%s → %s', (date, label) => {
    expect(periodLabel(date, TODAY)).toBe(label)
  })

  it('si hoy es lunes, el fin de semana anterior ya no es "Esta semana"', () => {
    expect(periodLabel('2026-10-04', '2026-10-05')).toBe('Ayer')
    expect(periodLabel('2026-10-03', '2026-10-05')).toBe('Este mes')
  })

  it('agrupa de forma cronológica y dinámica', () => {
    const list = sortByRecency([
      make({ date: '2026-10-07', description: 'a' }),
      make({ date: '2026-10-06', description: 'b' }),
      make({ date: '2026-10-05', description: 'c' }),
      make({ date: '2026-10-02', description: 'd' }),
      make({ date: '2026-09-10', description: 'e' }),
      make({ date: '2025-03-01', description: 'f' }),
    ])
    const groups = groupMovements(list, TODAY)
    expect(groups.map((g) => g.label)).toEqual(['Hoy', 'Ayer', 'Esta semana', 'Este mes', 'Septiembre', 'Marzo 2025'])
    expect(groups.map((g) => g.items.map((t) => t.description))).toEqual([['a'], ['b'], ['c'], ['d'], ['e'], ['f']])
  })

  it('junta los movimientos del mismo período', () => {
    const list = sortByRecency([make({ description: 'x' }), make({ description: 'y' })])
    expect(groupMovements(list, TODAY)).toHaveLength(1)
  })
})

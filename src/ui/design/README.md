# Design system DWF

Fuente única: `tokens.css` (paleta → semánticos → tipografía, espaciado, radios, sombras, íconos, movimiento). `base.css` define los roles tipográficos (`type-*`), `interactive` (hover/pressed/disabled/transición), foco y reset.

Regla: los componentes usan solo tokens semánticos (`bg-canvas`, `text-fg`, `bg-action`, `rounded-card`, …), nunca colores de la paleta base.

| Necesidad | Usar |
|---|---|
| Fondo / card / hundido / panel financiero | `bg-canvas` / `Card surface` / `Card sunken` / `Card panel` |
| Texto | `text-fg`, `text-fg-soft` (secundario), `text-fg-muted` (deshabilitado) |
| Positivo / advertencia / error | `text-positive`, `text-warning`, `text-danger` (+ `-bg`) |
| Botones | `Button` (primary, secondary, tertiary, destructive, inverse, glass; size sm 36 / md 44 / lg 52), `IconButton` |
| Íconos | `Icon` (size sm/md/lg, trazo `--icon-stroke`) |
| Tipografía | `type-money` + `type-money-cents` (saldo), `type-display`, `type-heading`, `type-title` (sección), `type-subheading` (fila), `type-eyebrow` (label), `type-button`, `type-number` |
| Radios | `rounded-pill`, `-card`, `-panel`, `-sheet`, `-control`, `-chip` |
| Tamaños | `size-avatar` (36), `min-h-control-sm/md/lg`, `min-h-input` (48), `min-h-nav-item` (44) |
| Espaciado | escala de 4px + `px-gutter`, `gap-section`, `gap-block`, `py-row`, `gap-tight` |

Nota: `tokens.css` usa `@theme static` para que Tailwind emita también las variables que no generan utilidades (íconos, movimiento).

Roles de color: background=`canvas`, surface=`surface`, surface elevated=`surface-elevated`, dark surface=`panel`, primary=`action`/`on-action`, secondary=`sunken`, text=`fg`, muted text=`fg-soft`, border=`line`, success=`positive`, warning=`warning`, error=`danger`.

## Identidad (tipografías y logotipo)

- `--font-ui` (DM Sans): textos, títulos, botones, labels y navegación.
- `--font-display-numeric` (Anton): **solo** cifras financieras. Utilidades `type-money`, `type-money-cents`, `type-amount*`, `type-number`, `type-number-row` y `font-numeric`. No usar en textos largos.
- `LogoDiegoFinanzas` (`src/ui/brand`): DIEGO / FINANZAS apilado, en curvas SVG (`size` `sm` en el Home, `lg` en acceso). Se regenera con `python3 scripts/generate-logo.py` (requiere `fonttools`); `node scripts/generate-icons.mjs` regenera los íconos PWA.

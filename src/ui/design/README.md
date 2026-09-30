# Design system DWF

Fuente única: `tokens.css` (paleta → semánticos → tipografía, espaciado, radios, sombras, íconos, movimiento). `base.css` define los roles tipográficos (`type-*`), `interactive` (hover/pressed/disabled/transición), foco y reset.

Regla: los componentes usan solo tokens semánticos (`bg-canvas`, `text-fg`, `bg-action`, `rounded-card`, …), nunca colores de la paleta base.

| Necesidad | Usar |
|---|---|
| Fondo / card / hundido / panel financiero | `bg-canvas` / `Card surface` / `Card sunken` / `Card panel` |
| Texto | `text-fg`, `text-fg-soft` (secundario), `text-fg-muted` (deshabilitado) |
| Positivo / advertencia / error | `text-positive`, `text-warning`, `text-danger` (+ `-bg`) |
| Botones | `Button` (primary, secondary, tertiary, destructive; size sm/md), `IconButton` |
| Íconos | `Icon` (size sm/md/lg, trazo `--icon-stroke`) |
| Tipografía | `type-display-xl` (saldo), `type-display`, `type-heading`, `type-title`, `type-subheading`, `type-eyebrow` (label), `type-button`, `type-number` |
| Radios | `rounded-pill`, `-card`, `-panel`, `-sheet`, `-control`, `-chip` |
| Espaciado | escala de 4px + `px-gutter`, `gap-section`, `p-card`, `gap-item`, `gap-tight` |

Nota: `tokens.css` usa `@theme static` para que Tailwind emita también las variables que no generan utilidades (íconos, movimiento).

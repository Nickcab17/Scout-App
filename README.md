# BIOBUZZ FTC Scouting

Aplicación de scouting para BIOBUZZ 2026–2027. Mantiene modo local y espacios multiusuario con Supabase cuando se configura el proyecto externo.

## Funcionalidad

- Equipos, partidos y observaciones con almacenamiento local, importación y exportación JSON.
- Captura de cantidades AUTO/TELEOP y estimaciones según el manual BIOBUZZ TU06.
- Estadísticas por equipo a partir de observaciones con scoring confirmado.
- Cuentas, grupos, roles, invitaciones y sincronización de scouting por grupo con Supabase.
- Sección **Eventos oficiales** con eventos, calendario híbrido y resultados publicados por FTC Events.
- Selector de paletas, modo claro/oscuro y personalización de apariencia.

Los valores de puntos y umbrales se basan en el [manual BIOBUZZ TU06](https://ftc-resources.firstinspires.org/ftc/game/cm-html/BIOBUZZ%20Competition%20Manual%20-%20TU06.htm). El scoring de scouting se identifica como estimado. Los puntos de pool permanecen pendientes porque el manual consultado no define esa métrica.

## Desarrollo y comprobaciones

Node.js 20.9 o posterior y npm.

```bash
npm install
npm run dev
```

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run test:e2e
npm run build
```

## Configurar FTC Events

Solicita acceso en [FTC Events API registration](https://ftc-events.firstinspires.org/services/API/register). Define en el servidor, nunca en variables `NEXT_PUBLIC_*`:

```env
FTC_EVENTS_USERNAME=
FTC_EVENTS_AUTHORIZATION_KEY=
```

El adaptador usa el índice de temporadas `GET /v2.0`, eventos `/v2.0/{season}/events`, detalle de evento con el parámetro oficial `eventCode`, equipos `/v2.0/{season}/teams?eventCode=...`, calendario híbrido `/v2.0/{season}/schedule/{eventCode}/{qual|playoff}/hybrid`, resultados `/v2.0/{season}/matches/{eventCode}?tournamentLevel=...` y detalles de scoring `/v2.0/{season}/scores/{eventCode}/{qual|playoff}`. Los nombres de parámetros y los campos HTTP oficiales se conservan; el adaptador traduce sus valores a tipos internos. La caché del servidor es temporal en memoria y el calendario descargado se conserva en el almacenamiento local del navegador.

Las respuestas FIRST respetan `Last-Modified` / `If-Modified-Since`, timeout y reintentos manuales. Ante una falla se conserva la respuesta válida en memoria y el navegador mantiene su última copia local. Los equipos obtenidos por evento son datos oficiales independientes de los registros locales de pit scouting.

## Configurar Supabase

1. Crea un proyecto Supabase y habilita autenticación por correo y contraseña.
2. Para espacios remotos existentes, aplica `supabase/migrations/202610270001_biobuzz_core.sql`. FTC Events no requiere migración ni conexión a Supabase.
3. Define `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`; registra `/auth/callback` como URL de retorno.
4. Las consultas de FTC Events y la selección del evento permanecen en caché y almacenamiento local; la integración oficial no escribe datos en Supabase.
5. Comprueba RLS con cuentas de grupos diferentes.

FTC Events publica datos cuando FIRST los sincroniza; los resultados y score details pueden no estar disponibles para eventos futuros o partidos en curso. La interfaz conserva los calendarios programados aunque falten resultados.

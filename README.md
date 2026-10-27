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

El adaptador utiliza `GET /v2.0/{season}/events` y `/v2.0/{season}/schedule/{eventCode}/{qual|playoff}/hybrid`. El formato híbrido incluye programación y resultados disponibles con puntajes finales, autónomos y de faltas. Las consultas respetan `Last-Modified` / `If-Modified-Since` y conservan la última descarga correcta ante fallas.

Para compartir y persistir la caché oficial entre instancias, configura también `SUPABASE_URL` (o `NEXT_PUBLIC_SUPABASE_URL`) y `SUPABASE_SERVICE_ROLE_KEY` como secretos de servidor. Sin esa clave privada, la caché se guarda en el navegador. La selección de evento se asocia al grupo cuando hay una sesión y grupo Supabase activos.

## Configurar Supabase

1. Crea un proyecto Supabase y habilita autenticación por correo y contraseña.
2. Aplica `supabase/migrations/202610270001_biobuzz_core.sql` y `supabase/migrations/202610270002_first_official_data.sql`.
3. Define `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`; registra `/auth/callback` como URL de retorno.
4. Configura `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en servidor para guardar la caché oficial compartida. No incluyas esta clave en el navegador ni en el repositorio.
5. Comprueba RLS con cuentas de grupos diferentes.

No se configuró un proyecto remoto ni se hizo una solicitud autenticada real a FIRST en este entorno. FTC Events publica datos después de que el torneo concluye y se sincroniza; la interfaz no promete datos en tiempo real.

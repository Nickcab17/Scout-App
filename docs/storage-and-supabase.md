# Almacenamiento y fuentes oficiales

## Datos de scouting

Sin sesión/grupo, equipos, partidos y observaciones usan `localStorage` (`biobuzz-scout-v1`) con importación/exportación JSON. Con Supabase configurado, esas entidades se sincronizan en el grupo elegido bajo RLS. La importación local exige confirmación, valida la estructura y verifica los datos persistidos antes de ofrecer borrar la copia local.

## Eventos y resultados FIRST

La sección **Eventos oficiales** consulta FTC Events desde Route Handlers del servidor. BIOBUZZ 2026–2027 usa el año de temporada FIRST/API `2026` (el año de inicio de temporada); usar `2027` en la ruta produjo `Invalid Season Requested`. La selección previa guardada como 2027 se migra a 2026 en el cliente. Usa:

- `GET /v2.0/{season}/events`
- `GET /v2.0/{season}/schedule/{eventCode}/{qual|playoff}/hybrid`

La respuesta híbrida contiene los partidos programados y, cuando FIRST los ha publicado, los resultados finales, puntajes AUTO y de faltas. `null` sigue siendo pendiente; el valor numérico `0` se conserva como resultado oficial. Los IDs se construyen con temporada, código de evento, nivel, serie y número. La selección se guarda localmente por grupo o espacio local; el caché de calendarios se separa por los mismos identificadores.

FIRST solicita credenciales Basic Auth propias. Configura `FTC_EVENTS_USERNAME` y `FTC_EVENTS_AUTHORIZATION_KEY` solo en servidor. El adaptador pasa `If-Modified-Since` usando la última cabecera `Last-Modified`, maneja 304/401/429/desconexión y mantiene la última actualización válida si una consulta falla. Los datos y resultados provienen de la API; el código no crea eventos ni puntajes ficticios.

## Supabase

La migración base `202610270001_biobuzz_core.sql` crea grupos y datos de scouting. `202610270002_first_official_data.sql` agrega una tabla de caché global oficial y una selección por grupo. Para persistir la caché global entre instancias, configura `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` como secretos de servidor. La clave de servicio solo accede a la tabla de caché oficial y nunca se envía al cliente; el resto de datos usa RLS por sesión/grupo. Sin clave de servicio, la interfaz conserva el caché en `localStorage`.

Aplica ambas migraciones desde el flujo de migraciones del proyecto Supabase. No se ejecutó ninguna migración remota ni se configuró un proyecto en este cambio.

## Variables requeridas

```env
FTC_EVENTS_USERNAME=
FTC_EVENTS_AUTHORIZATION_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

`NEXT_PUBLIC_SUPABASE_ANON_KEY` es la clave pública protegida por RLS. No uses prefijo `NEXT_PUBLIC_` en credenciales de FTC ni en la clave `service_role`. Solicita acceso a FIRST en [FTC Events API registration](https://ftc-events.firstinspires.org/services/API/register). FIRST sincroniza los resultados después del evento, por lo que una consulta correcta no implica que los resultados de todos los partidos ya estén publicados.

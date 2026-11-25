# Auditoría de migraciones de BioBuzz

Revisión estática del repositorio. No se aplicó ni alteró ninguna migración remota.

## Orden y dependencias

1. `202610270001_biobuzz_core.sql` es la base. Define workspaces, membresías y roles, perfiles, invitaciones, temporadas, eventos, equipos, partidos, Pit Scouting, observaciones, resultados y preferencias. Crea helpers de membresía/administrador, validación de equipos en partidos, perfil automático al registrar una cuenta, aceptación de invitaciones y políticas RLS. Requiere Supabase Auth (`auth.users`, `auth.uid()`) y `pgcrypto`/`extensions.digest`.
2. `202610270002_first_official_data.sql` depende del core. Añade caché compartida de FIRST y selección de evento por workspace; los miembros pueden leer la selección y admin/scout pueden cambiarla. La caché queda reservada al rol `service_role`.
3. `202611220001_match_scouting_extended.sql` depende de `matches` y `observations` del core. Añade identificadores oficiales FIRST, acciones, datos de scoring y los índices de consulta; no reemplaza ni borra observaciones.
4. `202611240001_workspace_onboarding.sql` depende de `workspaces`, `workspace_members`, la política RLS de lectura y el trigger `workspace_owner_membership` del core. Añade una RPC `SECURITY INVOKER` que inserta el workspace y verifica la membresía Admin dentro de la misma transacción. No cambia políticas RLS ni concede acceso general.

## Revisión de seguridad

- Las tablas privadas principales tienen RLS habilitado. Los datos de scouting se consultan por membresía del workspace; las escrituras excluyen el rol `viewer`.
- Los perfiles se leen y actualizan solo por su propio `auth.uid()`. El rol no forma parte del perfil editable.
- Las invitaciones guardan el hash del token, limitan roles a `scout`/`viewer`, caducan y se aceptan solo desde una cuenta autenticada con correo coincidente.
- `first_api_cache` no concede acceso a `anon` ni `authenticated`; `workspace_event_selections` aplica RLS por workspace.
- Las credenciales del FTC Events API y cualquier clave secreta Supabase son exclusivamente de servidor. La clave pública se usa para clientes SSR/navegador.

## Antes de aplicar en un proyecto existente

### Hallazgos del código relacionado

La tabla `first_api_cache` del segundo archivo actualmente no tiene consumidor en `lib/first/cache.ts`: FIRST se consulta desde el servidor y se conserva en memoria del proceso. Por ello no se presupone caché persistente compartido al aplicar esas migraciones. La variable `SUPABASE_SECRET_KEY` no se usa en clientes ni en código de navegador; la aplicación de hoy usa la clave pública con RLS.

El primer archivo advierte que es una base para un proyecto vacío y que una instalación existente debe reconciliar su historial. Comparar esquema, tablas y filas existentes con estas tres migraciones y con el historial de migraciones del proyecto; no ejecutar el baseline a ciegas. La comprobación de salud HTTPS confirma que el proyecto Supabase responde, pero no confirma qué migraciones hay aplicadas. Ese historial no se consultó y queda pendiente de revisión desde Supabase antes de cualquier aplicación remota.

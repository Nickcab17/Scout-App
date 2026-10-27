# Almacenamiento BioBuzz

## Comportamiento disponible

Sin una sesión y un grupo seleccionado, la aplicación conserva el modo de navegador con `localStorage` (`biobuzz-scout-v1`) y exportación/importación JSON. Con Supabase configurado, la interfaz permite crear cuenta, iniciar/cerrar sesión, crear grupos y abrir datos aislados por grupo. Los cambios se envían al servidor con estado visible; un error nunca se anuncia como guardado. La migración local requiere confirmación, valida la estructura, evita duplicados al reintentar y permite borrar la copia local solo después de verificarla y confirmarlo de nuevo.

La migración versionada `supabase/migrations/202610270001_biobuzz_core.sql` agrega perfiles, membresías y roles, equipos, temporadas, eventos, partidos, observaciones, pit scouting, tareas, configuración versionada de reglas, resultados calculados, resultados oficiales, preferencias e invitaciones. RLS limita acceso por grupo y rol. No se necesita ni se usa una clave `service_role` en el cliente.

Actualmente la UI sincroniza equipos, partidos y Match Scouting. Pit Scouting, tareas, preferencias remotas, resultados históricos y administración visual de miembros/invitaciones tienen tablas preparadas pero requieren completar sus pantallas/operaciones antes de considerarlas funcionales.

## Configuración externa necesaria

1. Crear un proyecto Supabase y habilitar proveedor de correo/contraseña.
2. Aplicar la migración versionada mediante el flujo de migraciones de Supabase.
3. Definir `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` en `.env.local`, reiniciar Next.js y configurar el callback `/auth/callback` en el proveedor.
4. Verificar RLS con dos usuarios de grupos separados antes de usar datos reales.

No se configuró ni se modificó un proyecto remoto en esta implementación.

## Datos FIRST

La API oficial de FTC Events requiere credenciales que se mantienen en servidor. No hay credenciales en este proyecto; por ello no se importan eventos ni resultados externos. El motor de scoring funciona con observaciones independientes y conserva diferenciados los datos oficiales.

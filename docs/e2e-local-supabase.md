# E2E con Supabase local

Estas pruebas crean cuentas reales únicamente en el proyecto local de Supabase configurado en `supabase/config.toml`. No usan sesiones inventadas ni acceden al proyecto remoto. Los eventos FIRST pueden simularse con datos de prueba en Playwright; eso no simula la autenticación.

Requisitos: Node.js 20 o posterior (el equipo revisado tiene Node 24.18.0), Docker Desktop con el motor Linux iniciado y Supabase CLI como dependencia local del proyecto. Chromium de Playwright ya está instalado. Docker Desktop en Windows requiere WSL 2 (versión 2.1.5 o posterior), virtualización de hardware y al menos 8 GB de RAM; verifica la edición y versión de Windows en la guía oficial de Docker. En el PowerShell del proyecto:

```powershell
npm install --save-dev supabase
npx supabase --version
npx supabase start
npx supabase status
npm run test:e2e:local
```

Docker Desktop se instala desde la [guía oficial de Windows](https://docs.docker.com/desktop/setup/install/windows-install/) y debe quedar iniciado en modo Linux containers. Si WSL no está instalado o actualizado, comprueba primero `wsl --version`; la guía de Docker explica cuándo `wsl --install` o `wsl --update` requiere reiniciar o permisos elevados. `npm install` añade Supabase CLI al proyecto y actualiza `package.json`/`package-lock.json`; no la instala globalmente. El repositorio ya incluye `supabase/config.toml`, así que no ejecutes `supabase init`.

`supabase start` aplica las migraciones locales al iniciar un proyecto nuevo. `supabase db reset` también vuelve a aplicar las migraciones, pero destruye todos los datos de **esa base local**; úsalo solo si aceptas reiniciarla. No uses el modificador `--linked` ni `--remote`. `test:e2e:local` obtiene URL y clave pública desde el estado local sin imprimirlas y vuelve a comprobar que la URL sea loopback antes de lanzar Playwright. La configuración de Playwright solo pasa credenciales a Next si `PLAYWRIGHT_LOCAL_SUPABASE=1` y el host es `localhost`, `127.0.0.1` o `::1`; en otro caso los envíos al servidor web quedan vacíos. Cada prueba crea un correo aleatorio `@biobuzz.test` y un workspace real.

La guía oficial de la [CLI de Supabase](https://supabase.com/docs/guides/local-development/cli/config) documenta `config.toml`, y la guía de [pruebas de Auth](https://supabase.com/docs/guides/auth/testing-auth-flows) cubre flujos contra el servidor local.

## Inicialización remota en ScoutingApp (solo instrucciones)

No se ejecutó SQL remoto. Antes de aplicar, confirma en el dashboard que el proyecto seleccionado es **ScoutingApp**, exporta/asegura un respaldo y revisa el historial y el esquema existente: `202610270001_biobuzz_core.sql` es un baseline para proyecto vacío y no debe repetirse a ciegas sobre tablas/datos existentes.

En **ScoutingApp → SQL Editor**, ejecuta, revisa el resultado y confirma cada archivo antes de pasar al siguiente:

1. `supabase/migrations/202610270001_biobuzz_core.sql`
2. `supabase/migrations/202610270002_first_official_data.sql`
3. `supabase/migrations/202611220001_match_scouting_extended.sql`
4. `supabase/migrations/202611240001_workspace_onboarding.sql`
5. `supabase/migrations/202611250001_onboarding_profile_backfill.sql`

Verifica que la primera cree el esquema de perfiles, workspaces, miembros, invitaciones y scouting con índices, funciones, triggers y RLS; la segunda añada caché FIRST y selección de evento por workspace con sus políticas; la tercera amplíe `matches`/`observations`; la cuarta cree la RPC atómica de onboarding; y la quinta complete perfiles existentes. Registra cada archivo aplicado: en el proyecto reportado no existe `supabase_migrations.schema_migrations`. No pegues claves en SQL ni compartas `SUPABASE_SECRET_KEY`; las pruebas locales no requieren ninguna clave secreta.

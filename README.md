# BIOBUZZ FTC Scouting

Aplicación de scouting BIOBUZZ 2026–2027. Mantiene un modo local para uso sin cuenta y ofrece espacios multiusuario con Supabase cuando se configura el proyecto externo.

## Funcionalidad

- Equipos, partidos y observaciones individuales con guardado local, importación/exportación JSON.
- Registro de cantidades por AUTO/TELEOP y estimación de puntos a partir del manual BIOBUZZ TU06.
- RP estimados de alianza cuando hay registros completos y umbrales aplicables; resultado de victoria requiere resultado oficial confirmado.
- Analítica de promedios por equipo, tamaño de muestra y dispersión basada solo en scoring confirmado.
- Registro/inicio/cierre de sesión, creación de grupos, roles, invitaciones de un uso y sincronización remota con Supabase configurado.
- Importación local confirmada, validada, reintentable e inspeccionada en servidor antes de permitir borrar la copia local.
- Temas claro/oscuro, paletas y personalización existentes.

Los valores de puntos y umbrales provienen del [manual oficial BIOBUZZ TU06](https://ftc-resources.firstinspires.org/ftc/game/cm-html/BIOBUZZ%20Competition%20Manual%20-%20TU06.htm). Las estimaciones de scouting no son resultados oficiales. Los umbrales regionales y de FIRST Championship permanecen pendientes según el manual consultado. El manual no define puntos de pool; no se calcula ese valor.

## Requisitos y desarrollo

Node.js 20.9 o posterior y npm.

```bash
npm install
npm run dev
```

Comprobaciones:

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run test:e2e
npm run build
```

## Configurar Supabase

1. Crea un proyecto Supabase y habilita autenticación por correo/contraseña.
2. Aplica `supabase/migrations/202610270001_biobuzz_core.sql` mediante el flujo de migraciones de tu proyecto.
3. Define `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` en `.env.local`; configura `/auth/callback` como URL de retorno.
4. Reinicia Next.js y verifica el aislamiento RLS usando cuentas de dos grupos diferentes.

No incluyas una clave `service_role` en variables públicas o en el navegador. Esta implementación no contiene credenciales ni ha sido conectada a un proyecto remoto.

## Datos e integraciones pendientes

El modo remoto sincroniza equipos, partidos y Match Scouting con RLS y estados reales de sincronización. El esquema incluye Pit Scouting, tareas, preferencias, resultados versionados e invitaciones; algunas de esas áreas todavía no tienen pantallas CRUD completas. La importación de FIRST Events API queda pendiente de credenciales oficiales, que deben guardarse solo en servidor. Los registros y preferencias locales existentes no se transfieren automáticamente.

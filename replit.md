# Control Vehicular

Bitácora interna para una institución pública en Chile. Priorizar sencillez, estabilidad, trazabilidad y uso desde teléfonos Android; flota aproximada de ocho vehículos.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build the vehicle app and API, excluding the design sandbox
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/control-vehicular`: aplicación React responsive.
- `artifacts/api-server`: API privada, PIN y sesiones, reglas de kilometraje y avisos.
- `lib/api-spec/openapi.yaml`: contrato compartido de la API.
- `lib/db/src/schema/fleet.ts`: almacenamiento PostgreSQL.

## Architecture decisions

- El usuario pidió expresamente autenticación local sencilla por PIN. No sustituir por OAuth sin pedirlo.
- Serializar escrituras de la flota pequeña dentro de transacciones. El propósito es que dos registros simultáneos no puedan validar contra el mismo kilometraje antiguo.
- Sin vehículos, conductores o credenciales ficticios en la base institucional. La primera apertura requiere crear Administración, luego registrar vehículos y conductores.
- El correo se procesa después de confirmar el viaje. Un problema del proveedor nunca debe impedir guardar la bitácora. Usar una clave de idempotencia por ciclo de mantención y reintentos acotados dentro de la ventana de 24 horas del proveedor.
- No reiniciar alertas al corregir un viaje: una mantención nueva inicia el nuevo ciclo, evitando avisos duplicados.

## Product

Viajes con fecha automática, validación de kilometraje, combustible, acompañantes y observaciones; administración de vehículos y conductores, mantenciones, historial con filtros, correcciones auditadas y resúmenes de combustible. Costos CLP, fechas America/Santiago. Exportaciones CSV compatibles con Excel para viajes, combustible, mantenciones y kilometraje; los filtros actuales se aplican a las exportaciones.

## User preferences

Mantener `vercel.json` en la raíz desde el principio con exactamente framework `vite`, outputDirectory `dist/public` y una única regla source `/(.*)` hacia `/index.html`.
No agregar funcionalidades ajenas al control vehicular. Priorizar una versión funcional y comprobar el flujo completo antes de mejoras de diseño. La aplicación debe funcionar en Android, computador y tablet.

## Gotchas

- La configuración Vercel solicitada cubre SOLO la SPA. No despliega el servidor Express, PostgreSQL ni el proceso periódico de correo. No prometer que copiar solo `dist/public` habilita la aplicación completa. Un despliegue fuera de Replit requiere alojar también API y base de datos y conservar `/api` bajo el mismo origen.
- Resend requiere conexión autorizada y remitente verificado; configurar remitente y destinatario en Administración. Sin conexión los avisos permanecen pendientes, nunca se marcan enviados.
- PIN del conductor de exactamente 4 dígitos; Administración mantiene 6 a 12 dígitos. No almacenar ni documentar PIN en texto plano. Los PIN anteriores de conductores requieren reasignación administrativa: los hashes no pueden convertirse ni truncarse.
- Antes de guardar un viaje, mostrar un resumen y permitir confirmar o volver a corregir sin perder datos.
- Completar la configuración inicial antes de compartir la URL: el primer administrador reclama la instancia. No dejar la pantalla de configuración inicial expuesta públicamente.
- Una notificación que agota reintentos queda `failed` para revisión operativa, sin reenvío automático fuera de la ventana de idempotencia.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details

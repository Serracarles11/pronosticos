# TodosGanamos

TodosGanamos es una comunidad de pronosticos deportivos informativos para mayores de edad. No es una casa de apuestas, no admite depositos ni apuestas con dinero real y no promete ganancias.

## Puesta en marcha

```bash
pnpm install
pnpm dev
```

Configura `.env.local` a partir de `.env.example` y ejecuta las migraciones SQL de `supabase/` en orden. Para partidos reales aplica tambien `16_football_data_matches.sql`.

Comprobacion local:

```bash
pnpm check
```

## Despliegue en Vercel

El proyecto esta preparado para Vercel con `vercel.json`, `pnpm install --frozen-lockfile` y `pnpm run build`. El archivo `public/logo.webp` se usa como logo de cabecera, icono y preview social.

Build settings en Vercel:

- Framework Preset: `Next.js`
- Install Command: `pnpm install --frozen-lockfile`
- Build Command: `pnpm run build`
- Output Directory: `.next`
- Node.js: `22.x`

Variables de entorno necesarias:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
NEXT_PUBLIC_SITE_URL=https://tu-dominio.vercel.app
SUPABASE_SERVICE_ROLE_KEY=solo-en-servidor-para-cron
CRON_SECRET=secreto-para-cron
FOOTBALL_DATA_API_KEY=tu-key-football-data
FOOTBALL_DATA_BASE_URL=https://api.football-data.org/v4
FOOTBALL_DATA_SYNC_DAYS_AHEAD=14
FOOTBALL_DATA_COMPETITIONS=PL,PD,SA,BL1,FL1,CL,WC
```

Antes de publicar:

- Ejecuta todas las migraciones necesarias de `supabase/` en orden, incluyendo `16_football_data_matches.sql` si usas partidos reales.
- En Supabase Authentication, anade estas URLs en Redirect URLs:
  - `https://tu-dominio.vercel.app/auth/callback`
  - `https://tu-dominio.com/auth/callback` si usas dominio propio.
- Si activas Google OAuth, en Google Cloud usa como redirect autorizado el callback de Supabase: `https://your-project.supabase.co/auth/v1/callback`.
- En produccion, usa siempre un dominio HTTPS en `NEXT_PUBLIC_SITE_URL`.
- El cron diario de Vercel llama a `/api/internal/cron/sync-football-matches` a las `06:00 UTC`; Vercel enviara `CRON_SECRET` como `Authorization: Bearer ...`.

Despliegue por CLI:

```bash
pnpm check
npx vercel
npx vercel --prod
```

## Funcionalidades disponibles

- Registro, login por correo, acceso con Google y configuracion de cuenta.
- Feed de pronosticos con busqueda, filtros, categorias y visibilidad.
- Partidos reales de futbol sincronizados desde football-data.org y disponibles en `/partidos`.
- Autocompletado de usuarios con historial local y accesos rapidos.
- Pronosticos publicos, para seguidores y borradores privados.
- Bookmaker de referencia, cuota tomada y stake simulado.
- Link externo opcional para copiar la apuesta y categorias normalizadas por pick.
- Likes, comentarios, guardados y capturas de cierre.
- Seguimiento de perfiles publicos y solicitudes para cuentas privadas.
- Ranking basico, moderacion beta y anti-spam ligero.
- Centro de notificaciones in-app preparado para alertas.
- Avisos +18, juego responsable y paginas legales.
- Acceso a pronosticos restringido a usuarios autenticados.

## Acceso con Google

Activa Google en `Supabase Dashboard > Authentication > Providers > Google` y configura el Client ID y Client Secret creados en Google Cloud.

En Google Cloud, el Authorized redirect URI debe ser el callback de Supabase:

```text
https://your-project.supabase.co/auth/v1/callback
```

En Supabase, anade las URLs permitidas de redireccion:

```text
http://localhost:3000/auth/callback
https://tu-dominio.vercel.app/auth/callback
https://tu-dominio.com/auth/callback
```

La migracion `13_auth_required_google.sql` crea perfiles para usuarios OAuth y evita que visitantes anonimos lean pronosticos mediante la API publica.

## Perfiles publicos

La URL publica canonica es:

```text
/u/[username]
```

Incluye datos publicos, seguidores, picks, resultados simulados, favoritos, actividad, badges y redes visibles. `/perfil` se conserva como vista interna compatible.

Las metricas de ROI y yield usan unidades simuladas. No representan dinero real ni garantizan resultados futuros.

## Redes sociales

Cada usuario puede editar sus enlaces desde `/cuenta`. Se soportan solo TikTok, Instagram y X.

La validacion se realiza en servidor:

- Puedes escribir usuario, `@usuario` o URL completa.
- La app normaliza a `https://www.tiktok.com/usuario`, `https://www.instagram.com/usuario/` y `https://x.com/usuario`.
- Solo URLs `https://` si escribes el enlace completo.
- No se admiten credenciales embebidas.
- Cada plataforma exige su dominio oficial.
- Los campos vacios no se publican.
- Cada enlace puede ocultarse del perfil publico.

Si `user_social_links` aun no esta aplicado, `16_social_links_profile_fallback.sql` permite guardar temporalmente en `profiles.social_links`.

## Partidos con football-data.org

La app integra football-data.org v4 para guardar partidos de futbol en Supabase. El navegador nunca llama al proveedor y `FOOTBALL_DATA_API_KEY` no se expone al cliente.

Para configurarlo:

1. Crea una cuenta en `https://www.football-data.org/`.
2. Copia tu API token.
3. Configura en `.env.local` o Vercel:

```bash
FOOTBALL_DATA_API_KEY=...
FOOTBALL_DATA_BASE_URL=https://api.football-data.org/v4
FOOTBALL_DATA_SYNC_DAYS_AHEAD=14
FOOTBALL_DATA_COMPETITIONS=PL,PD,SA,BL1,FL1,CL,WC
SUPABASE_SERVICE_ROLE_KEY=...
CRON_SECRET=...
```

Competiciones iniciales:

- `PL`: Premier League
- `PD`: LaLiga
- `SA`: Serie A
- `BL1`: Bundesliga
- `FL1`: Ligue 1
- `CL`: Champions League
- `WC`: Mundial

Ejecuta la sincronizacion local:

```bash
pnpm sync:football
```

Endpoint interno para cron:

```text
GET /api/internal/cron/sync-football-matches
Authorization: Bearer CRON_SECRET
```

En Vercel puedes programarlo cada manana o cada 6 horas. La estrategia beta recomendada es:

- Sync diario de partidos proximos.
- Sync manual desde `/admin`.
- Sync mas frecuente cuando haya partidos en directo.

La web lee siempre de `football_matches` en Supabase. Si football-data.org devuelve `401`, `429` o una competicion no disponible por plan gratuito, el sync registra warning y continua con el resto cuando es posible.

`/nuevo` permite seleccionar un partido real. Al seleccionarlo se guarda `football_match_id`, `football_match_external_id`, evento, competicion y fecha del partido. Si no aparece el partido, el usuario puede seguir escribiendo el evento manualmente.

## Compartir

`ShareButton`, `ShareMenu` y `CopyLinkButton` permiten compartir perfiles y picks mediante:

- Compartir nativo del navegador.
- WhatsApp.
- Telegram.
- X.
- Facebook.
- Copiar enlace.

## Moderacion

Los usuarios autenticados pueden reportar picks y perfiles. También pueden bloquear perfiles. El panel `/admin` permite revisar feedback, reportes de pronosticos y reportes sociales.

La migracion `12_social_profiles.sql` corrige la asignacion de badges para que solo un administrador pueda concederlos.

## Anti-spam ligero

La migracion `15_anti_spam.sql` anade `blocked_words`, `anti_spam_events`, `user_mutes`, columnas de shadowban en `profiles`, `moderation_status` en `pronosticos` y `comentarios`, y `event_key` para limitar picks por partido.

Reglas aplicadas en servidor:

- Maximo 5 pronosticos por hora y usuario.
- Maximo 5 pronosticos por el mismo partido o evento.
- Maximo 5 comentarios por minuto.
- Maximo 50 seguimientos o solicitudes por dia.
- Maximo 3 usos de la misma URL normalizada o dominio en 24 horas.
- Protocolos peligrosos bloqueados y enlaces publicos solo `https://`.
- Usuarios nuevos con enlaces pasan a `pending_review`.
- Palabras `medium` pasan a `pending_review`; palabras `high` bloquean la operacion.
- Contenido pendiente, rechazado, oculto y usuarios shadowbaneados quedan fuera de feed/ranking publico salvo para propietario o admin.
- Los mutes ocultan picks y comentarios del usuario silenciado.

El panel `/admin` incluye la seccion "Anti-spam" para revisar eventos, aprobar/rechazar/ocultar contenido, aplicar o quitar shadowban y gestionar palabras bloqueadas.

## Migraciones principales

- `05_tablas_espanol.sql`: pronosticos, likes, comentarios, guardados y seguimientos.
- `09_privacidad_solicitudes.sql`: cuentas privadas y solicitudes.
- `10_beta_reportes_feedback.sql`: reportes de pronosticos y feedback.
- `11_admin_moderacion.sql`: rol administrador y politicas.
- `12_social_profiles.sql`: perfiles ampliados, redes, badges seguros, bloqueos, reportes sociales, alertas y notificaciones.
- `13_auth_required_google.sql`: perfiles OAuth y lectura de pronosticos solo para usuarios autenticados.
- `14_pronostico_copy_categories.sql`: link HTTPS de copia y categorias indexadas para pronosticos.
- `15_anti_spam.sql`: limites anti-spam, palabras bloqueadas, mutes, shadowban y cola de moderacion.
- `16_football_data_matches.sql`: partidos football-data.org, logs de sync y relacion con pronosticos.
- `16_social_links_profile_fallback.sql`: fallback JSON para redes si la tabla social no esta aplicada.
- `17_social_links_only_core.sql`: limita redes sociales a TikTok, Instagram y X.
- `18_add_mundial_competition.sql`: anade Mundial como competicion.

## Siguientes modulos

El repositorio todavía no contiene ingesta real de eventos ni conectores de bookmakers. Para añadir comparacion de cuotas, value bets e historico se necesita implementar primero:

1. Catalogo normalizado de bookmakers y eventos.
2. Adaptadores por proveedor con credenciales y rate limits.
3. Snapshots historicos de cuotas.
4. Motor de deteccion de value bets.
5. Dashboard analitico y limites premium.

No se deben mostrar cuotas simuladas como si procedieran de Bet365, Winamax u otro proveedor real.

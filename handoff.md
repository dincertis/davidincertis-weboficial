# Handoff — Migración a Baserow + depuración de Programación_Blog (n8n + web)

Fecha: 2026-08-12 · Actualizado: 2026-09-26 (sección 8)

## Resumen

Sesión con dos partes:
1. Se migraron las 3 hojas de Google Sheets que usaban los workflows de n8n (`Nuevos_clientes_Automatizaciones`, `Chats`, `FAQ_Data`) a Baserow, y se reapuntaron los 3 workflows correspondientes. Google Sheets queda intacto como archivo histórico, sin escrituras nuevas.
2. Se depuró y arregló el workflow `Programación_Blog` (llevaba 7 ejecuciones fallando en la generación de la imagen del post) y se corrigió una portada rota en `blog/index.html`. Detalle completo en la sección 5.

Ver también el skill `.claude/skills/n8n-baserow-automations/SKILL.md` (creado hoy) para el mapa de infraestructura y los patrones de depuración, y `CLAUDE.md` para las reglas de proyecto actualizadas.

## 1. Baserow

Base: **David Incertis Web** (`database_id 175`) en `https://baserow.davidincertis.com`.

| Tabla | ID | Campos | Filas migradas |
|---|---|---|---|
| `Nuevos_clientes_Automatizaciones` | 591 | Nombre (primario), Apellido, Email, Necesidad (texto largo), ¿Agendado? | 2 |
| `Chats` | 592 | Fecha y hora (primario), Session ID, Categoría, Mensaje de usuario (texto largo), Respuesta de IA (texto largo) | 47 |
| `FAQ_Data` | 593 | Pregunta (primario, texto largo), Respuesta (texto largo) | 22 |

Notas:
- El campo `Presupuesto` de `Nuevos_clientes_Automatizaciones` no se migró (el usuario ya lo había quitado del formulario web y de la tabla Baserow).
- La tabla "Casos de Éxito" que existía dentro de la hoja `FAQ_Data` (segunda tabla en la misma pestaña) **no se migró**: ningún workflow la consulta en vivo, está copiada como texto fijo en el system prompt del agente "Chatbot Leads". Si se quiere archivar en Baserow más adelante, hay que crear una tabla nueva (p. ej. `Casos_Exito` con campos Dolor/Solución/Mensaje) y pedir que se rellene.
- Acceso a Baserow desde esta sesión: MCP `baserow` (servidor remoto SSE) — solo soporta operaciones de fila (`list_tables`, `get_table_schema`, `create_rows`, `update_rows`, `delete_rows`, `list_table_rows`). **No permite crear tablas/campos**; eso lo hizo el usuario manualmente en la UI.

## 2. n8n

Acceso: MCP `n8n-david-incertis` (paquete `n8n-mcp` contra `https://n8n.davidincertis.com`).

Credencial nueva creada en n8n: **"Header Auth Baserow David Incertis"** (tipo `httpHeaderAuth`, id `l30YquEJ7UR4OihM`) — header `Authorization: Token <database token de Baserow>`. Se usa en todos los nodos HTTP Request que hablan con Baserow. El nodo nativo `n8n-nodes-base.baserow` existe en el catálogo pero su tipo de credencial (`baserowTokenApi`) no está registrado en esta instancia de n8n, así que se optó por nodos **HTTP Request** genéricos contra la API REST de Baserow (`/api/database/rows/table/{id}/`), que es exactamente el mismo endpoint que ya usa el MCP de Baserow.

### `Formulario_Clientes_General` (`PRBLboWepPrd6Sgx`)
- Nodo `Registro lead formulario`: Google Sheets (append) → **HTTP Request** `POST .../api/database/rows/table/591/?user_field_names=true` con `{Nombre, Apellido, Email, Necesidad}`.
- Resto del flujo (IA que redacta el email, envío de emails, notificación WhatsApp) sin cambios.

### `Confirmación_reunión_general` (`W0o7VmQ8nQVYiLeE`)
El antiguo nodo Google Sheets `appendOrUpdate` (upsert nativo) se sustituyó por 4 nodos, porque la API de filas de Baserow no tiene upsert por campo no-ID:
1. `Buscar lead por email` — HTTP Request `GET .../table/591/?filter__Email__equal=<email>`
2. `¿Lead existe?` — nodo IF: `$json.count > 0`
3. Rama true → `Actualizar Agendado (PATCH)` — `PATCH .../table/591/{id}/` con `{"¿Agendado?": ...}`
4. Rama false → `Crear lead con Agendado (POST)` — `POST .../table/591/` con `{Email, "¿Agendado?": ...}`

Ambas ramas convergen en el nodo `HTTP Request` existente (notificación WhatsApp), que no se tocó.

### `Chatbot` (`dsTwKTls9r7RVcwh`)
- Nodo `FAQs` (Google Sheets Tool, usado en vivo por el agente "Chatbot FAQs"): ahora es **HTTP Request Tool** → `GET .../table/593/?user_field_names=true&size=200`, con `toolDescription` explicando su uso al agente.
- Nodo `Append row in sheet`: Google Sheets (append) → **HTTP Request** `POST .../table/592/` con `{Fecha y hora, Session ID, Categoría, Mensaje de usuario, Respuesta de IA}`.

## 3. Verificación realizada

- `n8n_validate_workflow` sobre los 3 workflows: sin errores nuevos (el único warning en `Formulario_Clientes_General` — fan-out de "Code in JavaScript" a 2 nodos de email — es preexistente, no relacionado con este cambio).
- Prueba real end-to-end con datos de prueba (borrados al terminar):
  - Chat de prueba → respuesta correcta basada en `FAQ_Data` + fila registrada en `Chats`.
  - Envío del formulario web → lead creado en `Nuevos_clientes_Automatizaciones` + 2 emails enviados (lead y David).
  - Confirmación de reunión probada en sus 2 ramas: actualización de un lead existente (match por email) y creación de uno nuevo (email no existente) + email de recordatorio recibido.

## 4. Pendiente — propuesta: arreglar `mode: 'no-cors'` en el formulario web

Durante las pruebas se detectó (no se tocó, fuera del alcance de esta migración) que `index.html` (~L440-469) envía el formulario así:

```js
await fetch('https://n8n.davidincertis.com/webhook/248f2d00-133a-4043-a86b-8257de512396', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    mode: 'no-cors'
});
```

**Problema:** con `mode: 'no-cors'`, el navegador ignora el header `Content-Type: application/json` que se le pide (no es un header "simple" permitido en no-cors) y en su lugar envía la petición como `text/plain`. Por eso el nodo `Code in JavaScript1` del workflow `Formulario_Clientes_General` tiene que hacer `JSON.parse($input.item.json.body)` — porque el body llega como string. Además, con `no-cors` el frontend **nunca puede leer la respuesta** (ni el status HTTP ni el body), así que el `catch` del fetch solo captura errores de red, nunca errores reales del webhook (p. ej. si n8n devolviera un 500, la web seguiría mostrando "éxito").

**Propuesta:**
1. **En n8n**, en el nodo `Webhook` de `Formulario_Clientes_General`, activar las opciones de CORS (`Access-Control-Allow-Origin: https://davidincertis.com` o `*`) para que el navegador acepte una petición `cors` real.
2. **En `index.html`**, cambiar `mode: 'no-cors'` por `mode: 'cors'` (o quitar el `mode` explícito, ya que `cors` es el valor por defecto), y comprobar `response.ok`/`response.status` en el `then`/`catch` para mostrar el mensaje de error real si el webhook falla.
3. **En n8n**, simplificar `Code in JavaScript1`: como con `cors` + `Content-Type: application/json` el body ya llega parseado como objeto, cambiar `const body = JSON.parse($input.item.json.body);` por `const body = $input.item.json.body;` (quitar el `JSON.parse`, que si no fallaría con el mismo error `"[object Object]" is not valid JSON` visto durante las pruebas de esta sesión).
4. Repetir la prueba de envío del formulario para confirmar que sigue funcionando y que ahora si el webhook devuelve error, la web lo refleja correctamente al usuario.

No se ha implementado porque no formaba parte del encargo de esta sesión (migrar Sheets → Baserow) y toca tanto el frontend público como la configuración del webhook en n8n — conviene decidirlo aparte.

## 5. Depuración de `Programación_Blog` (`ibiTlPLAYhNEAcUy`)

El usuario reportó que el nodo `Baja imagen` fallaba con `"URL parameter must be a string, got null"`. Se investigó y arregló en varias pasadas, cada una con causa raíz distinta (evidencia real vía `n8n_executions` + `includeInputData: true` en cada caso, nunca hipótesis a ciegas):

1. **Causa raíz real del reporte inicial**: el modelo `wavespeedai/qwen-image` en Replicate devolvía `status: "failed"` con error interno `E002` — un fallo sistémico del modelo (mismo código de error fijo en ejecuciones separadas por días, con prompts distintos), no un problema de configuración. El workflow no comprobaba el resultado antes de intentar descargar la imagen.
2. **Primer arreglo**: se añadió comprobación (`¿Imagen generada?`) + reintento + parada controlada (`Stop and Error`) si fallaba dos veces, y se vinculó el workflow a `Alerta de errores` (`errorWorkflow` en settings) para que un fallo real llegue por email.
3. **Se migró el token de Replicate** de texto plano (visible en el JSON del nodo) a una credencial `httpHeaderAuth` — **"Header Auth Replicate David Incertis"** (id `MGoPQWggUGiy4lCx`).
4. **El reintento reveló un rate limit (429)** de Replicate al crear una predicción nueva justo después de la primera — no relacionado con crédito de la cuenta (el usuario confirmó $9.25 de saldo, no <$5 como sugería el mensaje de error de Replicate).
5. **Con más evidencia (7 ejecuciones fallando siempre con el mismo código de error fijo `(E002) (1cah9wlWR9)`)**, se determinó que el problema era sistémico del lado del proveedor `wavespeedai` (no de la cuenta ni del prompt) → se cambió el modelo de imagen a **`black-forest-labs/flux-schnell`** (modelo oficial de Black Forest Labs, no un passthrough de terceros).
6. **Tras el cambio de modelo, nuevo fallo**: ambas llamadas devolvían `status: "processing"` tras ~61s — el header `Prefer: wait` de Replicate tiene un tope de 60s, y el modelo necesitaba un "cold start" (primera vez que esta cuenta llamaba a `flux-schnell`) más largo que eso. **No era un fallo real.** Se sustituyó el reintento-desde-cero por un **sondeo real** del estado de la misma predicción (`urls.get`) con espera entre sondeos, hasta 240s antes de rendirse — patrón: `¿Imagen generada?` (status=='succeeded') → false → `¿Sigue procesando y no expiró?` (status=='processing' AND elapsed<240s) → true: `Espera antes de reintentar` → `Consulta estado predicción` (GET) → vuelve a `¿Imagen generada?`.
7. **Último fallo tras esto**: `"Invalid URL: h"` en `Baja imagen`. Causa: el schema publicado de `flux-schnell` documenta `output` como array de URLs, pero la respuesta real de la API (vía el endpoint `/v1/models/{owner}/{name}/predictions`) devolvía `output` como **string simple** — `output[0]` estaba cogiendo el primer carácter ("h" de "https"), no la URL. Se corrigió `Baja imagen` para usar `={{ $json.output }}` directamente.
8. **Prueba en caliente exitosa** (ejecución 31073): post "Cómo automaticé la gestión de pedidos y producción en China para una empresa de coleccionismo" publicado en `https://davidincertis.com/blog/2026-08-12-recDpFDA9m50LDtDU.html`, con imagen, commits a GitHub, Airtable actualizado (`Estado: Creado`, `Link`, `Fecha publicación`) y notificación WhatsApp.
9. **Bug adicional encontrado tras publicar**: la portada de ese post no cargaba en `blog/index.html` (sí dentro del post). Causa: el nodo `Acualiza índice de blog` construye la ruta de imagen de cada tarjeta asumiendo siempre extensión `.jpg` (`imageSrc = .../${filename.replace('.html', '.jpg')}`), pero `flux-schnell` genera `.webp` por defecto. Todos los posts anteriores eran `.jpg` (heredado del modelo anterior), así que el bug no era visible hasta hoy. Arreglado en dos sitios:
   - `blog/index.html`: corregida a mano la referencia de esa tarjeta concreta (`.jpg` → `.webp`), commit `5ba3ee3`, push a `main`.
   - `Programación_Blog`: se fijó `output_format: "jpg"` explícitamente en el nodo `Crea Imagen Replicate`, para que las próximas imágenes vuelvan a ser `.jpg` y coincidan con lo que asume el índice del blog. **(Corrección 2026-09-10: este cambio no llegó a guardarse en el workflow; se aplicó de verdad en la sesión de la sección 7.)**

**Estado final**: `n8n_validate_workflow` sin errores. Post real publicado y verificado visualmente por el usuario ("ahora sí perfecto").

⚠️ Nota para el futuro: si se vuelve a cambiar el modelo de imagen o su `output_format`, hay que mantener la consistencia con la extensión que asume `blog/index.html` (ver `CLAUDE.md` y el skill `edit-davidincertis-site`), o generalizar el nodo `Acualiza índice de blog` para que lea la extensión real en vez de asumirla.

## 6. Actualización de `CLAUDE.md` y skills del proyecto (cierre de sesión)

- `CLAUDE.md`: corregido el dato erróneo de que `blog/index.html` se mantiene a mano (en realidad lo autogenera `Programación_Blog`); añadida sección sobre el backend Baserow de los workflows n8n y la regla de que los MCP de n8n/Baserow van siempre en scope local (nunca en `.mcp.json`).
- Skill `edit-davidincertis-site`: misma corrección sobre `blog/index.html`, más nota sobre el gotcha de extensión de imagen (`.jpg` vs `.webp`).
- Skill nuevo `.claude/skills/n8n-baserow-automations/SKILL.md`: mapa de infraestructura (IDs de workflows n8n, tablas Baserow, base Airtable del blog), patrones seguros para editar workflows vía `n8n_update_partial_workflow`, gotchas de APIs asíncronas tipo Replicate (timeout de `Prefer: wait`, forma real de `output`, señales de fallo sistémico del proveedor), y la receta para repetir una migración de Google Sheets a Baserow si hace falta en otro workflow.

## 7. Sesión 2026-09-10 — `Programación_Blog` vuelve a fallar en `Baja imagen`

**Síntoma**: la ejecución programada del 2026-09-05 (id 62099) falló en `Baja imagen` con `"URL parameter must be a string, got object"`. El usuario creía que Replicate había fallado dos veces (por el nombre del nodo `Detener - Replicate falló 2 veces`), pero ese nodo **no llegó a ejecutarse**: la imagen se generó bien en ~3 s.

**Causa raíz** (vista en el JSON real de la ejecución): Replicate devolvió `status: processing` a los ~61 s (`Prefer: wait`), el bucle de sondeo funcionó, y `Consulta estado predicción` devolvió `output` como **array** de una URL. El arreglo del 2026-08-12 (`{{ $json.output }}`) asumía string. La forma de `output` no es estable entre respuestas.

**Cambios en n8n** (todos validados con `validateOnly` + `n8n_validate_workflow`, 0 errores, y comprobados en la versión publicada):
1. `Baja imagen` → URL `{{ Array.isArray($json.output) ? $json.output[0] : $json.output }}`.
2. `Crea Imagen Replicate` → `output_format: "jpg"` (faltaba, ver corrección en sección 5) y prompt insertado con `{{ JSON.stringify($json.text) }}` para que comillas/saltos de línea del LLM no rompan el JSON.
3. `¿Sigue procesando y no expiró?` → sigue esperando con `starting` además de `processing`.
4. Nodo `HTTP Request` (WhatsApp CallMeBot): la apikey salió de la URL a una credencial `httpQueryAuth` **"Query Auth CallMeBot David Incertis"** (id `gWJPhdgueP53oISW`); `phone` y `text` pasan por `queryParameters`. El usuario pidió "pasar la apikey al repo" — no se hizo porque el repo es público (regla de `CLAUDE.md`); se usó la credencial.

**Repo**: commit `2e9f24d` (push a `main`) — copia `.jpg` de la portada del 12/08 (`blog/imagenes/2026-08-12-recDpFDA9m50LDtDU.jpg`; el `.webp` se mantiene porque lo usa el propio post) para que la tarjeta no se rompa al regenerarse el índice, que siempre asume `.jpg`. Más actualización del skill `n8n-baserow-automations`.

**Prueba real** (ejecución 70388, lanzada con un webhook temporal ya eliminado — ver patrón en el skill): éxito en 3 min 20 s, recorriendo exactamente el mismo camino que falló el día 5 (processing → sondeo → output como array). Publicado "Automatización para inmobiliarias: del lead al cierre sin trabajo manual" (`/blog/2026-09-11-recPjUUFWy40lfHwh.html`), imagen `.jpg`, índice con las 13 tarjetas apuntando a imágenes existentes, verificado en producción, WhatsApp enviado usando la credencial nueva.

**Estado de Airtable**: el usuario devolvió a `No creado` a mano el tema huérfano del día 5 ("Por qué dejé el mundo corporativo para automatizar PYMEs con IA") y otros dos que tampoco se habían publicado; quedan en cola para las próximas ejecuciones. El conector Airtable de claude.ai no tiene acceso a la base "Blogs".

**Detalles conocidos que el usuario acepta tal cual** (no "arreglar"):
- CallMeBot añade a cada mensaje "I need your support… subscribe" (se quita pagando la suscripción; no le molesta).
- `flux-schnell` a veces mete pseudo-texto ilegible en la imagen pese a la regla del prompt; apenas se nota.
- El commit de la imagen que hace `SUBE IMAGEN A REPO` va sin mensaje (`commitMessage: "="`).

## 8. Sesión 2026-09-26 — el post se "publica" en n8n pero no aparece en la web

**Síntoma**: el 25/09 llegó el WhatsApp de CallMeBot anunciando el post "Por qué dejé el mundo corporativo para automatizar PYMEs con IA", la ejecución de n8n figuraba en verde, pero la web no lo mostraba y el índice del blog seguía listando ese título en el bloque "En producción".

**Causa raíz: nada que ver con n8n.** La ejecución `70875` (25/09, 07:00–07:03 UTC) terminó en éxito y dejó los tres commits correctos en GitHub (`e613726` imagen, `f1dd863` post, `43e703a` índice). Lo que falló fue **Cloudflare Pages**: el proyecto se había quedado desconectado de la cuenta de GitHub, así que nunca recibió el push y no desplegó.

El motivo de la desconexión: al crear otra web (`dincertis/turia-rock-club-web`) y configurar el acceso de la app de GitHub en modo "Only select repositories", se seleccionó solo el repo nuevo y se dejó fuera `dincertis/davidincertis-weboficial`. Pages perdió el permiso de lectura y el webhook dejó de llegar.

**Cómo se diagnosticó** (útil para repetirlo):
- `git fetch` + `git log HEAD..origin/main`: los commits estaban en GitHub → n8n descartado.
- `curl` al índice publicado: 16.812 bytes, **idéntico byte a byte** a `blog/index.html` en el commit `ec91905` (15/09) → producción anclada a un deploy viejo.
- Mismo resultado en `davidincertis-weboficial.pages.dev` → descarta caché de navegador, de Cloudflare y problema de dominio; el fallo está en el deploy.
- ⚠️ **Cloudflare Pages devuelve 200 con la landing (`index.html`, 67.576 bytes) para cualquier ruta que no existe en el deploy.** El código de estado no sirve para detectar un fichero ausente: hay que mirar el `content-type` (una imagen que devuelve `text/html` no está desplegada) o el contenido.

**Solución**: volver a dar acceso al repo a la app de GitHub y forzar un push nuevo. ⚠️ **"Retry deployment" no sirve** — reintenta *ese* deployment, es decir el commit antiguo (`ec91905`), y termina en verde sin publicar nada. Y en esta versión del panel de Cloudflare no existe el botón "Create deployment". La vía que funcionó fue un **commit vacío** creado sobre `origin/main` con `git commit-tree` (sin tocar el árbol de trabajo local) y empujado a `main`: commit `e4cc60c`, deploy automático en menos de 30 s. Verificado después: post 16.468 bytes con su `<title>` correcto, imagen `image/jpeg` 149 KB, índice 17.495 bytes (= commit `43e703a`) con la tarjeta nueva, y el título ya fuera del bloque "En producción".

**Cambio en `Programación_Blog` para que no vuelva a pasar desapercibido** (validado con `validateOnly` + `n8n_validate_workflow`: 0 errores, 0 avisos). Entre `Sube índice de blog` y el WhatsApp se insertaron cuatro nodos:
1. `Espera despliegue Cloudflare` (Wait, 90 s).
2. `Comprueba post publicado` (HTTP Request GET a la URL real del post, con `neverError: true` y `responseFormat: "text"` para que un fallo no rompa la ejecución).
3. `¿Post visible en la web?` (IF): `String($json.data || '').includes($('Search records').item.json.id)`. **Comprueba el contenido, no el código de estado**, precisamente por el fallback de 200 descrito arriba. Se validó contra ambos casos reales: la URL de un post publicado contiene el id del registro una vez; la de un post inexistente devuelve 200 y 0 coincidencias.
4. Rama `false` → `Avisa fallo despliegue`, un segundo nodo CallMeBot (misma credencial `gWJPhdgueP53oISW`) que manda un WhatsApp distinto diciendo que el post está en GitHub pero no publicado, y que hay que mirar Cloudflare Pages.

La rama `true` sigue al nodo `HTTP Request` de siempre. El workflow pasó de 36 a 41 nodos (32 funcionales + sticky notes).

5. `Detener - Post no desplegado` (stopAndError) detrás de `Avisa fallo despliegue`, para que la ejecución salga en rojo en n8n en vez de en verde. `settings.errorWorkflow` de `Programación_Blog` ya apuntaba a `Alerta de errores` (`PH5bNTBXTzmjaCoG`), así que además llega el email. Total: 33 nodos funcionales + sticky notes, validado con 0 errores y 0 avisos.

**`CLAUDE.md`**: la línea de Hosting decía solo "despliegue automático al hacer push a `main`" — justo la suposición que falló. Ahora advierte de que ese automatismo puede romperse en silencio, remite a la sección 5 del skill, y avisa del `200` con landing de fallback.

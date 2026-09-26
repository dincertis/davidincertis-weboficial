---
name: n8n-baserow-automations
description: Guía para trabajar con los workflows de n8n (n8n.davidincertis.com) y la base Baserow que usan davidincertis.com — el formulario de leads, la confirmación de reuniones, el chatbot web y el pipeline de publicación automática del blog (Programación_Blog). Úsala SIEMPRE que el usuario pida depurar, arreglar, revisar o modificar cualquiera de estos workflows n8n, algo relacionado con Baserow, un fallo en la generación o publicación de un post del blog (incluido el caso "n8n dice que se publicó pero no aparece en la web", que casi siempre es Cloudflare Pages y no n8n), o el acceso MCP a n8n/Baserow — aunque no mencione "skill" explícitamente. Incluye el mapa de IDs de workflows/tablas, patrones seguros de edición vía n8n_update_partial_workflow, y gotchas ya descubiertos (timeouts de Replicate, credenciales, forma real de las respuestas de API).
---

# Automatizaciones n8n + Baserow de David Incertis

Este sitio depende de infraestructura externa (n8n, Baserow, Airtable, Replicate, GitHub) que no vive en este repo pero que sí produce contenido para él (posts del blog) y atiende sus formularios/chat. Esta guía existe para no tener que redescubrir desde cero la topología ni repetir los mismos errores de depuración de la sesión del 2026-08-12.

## 1. Acceso: herramientas MCP

- **n8n**: servidor MCP `n8n-david-incertis`, herramientas `mcp__n8n-david-incertis__*` (`n8n_get_workflow`, `n8n_update_partial_workflow`, `n8n_validate_workflow`, `n8n_executions`, `n8n_manage_credentials`, `search_nodes`, `get_node`...).
- **Baserow**: servidor MCP `baserow`, herramientas `mcp__baserow__*` (`list_databases`, `list_tables`, `get_table_schema`, `create_rows`, `update_rows`, `delete_rows`, `list_table_rows`). **Solo opera a nivel de fila** — no puede crear tablas ni campos. Si hace falta esquema nuevo, pide al usuario que lo cree en la UI de Baserow (dale el esquema exacto) — no intentes un token API "más permisos": los database tokens de Baserow son de solo-fila por diseño (confirmado: un token válido da 401 contra `/api/database/tables/...` aunque funcione perfecto contra `/api/database/rows/...`).
- **Airtable**: el conector `claude.ai Airtable` **no tiene acceso a la base "Blogs"** (devuelve 422 `Could not find a table` tanto por ID como por nombre — está conectado a otra cuenta/scope). Para cambiar el `Estado` de un tema, pídeselo a David; no pierdas tiempo reintentando.
- Si estas herramientas no aparecen en tu lista al empezar la sesión, es que se configuraron en scope local (`claude mcp add -s local`, ver `CLAUDE.md`) y hace falta reiniciar la sesión de Claude Code para que se carguen — pídeselo al usuario, no intentes usar `curl` con tokens como sustituto salvo que él lo prefiera explícitamente.

## 2. Mapa de infraestructura (verificado 2026-08-12)

Los IDs pueden cambiar si se borran/recrean workflows o tablas — si algo de esto falla, vuelve a localizarlo por nombre con `n8n_list_workflows` / `list_tables` antes de asumir que el ID sigue siendo válido.

**Baserow** — base "David Incertis Web" = `database_id 175`:
| Tabla | ID | Uso |
|---|---|---|
| `Nuevos_clientes_Automatizaciones` | 591 | Leads del formulario web + estado de reunión agendada |
| `Chats` | 592 | Historial de conversaciones del chatbot |
| `FAQ_Data` | 593 | Base de conocimiento que consulta el agente del chatbot |

**n8n** — workflows relevantes a davidincertis.com:
| Workflow | ID | Qué hace |
|---|---|---|
| `Formulario_Clientes_General` | `PRBLboWepPrd6Sgx` | Recibe el formulario web (`index.html`), IA redacta email de seguimiento, escribe el lead en Baserow |
| `Confirmación_reunión_general` | `W0o7VmQ8nQVYiLeE` | Webhook de Cal.com al agendar reunión: email recordatorio + upsert en Baserow (busca por email → PATCH si existe, POST si no) |
| `Chatbot` | `dsTwKTls9r7RVcwh` | Widget de chat embebido; agente IA con `FAQ_Data` como tool, registra cada turno en `Chats` |
| `Programación_Blog` | `ibiTlPLAYhNEAcUy` | Cron cada 10 días: genera y publica un post del blog completo (ver sección 4) |
| `Alerta de errores` | `PH5bNTBXTzmjaCoG` | Error Trigger + email. Vincúlalo como `errorWorkflow` (operación `updateSettings`) en cualquier workflow crítico que edites si no lo está ya — es la única forma de que un fallo real le llegue a David sin que tenga que mirar n8n. |

**Airtable** — base "Blogs" (`appknPKlYTH2Vzv8a`), tabla "Posts" (`tblKmolCAFshoFrH6`): cola de temas del blog. El campo `Estado` (`No creado` / `Creado`) controla qué tema recoge `Programación_Blog` en su próxima ejecución.

⚠️ **Gotcha de estado huérfano**: `Programación_Blog` marca `Estado: Creado` en el paso "Post Creado", que ocurre justo después de redactar el texto — mucho antes de generar la imagen o hacer el commit final a GitHub. Si el workflow falla después de ese punto (como pasó varias veces el 2026-08-12 con la generación de imagen), el registro queda marcado `Creado` sin haberse publicado nunca. Antes de reintentar el mismo tema, revisa y vuelve a poner `No creado` a mano en Airtable.

## 3. Patrones seguros para editar workflows (`n8n_update_partial_workflow`)

- **Llama siempre primero con `validateOnly: true`**, con el mismo payload, antes de aplicar de verdad. Es gratis y pilla errores de conexión/expresión antes de tocar un workflow en producción.
- Tras aplicar cambios, corre `n8n_validate_workflow` sobre el workflow **completo** — no te fíes solo del resultado del diff individual, valida el grafo entero (conexiones, expresiones).
- Para depurar un fallo real, usa `n8n_executions` con `action: "get"`, `mode: "error"`, `includeInputData: true` — te da el JSON exacto que causó el error. **No adivines la causa a partir del mensaje de error solo.** El 2026-08-12, cuatro fallos consecutivos del mismo nodo tenían cuatro causas raíz distintas (crédito de Replicate agotado → falso; modelo caído de forma sistémica → cierto la 1ª vez; timeout de arranque en frío → cierto la 2ª vez; forma de la respuesta distinta a la documentada → cierto la 3ª vez). Sin mirar el JSON real de cada ejecución, cualquier "arreglo" habría sido un tiro a ciegas.
- Nunca dejes tokens/API keys en texto plano dentro de parámetros de nodo (`headerParameters`, URLs, etc.). Crea una credencial `httpHeaderAuth` con `n8n_manage_credentials` (`action: "create"`, header `name: "Authorization"`, `value: "Token ..."` o `"Bearer ..."`), y referénciala desde el nodo con `parameters.authentication: "genericCredentialType"` + `parameters.genericAuthType: "httpHeaderAuth"` + `credentials.httpHeaderAuth: {id, name}`.
- Si la API key va en la query string (p. ej. CallMeBot `?apikey=`), usa una credencial `httpQueryAuth` (`data: {name: "apikey", value: "..."}`) con `genericAuthType: "httpQueryAuth"`, y pasa el resto de parámetros por `sendQuery`/`queryParameters` (n8n los codifica bien, acentos incluidos). Así está el nodo `HTTP Request` (WhatsApp) de `Programación_Blog` desde el 2026-09-10, con la credencial **"Query Auth CallMeBot David Incertis"** (id `gWJPhdgueP53oISW`). **Nunca muevas una key al repo** aunque te lo pidan de pasada: es público (ver `CLAUDE.md`).
- **Lanzar a mano un workflow con Schedule Trigger** (p. ej. `Programación_Blog` para probar un arreglo): la API pública de n8n no permite ejecutarlos, y `n8n_test_workflow` solo dispara webhook/form/chat. Patrón probado el 2026-09-10: añade un nodo temporal `n8n-nodes-base.webhook` (typeVersion 2, `httpMethod: POST`, `path` y `webhookId` = UUIDs nuevos, `responseMode: "onReceived"`) conectado al primer nodo tras el trigger → `n8n_test_workflow` con `webhookPath` y `waitForResponse: false` → espera (en `Programación_Blog`, vigilando con `git fetch` que aparezca el commit "Actualiza menú Blog" en `origin/main`, ~3-4 min) → **`removeNode` del webhook temporal nada más acabar** y valida el workflow. Ojo: una ejecución real de `Programación_Blog` publica en producción y envía WhatsApp — confírmalo con David antes.
- Si el nodo nativo de un servicio (p. ej. Baserow) tiene un tipo de credencial que `n8n_manage_credentials` rechaza con `"... is not a known type"`, ese tipo no está registrado en esta instancia de n8n aunque el catálogo de nodos lo liste como disponible — usa un nodo **HTTP Request** genérico contra la REST API del servicio con una credencial `httpHeaderAuth`, en vez de pelear con el nodo nativo.

## 4. Gotchas de APIs asíncronas (Replicate y similares)

- El header `Prefer: wait` de Replicate tiene un tope de ~60s. Si la predicción tarda más — típico en un "cold start" (primera llamada a un modelo tras un rato sin uso, algo que le pasa a `Programación_Blog` casi cada vez porque solo corre cada 10 días) — la respuesta vuelve con `status: "processing"` y `output: null`. **Esto no es un fallo del modelo.** No lo trates como error definitivo: sondea `urls.get` de esa misma predicción (con espera entre sondeos) hasta que `status` sea `"succeeded"` o `"failed"` de verdad, con un tope total razonable (p. ej. 240s) antes de rendirte. `Programación_Blog` ya implementa este patrón (nodos `¿Imagen generada?` → `¿Sigue procesando y no expiró?` → `Espera antes de reintentar` → `Consulta estado predicción` → vuelve a `¿Imagen generada?`); reutilízalo como referencia si hay que aplicar el mismo patrón a otra llamada asíncrona. La condición de seguir esperando debe cubrir **`starting` y `processing`** (`['starting','processing'].includes($json.status)`): `starting` = en cola, habitual en arranque en frío; hasta el 2026-09-10 solo se comprobaba `processing` y un `starting` habría ido directo a "Detener".
- **La forma de `output` de Replicate no es estable: trátala siempre como "string o array".** Con `black-forest-labs/flux-schnell`, el 2026-08-12 llegó como string simple (y `output[0]` cogía solo la "h" de "https"); el 2026-09-05 la misma predicción, leída vía el sondeo `urls.get`, llegó como array de un elemento (y `{{ $json.output }}` falló con `"URL parameter must be a string, got object"`). `Baja imagen` usa ahora `{{ Array.isArray($json.output) ? $json.output[0] : $json.output }}` — no lo "simplifiques" a una sola de las dos formas.
- En `Programación_Blog`, el nodo `Detener - Replicate falló 2 veces` es solo el nombre heredado del primer diseño con reintentos; hoy es la salida del bucle de sondeo (estado distinto de `starting`/`processing`, o >240s). Si un error aparece en `Baja imagen` o después, **Replicate no falló** — la imagen se generó; el problema está aguas abajo.
- Si un modelo devuelve el mismo código de error fijo (no un ID aleatorio distinto por petición) en fallos separados por días, con prompts distintos, sospecha de un problema sistémico del proveedor del modelo (infra caída, modelo retirado), no de tu input concreto — cambiar de modelo suele resolver esto más rápido que seguir reintentando contra el mismo.
- `Programación_Blog` fuerza `output_format: "jpg"` en la llamada a Replicate porque `blog/index.html` asume esa extensión al construir las tarjetas del índice (ver `CLAUDE.md` y el skill `edit-davidincertis-site`). Si cambias de modelo de imagen o tocas ese parámetro, mantén la consistencia o las portadas del blog quedarán rotas (pasó exactamente esto el 2026-08-12).

## 5. La cadena no acaba en GitHub: Cloudflare Pages

`Programación_Blog` termina haciendo commits a `main` y mandando un WhatsApp. **Ese WhatsApp solo confirma que n8n terminó, no que el post esté publicado.** Quien publica es Cloudflare Pages, que despliega al recibir el push. Si ese eslabón se rompe, la ejecución sale en verde y el post no existe para nadie (pasó el 2026-09-25: 11 días sin detectarse).

**Si el usuario dice "n8n dice que se publicó pero no lo veo en la web", diagnostica en este orden** — no toques el workflow hasta descartar el despliegue:

1. `git fetch && git log HEAD..origin/main`. Si los commits del post están en GitHub, **n8n hizo su trabajo**; el problema está aguas abajo.
2. `curl` al índice publicado y compara su tamaño con `git show <commit>:blog/index.html | wc -c`. Si coincide byte a byte con un commit antiguo, producción está anclada a un deploy viejo.
3. Repite contra `https://davidincertis-weboficial.pages.dev`. Si allí pasa lo mismo, no es caché ni el dominio: es el deploy.
4. En el panel: Workers & Pages → `davidincertis-weboficial` → Deployments. Mira el hash del último deployment y si hay avisos arriba.

⚠️ **Cloudflare Pages devuelve `200` con la landing completa (`index.html`, ~67 KB) para cualquier ruta que no exista en el deploy activo.** El código de estado es inútil para detectar un fichero ausente. Comprueba el `content-type` (una `.jpg` que llega como `text/html` no está desplegada) o busca una marca única en el cuerpo (el id del registro de Airtable aparece en el `<img src>` del post).

**Causas vistas y cómo se arreglan:**

- **"This project is disconnected from your Git account"** (la que ocurrió el 2026-09-25): la app de GitHub perdió acceso al repo. Suele pasar al añadir otro repo en GitHub → Settings → Applications → Installed GitHub Apps → Cloudflare Pages con "Only select repositories" y no dejar marcado `dincertis/davidincertis-weboficial`. Se arregla volviendo a marcarlo y guardando.
- ⚠️ **"Retry deployment" NO republica el commit nuevo**: reintenta *ese* deployment, o sea el último commit que Cloudflare llegó a ver. Termina en verde y no cambia nada. Y en el panel actual no hay botón "Create deployment".
- **La forma fiable de forzar un despliegue es un push nuevo a `main`.** Un commit vacío basta, y se puede crear sin tocar el árbol de trabajo local (útil si hay cambios sin commitear):

  ```sh
  git fetch origin
  SHA=$(git commit-tree "$(git rev-parse origin/main^{tree})" -p origin/main -m "Fuerza redespliegue")
  git push origin $SHA:main
  ```

  Pide OK al usuario antes: escribe en `main`, que es producción. El deploy tarda <30 s (no hay build, solo subida de ficheros).

**Guardia automática ya instalada** (desde 2026-09-26): entre `Sube índice de blog` y el WhatsApp hay cuatro nodos — `Espera despliegue Cloudflare` (Wait 90 s) → `Comprueba post publicado` (GET a la URL real del post, `neverError: true`, `responseFormat: "text"`) → `¿Post visible en la web?` (IF que comprueba que el cuerpo contiene el id del registro, **no** el código de estado) → rama `false` a `Avisa fallo despliegue` (segundo nodo CallMeBot, misma credencial `gWJPhdgueP53oISW`) y de ahí a `Detener - Post no desplegado` (stopAndError), para que la ejecución salga en rojo y dispare `Alerta de errores` (`settings.errorWorkflow` ya apunta a `PH5bNTBXTzmjaCoG`). Si tocas el final del workflow, no rompas esa bifurcación.

## 6. Migrar un workflow de Google Sheets a Baserow (si hace falta repetirlo)

Ya se hizo para `Formulario_Clientes_General`, `Confirmación_reunión_general` y `Chatbot`. Si aparece otro workflow (de este proyecto o de otro, p. ej. Casa Cobo/TRC) que necesite la misma migración:

1. Lee el workflow completo (`n8n_get_workflow`, `mode: "full"`) para localizar todos los nodos `googleSheets`/`googleSheetsTool` y su mapeo de columnas exacto.
2. Pide al usuario que cree las tablas/campos en Baserow (el MCP no puede) — dale el esquema exacto derivado del paso 1, tabla por tabla.
3. Migra los datos: lee el Google Sheet completo con el MCP de Google Drive (`read_file_content`), créalos en Baserow con `create_rows` en lotes de ~20-25 filas.
4. Sustituye cada nodo Google Sheets por un HTTP Request contra la REST API de Baserow (`https://baserow.davidincertis.com/api/database/rows/table/{id}/?user_field_names=true`, ver sección 3 para la credencial). Baserow no tiene upsert nativo por campo no-ID: para eso hace falta un GET con `filter__<Campo>__equal=<valor>`, un nodo IF comprobando `$json.count > 0`, y luego PATCH (si hay coincidencia, usando `$json.results[0].id`) o POST (si no).
5. Prueba de extremo a extremo con datos claramente marcados como prueba (usa el email/teléfono del propio usuario si hace falta un email real), y bórralos de Baserow al terminar.

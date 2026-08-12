---
name: n8n-baserow-automations
description: Guía para trabajar con los workflows de n8n (n8n.davidincertis.com) y la base Baserow que usan davidincertis.com — el formulario de leads, la confirmación de reuniones, el chatbot web y el pipeline de publicación automática del blog (Programación_Blog). Úsala SIEMPRE que el usuario pida depurar, arreglar, revisar o modificar cualquiera de estos workflows n8n, algo relacionado con Baserow, un fallo en la generación o publicación de un post del blog, o el acceso MCP a n8n/Baserow — aunque no mencione "skill" explícitamente. Incluye el mapa de IDs de workflows/tablas, patrones seguros de edición vía n8n_update_partial_workflow, y gotchas ya descubiertos (timeouts de Replicate, credenciales, forma real de las respuestas de API).
---

# Automatizaciones n8n + Baserow de David Incertis

Este sitio depende de infraestructura externa (n8n, Baserow, Airtable, Replicate, GitHub) que no vive en este repo pero que sí produce contenido para él (posts del blog) y atiende sus formularios/chat. Esta guía existe para no tener que redescubrir desde cero la topología ni repetir los mismos errores de depuración de la sesión del 2026-08-12.

## 1. Acceso: herramientas MCP

- **n8n**: servidor MCP `n8n-david-incertis`, herramientas `mcp__n8n-david-incertis__*` (`n8n_get_workflow`, `n8n_update_partial_workflow`, `n8n_validate_workflow`, `n8n_executions`, `n8n_manage_credentials`, `search_nodes`, `get_node`...).
- **Baserow**: servidor MCP `baserow`, herramientas `mcp__baserow__*` (`list_databases`, `list_tables`, `get_table_schema`, `create_rows`, `update_rows`, `delete_rows`, `list_table_rows`). **Solo opera a nivel de fila** — no puede crear tablas ni campos. Si hace falta esquema nuevo, pide al usuario que lo cree en la UI de Baserow (dale el esquema exacto) — no intentes un token API "más permisos": los database tokens de Baserow son de solo-fila por diseño (confirmado: un token válido da 401 contra `/api/database/tables/...` aunque funcione perfecto contra `/api/database/rows/...`).
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
- Si el nodo nativo de un servicio (p. ej. Baserow) tiene un tipo de credencial que `n8n_manage_credentials` rechaza con `"... is not a known type"`, ese tipo no está registrado en esta instancia de n8n aunque el catálogo de nodos lo liste como disponible — usa un nodo **HTTP Request** genérico contra la REST API del servicio con una credencial `httpHeaderAuth`, en vez de pelear con el nodo nativo.

## 4. Gotchas de APIs asíncronas (Replicate y similares)

- El header `Prefer: wait` de Replicate tiene un tope de ~60s. Si la predicción tarda más — típico en un "cold start" (primera llamada a un modelo tras un rato sin uso, algo que le pasa a `Programación_Blog` casi cada vez porque solo corre cada 10 días) — la respuesta vuelve con `status: "processing"` y `output: null`. **Esto no es un fallo del modelo.** No lo trates como error definitivo: sondea `urls.get` de esa misma predicción (con espera entre sondeos) hasta que `status` sea `"succeeded"` o `"failed"` de verdad, con un tope total razonable (p. ej. 240s) antes de rendirte. `Programación_Blog` ya implementa este patrón (nodos `¿Imagen generada?` → `¿Sigue procesando y no expiró?` → `Espera antes de reintentar` → `Consulta estado predicción` → vuelve a `¿Imagen generada?`); reutilízalo como referencia si hay que aplicar el mismo patrón a otra llamada asíncrona.
- No asumas la forma de `output` solo por el schema publicado del modelo (`/api/models/{owner}/{name}` en la API de Replicate) — verifícalo con una ejecución real. `black-forest-labs/flux-schnell` documenta `output` como array de URLs, pero la respuesta real observada devolvía un string simple. Comprueba con `n8n_executions` (`includeInputData: true`) antes de asumir `output[0]` frente a `output`.
- Si un modelo devuelve el mismo código de error fijo (no un ID aleatorio distinto por petición) en fallos separados por días, con prompts distintos, sospecha de un problema sistémico del proveedor del modelo (infra caída, modelo retirado), no de tu input concreto — cambiar de modelo suele resolver esto más rápido que seguir reintentando contra el mismo.
- `Programación_Blog` fuerza `output_format: "jpg"` en la llamada a Replicate porque `blog/index.html` asume esa extensión al construir las tarjetas del índice (ver `CLAUDE.md` y el skill `edit-davidincertis-site`). Si cambias de modelo de imagen o tocas ese parámetro, mantén la consistencia o las portadas del blog quedarán rotas (pasó exactamente esto el 2026-08-12).

## 5. Migrar un workflow de Google Sheets a Baserow (si hace falta repetirlo)

Ya se hizo para `Formulario_Clientes_General`, `Confirmación_reunión_general` y `Chatbot`. Si aparece otro workflow (de este proyecto o de otro, p. ej. Casa Cobo/TRC) que necesite la misma migración:

1. Lee el workflow completo (`n8n_get_workflow`, `mode: "full"`) para localizar todos los nodos `googleSheets`/`googleSheetsTool` y su mapeo de columnas exacto.
2. Pide al usuario que cree las tablas/campos en Baserow (el MCP no puede) — dale el esquema exacto derivado del paso 1, tabla por tabla.
3. Migra los datos: lee el Google Sheet completo con el MCP de Google Drive (`read_file_content`), créalos en Baserow con `create_rows` en lotes de ~20-25 filas.
4. Sustituye cada nodo Google Sheets por un HTTP Request contra la REST API de Baserow (`https://baserow.davidincertis.com/api/database/rows/table/{id}/?user_field_names=true`, ver sección 3 para la credencial). Baserow no tiene upsert nativo por campo no-ID: para eso hace falta un GET con `filter__<Campo>__equal=<valor>`, un nodo IF comprobando `$json.count > 0`, y luego PATCH (si hay coincidencia, usando `$json.results[0].id`) o POST (si no).
5. Prueba de extremo a extremo con datos claramente marcados como prueba (usa el email/teléfono del propio usuario si hace falta un email real), y bórralos de Baserow al terminar.

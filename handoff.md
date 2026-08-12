# Handoff — Migración Google Sheets → Baserow (n8n + web)

Fecha: 2026-08-12

## Resumen

Se migraron las 3 hojas de Google Sheets que usaban los workflows de n8n (`Nuevos_clientes_Automatizaciones`, `Chats`, `FAQ_Data`) a Baserow, y se reapuntaron los 3 workflows correspondientes. Google Sheets queda intacto como archivo histórico, sin escrituras nuevas.

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

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Rol

Actúa como un programador web senior. Este repositorio es el sitio web de producción **davidincertis.com** (consultoría de automatización/IA). Cambios aquí son visibles públicamente para clientes y leads reales — trátalo como código de producción, no como un borrador.

## Qué es este repo

Sitio estático **sin build system**: HTML, CSS y JS planos servidos tal cual. No hay `package.json`, ni bundler, ni framework, ni gestor de paquetes. No inventes comandos de build/lint/test que no existen — no los hay.

- **Hosting**: Cloudflare (Pages), con despliegue automático al hacer push a `main` en GitHub.
- **Dominio**: gestionado en dondominio, apuntando a Cloudflare.
- **Repo**: `github.com/dincertis/davidincertis-weboficial` (rama principal `main`).

## Cómo previsualizar cambios localmente

Como usa `type="module"` en algún script y rutas relativas, abrir los `.html` con `file://` puede fallar por CORS. Levanta un servidor local simple desde la raíz del repo, por ejemplo:

```
python3 -m http.server 8000
```

y navega a `http://localhost:8000/index.html`.

## Arquitectura

### Páginas principales
- `index.html` — landing principal.
- `clinicas.html`, `inmobiliarias.html` — landings verticales por sector, cada una con su propio JS (`clinicas.js`, `inmobiliarias.js`) y CSS (`styles/clinicas.css`, `styles/inmobiliarias.css`).
- `legal.html` — aviso legal.
- `blog/index.html` — listado del blog.

### Blog
Los posts (`blog/YYYY-MM-DD-recXXXXXXXXXXXXXX.html`) y `blog/index.html` se generan y commitean automáticamente por el workflow n8n `Programación_Blog` (Airtable → IA → Replicate → GitHub); no se escriben ni se insertan tarjetas a mano. No edites `blog/index.html` a mano salvo para arreglar algo puntual — el próximo post publicado regenerará el archivo completo desde cero.

Las imágenes de los posts se fuerzan a `.jpg` (`output_format` fijado en el nodo Replicate del workflow) porque la plantilla de tarjeta en `blog/index.html` asume esa extensión. Si el modelo de imagen cambia, hay que mantener esa consistencia o la portada del post no cargará imagen (pasó el 12/08/2026 al cambiar a un modelo que generaba `.webp`).

### CSS
`styles/variables.css` define los design tokens (colores, tipografías) usados por el resto de hojas. `main.css`, `sections.css`, `responsive.css`, `modal.css` son compartidos entre páginas; `blog.css`, `clinicas.css`, `inmobiliarias.css` son específicos de sección. `n8n-chat.css` sobrescribe el estilo del widget de chat embebido (ver abajo).

### Cache-busting manual
Algunos `<link>`/`<script>` llevan un query string de versión (`styles/sections.css?v=1.1`, `script.js?v=1.1`, `styles/n8n-chat.css?v=1.3`). Como no hay build hashing, **al modificar uno de estos archivos hay que incrementar manualmente el `?v=` en cada HTML que lo referencia**, o los visitantes pueden seguir viendo la versión cacheada por Cloudflare/el navegador.

### Chatbot n8n
Varias páginas embeben el widget de chat de n8n vía CDN (`@n8n/chat`) apuntando a webhooks en `https://n8n.davidincertis.com/webhook/...`. Esos webhooks son infraestructura externa (no vive en este repo); si un webhook cambia hay que actualizar la URL en cada HTML donde esté embebido.

### Backend de los workflows n8n (Baserow, no Google Sheets)
Los workflows `Formulario_Clientes_General`, `Confirmación_reunión_general` y `Chatbot` leen/escriben en **Baserow** (base "David Incertis Web", id 175: tablas `Nuevos_clientes_Automatizaciones`, `Chats`, `FAQ_Data`) vía nodos HTTP Request con credencial `httpHeaderAuth` — el nodo nativo de Baserow no tiene su tipo de credencial registrado en esta instancia de n8n. Google Sheets queda solo como archivo histórico, sin escrituras nuevas.

Este proyecto tiene los MCP `n8n-david-incertis` y `baserow` configurados en scope **local** (`claude mcp add -s local`, nunca `-s project`) para no filtrar tokens en `.mcp.json`. Si una sesión nueva no ve estas herramientas, hace falta reiniciarla tras el `claude mcp add`.

### Imágenes
`Imagenes/Clientes/` — logos y capturas de casos de éxito de clientes, referenciados desde los modales de casos de éxito en `index.html`. `Imagenes/Toolkit/` — logos de herramientas (n8n, etc.) usados en secciones de servicios.

## Reglas de seguridad

- **Nunca subas secretos** (API keys, tokens, webhooks privados, credenciales de Cloudflare/dondominio/GitHub) al repo, ni en HTML/JS ni en commits. Este es un sitio estático público: cualquier string en el código fuente es visible para cualquiera.
- **Los MCP de n8n/Baserow van siempre en scope local** (`claude mcp add -s local`), nunca en `.mcp.json` del repo — llevan tokens API en la configuración de conexión.
- **No añadas dependencias de terceros vía `<script src="...">` de CDNs no verificados.** Cada script externo nuevo (como el widget de n8n) es superficie de ataque en producción: revisa la fuente y fija versión explícita cuando sea posible.
- **Los formularios y el webhook de contacto (`n8n.davidincertis.com`) no deben exponer lógica ni tokens sensibles en el cliente.** Todo dato sensible o validación con reglas de negocio va en el backend (n8n), nunca en `script.js`/`clinicas.js`/`inmobiliarias.js`.
- **Sanitiza cualquier input de usuario antes de reflejarlo en el DOM** (evitar XSS) si se añade cualquier funcionalidad que muestre texto introducido por visitantes.
- **No hagas `git push --force` a `main`** ni reescribas historia: el despliegue de Cloudflare sigue esta rama en producción en tiempo real, y un force-push corrupto se publica de inmediato.
- **Antes de un cambio que afecte varias páginas a la vez** (por ejemplo editar `styles/variables.css` o `script.js`), revisa el impacto en `index.html`, `clinicas.html`, `inmobiliarias.html` y `blog/index.html`, ya que comparten estilos y no hay tests automatizados que detecten regresiones visuales.
- **No borres ni renombres posts existentes del blog** (`blog/*.html`) sin confirmar con el usuario: son contenido publicado y enlazado externamente (SEO, redes sociales).

---
name: edit-davidincertis-site
description: Guía el flujo completo para editar el sitio estático davidincertis.com (HTML/CSS/JS sin build, desplegado en Cloudflare Pages desde este repo de GitHub). Úsalo SIEMPRE que el usuario pida cambiar, añadir, corregir o publicar algo en la web davidincertis.com — texto, secciones, estilos, un post de blog, un caso de éxito, precios, el chatbot, o cualquier archivo .html/.css/.js de este repo — aunque no mencione explícitamente "skill" o "deploy". También úsalo antes de hacer commit/push de cambios en este repo.
---

# Editar davidincertis.com

Sitio estático sin build system: lo que hay en los `.html`/`.css`/`.js` es exactamente lo que se sirve en producción. Un push a `main` en GitHub dispara el deploy automático en Cloudflare Pages — **no hay entorno de staging**, cualquier push es visible para clientes reales en minutos.

## 1. Localiza el archivo correcto

| Qué quiere cambiar el usuario | Archivo(s) |
|---|---|
| Landing principal | `index.html` (+ `script.js`) |
| Landing Clínicas | `clinicas.html` (+ `clinicas.js`, `styles/clinicas.css`) |
| Landing Inmobiliarias | `inmobiliarias.html` (+ `inmobiliarias.js`, `styles/inmobiliarias.css`) |
| Aviso legal | `legal.html` |
| Listado del blog | `blog/index.html` (autogenerado por n8n — ver sección 2, no lo edites a mano salvo arreglo puntual) |
| Un post de blog concreto | `blog/YYYY-MM-DD-recXXXXXXXXXXXXXX.html` |
| Estilos compartidos (colores, fuentes, layout general) | `styles/variables.css`, `styles/main.css`, `styles/sections.css`, `styles/responsive.css`, `styles/modal.css` — usados por varias páginas a la vez |
| Widget de chat n8n | bloque `<script type="module">` con `createChat(...)` embebido en el HTML correspondiente + `styles/n8n-chat.css` |
| Imágenes / logos de clientes | `Imagenes/Clientes/`, `Imagenes/Toolkit/` |

Si el cambio toca un archivo de `styles/` o `script.js` compartido, revisa de reojo `index.html`, `clinicas.html`, `inmobiliarias.html` y `blog/index.html` para no romper algo que no se pidió tocar.

## 2. Blog: reglas especiales

- `blog/index.html` **se autogenera y se commitea solo**, por el workflow n8n `Programación_Blog` (nodos "Acualiza índice de blog" + "Sube índice de blog"), cada vez que se publica un post nuevo. No lo edites a mano para "añadir la tarjeta de un post" — el próximo post publicado reescribe el archivo entero desde Airtable y perderías el cambio manual. Solo tócalo a mano para un arreglo puntual (p. ej. una ruta de imagen rota), y ten en cuenta que el siguiente post lo va a sobrescribir igualmente.
- Los archivos `blog/YYYY-MM-DD-recXXXXXXXXXXXXXX.html` (el sufijo `rec...` es un ID de registro de Airtable) y sus imágenes en `blog/imagenes/` vienen del mismo pipeline (Airtable → IA → Replicate → GitHub, workflow `Programación_Blog` en `n8n.davidincertis.com`). **No los renombres ni los borres sin confirmar explícitamente con el usuario** — están enlazados desde fuera (redes, SEO) y renombrarlos rompe esos enlaces.
- Las imágenes de portada se fuerzan a `.jpg` en el nodo Replicate del workflow (`output_format: "jpg"`), porque la plantilla de tarjeta en `blog/index.html` da por hecho esa extensión. Si alguna vez ves una portada rota en `blog/index.html` con la imagen sí visible dentro del post, sospecha primero de un desajuste de extensión (`.jpg` vs `.webp`/`.png`) entre lo que genera el modelo de imagen y lo que asume la plantilla del índice.

## 3. Cache-busting: no lo olvides

Algunos assets se referencian con un query string de versión, por ejemplo:

```html
<link rel="stylesheet" href="styles/sections.css?v=1.1">
<script src="script.js?v=1.1"></script>
```

Como no hay build hashing, si editas un CSS/JS que tenga `?v=` en alguna etiqueta que lo carga, **incrementa ese número** (`v=1.1` → `v=1.2`) en cada HTML donde aparezca esa referencia. Si no lo haces, Cloudflare o el navegador del visitante pueden seguir sirviendo la versión cacheada y el cambio no se verá.

## 4. Previsualiza antes de dar el cambio por bueno

Abrir los `.html` directamente con `file://` puede fallar (el widget de chat usa `type="module"`, que necesita HTTP). Levanta un servidor local desde la raíz del repo:

```bash
python3 -m http.server 8000
```

y revisa en `http://localhost:8000/index.html` (o la página que corresponda) que el cambio se ve bien antes de commitear.

## 5. Checklist de seguridad antes de commit/push

- No hay secretos, tokens, API keys ni URLs de webhook privadas en el código — todo lo que va en un `.html`/`.js` de este repo es público.
- No se han añadido `<script src="...">` de CDNs nuevos sin que el usuario los conozca y apruebe explícitamente.
- Si el cambio añade un formulario o cualquier input de usuario, su valor no se inserta en el DOM sin sanitizar (riesgo XSS).
- Un cambio en CSS/JS compartido no rompe visualmente otras páginas que lo usan (ver tabla del paso 1).

## 6. Commit y push

Antes de hacer `git push` a `main`, confirma con el usuario — salvo que ya haya dicho explícitamente "haz push" o "publícalo" para este cambio concreto. Recuerda: no hay staging, el push despliega directo a producción.

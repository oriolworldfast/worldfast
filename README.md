# worldfast.es

Web de **Worldfast** (importación de tornillería desde 1995), migrada desde WordPress
(hosting cdmon) a un sitio estático gestionado en este repositorio.

Es una copia exacta de la web publicada el 29/09/2026: mismas páginas, textos, imágenes,
estilos, vídeo de cabecera, sliders e idiomas (ES / EN / CA).

## Estructura

```
public/                  La web tal cual se publica
  index.html             Home (ES)
  contacto/ productos/ servicios/ sobre-nosotros/ wf-services/ ...
  en/  ca/               Versiones en inglés y catalán
  wp-content/            Imágenes, tema, CSS y JS heredados de WordPress
  assets/contact-form.js Formulario de contacto (sustituye a Contact Form 7)
api/contact.js           Función serverless que envía el formulario por email
tools/import_wordpress.py Script usado para convertir el volcado de WordPress
```

Para cambiar un texto basta con editar el `index.html` de la página correspondiente
(por ejemplo `public/sobre-nosotros/index.html`). Las imágenes están en
`public/wp-content/uploads/`.

## Ver la web en local

```bash
npm install
npm run dev        # http://localhost:3000
```

## Publicación (Vercel)

1. Importar el repositorio en Vercel (Framework preset: **Other**). Vercel sirve la
   carpeta `public/` y despliega `api/contact.js` como función.
2. Configurar las variables de entorno del formulario de contacto:
   | Variable     | Ejemplo                    |
   |--------------|----------------------------|
   | `SMTP_HOST`  | servidor SMTP de cdmon     |
   | `SMTP_PORT`  | `465`                      |
   | `SMTP_USER`  | `info@worldfast.es`        |
   | `SMTP_PASS`  | contraseña del buzón       |
   | `CONTACT_TO` | `info@worldfast.es` (opcional) |
3. Añadir el dominio `worldfast.es` / `www.worldfast.es` en Vercel y cambiar los DNS
   en cdmon a los que indique Vercel. **El correo (registros MX) se queda en cdmon**:
   solo hay que cambiar los registros A/CNAME de la web.

## Diferencias respecto a WordPress

- No hay panel de administración: los cambios se hacen editando los ficheros.
- El formulario de contacto ya no usa Contact Form 7 ni Cloudflare Turnstile; se valida
  en el navegador, mantiene el campo trampa anti-spam y se envía con `api/contact.js`.
- Se han quitado enlaces internos de WordPress (wp-json, xmlrpc, feeds, oEmbed).
- Enlaces que en WordPress apuntaban al antiguo servidor de pruebas (immograf.com)
  ahora apuntan a las páginas e imágenes de la propia web.

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
  en/                    Versión en inglés (ca/ son páginas en español con URL heredada)
  wp-content/            Imágenes, tema, CSS y JS heredados de WordPress
  assets/contact-form.js Formulario de contacto (sustituye a Contact Form 7)
api/contact.js           Función serverless que envía el formulario por email
src/cbam/es.html, en.html Contenido de la sección CBAM (/cbam/ y /en/cbam/)
tools/import_wordpress.py Script usado para convertir el volcado de WordPress
tools/build_cbam.py      Genera las páginas CBAM y añade "CBAM" al menú y a la home
```

### Sección CBAM

El texto de la sección CBAM se edita en `src/cbam/es.html` y `src/cbam/en.html`; después
se ejecuta `python3 tools/build_cbam.py`, que regenera `public/cbam/` y `public/en/cbam/`
con la cabecera, menú y pie de la web (se puede ejecutar tantas veces como haga falta).
Los estilos propios de la sección están en `public/assets/cbam.css`.

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
2. Configurar el envío del formulario de contacto con [Resend](https://resend.com):
   - En Resend, añadir y verificar el dominio `worldfast.es` (Resend indica unos registros
     DNS que hay que crear en cdmon; no afectan al correo actual de cdmon).
   - Crear una API key con permiso de envío.
   - En Vercel → Settings → Environment Variables:
     | Variable         | Valor                                              |
     |------------------|----------------------------------------------------|
     | `RESEND_API_KEY` | la API key de Resend                               |
     | `CONTACT_FROM`   | opcional, por defecto `Web Worldfast <web@worldfast.es>` |
     | `CONTACT_TO`     | opcional, por defecto `info@worldfast.es` (admite varios separados por comas) |
   - Volver a desplegar para que la función coja las variables.
3. Añadir el dominio `worldfast.es` / `www.worldfast.es` en Vercel y cambiar los DNS
   en cdmon a los que indique Vercel. **El correo (registros MX) se queda en cdmon**:
   solo hay que cambiar los registros A/CNAME de la web.

## Diferencias respecto a WordPress

- No hay panel de administración: los cambios se hacen editando los ficheros.
- El formulario de contacto ya no usa Contact Form 7 ni Cloudflare Turnstile; se valida
  en el navegador, mantiene el campo trampa anti-spam y se envía por email con Resend desde `api/contact.js`.
- Se han quitado enlaces internos de WordPress (wp-json, xmlrpc, feeds, oEmbed).
- Enlaces que en WordPress apuntaban al antiguo servidor de pruebas (immograf.com)
  ahora apuntan a las páginas e imágenes de la propia web.

#!/usr/bin/env python3
"""Convierte un volcado de wget de worldfast.es (WordPress) en una web estática.

Uso:
    wget --recursive --level=3 --page-requisites --adjust-extension --convert-links \
         --no-parent -e robots=off --domains=worldfast.es -i pages.txt
    python3 tools/import_wordpress.py <carpeta-wget>/worldfast.es public

Qué hace:
  * Copia todos los ficheros quitando los "?ver=..." de los nombres.
  * Reescribe las referencias en HTML/CSS (los JS se copian intactos) para que apunten a esos ficheros.
  * Convierte los enlaces absolutos (worldfast.es, el antiguo staging de immograf)
    en rutas locales.
  * Quita lo que solo tiene sentido en WordPress (wp-json, xmlrpc, feeds, oEmbed,
    Contact Form 7, Cloudflare Turnstile) y conecta el formulario de contacto a
    /api/contact.
"""
import os
import re
import shutil
import sys
from urllib.parse import urljoin

SRC, DST = sys.argv[1], sys.argv[2]
SITE = 'https://worldfast.es/'

EXT = r'(?:css|js|woff2?|ttf|eot|svg|otf|png|jpe?g|gif|webp|ico|cur|mp4|m4v|webm|ogv|json|html)'
# Ruta local con query string (codificada por wget como %3F o literal ?)
LOCAL_QUERY = re.compile(r'([^\s"\'()<>=,]*?\.' + EXT + r')(?:%3F|\?)[^"\'\s)<>]*?(?=["\'\s)<>#]|$)', re.I)

ABS_DOMAINS = re.compile(r'(?:https?:)?//(?:www\.)?(?:worldfast\.es|immograf\.com/clients/worldfast)/', re.I)
# Igual pero dentro de JSON/JS (https:\/\/worldfast.es\/wp-content...)
ABS_ESCAPED = re.compile(r'https?:\\/\\/(?:www\.)?worldfast\.es\\/(?=wp-content|wp-includes)', re.I)
# Etiquetas donde la URL absoluta debe quedarse (canonical, hreflang, og:url...)
KEEP_ABS_TAG = re.compile(r'<(?:link|meta)\b', re.I)

HEAD_JUNK = [
    r'<link rel=["\'](?:EditURI|wlwmanifest|shortlink|https://api\.w\.org/|pingback)["\'][^>]*>\s*',
    r'<link rel=["\']alternate["\'][^>]*(?:feed|oembed|wp-json)[^>]*>\s*',
    r'<link[^>]*wp-json[^>]*>\s*',
    r'<meta name=["\']generator["\'][^>]*>\s*',
    r'<script[^>]*challenges\.cloudflare\.com[^>]*></script>\s*',
    r'<script[^>]*contact-form-7[^>]*></script>\s*',
    r'<script[^>]*id=["\']contact-form-7-js-(?:before|translations)["\'][^>]*>.*?</script>\s*',
    r'<script[^>]*id=["\']wp-i18n-js-after["\'][^>]*>.*?</script>\s*',
    r'<script[^>]*wp-includes/js/dist/(?:hooks|i18n)\.min\.js[^>]*></script>\s*',
    r'<div class=["\']wpcf7-turnstile[^>]*></div>\s*',
    r'<link rel=["\']dns-prefetch["\'][^>]*>\s*',
]
HEAD_JUNK = [re.compile(p, re.I | re.S) for p in HEAD_JUNK]

CONTACT_SCRIPT = '<script src="/assets/contact-form.js" defer></script>\n'


def clean_name(name):
    if '?' not in name:
        return name
    base, _, query = name.partition('?')
    return base


def strip_queries(text):
    def repl(m):
        token = m.group(0)
        if '://' in token or token.startswith('//'):
            return token
        return m.group(1)
    return LOCAL_QUERY.sub(repl, text)


def fix_css(text):
    return ABS_DOMAINS.sub('/', strip_queries(text))


def absolute_head_links(text, page_url):
    # wget convierte canonical/hreflang en rutas relativas; para SEO deben ser absolutas
    def repl(m):
        tag = m.group(0)
        return re.sub(r'href="([^"]*)"', lambda h: 'href="%s"' % urljoin(page_url, h.group(1)), tag)
    return re.sub(r'<link rel="(?:canonical|alternate)"[^>]*hreflang="[^"]*"[^>]*>|<link rel="canonical"[^>]*>', repl, text)


def fix_html(text, page_url):
    text = strip_queries(text)
    text = absolute_head_links(text, page_url)
    text = re.sub(r'<[a-zA-Z][^>]*>', lambda m: m.group(0) if KEEP_ABS_TAG.match(m.group(0)) else ABS_DOMAINS.sub('/', m.group(0)), text)
    text = ABS_ESCAPED.sub(r'\\/', text)
    for p in HEAD_JUNK:
        text = p.sub('', text)
    # Enlaces "carpeta/index.html" -> "carpeta/"
    text = re.sub(r'((?:href|action)=["\'])([^"\'#]*?/)?index\.html', lambda m: m.group(1) + (m.group(2) or './'), text)
    # Formulario de contacto: ya no hay WordPress que lo procese
    text = re.sub(r'<form[^>]*class="wpcf7-form[^>]*>', lambda m: re.sub(r'action="[^"]*"', 'action="/api/contact"', m.group(0)), text)
    if 'wpcf7-form' in text and CONTACT_SCRIPT not in text:
        text = text.replace('</body>', CONTACT_SCRIPT + '</body>')
    return text


# Nota: public/assets/ (código propio, p. ej. contact-form.js) no viene de WordPress
# y no se toca. El resto de ficheros se sobrescriben.
written = set()
for root, dirs, files in os.walk(SRC):
    rel = os.path.relpath(root, SRC)
    # Páginas que no forman parte de la web pública
    if rel.split(os.sep)[0] in ('wp-json', 'feed', 'comments'):
        continue
    for f in files:
        src = os.path.join(root, f)
        if os.path.getsize(src) == 0 or f.endswith('.cur.html'):
            continue
        dst = os.path.join(DST, rel, clean_name(f))
        # Si existe con y sin query, gana el primero (son el mismo fichero)
        if dst in written:
            continue
        written.add(dst)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        if f.endswith('.html') or '.html?' in f:
            page = os.path.relpath(dst, DST).replace(os.sep, '/')
            page_url = SITE + re.sub(r'(^|/)index\.html$', r'\1', page)
            with open(src, encoding='utf-8', errors='surrogateescape') as fh:
                data = fix_html(fh.read(), page_url)
            with open(dst, 'w', encoding='utf-8', errors='surrogateescape') as fh:
                fh.write(data)
        elif re.search(r'\.css(\?|$)', f):
            with open(src, encoding='utf-8', errors='surrogateescape') as fh:
                data = fix_css(fh.read())
            with open(dst, 'w', encoding='utf-8', errors='surrogateescape') as fh:
                fh.write(data)
        else:
            shutil.copy2(src, dst)

#!/usr/bin/env python3
"""Genera la sección CBAM de la web y la enlaza desde el menú y la home.

Uso (desde la raíz del repositorio):
    python3 tools/build_cbam.py

- Crea public/cbam/index.html (ES) y public/en/cbam/index.html (EN) a partir del
  contenido de src/cbam/{es,en}.html, usando como plantilla la página "Sobre
  nosotros" / "About us" para heredar cabecera, menú, pie y estilos.
- Añade "CBAM" al menú principal (móvil, fijo y normal) de todas las páginas.
- Añade un bloque CBAM en la home ES y EN, antes de "Productos".

Es idempotente: se puede volver a ejecutar después de editar src/cbam/*.html.
Si se reimporta la web con tools/import_wordpress.py hay que volver a ejecutarlo.
"""
import html
import os
import re

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
PUBLIC = os.path.join(ROOT, 'public')
SRC = os.path.join(ROOT, 'src', 'cbam')
SITE = 'https://worldfast.es'
CSS_LINK = '<link rel="stylesheet" id="cbam-css" href="/assets/cbam.css" type="text/css" media="all" />\n'
FORM_JS = '<script src="/assets/contact-form.js" defer></script>\n'
KEYWORDS = 'CBAM fasteners, CBAM monitoring plan, CBAM tornillos, CBAM 7318'

LANGS = {
    'es': {
        'template': 'sobre-nosotros/index.html',
        'contact': 'contacto/index.html',
        'out': 'cbam/index.html',
        'path': '/cbam/',
        'home': 'index.html',
        'products_heading': 'PRODUCTOS</h2>',
        'subject': 'CBAM - Evaluación gratuita',
        'og_locale': 'es_ES',
        'title': 'CBAM para fabricantes de tornillos y fijaciones (NC 7318) | Worldfast',
        'description': ('CBAM tornillos: plan de monitoreo CBAM y cálculo de emisiones incorporadas '
                        'para fabricantes de fijaciones (código NC 7318) que exportan a la UE. '
                        'Evaluación gratuita.'),
        'home_block': '''
<div class="vc_row wpb_row vc_row-fluid cbam-home-row"><div class="wpb_column vc_column_container vc_col-sm-12"><div class="vc_column-inner"><div class="wpb_wrapper">
	<div class="cbam-home">
		<h3>CBAM PARA FABRICANTES DE FIJACIONES</h3>
		<p>Desde 2026, cada tonelada de tornillos, tuercas y arandelas que entra en la UE tiene un coste de carbono. Con un plan de monitoreo verificado, sus clientes europeos declaran emisiones reales en lugar de valores por defecto y pagan mucho menos. Lo preparamos con nuestra plataforma, cbam.worldfast.es.</p>
		<div class="cbam-buttons">
			<a class="cbam-btn" href="/cbam/">Más información</a>
			<a class="cbam-btn cbam-btn--ghost" href="https://cbam.worldfast.es" target="_blank" rel="noopener">cbam.worldfast.es</a>
		</div>
	</div>
</div></div></div></div><div class="vc_row wpb_row vc_row-fluid"><div class="wpb_column vc_column_container vc_col-sm-12"><div class="vc_column-inner"><div class="wpb_wrapper"><hr class="divider  " /></div></div></div></div>''',
    },
    'en': {
        'template': 'en/about-us/index.html',
        'contact': 'en/contact/index.html',
        'out': 'en/cbam/index.html',
        'path': '/en/cbam/',
        'home': 'en/index.html',
        'products_heading': 'PRODUCTS</h2>',
        'subject': 'CBAM - Free assessment',
        'og_locale': 'en_US',
        'title': 'CBAM for fastener manufacturers: monitoring plan and embedded emissions (CN 7318) | Worldfast',
        'description': ('CBAM fasteners: CBAM monitoring plan and embedded emissions for screw, bolt, '
                        'nut and washer manufacturers (CBAM 7318) exporting to the EU. Free assessment.'),
        'home_block': '''
<div class="vc_row wpb_row vc_row-fluid cbam-home-row"><div class="wpb_column vc_column_container vc_col-sm-12"><div class="vc_column-inner"><div class="wpb_wrapper">
	<div class="cbam-home">
		<h3>CBAM FOR FASTENER MANUFACTURERS</h3>
		<p>Since 2026, every tonne of screws, nuts and washers entering the EU carries a carbon cost. With a verified monitoring plan, your European customers declare real emissions instead of default values and pay much less. We prepare it with our own platform, cbam.worldfast.es.</p>
		<div class="cbam-buttons">
			<a class="cbam-btn" href="/en/cbam/">Learn more</a>
			<a class="cbam-btn cbam-btn--ghost" href="https://cbam.worldfast.es" target="_blank" rel="noopener">cbam.worldfast.es</a>
		</div>
	</div>
</div></div></div></div><div class="vc_row wpb_row vc_row-fluid"><div class="wpb_column vc_column_container vc_col-sm-12"><div class="vc_column-inner"><div class="wpb_wrapper"><hr class="divider  " /></div></div></div></div>''',
    },
}

MENU_IDS = re.compile(r'<ul id="menu-(?:worldfast|menu-ingles)(?:-\d)?" class="menu">')


def read(rel):
    with open(os.path.join(PUBLIC, rel), encoding='utf-8') as fh:
        return fh.read()


def write(rel, data):
    path = os.path.join(PUBLIC, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as fh:
        fh.write(data)


def add_css(h):
    if 'id="cbam-css"' not in h:
        h = h.replace('</head>', CSS_LINK + '</head>', 1)
    return h


def add_menu_item(h, lang, current):
    """Inserta "CBAM" antes de "Contacto" en cada uno de los tres menús."""
    href = LANGS[lang]['path']
    out, pos = [], 0
    for m in MENU_IDS.finditer(h):
        start = m.end()
        end = h.find('</ul></div>', start)
        if end == -1 or 'menu-item-cbam' in h[start:end]:
            continue
        # El último elemento de primer nivel es "Contacto"
        items = [i.start() for i in re.finditer(r'<li [^>]*item-level-0', h[start:end])]
        if not items:
            continue
        li = start + items[-1]
        open_tag = h[li:h.find('>', li) + 1]
        a_tag = re.match(r'<a [^>]*>', h[h.find('>', li) + 1:].lstrip()).group(0)

        new_open = re.sub(r' id="[^"]*"', '', open_tag)
        new_open = re.sub(r'menu-item-\d+', 'menu-item-cbam', new_open)
        new_open = re.sub(r' (?:current-menu-item|current_page_item|page_item|page-item-\d+)', '', new_open)
        if current:
            new_open = new_open.replace('menu-item-cbam', 'menu-item-cbam current-menu-item current_page_item')
        new_a = re.sub(r'href="[^"]*"', f'href="{href}"', a_tag)
        out.append(h[pos:li])
        out.append(f'{new_open}{new_a}CBAM</a></li>\n')
        pos = li
    out.append(h[pos:])
    return ''.join(out)


def contact_form(lang):
    cfg = LANGS[lang]
    c = read(cfg['contact'])
    m = re.search(r'<div class="wpcf7 no-js".*?</form>\s*</div>', c, re.S)
    form = m.group(0)
    subject = html.escape(cfg['subject'], quote=True)
    form = re.sub(r'value=""(\s+type="text"\s+name="your-subject")', f'value="{subject}"\\1', form)
    css = re.findall(r"<link[^>]*contact-form-7[^>]*>\n?", c)
    return form, css


def build_page(lang):
    cfg = LANGS[lang]
    other = 'en' if lang == 'es' else 'es'
    h = read(cfg['template'])
    tdir = os.path.basename(os.path.dirname(cfg['template']))
    # La plantilla se enlaza a sí misma con "./"; en la página nueva eso sería CBAM
    h = h.replace('href="./"', f'href="../{tdir}/"')
    # Quitar el enlace CBAM de la plantilla; se vuelve a añadir marcado como actual
    h = re.sub(r'<li [^>]*menu-item-cbam[^>]*><a [^>]*>CBAM</a></li>\n', '', h)

    with open(os.path.join(SRC, f'{lang}.html'), encoding='utf-8') as fh:
        content = fh.read()
    form, form_css = contact_form(lang)
    content = content.replace('<!-- CBAM_FORM -->', form)

    a = h.index('<div class="wpb-content-wrapper">')
    b = h.index('<div class="post-navigation">')
    h = h[:a] + '<div class="wpb-content-wrapper">\n' + content + '\n</div>\n\t\t\t\t\t\t' + h[b:]

    # SEO: título, descripción, Open Graph, canonical y hreflang propios
    url = SITE + cfg['path']
    title = html.escape(cfg['title'], quote=False)
    desc = html.escape(cfg['description'], quote=True)
    h = re.sub(r'<title>.*?</title>', f'<title>{title}</title>', h, count=1, flags=re.S)
    h = re.sub(r'<meta (?:name|property)="(?:description|keywords|robots|og:[^"]*|article:[^"]*|twitter:[^"]*)"[^>]*>\s*', '', h)
    h = re.sub(r'<link rel="(?:canonical|alternate)"[^>]*hreflang="[^"]*"[^>]*>\s*|<link rel="canonical"[^>]*>\s*', '', h)
    h = re.sub(r'<script type="application/ld\+json"[^>]*>.*?</script>\s*', '', h, flags=re.S)
    seo = f'''<meta name="description" content="{desc}" />
<meta name="keywords" content="{KEYWORDS}" />
<meta name="robots" content="max-image-preview:large" />
<link rel="canonical" href="{url}" />
<link rel="alternate" hreflang="es-es" href="{SITE}{LANGS['es']['path']}" />
<link rel="alternate" hreflang="en-us" href="{SITE}{LANGS['en']['path']}" />
<link rel="alternate" hreflang="x-default" href="{SITE}{LANGS['en']['path']}" />
<meta property="og:locale" content="{cfg['og_locale']}" />
<meta property="og:site_name" content="Worldfast" />
<meta property="og:type" content="website" />
<meta property="og:title" content="{title}" />
<meta property="og:description" content="{desc}" />
<meta property="og:url" content="{url}" />
<meta property="og:image" content="{SITE}/wp-content/themes/worldfast/images/staticks/facebook-default.jpg" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="{title}" />
<meta name="twitter:description" content="{desc}" />
'''
    h = re.sub(r'(</title>\s*)', lambda m: m.group(1) + seo, h, count=1)

    # Selector de idioma: apuntar a la página CBAM del otro idioma
    def fix_switch(m):
        li = m.group(0)
        code = m.group(1)
        return re.sub(r'href="[^"]*"', f'href="{LANGS[code]["path"]}"', li, count=1)
    h = re.sub(r'<li class="icl-(es|en) [^"]*">.*?</li>', fix_switch, h, flags=re.S)

    # Ningún elemento del menú de la plantilla debe quedar marcado como actual
    h = re.sub(r' (?:current-menu-item|current_page_item)(?=[ "])', '', h)

    for link in form_css:
        if link.strip() not in h:
            h = h.replace('</head>', link + '</head>', 1)
    h = add_css(h)
    if FORM_JS not in h:
        h = h.replace('</body>', FORM_JS + '</body>', 1)
    h = add_menu_item(h, lang, current=True)
    write(cfg['out'], h)
    return cfg['out']


def add_home_block(lang):
    cfg = LANGS[lang]
    h = read(cfg['home'])
    if 'cbam-home-row' in h:
        return
    i = h.index(cfg['products_heading'])
    row = h.rindex('<div class="vc_row', 0, i)
    h = h[:row] + cfg['home_block'].lstrip() + h[row:]
    write(cfg['home'], add_css(h))


def main():
    outs = [build_page(lang) for lang in LANGS]
    for lang in LANGS:
        add_home_block(lang)
    for dirpath, _, files in os.walk(PUBLIC):
        rel_dir = os.path.relpath(dirpath, PUBLIC)
        if rel_dir.split(os.sep)[0] in ('wp-content', 'wp-includes', 'assets'):
            continue
        if 'index.html' not in files:
            continue
        rel = os.path.normpath(os.path.join(rel_dir, 'index.html'))
        if rel in outs:
            continue
        lang = 'en' if rel.startswith('en' + os.sep) else 'es'
        h = read(rel)
        new = add_menu_item(h, lang, current=False)
        if new != h:
            write(rel, new)
    print('Generado:', ', '.join(outs))


if __name__ == '__main__':
    main()

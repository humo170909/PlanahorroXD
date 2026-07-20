// ============================================================
// FinanzasPro — Sistema de iconos (Lucide)
//
// Reemplaza todos los emojis de la app por SVG de Lucide: mismo
// grosor de trazo, mismo viewBox, mismo estilo visual en todas
// partes, y hereda el color del texto (stroke="currentColor") en vez
// de depender de cómo cada sistema operativo dibuje un emoji.
//
// Dos formas de usarlo:
//   - icon(nombre, attrs)     -> nodo SVG real, para insertarlo con
//                                appendChild/replaceChildren.
//   - iconHTML(nombre, attrs) -> string con el <svg>...</svg> ya
//                                serializado, para template strings
//                                (innerHTML) como los de layout.js.
// Para HTML estático (login.html, register.html, etc.) se usa el
// atributo `data-icon="NombreIcono"` en un <span> vacío; app.js llama
// a renderIconPlaceholders() en cada carga de página para rellenarlos.
// ============================================================

import { createElement, icons } from 'https://esm.sh/lucide@latest';

const DEFAULT_ATTRS = {
  width: 20,
  height: 20,
  'stroke-width': 1.75,
};

export function icon(name, attrs = {}) {
  const iconNode = icons[name];
  if (!iconNode) {
    console.warn(`[icons.js] Icono Lucide no encontrado: "${name}"`);
    return document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  }
  return createElement(iconNode, { ...DEFAULT_ATTRS, ...attrs });
}

export function iconHTML(name, attrs = {}) {
  return icon(name, attrs).outerHTML;
}

// Rellena cualquier <span data-icon="NombreIcono" data-icon-size="18">
// vacío dentro de `root` con su SVG correspondiente. Se usa para
// marcado HTML estático que no pasa por una plantilla JS.
export function renderIconPlaceholders(root = document) {
  root.querySelectorAll('[data-icon]').forEach((el) => {
    const name = el.getAttribute('data-icon');
    const size = Number(el.getAttribute('data-icon-size')) || DEFAULT_ATTRS.width;
    el.replaceChildren(icon(name, { width: size, height: size }));
  });
}

// Botón de icono estándar (editar/eliminar en las tablas y tarjetas de
// Ingresos, Gastos, Ahorros y Presupuesto). Antes cada vista repetía
// las mismas ~6 líneas para crear cada botón; centralizarlo aquí es
// la eliminación de duplicado más directa de la Fase 6.
export function createIconButton({ iconName, label, danger = false, onClick, signal }) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = danger ? 'icon-btn icon-btn-danger' : 'icon-btn';
  btn.setAttribute('aria-label', label);
  btn.appendChild(icon(iconName, { width: 16, height: 16 }));
  btn.addEventListener('click', onClick, { signal });
  return btn;
}

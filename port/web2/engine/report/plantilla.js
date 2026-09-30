// @ts-check
// Armazón común de los informes (decisión 11 de port/web2/PLAN.md): un solo
// .html autocontenido, sin recursos externos (ni fuentes remotas: la pila
// de fuentes cae en las del sistema), que se abre sin conexión.
//
//   - CSS embebido, con @media print para imprimir a PDF en A4 (saltos de
//     página en las secciones marcadas, sin la barra de pantalla, sin
//     fondos oscuros, figuras, filas y bloques que no se parten, cabecera
//     de las tablas repetida en cada hoja, dos columnas en la hoja A4). La
//     versión angosta (una columna) es solo de pantalla: una hoja A4 mide
//     menos de 840 px y en la impresión no debe aplicarse. En pantalla, los
//     destinos de los enlaces (#fig-…) dejan lugar para la barra fija;
//   - el cuerpo que arma cada plantilla (SVG inline para los gráficos);
//   - los datos embebidos en <script type="application/json"> (el `<` va
//     escapado como <, así ningún nombre de bot cierra la etiqueta);
//   - una barra de pantalla (Imprimir, Datos · JSON, Datos · CSV) con un
//     script inline mínimo que descarga los datos embebidos.

import { esc } from './svg.js';

/** Pila de fuentes (sin fuentes remotas). */
export const FUENTE = "'IBM Plex Sans', system-ui, sans-serif";
export const FUENTE_TITULOS = "'IBM Plex Serif', Georgia, serif";
export const FUENTE_MONO = "'IBM Plex Mono', ui-monospace, monospace";

/** Ancho útil de la hoja (px): cabe en A4 con márgenes de 12 mm (≈ 703 px). */
export const ANCHO_HOJA = 688;
/** Ancho de una figura en dos columnas. */
export const ANCHO_MEDIO = 334;

const CSS = `
:root{color-scheme:light}
*{box-sizing:border-box}
body{margin:0;font-family:${FUENTE};color:#151513;background:#e9e8e3}
a{color:#0f5c55}a:hover{color:#0a3f3a}
.mono{font-family:${FUENTE_MONO}}
.barra{position:sticky;top:0;z-index:1;display:flex;align-items:center;gap:10px;padding:10px 24px;background:#151513;color:#f4f3ef;flex-wrap:wrap}
.barra .archivo{font-family:${FUENTE_MONO};font-size:13px;color:#c9c7bf;flex-grow:1;overflow-wrap:anywhere}
.btn{display:inline-flex;align-items:center;justify-content:center;font:inherit;font-size:13px;font-weight:500;padding:0 12px;height:34px;border-radius:6px;border:1px solid #3a3a36;background:#1f1f1d;color:#f4f3ef;cursor:pointer}
.btn.pri{background:#0f5c55;border-color:#0f5c55;color:#fff}
.hoja{width:800px;max-width:100%;margin:28px auto 40px;background:#fff;box-shadow:0 2px 16px rgba(0,0,0,.08);padding:48px 56px 40px;display:flex;flex-direction:column;gap:26px}
.cab{display:flex;flex-direction:column;gap:6px}
.kicker{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#0f5c55;font-weight:600}
h1{margin:0;font-family:${FUENTE_TITULOS};font-size:34px;font-weight:600;overflow-wrap:anywhere}
.meta{font-family:${FUENTE_MONO};font-size:12px;color:#52514e}
.resumen{display:flex;flex-direction:column;gap:10px;background:#f4f8f7;border-radius:8px;padding:18px 20px}
.resumen .kicker{color:#0a3f3a;letter-spacing:.06em}
.find{display:flex;gap:10px;align-items:baseline;font-size:15px;line-height:1.55;margin:0}
.sw{display:inline-block;width:10px;height:10px;border-radius:3px;flex-shrink:0}
.cap{font-size:12px;color:#52514e;line-height:1.5;margin:0}
.kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
.tile{display:flex;flex-direction:column;gap:2px;padding:10px 12px;border:1px solid #e1e0d9;border-radius:6px}
.tile b{font-size:20px;font-weight:600;font-variant-numeric:tabular-nums}
.tile span{font-size:12px;color:#6b6962}
.sec{display:flex;flex-direction:column;gap:12px;padding-top:26px;border-top:1px solid #e1e0d9}
h2{margin:0;font-family:${FUENTE_TITULOS};font-size:20px;font-weight:600}
h3{margin:8px 0 0;font-size:15px;font-weight:600}
.p{margin:0;font-size:14px;line-height:1.6;color:#2b2a27}
figure{margin:0;display:flex;flex-direction:column;gap:6px}
figure svg{max-width:100%;height:auto;display:block}
.dos{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}
.leyenda{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:12px;color:#3d3c38}
.leyenda span{display:inline-flex;align-items:center;gap:6px}
.tbl{width:100%;border-collapse:collapse;font-size:13px}
.tbl th{font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:#6b6962;font-weight:600;text-align:right;padding:6px 4px;border-bottom:1px solid #cfcdc4}
.tbl th:first-child,.tbl td:first-child,.tbl .izq{text-align:left}
.tbl td{padding:6px 4px;border-bottom:1px solid #ebe9e2;text-align:right;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.nombre{display:inline-flex;align-items:center;gap:6px}
.chip{display:inline-flex;align-items:center;font-size:11px;padding:2px 8px;border-radius:999px;white-space:nowrap;background:#ebe9e2;color:#3d3c38}
.chip.extincion{background:#151513;color:#fff}
.chip.especieNueva,.chip.llegada{background:#d9ece9;color:#0a3f3a}
.chip.sembrado,.chip.cambio{background:#f3e5cf;color:#6b4a00}
.chip.pico,.chip.generacion{background:#dde7f6;color:#1c4f91}
.pie{display:flex;justify-content:space-between;gap:20px;padding-top:18px;border-top:1px solid #e1e0d9;font-size:11px;color:#6b6962;flex-wrap:wrap}
.tick text{font-family:${FUENTE_MONO}}
@media screen{[id]{scroll-margin-top:72px}}
@media screen and (max-width:840px){.hoja{margin:0;padding:24px 16px}.kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.dos{grid-template-columns:1fr}.barra{padding:10px 16px}[id]{scroll-margin-top:112px}}
@page{size:A4;margin:14mm 12mm}
@media print{
  html,body{background:#fff;width:auto}
  .barra{display:none}
  .hoja{width:auto;max-width:none;margin:0;padding:0;box-shadow:none;gap:18px}
  .salto{break-before:page}
  figure,figure svg,.dos>div,.leyenda,.tile,.kpis,.cab,.resumen,.tbl tr,.find{break-inside:avoid;page-break-inside:avoid}
  .tbl thead{display:table-header-group}
  h2,h3{break-after:avoid;page-break-after:avoid}
  .dos{grid-template-columns:repeat(2,minmax(0,1fr))}
  .resumen{background:none;border:1px solid #cfcdc4}
  .chip,.chip.extincion,.chip.especieNueva,.chip.llegada,.chip.sembrado,.chip.cambio,.chip.pico,.chip.generacion{background:none;color:#151513;border:1px solid #9a988f}
  a{color:#151513;text-decoration:none}
  svg,.sw{-webkit-print-color-adjust:exact;print-color-adjust:exact}
}
`;

// Script de la barra (inline, sin dependencias). El CSV sale de las series
// embebidas: en la Corrida, ciclo, métrica, especie, media, mín, máx (las
// columnas de csvLargo de engine/export.js, sin n); en las demás plantillas,
// ciclo, corrida (A/B, si la hay), métrica, especie (si la hay) y las
// columnas numéricas que traigan sus series (media, p10, p90, mín, máx, n).
// Los textos que empiezan con = + - @ van neutralizados como en campoCsv.
const SCRIPT = `(function(){
var nodo=document.getElementById('datos-informe');if(!nodo)return;
var base=document.body.getAttribute('data-archivo')||'informe';
function bajar(n,t,tipo){var b=new Blob([t],{type:tipo});var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=n;document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove();},0);}
function campo(v){if(v===null||v===undefined)return '';var s=String(v);if(typeof v==='string'&&/^[=+\\-@\\t\\r]/.test(s))s="'"+s;return /[",\\n\\r]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}
function csv(o){var ss=o.series||[],co=o.tipo==='corrida';
var conC=ss.some(function(s){return s.corrida!=null;}),conE=co||ss.some(function(s){return s.especie!=null;});
var nums=co?['media','min','max']:['media','p10','p90','min','max','n'].filter(function(k){return ss.some(function(s){return !!s[k];});});
var cab=['ciclo'];if(conC)cab.push('corrida');cab.push('metrica');if(conE)cab.push('especie');
var f=[cab.concat(nums).join(',')];
ss.forEach(function(s){var t=s.t||o.t||[];for(var i=0;i<t.length;i++){var m=s.media[i];if(m===null)continue;var r=[t[i]];if(conC)r.push(campo(s.corrida));r.push(campo(s.metrica));if(conE)r.push(campo(s.especie||''));nums.forEach(function(k){var a=s[k];r.push(a?a[i]:(co?m:''));});f.push(r.join(','));}});
return f.join('\\n')+'\\n';}
function en(id,fn){var b=document.getElementById(id);if(b)b.addEventListener('click',fn);}
en('b-imprimir',function(){window.print();});
en('b-json',function(){bajar(base+'.json',nodo.textContent,'application/json');});
en('b-csv',function(){bajar(base+'.csv',csv(JSON.parse(nodo.textContent)),'text/csv');});
})();`;

/**
 * JSON seguro dentro de <script>: `<` como < (y los separadores de
 * línea U+2028/2029 escapados).
 * @param {unknown} datos
 */
export function jsonEmbebido(datos) {
  return JSON.stringify(datos)
    .replaceAll('<', '\\u003c')
    .replaceAll(' ', '\\u2028')
    .replaceAll(' ', '\\u2029');
}

/**
 * El documento completo.
 * @param {{idioma: string, titulo: string, archivo: string, cuerpo: string, datos: unknown,
 *   barra: {imprimir: string, json: string, csv: string}}} o
 */
export function documento(o) {
  const base = o.archivo.replace(/\.html?$/i, '');
  return (
    `<!doctype html>\n<html lang="${esc(o.idioma)}">\n<head>\n<meta charset="utf-8">\n` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">\n` +
    `<title>${esc(o.titulo)}</title>\n<style>${CSS}</style>\n</head>\n` +
    `<body data-archivo="${esc(base)}">\n` +
    `<div class="barra"><span class="archivo">${esc(o.archivo)}</span>` +
    `<button class="btn" type="button" id="b-csv">${esc(o.barra.csv)}</button>` +
    `<button class="btn" type="button" id="b-json">${esc(o.barra.json)}</button>` +
    `<button class="btn pri" type="button" id="b-imprimir">${esc(o.barra.imprimir)}</button></div>\n` +
    `<article class="hoja">\n${o.cuerpo}\n</article>\n` +
    `<script type="application/json" id="datos-informe">${jsonEmbebido(o.datos)}</script>\n` +
    `<script>${SCRIPT}</script>\n</body>\n</html>\n`
  );
}

/**
 * Nombre de archivo sugerido: informe_<slug>_<aaaa-mm-dd>.html.
 * @param {string} titulo @param {Date} fecha
 */
export function nombreArchivo(titulo, fecha) {
  const slug =
    String(titulo)
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'corrida';
  const d = Number.isNaN(fecha.getTime()) ? new Date(0) : fecha;
  return `informe_${slug}_${d.toISOString().slice(0, 10)}.html`;
}

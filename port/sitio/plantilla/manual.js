// Manual de darwinbots-wasm.org (PLAN-SITIO.md S9): tema, índice en el
// celular, botón «Copiar» de los bloques de ADN y el buscador (buscar.json,
// que se baja la primera vez que se usa). La página se lee sin esto. Los
// textos salen en el idioma de <html lang> (es o en).
(() => {
  const CLAVE = 'darwinbots2.tema'; // la misma que la app: mismo origen
  const raiz = document.body.dataset.raiz || '';
  const html = document.documentElement;
  const TX = {
    es: {
      tema: { auto: 'Tema: sistema', claro: 'Tema: claro', oscuro: 'Tema: oscuro' },
      copiar: 'Copiar',
      copiado: 'Copiado',
      noCopiado: 'No se pudo copiar',
      sinResultados: 'Sin resultados',
    },
    en: {
      tema: { auto: 'Theme: system', claro: 'Theme: light', oscuro: 'Theme: dark' },
      copiar: 'Copy',
      copiado: 'Copied',
      noCopiado: 'Could not copy',
      sinResultados: 'No results',
    },
  }[html.lang === 'en' ? 'en' : 'es'];

  // ---- Tema: sistema → claro → oscuro ----
  const nombres = TX.tema;
  const leer = () => {
    try {
      const t = localStorage.getItem(CLAVE);
      return t === 'claro' || t === 'oscuro' ? t : 'auto';
    } catch {
      return 'auto';
    }
  };
  const botonTema = document.querySelector('.tema');
  const pintar = (t) => {
    if (t === 'auto') delete html.dataset.tema;
    else html.dataset.tema = t;
    if (botonTema) botonTema.textContent = nombres[t];
  };
  pintar(leer());
  botonTema?.addEventListener('click', () => {
    const sig = { auto: 'claro', claro: 'oscuro', oscuro: 'auto' }[leer()];
    try {
      if (sig === 'auto') localStorage.removeItem(CLAVE);
      else localStorage.setItem(CLAVE, sig);
    } catch {}
    pintar(sig);
  });

  // ---- Índice en el celular ----
  const menu = document.querySelector('.menu');
  menu?.addEventListener('click', () => {
    const abierto = document.body.classList.toggle('con-indice');
    menu.setAttribute('aria-expanded', String(abierto));
  });
  document.querySelector('.lateral [aria-current]')?.scrollIntoView({ block: 'center' });

  // ---- Copiar ----
  for (const b of document.querySelectorAll('.copiar')) {
    b.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(b.dataset.texto || '');
        b.textContent = TX.copiado;
      } catch {
        b.textContent = TX.noCopiado;
      }
      setTimeout(() => {
        b.textContent = TX.copiar;
      }, 1500);
    });
  }

  // ---- Buscador ----
  const entrada = document.querySelector('.buscador input');
  const lista = document.querySelector('.buscador .resultados');
  if (!entrada || !lista) return;
  /** @type {Promise<any[]> | null} */
  let indice = null;
  const normal = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const cargar = () => {
    indice ??= fetch(`${raiz}buscar.json`)
      .then((r) => r.json())
      .then((xs) => xs.map((x) => ({ ...x, nt: normal(x.t), nk: normal(`${x.k} ${x.r} ${x.c}`) })))
      .catch(() => []);
    return indice;
  };
  let activo = -1;
  const puntaje = (x, terminos) => {
    let p = 0;
    for (const t of terminos) {
      if (x.nt === t || x.nt === `.${t}`) p += 100;
      else if (x.nt.startsWith(t) || x.nt.startsWith(`.${t}`)) p += 40;
      else if (x.nt.includes(t)) p += 20;
      else if (` ${x.nk} `.includes(` ${t} `)) p += 15;
      else if (x.nk.includes(t)) p += 5;
      else return 0;
    }
    return p;
  };
  const marcar = (i) => {
    const items = lista.querySelectorAll('li');
    activo = Math.max(-1, Math.min(i, items.length - 1));
    items.forEach((li, j) => {
      li.classList.toggle('activo', j === activo);
    });
    items[activo]?.scrollIntoView({ block: 'nearest' });
  };
  const buscar = async () => {
    const q = normal(entrada.value.trim());
    if (!q) {
      lista.hidden = true;
      return;
    }
    const xs = await cargar();
    const terminos = q.split(/\s+/);
    const res = xs
      .map((x) => ({ x, p: puntaje(x, terminos) }))
      .filter((r) => r.p > 0)
      .sort((a, b) => b.p - a.p || a.x.t.localeCompare(b.x.t))
      .slice(0, 15);
    lista.replaceChildren();
    if (!res.length) {
      const li = document.createElement('li');
      li.className = 'vacio';
      li.textContent = TX.sinResultados;
      lista.append(li);
    }
    for (const { x } of res) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = raiz + x.u;
      a.textContent = x.t;
      const s = document.createElement('small');
      s.textContent = [x.c, x.r].filter(Boolean).join(' · ');
      a.append(s);
      li.append(a);
      lista.append(li);
    }
    lista.hidden = false;
    marcar(res.length ? 0 : -1);
  };
  entrada.addEventListener('focus', cargar);
  entrada.addEventListener('input', buscar);
  entrada.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      marcar(activo + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      marcar(activo - 1);
    } else if (e.key === 'Enter') {
      const a = lista.querySelectorAll('li a')[Math.max(activo, 0)];
      if (a) location.href = a.href;
    } else if (e.key === 'Escape') {
      lista.hidden = true;
      entrada.blur();
    }
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.buscador')) lista.hidden = true;
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== entrada && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      entrada.focus();
    }
  });
})();

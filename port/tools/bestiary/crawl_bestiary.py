# Crawler del Bestiary del foro de DarwinBots (SMF 1.x, HTTP simple).
# Fase 1: listar temas de cada sub-board (todas las páginas).
# Fase 2: bajar cada tema y extraer bloques <code> (bbc_code) como candidatos a ADN.
# Salida: scratchpad/bots_raw/<board>/<topic_id>__<slug>.txt  +  raw_index.json
import html
import json
import os
import re
import sys
import time
import urllib.request

BASE = "http://forum.darwinbots.com/index.php"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "bots_raw")
BOARDS = {
    22: "F1 bots", 23: "F2 bots", 24: "Short bots", 25: "Multi-Bots",
    26: "Veggies", 27: "Interesting behaviour bots", 28: "Mutations",
    37: "The Starting Gate", 59: "EcoSim Bots", 71: "Single store",
    72: "F3 bots", 73: "Untagged bots",
}
DELAY = 0.7  # cortesía entre requests

opener = urllib.request.build_opener()
opener.addheaders = [("User-Agent", "Mozilla/5.0 (bestiary-archiver; contacto: jntaca@gmail.com)")]


def get(url, tries=3):
    for i in range(tries):
        try:
            with opener.open(url, timeout=40) as r:
                return r.read().decode("utf-8", "replace")
        except Exception as e:
            print(f"  ! {e} ({url})", flush=True)
            time.sleep(3 * (i + 1))
    return None


def strip_sess(u):
    return re.sub(r"\?PHPSESSID=[a-z0-9]+", "", u)


def board_pages(board):
    """Devuelve la lista de offsets de página del board."""
    first = get(f"{BASE}/board,{board}.0.html")
    if first is None:
        return [], {}
    # SMF pagina de a 15 y desde la primera página solo linkea 1,2,3,…,última:
    # generamos todos los offsets intermedios hasta el mayor visto.
    last = 0
    for m in re.finditer(rf"board,{board}\.(\d+)\.html", first):
        last = max(last, int(m.group(1)))
    return list(range(0, last + 1, 15)), {0: first}


def topics_in(html_text):
    """(topic_id, título) de una página de board; ignora los 'últimos mensajes'."""
    out = {}
    for m in re.finditer(
        r'href="[^"]*topic,(\d+)\.0\.html[^"]*">([^<]+)</a>', html_text
    ):
        tid, title = int(m.group(1)), html.unescape(m.group(2)).strip()
        out[tid] = title
    return out


CODE_RE = re.compile(
    r'<code class="bbc_code"[^>]*>(.*?)</code>|<code>(.*?)</code>', re.S
)


def extract_codes(page):
    codes = []
    for m in CODE_RE.finditer(page):
        raw = m.group(1) if m.group(1) is not None else m.group(2)
        # SMF mete <br /> y a veces spans; a texto plano:
        txt = re.sub(r"<br\s*/?>", "\n", raw)
        txt = re.sub(r"<[^>]+>", "", txt)
        # &nbsp; (\xa0) y zero-width rompen el tokenizador del core: a espacio.
        txt = (html.unescape(txt).replace("\r", "").replace("\xa0", " ")
               .replace("​", "").replace("﻿", ""))
        codes.append(txt.strip("\n"))
    return codes


DNA_HINT = re.compile(r"\b(cond|start|stop|end)\b")


def looks_like_dna(txt):
    # Un bot de texto tiene al menos un gen: cond/start ... stop, o al menos
    # pares valor/sysvar con store. Filtro laxo; la validación real la hace el core.
    if len(txt) < 20:
        return False
    hits = set(DNA_HINT.findall(txt))
    return ("cond" in hits or "start" in hits) and "stop" in hits


def slug(s):
    s = re.sub(r"[^A-Za-z0-9._ -]+", "", s).strip().replace(" ", "_")
    return s[:60] or "sin_titulo"


def main():
    os.makedirs(OUT, exist_ok=True)
    index = []
    done_topics = set()
    for board, bname in BOARDS.items():
        offs, cache = board_pages(board)
        print(f"== board {board} ({bname}): páginas {offs}", flush=True)
        topics = {}
        for off in offs:
            page = cache.get(off) or get(f"{BASE}/board,{board}.{off}.html")
            time.sleep(DELAY)
            if page:
                topics.update(topics_in(page))
        print(f"   {len(topics)} temas", flush=True)
        bdir = os.path.join(OUT, f"{board}")
        os.makedirs(bdir, exist_ok=True)
        for tid, title in sorted(topics.items()):
            if tid in done_topics:
                continue
            done_topics.add(tid)
            page = get(f"{BASE}/topic,{tid}.0.html")
            time.sleep(DELAY)
            if not page:
                continue
            codes = [c for c in extract_codes(page) if looks_like_dna(c)]
            # adjuntos .txt visibles para invitados (si los hay)
            atts = re.findall(r'href="([^"]*action=dlattach[^"]*)"[^>]*>([^<]*\.txt)', page)
            for j, code in enumerate(codes):
                suf = "" if len(codes) == 1 else f"__{j+1}"
                fn = f"{tid}__{slug(title)}{suf}.txt"
                with open(os.path.join(bdir, fn), "w", encoding="utf-8", newline="\n") as f:
                    f.write(code + "\n")
                index.append({
                    "board": board, "board_name": bname, "topic": tid,
                    "title": title, "file": f"{board}/{fn}",
                    "url": f"{BASE}/topic,{tid}.0.html",
                })
            for href, aname in atts:
                url = html.unescape(strip_sess(href))
                data = get(url)
                time.sleep(DELAY)
                if data and looks_like_dna(data):
                    fn = f"{tid}__att__{slug(aname)}"
                    if not fn.endswith(".txt"):
                        fn += ".txt"
                    with open(os.path.join(bdir, fn), "w", encoding="utf-8", newline="\n") as f:
                        f.write(data.replace("\r", ""))
                    index.append({
                        "board": board, "board_name": bname, "topic": tid,
                        "title": title, "file": f"{board}/{fn}", "attachment": aname,
                        "url": f"{BASE}/topic,{tid}.0.html",
                    })
        with open(os.path.join(OUT, "raw_index.json"), "w", encoding="utf-8") as f:
            json.dump(index, f, ensure_ascii=False, indent=1)
        print(f"   acumulado: {len(index)} archivos", flush=True)
    print(f"FIN: {len(index)} candidatos en {OUT}", flush=True)


if __name__ == "__main__":
    main()

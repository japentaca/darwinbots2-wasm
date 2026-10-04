# Publica en port/web/bots/ los candidatos validados por validate_bots.js.
# Regla por tema: preferir el adjunto .txt válido; si no hay, el bloque de
# código válido más largo. Genera bots.json (índice que consume index.html).
import json
import os
import re
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "bots_raw")
VALIDATED = os.path.join(HERE, "validated.json")
DEST = os.path.normpath(os.path.join(HERE, "..", "..", "web", "bots"))
# Bots de la casa (no vienen del foro): house/house.json + sus .txt. Se
# publican al final, así sobreviven a cada nueva corrida del archivador.
HOUSE = os.path.join(HERE, "house")
# Bots del resto del foro y del wiki (fuera del Bestiary), curados a mano:
# extra/extra.json + sus .txt. Se publican antes que los de la casa.
EXTRA = os.path.join(HERE, "extra")

# Orden de presentación de las categorías en el selector
BOARD_ORDER = ["F1 bots", "F2 bots", "F3 bots", "Short bots", "Multi-Bots",
               "Veggies", "Interesting behaviour bots", "EcoSim Bots",
               "Mutations", "The Starting Gate", "Single store",
               "Untagged bots", "Forum bots", "Wiki bots", "House bots"]


def clean_name(title):
    s = title.strip()
    s = re.sub(r"\s*\((veg|F1|F2|F3)\)\s*$", "", s, flags=re.I)
    s = re.sub(r'[<>:"/\\|?*]+', "", s)
    return s.strip() or "untitled"


def main():
    with open(VALIDATED, encoding="utf-8") as f:
        results = json.load(f)
    valid = [r for r in results if r.get("valid")]

    # agrupar por tema
    by_topic = {}
    for r in valid:
        by_topic.setdefault(r["topic"], []).append(r)

    chosen = []
    for tid, rs in by_topic.items():
        atts = [r for r in rs if "attachment" in r]
        if atts:
            pick = max(atts, key=lambda r: os.path.getsize(os.path.join(RAW, r["file"])))
        else:
            pick = max(rs, key=lambda r: os.path.getsize(os.path.join(RAW, r["file"])))
        chosen.append(pick)

    # ordenar: por board (orden fijo) y alfabético por título
    order = {b: i for i, b in enumerate(BOARD_ORDER)}
    chosen.sort(key=lambda r: (order.get(r["board_name"], 99), r["title"].lower()))

    if os.path.isdir(DEST):
        shutil.rmtree(DEST)
    os.makedirs(DEST)

    index = []
    used = set()
    for r in chosen:
        name = clean_name(r["title"])
        fn = re.sub(r"[^A-Za-z0-9._-]+", "_", name)[:60].strip("_") or "bot"
        base = fn
        k = 2
        while fn.lower() in used:
            fn = f"{base}_{k}"
            k += 1
        used.add(fn.lower())
        fn += ".txt"
        shutil.copyfile(os.path.join(RAW, r["file"]), os.path.join(DEST, fn))
        index.append({
            "file": fn,
            "name": name,
            "board": r["board_name"],
            "veg": bool(r.get("veg")),
            "url": r["url"],
        })

    # extra y casa: el registro de su .json tal cual (file, name, board, veg, url)
    for folder, reg in ((EXTRA, "extra.json"), (HOUSE, "house.json")):
        reg_path = os.path.join(folder, reg)
        if os.path.isfile(reg_path):
            with open(reg_path, encoding="utf-8") as f:
                for e in json.load(f):
                    shutil.copyfile(os.path.join(folder, e["file"]), os.path.join(DEST, e["file"]))
                    index.append(e)

    with open(os.path.join(DEST, "bots.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(index, f, ensure_ascii=False, indent=1)

    per_board = {}
    for e in index:
        per_board[e["board"]] = per_board.get(e["board"], 0) + 1
    for b in BOARD_ORDER:
        if b in per_board:
            print(f"{per_board[b]:4d}  {b}")
    print(f"TOTAL {len(index)} bots publicados en {DEST}")


if __name__ == "__main__":
    main()

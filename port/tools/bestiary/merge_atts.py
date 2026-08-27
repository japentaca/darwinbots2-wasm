# Fusiona los adjuntos cosechados (bots_att_*.json, lotes drenados del
# navegador) dentro de bots_raw/: escribe <board>/<tid>__att__<name>.txt y
# extiende raw_index.json con entradas "attachment" (las que publish_bots.py
# prefiere sobre los bloques de código).
import glob
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "bots_raw")
BOARDS = {
    22: "F1 bots", 23: "F2 bots", 24: "Short bots", 25: "Multi-Bots",
    26: "Veggies", 27: "Interesting behaviour bots", 28: "Mutations",
    37: "The Starting Gate", 59: "EcoSim Bots", 71: "Single store",
    72: "F3 bots", 73: "Untagged bots",
}


def slug(s):
    s = re.sub(r"[^A-Za-z0-9._ -]+", "", s).strip().replace(" ", "_")
    return s[:60] or "adjunto"


def main():
    with open(os.path.join(RAW, "raw_index.json"), encoding="utf-8") as f:
        index = json.load(f)
    known = {(e["board"], e["topic"], e.get("attachment")) for e in index}

    added = 0
    for chunk in sorted(glob.glob(os.path.join(HERE, "bots_att_*.json"))):
        with open(chunk, encoding="utf-8") as f:
            atts = json.load(f)
        for a in atts:
            board, tid = int(a["b"]), int(a["tid"])
            if (board, tid, a["name"]) in known:
                continue
            known.add((board, tid, a["name"]))
            txt = (a["content"].replace("\xa0", " ")
                   .replace("​", "").replace("﻿", ""))
            bdir = os.path.join(RAW, str(board))
            os.makedirs(bdir, exist_ok=True)
            fn = f"{tid}__att__{slug(a['name'])}"
            if not fn.lower().endswith(".txt"):
                fn += ".txt"
            with open(os.path.join(bdir, fn), "w", encoding="utf-8",
                      newline="\n") as f:
                f.write(txt if txt.endswith("\n") else txt + "\n")
            index.append({
                "board": board, "board_name": BOARDS[board], "topic": tid,
                "title": a["title"], "file": f"{board}/{fn}",
                "attachment": a["name"],
                "url": f"http://forum.darwinbots.com/index.php/topic,{tid}.0.html",
            })
            added += 1

    with open(os.path.join(RAW, "raw_index.json"), "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=1)
    print(f"adjuntos nuevos fusionados: {added} (índice: {len(index)} entradas)")


if __name__ == "__main__":
    main()

import re, zlib

path = r"D:\Devesh\Devesh 2\Python\ML\Deepseek end Point\Reciprocity theorem.pdf"
outpath = r"D:\Devesh\Devesh 2\Python\ML\Deepseek end Point\pdf_text.txt"
data = open(path, "rb").read()

def iter_streams(buf):
    out = []
    for m in re.finditer(rb"stream\r?\n", buf):
        start = m.end()
        end = buf.find(b"endstream", start)
        if end != -1:
            out.append(buf[start:end])
    return out

def strings_in(s):
    res = []
    i = 0
    n = len(s)
    while i < n:
        if s[i] == "(":
            depth = 1
            i += 1
            cur = []
            while i < n and depth > 0:
                ch = s[i]
                if ch == "\\":
                    nxt = s[i+1:i+2]
                    mp = {"n": "\n", "r": "\r", "t": "\t", "(": "(", ")": ")", "\\": "\\"}
                    cur.append(mp.get(nxt, nxt))
                    i += 2
                    continue
                if ch == "(":
                    depth += 1
                    cur.append(ch)
                elif ch == ")":
                    depth -= 1
                    if depth > 0:
                        cur.append(ch)
                else:
                    cur.append(ch)
                i += 1
            res.append("".join(cur))
        else:
            i += 1
    return res

streams = iter_streams(data)
lines = []
for idx, raw in enumerate(streams):
    dec = None
    try:
        dec = zlib.decompress(raw)
    except Exception:
        try:
            dec = zlib.decompressobj().decompress(raw)
        except Exception:
            dec = None
    if not dec:
        continue
    lines.append("==== STREAM %d declen %d ====" % (idx, len(dec)))
    s = dec.decode("latin-1", "replace")
    if b"BT" in dec and (b"Tj" in dec or b"TJ" in dec):
        strlist = strings_in(s)
        lines.append("[TEXT] " + " ".join(strlist))
    else:
        lines.append("[RAW] " + s[:1500])

open(outpath, "w", encoding="utf-8").write("\n".join(lines))
print("WROTE", outpath, len(lines), "sections")

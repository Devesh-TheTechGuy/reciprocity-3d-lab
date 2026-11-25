import re, zlib

path = r"D:\Devesh\Devesh 2\Python\ML\Deepseek end Point\Reciprocity theorem.pdf"
outpath = r"D:\Devesh\Devesh 2\Python\ML\Deepseek end Point\pdf_content.txt"
data = open(path, "rb").read()

def dec(raw):
    for f in (zlib.decompress, lambda r: zlib.decompressobj().decompress(r)):
        try:
            return f(raw)
        except Exception:
            pass
    return None

def unescape(s):
    out = []
    i = 0
    mp = {"n": "\n", "r": "\r", "t": "\t", "b": "\b", "f": "\f", "(": "(", ")": ")", "\\": "\\"}
    while i < len(s):
        if s[i] == "\\" and i + 1 < len(s):
            n = s[i+1]
            out.append(mp.get(n, n))
            i += 2
        else:
            out.append(s[i])
            i += 1
    return "".join(out)

def inner_strings(arr):
    return [unescape(x) for x in re.findall(r"\((?:\\.|[^\\()])*\)", arr)]

token = re.compile(r"(\[(?:[^\[\]\\]|\\.)*\]\s*TJ)|(\((?:[^()\\]|\\.)*\)\s*Tj)|(\bTd\b|\bTD\b|\bT\*\b|\bTm\b)")

streams = []
for m in re.finditer(rb"stream\r?\n", data):
    s = m.end(); e = data.find(b"endstream", s)
    if e != -1:
        streams.append((s, data[s:e]))

pages = []
for off, raw in streams:
    d = dec(raw)
    if d is None:
        continue
    txt = d.decode("latin-1", "replace")
    if "TJ" not in txt and "Tj" not in txt:
        continue
    if "BT" not in txt:
        continue
    lines = []
    cur = []
    for mm in token.finditer(txt):
        if mm.group(1):
            cur.append("".join(inner_strings(mm.group(1))))
        elif mm.group(2):
            cur.append("".join(inner_strings(mm.group(2))))
        else:
            if cur:
                lines.append("".join(cur))
                cur = []
    if cur:
        lines.append("".join(cur))
    body = "\n".join(x for x in lines if x.strip())
    if body.strip():
        pages.append((off, body))

out = []
for i, (off, body) in enumerate(pages):
    out.append("########## CONTENT STREAM %d (offset %d) ##########" % (i, off))
    out.append(body)
    out.append("")
open(outpath, "w", encoding="utf-8").write("\n".join(out))
print("wrote", outpath, "content-streams:", len(pages))

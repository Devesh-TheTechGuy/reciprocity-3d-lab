import re, zlib

path = r"D:\Devesh\Devesh 2\Python\ML\Deepseek end Point\Reciprocity theorem.pdf"
out = r"D:\Devesh\Devesh 2\Python\ML\Deepseek end Point\pdf_streams.txt"
data = open(path, "rb").read()

streams = []
for m in re.finditer(rb"stream\r?\n", data):
    s = m.end()
    e = data.find(b"endstream", s)
    if e != -1:
        streams.append((s, data[s:e]))

def dec(raw):
    for f in (lambda r: zlib.decompress(r), lambda r: zlib.decompressobj().decompress(r)):
        try:
            return f(raw)
        except Exception:
            pass
    return None

def printables(b, minlen=4):
    return re.findall(rb"[ -~]{%d,}" % minlen, b)

lines = []
for i, (off, raw) in enumerate(streams):
    d = dec(raw)
    tag = "FLATE" if d is not None else "RAW  "
    cnt = ""
    if d is not None:
        cnt = " BT=%d Tj=%d TJ=%d Td=%d Tf=%d" % (d.count(b"BT"), d.count(b"Tj"), d.count(b"TJ"), d.count(b"Td"), d.count(b"Tf"))
    lines.append("[%02d] off=%d rawlen=%d %s%s" % (i, off, len(raw), tag, cnt))
    body = d if d is not None else raw
    ps = printables(body)
    joined = " | ".join(p.decode("latin-1", "replace") for p in ps[:30])
    lines.append("     " + joined[:900])

open(out, "w", encoding="utf-8").write("\n".join(lines))
print("wrote", out)

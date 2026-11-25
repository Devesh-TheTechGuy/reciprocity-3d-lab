import re, os

path = r"D:\Devesh\Devesh 2\Python\ML\Deepseek end Point\Reciprocity theorem.pdf"
outdir = r"D:\Devesh\Devesh 2\Python\ML\Deepseek end Point\pdf_images"
os.makedirs(outdir, exist_ok=True)
data = open(path, "rb").read()

starts = [m.start() for m in re.finditer(b"\xff\xd8\xff", data)]
print("JPEG SOI count:", len(starts))
count = 0
for i, s in enumerate(starts):
    e = data.find(b"\xff\xd9", s)
    if e == -1:
        continue
    e += 2
    blob = data[s:e]
    if len(blob) < 3000:
        continue
    fn = os.path.join(outdir, "img_%02d_%d.jpg" % (i, len(blob)))
    open(fn, "wb").write(blob)
    count += 1
    print("saved", os.path.basename(fn))
print("TOTAL SAVED:", count)

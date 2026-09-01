import os, datetime

rb = "C:\\$Recycle.Bin"
print("检查:", rb, "存在:", os.path.exists(rb))
big = []
try:
    for sid in os.listdir(rb):
        sidpath = os.path.join(rb, sid)
        for root, dirs, files in os.walk(sidpath):
            for f in files:
                fp = os.path.join(root, f)
                try:
                    sz = os.path.getsize(fp)
                    if sz > 100000:
                        big.append((round(sz / 1048576, 1), fp, os.path.getmtime(fp)))
                except Exception:
                    pass
except Exception as e:
    print("ERR", e)
big.sort(reverse=True)
for sz, fp, mt in big[:20]:
    print("%.1fMB\t%s\t%s" % (sz, datetime.datetime.fromtimestamp(mt).strftime("%m-%d %H:%M"), fp))
if not big:
    print("回收站无 >100KB 文件")

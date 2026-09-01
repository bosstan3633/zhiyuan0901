import os, datetime

rb = "C:\\$Recycle.Bin"
gitlike = []
total_entries = 0
try:
    for sid in os.listdir(rb):
        sidpath = os.path.join(rb, sid)
        for root, dirs, files in os.walk(sidpath):
            for f in files:
                total_entries += 1
                fp = os.path.join(root, f)
                low = f.lower()
                if any(k in low for k in ('.git', 'pack', 'head', 'config', 'refs', 'objects', 'index', 'rewrite')):
                    try:
                        sz = os.path.getsize(fp)
                        gitlike.append((round(sz / 1048576, 2), fp, os.path.getmtime(fp)))
                    except Exception:
                        pass
except Exception as e:
    print("ERR", e)

print("回收站总条目:", total_entries)
gitlike.sort(reverse=True)
print("--- git 相关条目（按大小） ---")
for sz, fp, mt in gitlike[:30]:
    print("%.2fMB\t%s\t%s" % (sz, datetime.datetime.fromtimestamp(mt).strftime("%m-%d %H:%M"), fp))
if not gitlike:
    print("回收站无 git 相关文件")

# 同时检查项目内是否有其他 git 备份
print("\n--- 项目内可能的 git 备份 ---")
for cand in [r"D:\知源工作台V2.11.0\.git.bak", r"D:\知源工作台V2.11.0\.git_old", r"D:\知源工作台V2.11.0\git-backup", r"D:\知源工作台V2.11.0\v2\.git"]:
    print(("存在: " if os.path.exists(cand) else "缺失: ") + cand)

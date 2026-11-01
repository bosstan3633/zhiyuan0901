#!/usr/bin/env python3
"""
宣传片合成 · 第 2 步：拼接 + 叠加（字幕/主线/尾帧）+ 混音（旁白/配乐/环境音）

时间轴：净时长合计 60.0s，xfade 转场每处扣 0.4s × 15 处 = 6.0s
        ⇒ 拼接前给每段补 0.4s（除首段），使成片精确 60.000s。

声音设计（母本「声音设计」节）：
  00:00-00:07.4  环境杂讯渐强（ffmpeg anoisesrc 生成，无需外部素材）
  00:07.4-00:10  戛然静音（痛点问句处）
  00:10-01:00    克制笃定的极简电子配乐（10s 淡入，58s 后淡出）
  旁白 5 段：adelay 精确定位，按镜头起点起拍
"""
import os
import json
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEG = os.path.join(ROOT, 'work', 'segments')
OV = os.path.join(ROOT, 'work', 'overlays')
VOICE = os.path.join(ROOT, 'voice')
MUSIC = os.path.join(ROOT, 'music')
OUT = os.path.join(ROOT, 'out')
os.makedirs(OUT, exist_ok=True)

W, H, FPS = 1920, 1080, 30
XF = 0.4          # 转场时长
TOTAL = 60.0

plan = json.load(open(os.path.join(SEG, 'plan.json')))
ovman = json.load(open(os.path.join(OV, 'overlay_manifest.json')))

# ── 1. 拼接（xfade 链） ────────────────────────────────────────────────
inputs, filt, labels = [], [], []


_input_counter = [0]


def add_input(path, extra=None):
    """ffmpeg 的 input index 按 -i 出现顺序编号，**与 argv 位置无关**
    （inputs 列表里 '-i' 与路径成对，长度是 index 的两倍）。
    早前用 len(inputs) 当 index ⇒ 索引整体错位 ⇒ filter 报 "Stream specifier ':v'"。"""
    idx = _input_counter[0]
    _input_counter[0] += 1
    inputs.extend((extra or []) + ['-i', path])   # 输入选项必须排在 -i 之前
    return idx


seg_idx = [add_input(os.path.join(SEG, f"seg_{s['id']}.mp4")) for s in plan]

# 每段补长 XF（首段除外），使总长 = 60s
# 用 tpad=clone 延长末帧 —— trim 只会裁剪，不会把 8.8s 的片段变成 9.2s。
for i, s in enumerate(plan):
    need = 0.0 if i == 0 else XF
    # filter_complex 里引用输入流必须写 [N:v]；[N] 会被当成 stream specifier 解析
    src = f"[{seg_idx[i]}:v]"
    if need:
        filt.append(f"{src}setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration={need},trim=duration={s['dur'] + need},setpts=PTS-STARTPTS[t{i}v]")
    else:
        filt.append(f"{src}setpts=PTS-STARTPTS,trim=duration={s['dur']},setpts=PTS-STARTPTS[t{i}v]")

# xfade 链：offset 必须是「前段末长 − 转场长」，否则 transition 会超出前段 ⇒ Invalid argument
prev = "[t0v]"
stream_len = plan[0]['dur']          # 当前 prev 流的总长
for i in range(1, len(plan)):
    out = f"[x{i}v]"
    off = round(stream_len - XF, 3)
    filt.append(f"{prev}[t{i}v]xfade=transition=fade:duration={XF}:offset={off}{out}")
    prev = out
    stream_len = stream_len + plan[i]['dur'] + XF - XF
print(f'  xfade 链 {len(plan)-1} 处，最终流长 {stream_len:.3f}s')

# ── 2. 叠加层 ──────────────────────────────────────────────────────────
# 2.1 紫色主线母题（全片）
thread_idx = add_input(os.path.join(OV, 'thread.png'))
filt.append(f"{prev}[{thread_idx}:v]overlay=0:0:format=auto[main]")

# 2.2 品牌尾帧（覆盖末段）
end_idx = add_input(os.path.join(OV, 'endframe.png'))
end_start = round(TOTAL - plan[-1]['dur'], 3)
filt.append(f"[main][{end_idx}:v]overlay=0:0:enable='between(t,{end_start},{TOTAL})':format=auto[main2]")

# 2.3 字幕
cur = '[main2]'
subs = [s for s in ovman if 'png' in s]
for i, s in enumerate(subs):
    idx = add_input(os.path.join(OV, s['png']))
    nxt = f"[sub{i}v]" if i < len(subs) - 1 else "[vout]"
    filt.append(f"{cur}[{idx}:v]overlay=0:0:enable='between(t,{s['start']},{s['end']})':format=auto{nxt}")
    cur = nxt

# ── 3. 音频 ────────────────────────────────────────────────────────────
VOICE_FILES = [
    ('voice_v1.mp3', 1.20),
    ('voice_v2.mp3', 10.30),
    ('voice_v3.mp3', 20.40),
    ('voice_v4_fit.mp3', 35.40),
    ('voice_v5_fit.mp3', 46.50),
]
v_idx = [(add_input(os.path.join(VOICE, f)), d) for f, d in VOICE_FILES]
m_idx = add_input(os.path.join(MUSIC, 'music_main.mp3'), ['-stream_loop', '2'])

for i, (idx, delay) in enumerate(v_idx):
    filt.append(f"[{idx}:a]adelay={int(delay*1000)}|{int(delay*1000)},volume=1.15[v{i}a]")

# 配乐包络：**0–9.4s 必须为静音**（母本：此段只有环境杂讯，痛点问句处戛然静音），
# 9.4s 起 1.5s 淡入，57.5s 起淡出。
# ⚠ 不能用 afade=t=in:st=10 —— afade 的 in 只是「从 st 开始渐入到满」，
#   st 之前**保持原音量**，实测导致 0–10s 一直有配乐（音量检测全程 -23.7dB 无差异）。
#   ⇒ 用带时间表达式的 volume 滤镜显式做包络。
filt.append(
    f"[{m_idx}:a]atrim=duration={TOTAL},asetpts=N/SR/TB,"
    "volume=volume='if(lt(t,9.4),0,"
    "if(lt(t,10.9),(t-9.4)/1.5,"
    "if(gt(t,57.5),max(0,(60-t)/2.5),1)))':eval=frame,"
    "volume=0.5[music]"
)
# 环境杂讯：0-7.4s 渐强，7.4s 起静音（痛点问句处戛然而止）
filt.append(
    "anoisesrc=color=brown:amplitude=0.6:duration=7.4:sample_rate=44100[noise0]"
)
filt.append(
    "[noise0]afade=t=in:st=0:d=7.0,volume=0.30[noise]"
)

mix_in = ''.join(f"[v{i}a]" for i in range(len(v_idx)))
# amix normalize=0 只保证不削峰、不提升；成片平均电平偏低（实测 -23.7dB），
# 母本要求"平静、清醒"但仍要听得清 ⇒ 统一提 8dB 后再限幅。
filt.append(f"{mix_in}[music][noise]amix=inputs={len(v_idx)+2}:duration=longest:normalize=0,"
            "aformat=channel_layouts=stereo,volume=2.5,alimiter=limit=0.95:level=0[aout]")

cmd = ['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error']
cmd += inputs
cmd += [
    '-filter_complex', ';'.join(filt),
    '-map', '[vout]', '-map', '[aout]',
    '-t', f'{TOTAL}',
    '-r', str(FPS), '-c:v', 'libx264', '-preset', 'slow', '-crf', '18',
    '-profile:v', 'high', '-level', '4.1', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
    '-movflags', '+faststart',
    os.path.join(OUT, '知源调度台_1分钟宣传片_1920x1080.mp4'),
]
print('▶ 执行最终合成…')
r = subprocess.run(cmd, capture_output=True, text=True)
if r.returncode != 0:
    open(os.path.join(ROOT,'work','ff_err.txt'),'w').write(r.stderr)
    print('❌ 失败，完整 stderr → work/ff_err.txt')
    print(r.stderr[:1500])
    raise SystemExit(1)
print('✅ 完成')

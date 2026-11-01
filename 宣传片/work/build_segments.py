#!/usr/bin/env python3
"""
宣传片合成 · 第 1 步：把每个片段标准化成 1920×1080 / 30fps / 精确时长

为什么分两步：
  1) 片段先独立渲染 → 每段可单独验收（画面、运镜、时长），出问题时能定位到具体镜头；
  2) 第 2 步只做拼接 + 叠加 + 混音，不在同一条命令里处理 16 段，ffmpeg 图太长难排错。

真实界面截图是静态图 ⇒ 用 zoompan 做克制的 Ken Burns 运镜（慢推 / 微移），
避免画面死板；运镜方向逐段变化，形成呼吸感而不喧宾夺主（母本：Linear 式克制）。
"""
import os
import subprocess
import json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = os.path.join(ROOT, 'shots')
GEN = os.path.join(ROOT, 'gen')
SEG = os.path.join(ROOT, 'work', 'segments')
os.makedirs(SEG, exist_ok=True)

W, H, FPS = 1920, 1080, 30

# ── 片段清单 ────────────────────────────────────────────────────────────
# kind: 'still' = 真实界面截图（zoompan 运镜） / 'clip' = AI 生成视频
# dur:  在 xfade 链里的净时长（不含转场消耗）
PLAN = [
    # 镜头1 00:00-00:10 痛点
    dict(id='01', kind='clip',  src='g1_pain.mp4',      dur=8.8,  mov='in',   shot='镜头1'),
    dict(id='02', kind='clip',  src='g2_gather.mp4',   dur=1.2,  mov='in',   shot='镜头1'),
    # 镜头2 00:10-00:20 破局（三个浮层）
    dict(id='03', kind='still', src='06-overlay-capture.png',   dur=3.3, mov='right', shot='镜头2'),
    dict(id='04', kind='still', src='07-overlay-curiosity.png', dur=3.3, mov='in',    shot='镜头2'),
    dict(id='05', kind='still', src='08-overlay-search.png',    dur=3.4, mov='left',  shot='镜头2'),
    # 镜头3 00:20-00:35 调度台
    dict(id='06', kind='still', src='01-dashboard.png',          dur=7.0, mov='in',    shot='镜头3'),
    dict(id='07', kind='still', src='02-drawer-task.png',       dur=4.0, mov='left',  shot='镜头3'),
    dict(id='08', kind='still', src='09-reuse-count.png',       dur=4.0, mov='in',    shot='镜头3'),
    # 镜头4 00:35-00:46 策展台
    dict(id='09', kind='clip',  src='g3_thread.mp4',     dur=1.2,  mov='in',   shot='镜头4'),
    dict(id='10', kind='still', src='03-curation.png',          dur=4.8, mov='in',    shot='镜头4'),
    dict(id='11', kind='still', src='04-curation-canvas.png',   dur=3.5, mov='right', shot='镜头4'),
    dict(id='12', kind='clip',  src='g4_structure.mp4',  dur=1.5,  mov='in',   shot='镜头4'),
    # 镜头5 00:46-01:00 信任 + 收口
    dict(id='13', kind='still', src='05-export.png',             dur=4.5, mov='in',    shot='镜头5'),
    dict(id='14', kind='clip',  src='g5_data.mp4',       dur=2.0,  mov='in',    shot='镜头5'),
    dict(id='15', kind='clip',  src='g6_end.mp4',        dur=3.0,  mov='in',    shot='镜头5'),
    dict(id='16', kind='still', src=None,                dur=4.5, mov='none',  shot='镜头5',
         note='品牌尾帧（overlays/endframe.png）'),
]

# zoompan 运镜参数：慢推 / 微移，幅度克制（母本：Linear 式克制、大量留白）
# 注：zoompan 没有 `t` 变量，进度只能用 `on`（输出帧号，从 1 起）除以总帧数 N。
def mov_expr(kind, total_frames):
    n = max(1, total_frames)
    if kind == 'in':
        return ("z='min(zoom+0.00055,1.10)':"
                "x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'")
    if kind == 'right':
        return (f"z='min(zoom+0.00035,1.07)':"
                f"x='(iw-iw/zoom)*on/{n}':y='ih/2-(ih/zoom/2)'")
    if kind == 'left':
        return (f"z='min(zoom+0.00035,1.07)':"
                f"x='(iw-iw/zoom)*(1-on/{n})':y='ih/2-(ih/zoom/2)'")
    return ("z='1.06':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'")


def build_still(seg):
    src = os.path.join(SHOTS, seg['src'])
    if not os.path.exists(src):
        raise SystemExit(f'缺素材：{src}')
    dur = seg['dur']
    frames = int(round(dur * FPS))
    # PNG 输入默认 25fps ⇒ 帧数不足 ⇒ zoompan 输出时长偏短（实测 7.0s 只出 5.83s）。
    # 修法：-framerate 30 喂足帧，再用 trim=end_frame 精确截断 + setpts 重置时间戳。
    vf = (f"scale=2560:1440:flags=lanczos,"
          f"zoompan={mov_expr(seg['mov'], frames)}:d=1:s={W}x{H}:fps={FPS},"
          f"trim=end_frame={frames},setpts=N/{FPS}/TB,format=yuv420p")
    return [
        '-loop', '1', '-framerate', str(FPS), '-t', f'{dur + 1}', '-i', src,
        '-vf', vf, '-r', str(FPS), '-c:v', 'libx264', '-preset', 'medium',
        '-crf', '18', '-pix_fmt', 'yuv420p', '-an', seg['out'],
    ]


def build_clip(seg):
    src = os.path.join(GEN, seg['src'])
    if not os.path.exists(src):
        raise SystemExit(f'缺素材：{src}')
    dur = seg['dur']
    # 生成素材原生 1366×768 → scale 到 1920×1080；按需裁前段（取运动最明确的片段）
    frames = int(round(dur * FPS))
    # 生成素材原生 24fps ⇒ 用 fps 滤镜做帧率转换（补帧），保持时长不变；
    # 不能用 setpts=N/30/TB 硬改，否则 24fps 内容按 30fps 播 → 画面加速 1.25 倍。
    vf = (f"scale={W}:{H}:flags=lanczos,"
          f"fps={FPS},trim=end_frame={frames},setpts=PTS-STARTPTS,format=yuv420p")
    return [
        '-i', src,
        '-vf', vf, '-t', f'{dur}', '-r', str(FPS),
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
        '-pix_fmt', 'yuv420p', '-an', seg['out'],
    ]


def build_endframe(seg):
    src = os.path.join(ROOT, 'work', 'overlays', 'endframe.png')
    dur = seg['dur']
    frames = int(round(dur * FPS))
    vf = (f"scale=2560:1440:flags=lanczos,"
          f"zoompan={mov_expr('in', frames)}:d=1:s={W}x{H}:fps={FPS},"
          f"trim=end_frame={frames},setpts=N/{FPS}/TB,format=yuv420p")
    return [
        '-loop', '1', '-framerate', str(FPS), '-t', f'{dur + 1}', '-i', src,
        '-vf', vf, '-r', str(FPS), '-c:v', 'libx264', '-preset', 'medium',
        '-crf', '18', '-pix_fmt', 'yuv420p', '-an', seg['out'],
    ]


if __name__ == '__main__':
    total = 0
    for seg in PLAN:
        seg['out'] = os.path.join(SEG, f"seg_{seg['id']}.mp4")
        if seg.get('src') is None:
            cmd = ['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error'] + build_endframe(seg)
        elif seg['kind'] == 'still':
            cmd = ['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error'] + build_still(seg)
        else:
            cmd = ['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error'] + build_clip(seg)
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode != 0:
            print(f"❌ seg_{seg['id']} 失败:\n{r.stderr[-900:]}")
            raise SystemExit(1)
        total += seg['dur']
        print(f"  ✓ seg_{seg['id']:>2} {seg['dur']:>4.1f}s  {seg['shot']}  {seg.get('src') or seg.get('note')}")

    print(f'\n净时长合计 {total:.1f}s（xfade 转场会再扣减，见第 2 步补偿）')
    json.dump(PLAN, open(os.path.join(SEG, 'plan.json'), 'w'), ensure_ascii=False, indent=1)

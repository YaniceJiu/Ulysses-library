# -*- coding: utf-8 -*-
"""
从下载的 Faithful 高清材质包提取建筑用贴图的高清版（64x），输出到 public/tex_hd/。
映射规则：
  1. 我方文件名在包里同名 → 直接用（oak_planks.png -> oak_planks.png）
  2. 我方 *_y.png（Mineways 生物群系染色变体）→ 剥掉 _y 用包里的原版贴图
     （grass_block_top_y.png -> grass_block_top.png；包里就是原版绿色，比染色再修正更干净）
  3. 其余找不到的（Mineways 自定义 MWO_/MW_ 等）→ 回退：原 16x 复制过去（保持可用）
用法：
  python hd_from_pack.py --dry        # 只报告覆盖情况
  python hd_from_pack.py              # 实际生成 tex_hd/
"""
import os, shutil, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MY = os.path.join(ROOT, 'public', 'tex')
PACK = os.path.join(ROOT, 'hd_pack', 'extracted', 'assets', 'minecraft', 'textures', 'block')
DST = os.path.join(ROOT, 'public', 'tex_hd')
DRY = '--dry' in sys.argv


def first_frame(src_path, out_path):
    """动画竖条贴图：取第一帧（顶部 64x64）；宽度不是 64 的缩到 64x64。"""
    im = Image.open(src_path).convert('RGBA')
    if im.height >= 64:
        im = im.crop((0, 0, im.width, 64))
    if im.width != 64:
        im = im.resize((64, 64), Image.LANCZOS)
    im.save(out_path)
    return True


def build_plan():
    mine = sorted(f for f in os.listdir(MY) if f.endswith('.png'))
    pack = set(f for f in os.listdir(PACK) if f.endswith('.png'))
    plan = []  # (mine_name, src_path_or_None, via, animated)
    for name in mine:
        if name in pack:
            plan.append((name, os.path.join(PACK, name), 'exact', False))
        elif name.endswith('_y.png') and name[:-6] + '.png' in pack:  # 'xxx_y.png' -> 'xxx.png'
            plan.append((name, os.path.join(PACK, name[:-6] + '.png'), 'strip_y', False))
        else:
            plan.append((name, None, 'fallback', False))
    # 检测动画（非 64x64 的匹配贴图）
    for i, (name, src, via, _) in enumerate(plan):
        if src:
            try:
                w, h = Image.open(src).size
                if w != 64 or h != 64:
                    plan[i] = (name, src, via, True)
            except Exception:
                pass
    return plan


def main():
    plan = build_plan()
    n_exact = sum(1 for _, s, v, a in plan if v == 'exact' and not a)
    n_anim = sum(1 for _, s, v, a in plan if a)
    n_strip = sum(1 for _, s, v, a in plan if v == 'strip_y' and not a)
    n_fb = sum(1 for _, s, v, a in plan if v == 'fallback')
    print('总贴图: %d | 高清同名: %d | 高清动画取首帧: %d | 去_y: %d | 回退16x: %d'
          % (len(plan), n_exact, n_anim, n_strip, n_fb))
    print('动画取首帧列表：')
    for name, _, _, a in plan:
        if a:
            print('   ', name)
    if n_fb:
        print('回退列表（包里没有，保留16x）：')
        for name, _, v, _ in plan:
            if v == 'fallback':
                print('   ', name)
    if DRY:
        return
    os.makedirs(DST, exist_ok=True)
    done = fb = 0
    for name, src, via, anim in plan:
        if not src:
            shutil.copyfile(os.path.join(MY, name), os.path.join(DST, name))
            fb += 1
        elif anim:
            first_frame(src, os.path.join(DST, name))
            done += 1
        else:
            shutil.copyfile(src, os.path.join(DST, name))
            done += 1
    print('已生成 %d 张高清 + %d 张16x兜底 → %s' % (done, fb, DST))


if __name__ == '__main__':
    main()

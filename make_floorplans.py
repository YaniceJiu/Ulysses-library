# -*- coding: utf-8 -*-
"""生成全部楼层平面图 + 浏览页"""
import json, os
from PIL import Image

os.chdir(r"C:\Users\janic\Downloads\mc_walkthrough")
d = json.load(open('build_data.json', encoding='utf-8'))
blocks = d['blocks']
W, H, D = d['size']

for y in range(H):
    img = Image.new('RGB', (W, D), (245, 245, 245))
    px = img.load()
    for b in blocks:
        if b['y'] == y:
            px[b['x'], b['z']] = (25, 25, 25)
    img = img.resize((W * 2, D * 2), Image.NEAREST)
    img.save('floor_y%02d.png' % y)

parts = []
for y in range(H):
    parts.append('<div class="f"><img src="floor_y%02d.png"><div>第 %d 层 (y=%d)</div></div>' % (y, y + 1, y))
html = (
    '<!DOCTYPE html><html><head><meta charset="utf-8"><title>楼层平面图</title>'
    '<style>body{font-family:system-ui;background:#111;color:#eee;margin:20px}'
    'img{image-rendering:pixelated;border:1px solid #333;width:300px}'
    '.f{display:inline-block;margin:8px;text-align:center}div{font-size:12px;color:#999}</style>'
    '</head><body><h2>建筑楼层平面图（白=可走空处，黑=方块）</h2>' + ''.join(parts) + '</body></html>'
)
open('floorplans.html', 'w', encoding='utf-8').write(html)
print('已生成', H, '层平面图 + floorplans.html')

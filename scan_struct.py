# -*- coding: utf-8 -*-
"""打印所有结构方块的完整 NBT 数据"""
import sys, json
sys.path.insert(0, r"C:\Users\janic\Downloads\mc_walkthrough")
from mc_extract import chunk_iter

REGION = r"C:\Users\janic\AppData\Roaming\.minecraft\saves\Arnis World 2\dimensions\minecraft\overworld\region"

for root in chunk_iter(REGION):
    for be in root.get('block_entities', []) or []:
        if be.get('id') == 'minecraft:structure_block':
            print("=== structure_block @ chunk", root.get('xPos'), root.get('zPos'))
            print(json.dumps(be, ensure_ascii=False, indent=1, default=str))

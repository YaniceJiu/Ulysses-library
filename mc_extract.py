# -*- coding: utf-8 -*-
"""手写 Minecraft .mca 区域文件 + NBT 解析器（不依赖第三方库）"""
import os, sys, glob, struct, zlib, gzip, io, math

# ---------- NBT 读取 ----------
TAG_END = 0; TAG_BYTE = 1; TAG_SHORT = 2; TAG_INT = 3; TAG_LONG = 4
TAG_FLOAT = 5; TAG_DOUBLE = 6; TAG_BYTE_ARR = 7; TAG_STRING = 8
TAG_LIST = 9; TAG_COMPOUND = 10; TAG_INT_ARR = 11; TAG_LONG_ARR = 12

class NBT:
    def __init__(self, tag_type, name=None, value=None):
        self.type = tag_type
        self.name = name
        self.value = value

def read_nbt(data):
    buf = io.BytesIO(data)
    def _read_u8(): return buf.read(1)[0]
    def _read_i8(): return struct.unpack('>b', buf.read(1))[0]
    def _read_u16(): return struct.unpack('>H', buf.read(2))[0]
    def _read_i16(): return struct.unpack('>h', buf.read(2))[0]
    def _read_i32(): return struct.unpack('>i', buf.read(4))[0]
    def _read_i64(): return struct.unpack('>q', buf.read(8))[0]
    def _read_f32(): return struct.unpack('>f', buf.read(4))[0]
    def _read_f64(): return struct.unpack('>d', buf.read(8))[0]
    def _read_str():
        n = _read_u16()
        return buf.read(n).decode('utf-8', errors='replace')
    def _read_named():
        t = _read_u8()
        name = _read_str() if t != TAG_END else None
        return t, name
    def _read_payload(t):
        if t == TAG_END: return None
        if t == TAG_BYTE: return _read_i8()
        if t == TAG_SHORT: return _read_i16()
        if t == TAG_INT: return _read_i32()
        if t == TAG_LONG: return _read_i64()
        if t == TAG_FLOAT: return _read_f32()
        if t == TAG_DOUBLE: return _read_f64()
        if t == TAG_BYTE_ARR:
            n = _read_i32(); return list(buf.read(n))
        if t == TAG_STRING: return _read_str()
        if t == TAG_LIST:
            et = _read_u8(); n = _read_i32()
            return [_read_payload(et) for _ in range(n)]
        if t == TAG_COMPOUND:
            d = {}
            while True:
                tt, name = _read_named()
                if tt == TAG_END: break
                d[name] = _read_payload(tt)
            return d
        if t == TAG_INT_ARR:
            n = _read_i32(); return [_read_i32() for _ in range(n)]
        if t == TAG_LONG_ARR:
            n = _read_i32(); return [_read_i64() for _ in range(n)]
        raise ValueError('unknown tag ' + str(t))
    t = _read_u8()
    if t != TAG_COMPOUND: raise ValueError('root not compound')
    name = _read_str()
    value = _read_payload(TAG_COMPOUND)
    return value

# ---------- 区块 block_states 解包 ----------
def unpack_block_states(palette, long_array):
    """返回 4096 个 block state 索引（按 x + z*16 + y*256，y 0-15 相对于 section）"""
    if long_array is None or len(long_array) == 0:
        return [0] * 4096
    bits = max(4, math.ceil(math.log2(max(1, len(palette)))))
    # 每个 long 按 little-endian 解释，组成连续位流
    longs = [v & 0xFFFFFFFFFFFFFFFF for v in long_array]
    result = []
    mask = (1 << bits) - 1
    for i in range(4096):
        start = i * bits
        li = start // 64
        off = start % 64
        v = longs[li] >> off
        if off + bits > 64:
            v |= longs[li + 1] << (64 - off)
        result.append(v & mask)
    return result

def chunk_iter(region_dir):
    """遍历所有区域的每个区块，yield (xPos, zPos, root_nbt_dict)"""
    for mca in sorted(glob.glob(os.path.join(region_dir, '*.mca'))):
        with open(mca, 'rb') as f:
            hdr = f.read(8192)
        for i in range(1024):
            loc = struct.unpack('>I', hdr[i*4:i*4+4])[0]
            offset = (loc >> 8) & 0xFFFFFF
            count = loc & 0xFF
            if offset == 0 or count == 0:
                continue
            with open(mca, 'rb') as f:
                f.seek(offset * 4096)
                ln = struct.unpack('>I', f.read(4))[0]
                comp = f.read(1)[0]
                raw = f.read(ln - 1)
            try:
                if comp == 1: data = gzip.decompress(raw)
                elif comp == 2: data = zlib.decompress(raw)
                elif comp == 3: data = raw
                else: continue
            except Exception:
                continue
            try:
                root = read_nbt(data)
            except Exception:
                continue
            yield root

def section_blocks(section):
    """返回 (section_y, [4096个 (block_id, block_state_dict) 或 None 表示空气])"""
    sy = section.get('Y')
    bs = section.get('block_states')
    if bs is None:
        return sy, None
    palette = bs.get('palette', [])
    data = bs.get('data', None)
    idx = unpack_block_states(palette, data)
    blocks = []
    for i in idx:
        p = palette[i] if i < len(palette) else {}
        name = p.get('Name', 'minecraft:air')
        blocks.append((name, p.get('Properties', {})))
    return sy, blocks

if __name__ == '__main__':
    REGION = r"C:\Users\janic\AppData\Roaming\.minecraft\saves\Arnis World 2\dimensions\minecraft\overworld\region"
    total_blocks = 0
    non_air = 0
    minx = miny = minz = 10**9
    maxx = maxy = maxz = -10**9
    struct_blocks = []
    from collections import Counter
    top = Counter()
    for root in chunk_iter(REGION):
        cx, cz = root.get('xPos'), root.get('zPos')
        # 方块实体（含结构方块）
        for be in root.get('block_entities', []) or []:
            beid = be.get('id')
            p = be.get('pos') or be.get('Pos')
            if beid == 'minecraft:structure_block' and isinstance(p, (list, tuple)):
                struct_blocks.append((tuple(int(v) for v in p), be))
        # 方块
        for sec in root.get('sections', []) or []:
            sy, blocks = section_blocks(sec)
            if blocks is None: continue
            for i, (name, props) in enumerate(blocks):
                if name == 'minecraft:air': continue
                x = i & 15; z = (i >> 4) & 15; y = (i >> 8) & 15
                wx = cx*16 + x; wz = cz*16 + z; wy = sy*16 + y
                non_air += 1
                minx = min(minx, wx); maxx = max(maxx, wx)
                miny = min(miny, wy); maxy = max(maxy, wy)
                minz = min(minz, wz); maxz = max(maxz, wz)
                base = name.replace('minecraft:', '')
                top[base] += 1

    print("非空气方块总数:", non_air)
    print("世界方块包围盒: x[%d..%d] y[%d..%d] z[%d..%d]" % (minx, maxx, miny, maxy, minz, maxz))
    print("\n结构方块:")
    for p, be in struct_blocks:
        print("  @", p, " mode=", be.get('mode'), " size=", (be.get('sizeX'), be.get('sizeY'), be.get('sizeZ')), " name=", be.get('name'))
    if not struct_blocks:
        print("  (无)")
    print("\n最常见的方块 Top 15:")
    for name, c in top.most_common(15):
        print("  %-30s %d" % (name, c))

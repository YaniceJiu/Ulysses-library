/* 生成 three.js 场景：根据 build_data.json + atlas 构建建筑网格 */
'use strict';

function buildMinecraftScene(scene, data, atlas) {
  const { blocks, size } = data;
  const { uvs, blocks: texSets, missing_textures } = atlas;

  // 占位纹理（缺失的用灰色像素）
  let fallbackUV = uvs['stone'] || [0,0,0.02,0.02];

  // 建立"不透明实心方块"占用表，用于面剔除
  const W = size[0], H = size[1], D = size[2];
  const solid = new Uint8Array(W * H * D);
  const idx = (x,y,z) => (z * H + y) * W + x;
  for (const b of blocks) {
    if (!MCBuilder.NOT_FULL.has(b.id)) solid[idx(b.x, b.y, b.z)] = 1;
  }

  // 面剔除：检查相邻格是否为不透明实心
  const isSolid = (x,y,z) => x>=0 && y>=0 && z>=0 && x<W && y<H && z<D && solid[idx(x,y,z)]===1;

  // 几何体数据
  const opaque = { pos:[], uv:[], col:[], nor:[] };
  const trans  = { pos:[], uv:[], col:[], nor:[] };

  const F = MCBuilder.FACE_NORMALS;
  const FB = MCBuilder.FACE_BRIGHT;

  // 每个面的 4 个角点（相对 box，从外看逆时针）
  const FACES = {
    px:{ d:[1,0,0], corners:[[1,0,1],[1,1,1],[1,1,0],[1,0,0]], uv:[[1,1],[1,0],[0,0],[0,1]] },
    nx:{ d:[-1,0,0], corners:[[0,0,0],[0,1,0],[0,1,1],[0,0,1]], uv:[[0,1],[0,0],[1,0],[1,1]] },
    py:{ d:[0,1,0], corners:[[0,1,1],[1,1,1],[1,1,0],[0,1,0]], uv:[[0,0],[1,0],[1,1],[0,1]] },
    ny:{ d:[0,-1,0], corners:[[0,0,0],[1,0,0],[1,0,1],[0,0,1]], uv:[[0,1],[1,1],[1,0],[0,0]] },
    pz:{ d:[0,0,1], corners:[[0,0,1],[1,0,1],[1,1,1],[0,1,1]], uv:[[0,1],[1,1],[1,0],[0,0]] },
    nz:{ d:[0,0,-1], corners:[[1,0,0],[0,0,0],[0,1,0],[1,1,0]], uv:[[1,1],[0,1],[0,0],[1,0]] },
  };

  function resolveUV(bid, role, box) {
    let texName;
    const set = texSets[bid];
    if (set) texName = set[role] || set['all'];
    if (!texName) texName = bid;
    let r = uvs[texName];
    if (!r) r = fallbackUV;
    return r;
  }

  function pushFace(buff, bx, by, bz, min, max, faceKey, role, bid, box, dir) {
    const f = FACES[faceKey];
    const u = resolveUV(bid, role, box);
    // 位置
    for (let k=0;k<4;k++){
      const c = f.corners[k];
      buff.pos.push(bx + min[0] + (max[0]-min[0])*c[0]);
      buff.pos.push(by + min[1] + (max[1]-min[1])*c[1]);
      buff.pos.push(bz + min[2] + (max[2]-min[2])*c[2]);
      buff.nor.push(dir[0], dir[1], dir[2]);
    }
    // UV
    for (let k=0;k<4;k++){
      const uv = f.uv[k];
      buff.uv.push(u[0] + (u[2]-u[0])*uv[0], u[1] + (u[3]-u[1])*uv[1]);
    }
    // 颜色（逐面亮度）
    const bright = (box.emissive ? 1.25 : FB[['px','nx','py','ny','pz','nz'].indexOf(faceKey)]);
    let r=1,g=1,b=1;
    if (box.color) { r=box.color[0]/255; g=box.color[1]/255; b=box.color[2]/255; }
    for (let k=0;k<4;k++){
      buff.col.push(r*bright, g*bright, b*bright);
    }
    // 两个三角形（逆时针）
    const base = buff.pos.length/3 - 4;
    pushTri(buff, base);
  }

  function pushTri(buff, base){
    // 追加索引三角形
    if (!buff.ib) buff.ib = [];
    buff.ib.push(base, base+1, base+2, base, base+2, base+3);
  }

  for (const b of blocks) {
    const s = MCBuilder.shape(b.id, b.p, null);
    for (const box of s.boxes) {
      const min = box.min, max = box.max;
      const faceKeys = ['px','nx','py','ny','pz','nz'];
      const dirs = {px:[1,0,0],nx:[-1,0,0],py:[0,1,0],ny:[0,-1,0],pz:[0,0,1],nz:[0,0,-1]};
      for (const fk of faceKeys) {
        // 面剔除：若该面在单元格边界且邻居是实心方块
        const d = dirs[fk];
        let hidden = false;
        if (s.full) {
          if (fk==='px' && max[0]===1 && isSolid(b.x+1,b.y,b.z)) hidden=true;
          if (fk==='nx' && min[0]===0 && isSolid(b.x-1,b.y,b.z)) hidden=true;
          if (fk==='py' && max[1]===1 && isSolid(b.x,b.y+1,b.z)) hidden=true;
          if (fk==='ny' && min[1]===0 && isSolid(b.x,b.y-1,b.z)) hidden=true;
          if (fk==='pz' && max[2]===1 && isSolid(b.x,b.y,b.z+1)) hidden=true;
          if (fk==='nz' && min[2]===0 && isSolid(b.x,b.y,b.z-1)) hidden=true;
        }
        if (hidden) continue;
        const role = box.f[fk] || 'side';
        const buff = MCBuilder.TRANSPARENT.has(b.id) ? trans : opaque;
        pushFace(buff, b.x, b.y, b.z, min, max, fk, role, b.id, box, d);
      }
    }
  }

  // 组装几何体
  function makeGeom(buff){
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(buff.pos, 3));
    geom.setAttribute('normal', new THREE.Float32BufferAttribute(buff.nor, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(buff.uv, 2));
    geom.setAttribute('color', new THREE.Float32BufferAttribute(buff.col, 3));
    geom.setIndex(buff.ib || []);
    geom.computeBoundingSphere();
    return geom;
  }

  const atlasTex = new THREE.TextureLoader().load('atlas.png');
  atlasTex.magFilter = THREE.NearestFilter;
  atlasTex.minFilter = THREE.NearestFilter;
  atlasTex.colorSpace = THREE.SRGBColorSpace;

  const opaqueMesh = new THREE.Mesh(makeGeom(opaque),
    new THREE.MeshBasicMaterial({ map: atlasTex, vertexColors: true }));
  scene.add(opaqueMesh);

  if (trans.pos.length) {
    // 透明方块（玻璃/玻璃板/铁栏）：正确深度测试，不叠加成网格
    const transMesh = new THREE.Mesh(makeGeom(trans),
      new THREE.MeshBasicMaterial({ map: atlasTex, vertexColors: true, transparent: true,
                                    alphaTest: 0.5, side: THREE.DoubleSide, depthWrite: true }));
    scene.add(transMesh);
  }

  return { opaqueMesh, size };
}

window.MCSceneBuilder = buildMinecraftScene;

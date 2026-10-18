/** 建筑：加载 Mineways 导出的 OBJ + MTL，提供碰撞网格与幽灵模式 */
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { mergeBufferGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// 建筑可走动的地面层（OBJ 坐标）。Mineways 导出已把 -64 归零为 0，
// 本建筑的地面层在 OBJ y≈2（外部大门 MC y=-62）。对齐到 y=0 让玩家能走进去。
const FLOOR_LEVEL = 2;

export class Building {
  constructor(scene) {
    this.scene = scene;
    this.group = null;
    this.collider = null;        // 合并后的碰撞网格
    this.offset = new THREE.Vector3(0, 0, 0);
    this.original = [];          // 记录材质原始色/透明度，供幽灵模式还原
    this.loaded = false;
    this.ghost = false;
  }

  load(onDone) {
    new MTLLoader().load('/export_final.mtl', (materials) => {
      materials.preload();
      // 纹理清晰化：高清贴图(tex_hd)用线性过滤平滑显示；普通 16x 用最近邻保持像素风。
      // 注意：图片是异步加载的，刚加载 MTL 时 tex.image.src 还没值，无法判断是不是高清，
      // 所以先设一次、等图片加载完再重设（此时才能读到 tex_hd 路径）。
      // 只在图片已加载(complete)时设 needsUpdate，避免“no image data”警告。
      const applyFilters = () => {
        for (const name in materials.materials) {
          const mat = materials.materials[name];
          for (const key of ['map', 'specularMap', 'bumpMap']) {
            const tex = mat[key];
            if (!tex || !tex.isTexture) continue;
            const img = tex.image;
            // 高清贴图(64x)用线性过滤平滑显示；16x 兜底贴图保持最近邻像素风
            const w = img ? (img.naturalWidth || img.width || 0) : 0;
            const hd = w >= 64;
            tex.magFilter = hd ? THREE.LinearFilter : THREE.NearestFilter;
            tex.minFilter = hd ? THREE.LinearMipmapLinearFilter : THREE.NearestMipmapLinearFilter;
            tex.generateMipmaps = true;
            if (img && img.complete) tex.needsUpdate = true;
          }
        }
      };
      applyFilters();
      // 等贴图图片全部加载完后（加载管理器 onLoad）再重设过滤——此时才能读到真实尺寸(64x/16x)
      THREE.DefaultLoadingManager.onLoad = applyFilters;
      // 多次兜底，覆盖慢加载
      setTimeout(applyFilters, 400);
      setTimeout(applyFilters, 1500);
      setTimeout(applyFilters, 3500);
      const objLoader = new OBJLoader();
      objLoader.setMaterials(materials);
      objLoader.load('/export_final.obj', (obj) => {
        // 材质对象已挂到 OBJ 上，此刻再设一次过滤
        applyFilters();
        // Mineways 导出坐标已归零(y 0..20、已居中)，但不同导出可能不同：
        // 这里自动对齐——可走动地面层(FLOOR_LEVEL)贴地(y=0)、x/z 居中到原点
        const box = new THREE.Box3().setFromObject(obj);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        this.offset.set(-center.x, -FLOOR_LEVEL, -center.z);
        obj.position.copy(this.offset);

        this.group = obj;
        this.scene.add(obj);
        this._buildCollider(obj);
        // 记录材质状态
        obj.traverse((m) => {
          if (m.isMesh && m.material) {
            const mats = Array.isArray(m.material) ? m.material : [m.material];
            for (const mt of mats) {
              this.original.push({
                mat: mt,
                color: (mt.color || new THREE.Color(1, 1, 1)).clone(),
                emissive: mt.emissive ? mt.emissive.clone() : null,
                opacity: mt.opacity,
                transparent: mt.transparent,
                map: mt.map,
                specularMap: mt.specularMap,
              });
            }
          }
        });
        this.loaded = true;
        if (this.ghost) this.toggleGhost(true);
        if (onDone) onDone();
      });
    });
  }

  _buildCollider(obj) {
    const geoms = [];
    obj.traverse((m) => {
      if (m.isMesh && m.geometry) geoms.push(m.geometry);
    });
    if (!geoms.length) return;
    let merged = null;
    try { merged = mergeBufferGeometries(geoms, false); } catch (e) { merged = null; }
    if (merged) {
      this.collider = new THREE.Mesh(merged, new THREE.MeshBasicMaterial({ visible: false }));
      this.collider.position.copy(this.offset);
      this.scene.add(this.collider);
    }
  }

  // 幽灵模式：所有方块去贴图/去颜色/去发光 → 统一半透明灰
  toggleGhost(on) {
    this.ghost = on;
    if (!this.group) return;
    this.group.traverse((m) => {
      if (!m.isMesh || !m.material) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mt of mats) {
        const orig = this.original.find((o) => o.mat === mt);
        if (on) {
          mt.transparent = true;
          mt.opacity = 0.35;          // 半透明：能看清建筑形状
          mt.depthWrite = false;
          if (mt.color) mt.color.set(0x9aa0a6);   // 统一灰
          if (mt.emissive) mt.emissive.set(0x000000); // 熄发光
          mt.map = null;              // ★ 摘掉贴图 → 不再有纹理花纹
          if (mt.specularMap) mt.specularMap = null;
          mt.needsUpdate = true;
        } else if (orig) {
          mt.transparent = orig.transparent;
          mt.opacity = orig.opacity;
          mt.depthWrite = true;
          if (mt.color) mt.color.copy(orig.color);
          if (mt.emissive && orig.emissive) mt.emissive.copy(orig.emissive);
          mt.map = orig.map;          // ★ 恢复贴图
          mt.specularMap = orig.specularMap || null;
          mt.needsUpdate = true;
        }
      }
    });
  }
}

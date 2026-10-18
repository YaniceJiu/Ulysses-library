# 尤利西斯第九章 · Minecraft 图书馆图钉展厅

中文多人 3D 图书馆：玩家注册用户名后漫游、放置最多 5 枚图钉、移动或删除自己的图钉，并用手机后置摄像头为图钉拍照。管理员 `JaniceJiu` 可实时查看各楼层图钉与照片，并控制玩家间可见性和全局幽灵模式。

## 功能与权限

- 玩家只需用户名注册/登录；用户名经 Unicode 规范化后大小写不敏感且唯一。
- 玩家可在楼面放置最多 5 枚图钉，移动、删除自己的图钉，并用相机拍照。
- 手机可按住左下方向键移动、同时按两个方向斜走，在画面空白处滑动转向，并用右下“跳”键跳跃。
- 玩家默认只收到自己的图钉及照片；管理员打开分享开关后，玩家才会看到他人的图钉和照片。
- 管理员 `JaniceJiu` 使用服务端独立密码登录；可以在整体平面图和实时记录表中查看玩家、放置时间、楼层与照片，并删除图钉。
- 管理员可以只为自己开启幽灵视图，也可独立开启全员同步的幽灵模式。
- 账号、图钉、开关和相片都写在 `DATA_DIR`；照片只经登录后 API 提供，不作为公开静态文件。
- 默认关闭旧的 AI 生成 3D 物件 API；`ENABLE_LEGACY_FEATURES=true` 仅供旧功能兼容测试，不应在公开部署中打开。

> **玩家账号安全提示：**按当前决定，玩家身份只由用户名确定，不使用密码或邮箱验证。任何人都能冒充已注册玩家并管理其图钉；这不适合存放私密照片。管理员账号仍由密码保护。公开使用前建议升级为用户名+密码或 Passkey。

## 本地启动

需要 Node.js 22 或 24。

1. 复制 `.env.example` 为 `.env`，设置独立的 `ADMIN_PASSWORD`（至少 16 个字符）与随机 `AUTH_SECRET`（至少 32 个字符）。
2. 安装依赖并构建前端：

   ```bash
   npm ci
   npm run build
   ```

3. 启动：

   ```bash
   npm start
   ```

4. 打开 `http://localhost:8900/`。管理员 Board：`http://localhost:8900/admin/`。

本地照片相机通常需要 `localhost`；手机通过 Wi-Fi 访问电脑时应使用 HTTPS，否则浏览器可能不开放摄像头。

## Render 部署（推荐）

仓库带有 `render.yaml`：单个 Node Web Service 同时运行 Vue 静态站点、Express、Socket.IO 和图钉 API，并将数据库 JSON 与照片保存到 `/var/data` 持久磁盘。不要使用 Render Free 服务来保存正式玩家数据：免费服务会休眠，而且文件系统是临时的。

1. 将本项目单独放入 GitHub 仓库并推送；**不要提交 `.env`、`data/`、上传照片或密钥**。
2. 注册 Render，在 Dashboard 选择 **New → Blueprint**，关联该 GitHub 仓库并应用 `render.yaml`。
3. 第一次配置时，为 `ADMIN_PASSWORD` 填入至少 16 位的强密码。`AUTH_SECRET` 由 Blueprint 生成；不要把密码发到聊天、提交到 GitHub 或写入客户端代码。
4. 确认 Web Service 使用付费 Starter 计算方案和至少 1 GB Persistent Disk。部署后检查 `/api/health` 返回 `{"ok":true,...}`。
5. 用 Render 提供的 HTTPS 地址分别测试玩家注册、相机权限、管理员 Board 和实时开关。

Render 支持由 GitHub 推送触发构建，也允许在 Dashboard 绑定自有域名。Persistent Disk 只由挂载目录 `/var/data` 保留；不可将 `DATA_DIR` 指向仓库目录。价格会因计算档、磁盘容量和服务商价格更新而变化，创建前请核对 Render 的当前费用页面。

## 数据和备份

单个服务实例以原子 JSON 文件保存账号、图钉与设置；照片存在 `DATA_DIR/pin-photos/`。部署目前刻意限制为单实例，避免多个进程/实例并发写同一文件。定期备份 Render Disk；若预计多实例扩展或更高可用性，再迁移到托管数据库和对象存储。

## 测试

```bash
npm test
npm run build
```

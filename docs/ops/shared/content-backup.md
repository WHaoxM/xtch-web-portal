# Content + MinIO backup import（多库隔离）

## 三套隔离（同一台 MinIO / Postgres 主机）

| 用途 | Postgres | MinIO 桶 | `APP_ENV` / key 前缀 | Env 文件 |
|---|---|---|---|---|
| 日常本地 | `xtch` | `xtch-public` | `dev` → `dev/…` | `env/local/.env` |
| 隧道测试台 | `xtch_tunnel` | `xtch-tunnel` | 通常 `dev` | `env/tunnel/.env` |
| Win11 家宽生产 | `xtch_prod` | `xtch-prod` | `prod` → `prod/…` | `env/win11-home/.env` |
| 云 VPS 生产 | `xtch_prod` | `xtch-prod` | `prod` → `prod/…` | `env/cloud-vps/.env`（另一台机器上的同名隔离） |

不要把生产导入写回日常 `xtch` / `xtch-public`。同一时刻只有一个公网 target 应接 DNS。

## 备份包结构

```text
<backup>/
  manifest.json
  media-map.json
  IMPORT.md
  tables/*.json
  minio/objects/<env>/<type>/…   # 对象文件（无密钥）
  minio/OBJECTS.md
```

`manifest.json` 记录导出时的 `appEnv` / `keyPrefix` / `bucket` / `publicBaseUrl`。

## 首次准备（已有 Docker volume）

新 volume：`docker/postgres/init-extra-db.sql` 与 `minio-init` 会创建 `xtch_prod` 与桶 `xtch-prod`。

已有 volume 时一次性执行：

```powershell
docker exec -it xtch-postgres psql -U postgres -c "CREATE DATABASE xtch_prod;"
docker compose up minio-init
```

确认 `env/win11-home/.env` 指向：

- `POSTGRES_URL=…/xtch_prod`
- `S3_BUCKET=xtch-prod`
- `S3_PUBLIC_BASE_URL=…/s3/xtch-prod`（或本机冒烟用的等价 URL）
- `APP_ENV=prod`

## 导入到生产隔离库

在 `app/`：

```powershell
npm run db:migrate:win11-home

npx tsx scripts/import-content-backup.ts `
  --env=win11-home `
  --dir=D:\XTCH_PROJECT\db\xtch-content-minio-backup-2026-07-17\2026-07-17T22-30-35 `
  --rewrite-key-env=prod `
  --upload-objects
```

大包对象上传若 SDK 超时，可改用 `mc mirror`（见备份包 `minio/OBJECTS.md`），库表仍用上面的 import 脚本。

脚本会：

1. 按 `--env` 加载对应 `env/<target>/.env`（覆盖写入 `POSTGRES_URL` / `S3_*`）
2. 把内容表 upsert 进目标库
3. 把媒体 URL / 封面 URL 从备份里的 `dev/` + 旧 base 重写为 `prod/` + 目标 `S3_PUBLIC_BASE_URL`
4. `--upload-objects` 时把 `minio/objects` 下的文件 PUT 到目标桶，key 同步 `dev/` → `prod/`

可选：`--dry-run` 只打印配置不写库；`--public-base-url=` 覆盖 env 里的公开 URL。

## 验证

```powershell
# 目标库有内容（勿查错库）
docker exec -it xtch-postgres psql -U postgres -d xtch_prod -c "select count(*) from routes; select count(*) from media_assets;"

# 目标桶有对象（需 mc alias 指向本机 MinIO）
# mc ls -r --summarize local/xtch-prod/prod/
```

冒烟：`npm run deploy:serve -- --target win11-home`（或 `npm run selfhost`）后 `GET /api/routes` 应返回路线；图片 URL 主机/桶应为 `…/s3/xtch-prod/prod/…`。

## 注意

- 备份包**不含** MinIO 密钥；上传使用目标 env 的 `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY`。
- 日常开发继续用 `xtch` + `xtch-public`；隧道继续用 `xtch_tunnel` + `xtch-tunnel`。
- 若只想导入元数据、稍后用 `mc mirror` 同步对象，去掉 `--upload-objects`，再按 `minio/OBJECTS.md` 自行 mirror（记得改 key 前缀为 `prod/`）。

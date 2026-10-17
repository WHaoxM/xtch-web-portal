# Private IM attachment storage

文数智旅咨询和客服工作台的图片/文件附件使用 `xtch-im-private`，绝不复用 `S3_BUCKET`（当前 `xtch-prod` 是匿名可读的公开素材桶）。浏览器只获得绑定会话/客服权限、5 分钟有效的签名 PUT/GET；对象 key 为随机 UUID，不含访客文件名。提交消息前 API 会核对 S3 HEAD 的实际大小、Content-Type 和文件签名。

## 代码与启动行为

- 迁移 `022_im_private_attachments` 只新增附件元数据表和索引，不触碰已有消息/线索。
- `docker-compose.yml` 的 `minio-init` 在新环境或手动重跑时创建 `xtch-im-private` 并执行 `mc anonymous set none`。已有生产 MinIO 容器不会因应用部署自动重跑初始化服务，因此需按下方步骤一次性开通。
- API 只在配置独立 `IM_MEDIA_S3_BUCKET=xtch-im-private` 后启用附件；若它缺失或意外与 `S3_BUCKET` 相同，API 不会降级到公开桶。
- 浏览器访客页与 `/s3` 存储域跨站，私有桶需要专属 CORS；CORS 是浏览器传输规则，不是访问控制。匿名读取始终必须拒绝，数据授权依靠 API 的访客会话/客服 IM ACL 和签名 URL。
- 生产签名 URL 的浏览器域必须是 MinIO 反向代理域 `https://www.xuntingtravel.com/s3`；生产需明确配置 `S3_BROWSER_ENDPOINT`，不要依赖 `PUBLIC_DOMAIN` 或访客站点请求 Host。不可使用 `https://www.zhilvtravel.com/s3`，因为官网前端没有该对象存储代理路由。

## 生产首次开通（Coordinator/运维在发布窗口执行；本文件本身不会修改生产）

1. 先对当前应用 `.env`、MinIO bucket 策略/CORS 和数据库做备份或留存回滚点；确认 `xtch-prod` 仍为原来的公开桶，不要在其上改匿名策略。
2. 在应用 Compose 根目录执行下面一次性 MinIO 管理命令。它只创建新桶、将匿名策略设为 `none`，并写入专用跨站策略；不会改动三个既有公开桶。请按生产实际 Compose 目录与 `.env` 路径调整 `--env-file` 和 XML 挂载路径，不要把秘密复制到命令行或日志。

   ```sh
   docker run --rm --network host \
     --env-file ./.env \
     -v "$PWD/deploy/cloud-vps/im-private-bucket-cors.xml:/tmp/im-private-bucket-cors.xml:ro" \
     --entrypoint /bin/sh minio/mc:RELEASE.2025-04-16T18-13-26Z -ec '
       mc alias set local http://127.0.0.1:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"
       mc mb --ignore-existing local/xtch-im-private
       mc anonymous set none local/xtch-im-private
       mc cors set local/xtch-im-private /tmp/im-private-bucket-cors.xml
       mc anonymous get local/xtch-im-private
       mc cors get local/xtch-im-private
     '
   ```

   `mc anonymous get` 必须显示无匿名访问；`mc cors get` 必须只含 `https://www.zhilvtravel.com`，方法 PUT/GET/HEAD，允许 `content-type` 与 `if-none-match`。禁止使用 `mc anonymous set download`，也不要给 CORS 写 `*`。

3. 用临时无敏感内容对象验证匿名拒绝，并验证跨站预检。不要只 GET 一个不存在的 key：404 不能证明桶策略正确。

   ```sh
   probe="im-chat/private-policy-probe-$(date +%s).txt"
   printf 'temporary private bucket policy probe\n' >/tmp/im-private-probe.txt
   mc cp /tmp/im-private-probe.txt "local/xtch-im-private/$probe"
   curl -i "https://www.xuntingtravel.com/s3/xtch-im-private/$probe"
   # 必须为 403，不得是 200；验证后立即清理两处探针。
   mc rm "local/xtch-im-private/$probe"
   rm -f /tmp/im-private-probe.txt
   ```

   匿名拒绝验证通过后，执行预检：

   ```sh
   curl -i -X OPTIONS 'https://www.xuntingtravel.com/s3/xtch-im-private/im-chat/cors-probe' \
     -H 'Origin: https://www.zhilvtravel.com' \
     -H 'Access-Control-Request-Method: PUT' \
     -H 'Access-Control-Request-Headers: content-type,if-none-match'
   ```

   预检必须成功且 `Access-Control-Allow-Origin` 精确为 `https://www.zhilvtravel.com`；不能允许任意站点。不要用真实会话内容作为探针。

4. 备份生产 `env/cloud-vps/.env` 后新增 `IM_MEDIA_S3_BUCKET=xtch-im-private` 与 `S3_BROWSER_ENDPOINT=https://www.xuntingtravel.com/s3`（MinIO 反代域必须明确配置；不要依赖可能指向访客官网的 `PUBLIC_DOMAIN`）。勿把私有桶变量改成 `xtch-prod`，勿把任何 `S3_*` 秘密写进 Vite/`VITE_*` 配置。确认部署会先应用新增迁移 022，再发布对应后端/网站产物。
5. 发布后做受控端到端验收：访客 A 上传一张允许图片和一个允许文件，历史刷新后可重新预览/下载；有权客服可看到并打开；访客 B、未登录客服、无会话 ACL 的客服拿不到链接。检查文件大小/MIME 错误会在发消息前拒绝，断网重试不会重复消息，匿名 URL 仍拒绝。

## 故障关闭与回滚

- 若上传或权限验收失败，先回滚前端/后端应用版本，或移除 API 环境变量 `IM_MEDIA_S3_BUCKET` 并重启应用以关闭新入口。不要改 `S3_BUCKET`，也不要把私有桶设为公开来恢复功能。
- 私有桶保持 `anonymous set none`，数据和 migration 022 表保留以便调查/再次上线；本功能迁移是加法，不应 `DROP TABLE` 回滚。附件不再可由应用签名访问时，已签发 URL 最长 5 分钟后失效。
- CORS 回滚前查看并记录原策略；若本桶原先没有专属策略，可用 `mc cors remove local/xtch-im-private` 移除该桶 CORS（会退回 MinIO 全局 CORS 设置），但这只会令浏览器跨站上传不可用，不会开放数据。若先前存在桶级策略，应恢复事前保存的原值，而不是猜测。
- 不删除私有桶或对象；清理孤立 `pending` 上传需另行审核/备份，并仅清理已过期且未关联消息的记录/对象。

## 开发与兼容

所有目标环境的 `.env.example` 都不得指向公开素材桶作为 IM 附件桶。开发者可在本地 MinIO 按相同方式创建隔离私有桶，并为实际本地前端 origin 单独配置 CORS；不要把本地测试源并入生产 XML。

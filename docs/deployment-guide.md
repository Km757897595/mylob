# LobeHub 私有化部署指南

本文档面向运维与管理员，介绍如何基于当前仓库代码构建你自己的 Docker 镜像，并在单台 Linux 服务器上使用 Docker Compose 部署完整的 LobeHub 服务栈。

本文档覆盖以下环节：

- 源码构建
- 镜像打包与发布
- 服务器部署
- 数据库初始化
- 对象存储初始化
- 首次业务初始化
- 更新发布与回滚
- 备份恢复
- 常见问题与安全建议

## 1. 部署方案概览

本文采用的部署方案如下：

- 应用服务：使用当前仓库代码构建自定义 Docker 镜像
- Web 服务：LobeHub
- 数据库：PostgreSQL 17，推荐使用 ParadeDB 镜像
- 缓存：Redis
- 对象存储：RustFS，兼容 S3
- 搜索：SearXNG
- 反向代理：Nginx 或 Caddy

这个方案的优势是：

- 可以部署当前仓库中的定制代码，而不是官方公共镜像
- 继续复用仓库已经存在的生产启动链路
- 启动时自动执行数据库 migration
- 自动初始化 RustFS bucket 和访问策略
- 便于后续通过镜像 tag 做升级和回滚

## 2. 核心初始化机制

仓库中的生产部署链路已经内置了以下自动初始化逻辑：

- 应用容器启动前会自动执行数据库 migration
- `rustfs-init` 会自动创建 `lobe` bucket
- `rustfs-init` 会自动设置 bucket 匿名读策略
- 部分基础数据会在 migration 中自动初始化
- RBAC 基础角色与权限数据已在 migration 中提供

因此，首次部署时通常不需要手工建表，也不需要手工创建对象存储桶。

## 3. 服务器要求

### 最低配置

| 项目           | 最低建议         |
| -------------- | ---------------- |
| CPU            | 4 核             |
| 内存           | 8 GB             |
| 磁盘           | 50 GB SSD        |
| 操作系统       | Ubuntu 22.04 LTS |
| Docker         | 24+              |
| Docker Compose | V2               |

### 推荐配置

| 项目   | 推荐配置                         |
| ------ | -------------------------------- |
| CPU    | 8 核或以上                       |
| 内存   | 16 GB 或以上                     |
| 磁盘   | 100 GB 以上                      |
| 数据盘 | 建议独立挂载数据库和对象存储数据 |

## 4. 域名与端口规划

推荐至少准备以下两个域名：

- `lobe.example.com`：LobeHub Web 访问入口
- `s3.example.com`：RustFS S3 API 公共访问入口

可选域名：

- `s3-ui.example.com`：RustFS 管理台

默认端口如下：

- `3210`：LobeHub
- `9000`：RustFS S3 API
- `9001`：RustFS 管理台
- `5432`：PostgreSQL
- `6379`：Redis

生产环境建议：

- 不要将 PostgreSQL 暴露到公网
- 不要将 Redis 暴露到公网
- RustFS 管理台只保留本机访问或受限访问
- 外网通常只需要开放 `80/443`

## 5. 本地或 CI 构建镜像

推荐做法：

- 不要在生产服务器上执行源码构建
- 在本地开发机或 CI 先完成镜像构建
- 将镜像推送到镜像仓库，或者导出后传到服务器
- 服务器只负责 `docker pull` / `docker load` 和 `docker compose up -d`

这样做的原因：

- 当前仓库是 monorepo，依赖较多，服务器现场构建通常很慢
- 国内网络下，Docker 构建阶段的依赖下载很容易变慢或波动
- 镜像构建与服务部署解耦后，升级、回滚和多机部署都更稳定

### 5.1 构建前提

在本地开发机或 CI 环境准备：

- 当前仓库源码
- Docker Buildx
- 可用的镜像仓库

### 5.2 构建并推送镜像

如果服务器是常见的 `linux/amd64`，推荐使用：

```bash
docker buildx build \
  -f Dockerfile.cn \
  --platform linux/amd64 \
  -t registry.example.com/yourname/mylob:2026-04-02 \
  -t registry.example.com/yourname/mylob:latest \
  --push \
  .
```

说明：

- `latest` 便于简单更新
- 带日期或版本号的 tag 便于回滚
- 中国大陆本地构建推荐使用 `Dockerfile.cn`，它默认使用国内基础镜像、Debian 源、npm/pnpm registry 与常见 native binary 镜像源
- 如果你不在中国大陆，可以去掉 `-f Dockerfile.cn`，改用默认 `Dockerfile`
- 如需替换 npm registry，可以追加 `--build-arg NPM_REGISTRY=https://registry.npmmirror.com`
- 如果构建在 `vite build` 阶段出现 `JavaScript heap out of memory`，优先给 Docker Desktop / OrbStack 分配更多内存；也可以追加 `--build-arg BUILD_NODE_OPTIONS=--max-old-space-size=12288`

补充说明：

- Dockerfile 中的缓存优化更偏向 “后续重复构建提速”
- `Dockerfile.cn` 更偏向 “首次在国内本地构建提速”，但 Next.js/ Vite 编译本身仍会占用较长时间
- 如果你只是要尽快上线，优先选择 “本地或 CI 构建，再推送到服务器”

### 5.3 没有镜像仓库时的替代方案

如果你暂时没有私有镜像仓库，可以本地构建并导出：

```bash
docker build -f Dockerfile.cn -t mylob:2026-04-02 .
docker save mylob:2026-04-02 | gzip > mylob-2026-04-02.tar.gz
```

传到服务器后导入：

```bash
gunzip -c mylob-2026-04-02.tar.gz | docker load
```

## 6. 服务器部署目录

在服务器创建部署目录：

```bash
sudo mkdir -p /opt/mylob
sudo chown -R $USER:$USER /opt/mylob
cd /opt/mylob
```

推荐目录结构：

```text
/opt/mylob
├── docker-compose.yml
├── .env
├── bucket.config.json
├── searxng-settings.yml
└── data/
```

从仓库复制以下文件：

- `docker-compose/deploy/docker-compose.yml`
- `docker-compose/deploy/bucket.config.json`
- `docker-compose/deploy/searxng-settings.yml`

说明：

- 仓库里的 `docker-compose/deploy/docker-compose.yml` 已支持通过 `LOBE_IMAGE` 指定自定义镜像
- 你可以直接复用它，也可以按本文示例自行裁剪

## 7. Docker Compose 配置

创建 `/opt/mylob/docker-compose.yml`：

```yaml
name: mylob

services:
  lobe:
    image: registry.example.com/yourname/mylob:latest
    container_name: mylob
    ports:
      - '${LOBE_PORT}:3210'
    depends_on:
      postgresql:
        condition: service_healthy
      redis:
        condition: service_healthy
      rustfs:
        condition: service_healthy
      rustfs-init:
        condition: service_completed_successfully
    environment:
      - 'KEY_VAULTS_SECRET=${KEY_VAULTS_SECRET}'
      - 'AUTH_SECRET=${AUTH_SECRET}'
      - 'DATABASE_URL=postgresql://postgres:${POSTGRES_PASSWORD}@postgresql:5432/${LOBE_DB_NAME}'
      - 'S3_ENDPOINT=${S3_ENDPOINT}'
      - 'S3_BUCKET=${RUSTFS_LOBE_BUCKET}'
      - 'S3_ENABLE_PATH_STYLE=1'
      - 'S3_ACCESS_KEY=${RUSTFS_ACCESS_KEY}'
      - 'S3_ACCESS_KEY_ID=${RUSTFS_ACCESS_KEY}'
      - 'S3_SECRET_ACCESS_KEY=${RUSTFS_SECRET_KEY}'
      - 'LLM_VISION_IMAGE_USE_BASE64=1'
      - 'S3_SET_ACL=0'
      - 'SEARXNG_URL=http://searxng:8080'
      - 'REDIS_URL=redis://redis:6379'
      - 'REDIS_PREFIX=lobechat'
      - 'REDIS_TLS=0'
    env_file:
      - .env
    restart: always
    networks:
      - lobe-network

  postgresql:
    image: paradedb/paradedb:latest-pg17
    container_name: mylob-postgres
    ports:
      - '127.0.0.1:5432:5432'
    volumes:
      - './data:/var/lib/postgresql/data'
    environment:
      - 'POSTGRES_DB=${LOBE_DB_NAME}'
      - 'POSTGRES_PASSWORD=${POSTGRES_PASSWORD}'
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres']
      interval: 5s
      timeout: 5s
      retries: 5
    restart: always
    networks:
      - lobe-network

  redis:
    image: redis:7-alpine
    container_name: mylob-redis
    command: redis-server --save 60 1000 --appendonly yes
    volumes:
      - 'redis_data:/data'
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 5s
      timeout: 3s
      retries: 5
    restart: always
    networks:
      - lobe-network

  rustfs:
    image: rustfs/rustfs:latest
    container_name: mylob-rustfs
    ports:
      - '${RUSTFS_PORT}:9000'
      - '127.0.0.1:${RUSTFS_ADMIN_PORT}:9001'
    environment:
      - RUSTFS_CONSOLE_ENABLE=true
      - RUSTFS_ACCESS_KEY=${RUSTFS_ACCESS_KEY}
      - RUSTFS_SECRET_KEY=${RUSTFS_SECRET_KEY}
    volumes:
      - 'rustfs-data:/data'
    healthcheck:
      test: ['CMD-SHELL', 'wget -qO- http://localhost:9000/health >/dev/null 2>&1 || exit 1']
      interval: 5s
      timeout: 3s
      retries: 30
    command:
      ['--access-key', '${RUSTFS_ACCESS_KEY}', '--secret-key', '${RUSTFS_SECRET_KEY}', '/data']
    restart: always
    networks:
      - lobe-network

  rustfs-init:
    image: minio/mc:latest
    container_name: mylob-rustfs-init
    depends_on:
      rustfs:
        condition: service_healthy
    volumes:
      - ./bucket.config.json:/bucket.config.json:ro
    entrypoint: /bin/sh
    command: >-
      -c '
      set -eux;
      mc alias set rustfs "http://rustfs:9000" "${RUSTFS_ACCESS_KEY}" "${RUSTFS_SECRET_KEY}";
      mc mb "rustfs/lobe" --ignore-existing;
      mc anonymous set-json "/bucket.config.json" "rustfs/lobe";
      '
    restart: 'no'
    networks:
      - lobe-network

  searxng:
    image: searxng/searxng
    container_name: mylob-searxng
    volumes:
      - './searxng-settings.yml:/etc/searxng/settings.yml'
    environment:
      - 'SEARXNG_SETTINGS_FILE=/etc/searxng/settings.yml'
    env_file:
      - .env
    restart: always
    networks:
      - lobe-network

networks:
  lobe-network:
    driver: bridge

volumes:
  redis_data:
    driver: local
  rustfs-data:
    driver: local
```

### 配置说明

- PostgreSQL 只绑定到 `127.0.0.1`
  - 这样可以在服务器本机执行管理脚本
  - 同时避免对公网暴露数据库
- Redis 不对外暴露
- RustFS API 对外暴露，供浏览器访问上传文件
- RustFS 管理台只绑定本机，按需通过 SSH 隧道或反向代理访问

## 8. 环境变量配置

如果你直接复用仓库中的 `docker-compose/deploy/docker-compose.yml`，建议在 `/opt/mylob/.env` 中额外增加：

```env
LOBE_IMAGE=registry.example.com/yourname/mylob:latest
```

如果你走的是离线导入镜像方案，也可以写成：

```env
LOBE_IMAGE=mylob:2026-04-02
```

创建 `/opt/mylob/.env`：

```env
# ===========================
# 基础配置
# ===========================
LOBE_PORT=3210
APP_URL=https://lobe.example.com
INTERNAL_APP_URL=http://lobe:3210

# ===========================
# 密钥配置
# 上线后不要随意修改
# ===========================
KEY_VAULTS_SECRET=REPLACE_WITH_OPENSSL_BASE64_32
AUTH_SECRET=REPLACE_WITH_OPENSSL_BASE64_32
JWKS_KEY={"keys":[REPLACE_WITH_REAL_JWKS_JSON]}

# ===========================
# PostgreSQL
# ===========================
LOBE_DB_NAME=lobechat
POSTGRES_PASSWORD=REPLACE_WITH_STRONG_PASSWORD

# ===========================
# RustFS / S3
# S3_ENDPOINT 必须是浏览器可访问地址
# ===========================
S3_ENDPOINT=https://s3.example.com
RUSTFS_PORT=9000
RUSTFS_ADMIN_PORT=9001
RUSTFS_ACCESS_KEY=admin
RUSTFS_SECRET_KEY=REPLACE_WITH_STRONG_PASSWORD
RUSTFS_LOBE_BUCKET=lobe

# ===========================
# 登录控制，可选
# ===========================
# AUTH_ALLOWED_EMAILS=your-company.com,admin@example.com
# AUTH_DISABLE_EMAIL_PASSWORD=1
# AUTH_SSO_PROVIDERS=google,github

# ===========================
# 邮件服务，可选
# ===========================
# AUTH_EMAIL_VERIFICATION=1
# EMAIL_SERVICE_PROVIDER=smtp
# SMTP_HOST=smtp.example.com
# SMTP_PORT=465
# SMTP_SECURE=true
# SMTP_USER=noreply@example.com
# SMTP_PASS=REPLACE_ME
# SMTP_FROM=noreply@example.com

# ===========================
# 至少配置一个模型服务商
# ===========================
OPENAI_API_KEY=sk-xxxx
# DEEPSEEK_API_KEY=xxxx
# GOOGLE_API_KEY=xxxx
# QWEN_API_KEY=sk-xxxx

# ===========================
# 可选功能
# ===========================
FEATURE_FLAGS=+ai_image,+speech_to_text,+knowledge_base,-cloud_promotion,-check_updates
```

## 9. 生成密钥

### 9.1 生成 `KEY_VAULTS_SECRET`

```bash
openssl rand -base64 32
```

### 9.2 生成 `AUTH_SECRET`

```bash
openssl rand -base64 32
```

### 9.3 生成 `JWKS_KEY`

在源码仓库目录执行：

```bash
node scripts/generate-oidc-jwk.mjs
```

将输出的单行 JSON 直接填入：

```env
JWKS_KEY=这里替换成完整 JSON
```

### 9.4 注意事项

- `KEY_VAULTS_SECRET` 用于加密敏感数据
- `AUTH_SECRET` 用于会话加密
- `JWKS_KEY` 用于 JWT、OIDC 和内部服务认证
- 这几个值上线后不要轻易修改

## 10. 反向代理配置

### 10.1 Nginx 示例

LobeHub Web：

```nginx
server {
    listen 80;
    server_name lobe.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name lobe.example.com;

    ssl_certificate /etc/letsencrypt/live/lobe.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/lobe.example.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3210;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

RustFS S3 API：

```nginx
server {
    listen 80;
    server_name s3.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name s3.example.com;

    ssl_certificate /etc/letsencrypt/live/s3.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/s3.example.com/privkey.pem;

    client_max_body_size 200m;

    location / {
        proxy_pass http://127.0.0.1:9000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 10.2 Caddy 示例

```caddyfile
lobe.example.com {
    reverse_proxy 127.0.0.1:3210
}

s3.example.com {
    reverse_proxy 127.0.0.1:9000
}
```

## 11. 首次启动

在服务器执行：

```bash
cd /opt/mylob
docker compose pull
docker compose up -d
docker compose ps
docker logs -f mylob
```

### 成功标志

日志中出现以下内容，表示数据库初始化已经自动完成：

```text
[Database] Start to migration...
✅ database migration pass.
```

看到 Next.js 服务启动完成后，即可访问应用。

## 12. 首次登录与业务初始化

### 12.1 注册第一个用户

部署完成后，访问：

- `https://lobe.example.com`

完成第一个账号注册或登录。

### 12.2 获取用户 ID

如果需要给某个账号赋予超级管理员权限，需要先获得该账号的 `userId`。

常见方式：

- 在数据库中查询
- 通过现有调试或管理手段获取
- 从日志或开发辅助工具中获取

## 13. 超级管理员初始化

### 13.1 是否必须在服务器上保留源码仓库

不是必须。

执行 `scripts/init-super-admin.ts` 和 `scripts/seed-agent-templates.ts` 的前提只有两个：

- 你有一份能运行脚本的源码环境
- 这个环境能访问 PostgreSQL

因此有两种推荐方式：

- 方式 A：服务器临时 clone 一份源码并执行
- 方式 B：本地源码仓库 + SSH 隧道执行

### 13.2 方式 A：服务器临时执行

在服务器准备一个临时源码目录：

```bash
git clone < 你的仓库地址 > /opt/mylob-src
cd /opt/mylob-src
corepack enable
corepack use pnpm@10.20.0
pnpm install
```

然后执行：

```bash
DATABASE_URL=postgresql://postgres:你的密码@127.0.0.1:5432/lobechat bunx tsx scripts/init-super-admin.ts <userId>
```

### 13.3 方式 B：本地源码仓库 + SSH 隧道

先建立 SSH 隧道：

```bash
ssh -L 5432:127.0.0.1:5432 user@your-server
```

然后在你本地的源码仓库目录执行：

```bash
DATABASE_URL=postgresql://postgres:你的密码@127.0.0.1:5432/lobechat bunx tsx scripts/init-super-admin.ts <userId>
```

### 13.4 说明

这一步不要求 PostgreSQL 对公网开放。只要服务器本机可访问数据库即可。

## 14. 预置助手模板初始化

如果需要给指定用户导入预置助手模板，可以执行：

### 14.1 服务器本机执行

```bash
DATABASE_URL=postgresql://postgres:你的密码@127.0.0.1:5432/lobechat bunx tsx scripts/seed-agent-templates.ts <userId>
```

### 14.2 本地 + SSH 隧道执行

```bash
DATABASE_URL=postgresql://postgres:你的密码@127.0.0.1:5432/lobechat bunx tsx scripts/seed-agent-templates.ts <userId>
```

## 15. 更新发布流程

以后每次发布新版本，推荐按以下流程执行。

### 15.1 本地或 CI 构建新镜像

```bash
docker buildx build \
  -f Dockerfile.cn \
  --platform linux/amd64 \
  -t registry.example.com/yourname/mylob:2026-04-03 \
  -t registry.example.com/yourname/mylob:latest \
  --push \
  .
```

### 15.2 服务器拉取并更新

```bash
cd /opt/mylob
docker compose pull
docker compose up -d
docker compose ps
docker logs -f mylob
```

### 15.3 更新时自动完成的动作

- 拉取新镜像
- 重建应用容器
- 应用启动前自动执行数据库 migration

## 16. 回滚流程

如果新版本异常，可以通过固定 tag 回滚。

### 16.1 修改 `docker-compose.yml`

将：

```yaml
image: registry.example.com/yourname/mylob:latest
```

改为：

```yaml
image: registry.example.com/yourname/mylob:2026-04-02
```

### 16.2 重启服务

```bash
cd /opt/mylob
docker compose pull
docker compose up -d
```

## 17. 备份与恢复

### 17.1 PostgreSQL 备份

```bash
cd /opt/mylob
docker compose exec postgresql pg_dump -U postgres lobechat > backup.sql
```

### 17.2 PostgreSQL 恢复

```bash
cd /opt/mylob
docker compose exec -T postgresql psql -U postgres lobechat < backup.sql
```

### 17.3 RustFS 数据备份

```bash
cd /opt/mylob
docker compose exec rustfs tar czf /tmp/rustfs-backup.tar.gz /data
docker cp mylob-rustfs:/tmp/rustfs-backup.tar.gz ./rustfs-backup.tar.gz
```

### 17.4 Redis 数据持久化

Redis 主要用于缓存和辅助状态，一般不作为核心恢复依据。如需手动保存：

```bash
cd /opt/mylob
docker compose exec redis redis-cli BGSAVE
```

## 18. 运维常用命令

### 查看状态

```bash
cd /opt/mylob
docker compose ps
```

### 查看所有日志

```bash
docker compose logs -f
```

### 查看应用日志

```bash
docker logs -f mylob
```

### 查看数据库日志

```bash
docker compose logs -f postgresql
```

### 查看 RustFS 初始化日志

```bash
docker compose logs rustfs-init
```

### 重启所有服务

```bash
docker compose restart
```

### 仅重启应用

```bash
docker compose restart lobe
```

### 停止服务

```bash
docker compose stop
```

### 停止并删除容器

```bash
docker compose down
```

## 19. 常见问题

### Q1：应用启动了，但无法对话

通常是因为没有配置任何模型服务商 API Key。

检查 `.env` 是否至少配置了一个：

- `OPENAI_API_KEY`
- `DEEPSEEK_API_KEY`
- `GOOGLE_API_KEY`
- `QWEN_API_KEY`

### Q2：图片上传失败

优先检查：

- `S3_ENDPOINT` 是否为浏览器可访问地址
- 是否错误写成了容器内地址，例如 `http://rustfs:9000`
- `s3.example.com` 的反向代理和 HTTPS 是否正常

### Q3：数据库 migration 失败

查看应用日志：

```bash
docker logs -f mylob
```

重点检查：

- `DATABASE_URL` 是否正确
- PostgreSQL 是否健康
- 是否使用 PostgreSQL 17
- 是否使用 `paradedb/paradedb:latest-pg17`

### Q4：是否必须开放 PostgreSQL 外部端口

不是。

推荐做法：

- 只绑定 `127.0.0.1:5432:5432`
- 不开放公网
- 执行管理员初始化时，走服务器本机或 SSH 隧道

### Q5：执行初始化脚本时服务器上必须有源码仓库吗

不是。

只要满足以下条件即可：

- 你有源码仓库环境
- 这个环境可以访问数据库

你可以选择：

- 在服务器临时 clone 一份源码执行
- 在本地源码仓库里通过 SSH 隧道执行

## 20. 生产安全建议

- 不要将 PostgreSQL 和 Redis 暴露到公网
- `KEY_VAULTS_SECRET`、`AUTH_SECRET`、`JWKS_KEY` 一定要妥善保存
- 给 LobeHub 和 S3 都配置 HTTPS
- 限制 RustFS 管理台访问来源
- 定期备份数据库和对象存储
- 发布镜像时使用固定 tag，避免只依赖 `latest`
- 更新前先做一次数据库备份

## 21. 上线检查清单

- [ ] 镜像已成功构建并推送
- [ ] `.env` 已配置 `APP_URL`
- [ ] `.env` 已配置 `KEY_VAULTS_SECRET`
- [ ] `.env` 已配置 `AUTH_SECRET`
- [ ] `.env` 已配置 `JWKS_KEY`
- [ ] `.env` 已配置至少一个模型 API Key
- [ ] `S3_ENDPOINT` 为外部可访问 HTTPS 地址
- [ ] PostgreSQL 未暴露公网
- [ ] Redis 未暴露公网
- [ ] 反向代理已配置
- [ ] 证书已生效
- [ ] 首次启动日志出现 `database migration pass`
- [ ] 已完成首个管理员初始化
- [ ] 已完成备份演练

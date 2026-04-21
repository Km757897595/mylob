# Ubuntu 源码部署指南（本机演示版）

面向一台**本地演示用的 Ubuntu 电脑**：只在这台机器上用浏览器访问，不对外开放、不需要公网 IP、不需要 HTTPS。为了和「本地开发环境能跑通」保持一致，本文尽量沿用仓库根目录下 `.env` / `.env.local` 的配置值，只把 `dev` 启动改成 `next start` 生产模式。

> 后面如果需要局域网其他设备访问或公网域名 + HTTPS，再参考 `[deployment-guide.md](./deployment-guide.md)`。

---

## 0. 目标与架构

- 一台 Ubuntu 电脑，演示时**只在本机浏览器**打开 `http://localhost:3210`
- 本机同时跑：LobeHub 应用 + PostgreSQL + Redis + RustFS + SearXNG
- `FEATURE_FLAGS` 保持与 `.env` 相同（ai_image /speech_to_text/knowledge_base/rbac_management/user_groups 等）

```
本机浏览器 ──►  http://localhost:3210  ──►  LobeHub (next start)
                                              │
                        ┌────────┬────────────┼──────────┐
                        ▼        ▼            ▼          ▼
                    Postgres   Redis       RustFS     SearXNG
                     5432       6379        9000       8180
```

---

## 1. 安装基础依赖

### 1.1 系统包

```bash
sudo apt update && sudo apt install -y \
  curl git build-essential pkg-config ca-certificates \
  libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
```

> `libcairo2-dev` 等是 `@napi-rs/canvas`、`sharp`、`pdfkit` 等原生依赖编译所需。

### 1.2 Node.js 24 + pnpm 10

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs

sudo corepack enable
corepack prepare pnpm@10.20.0 --activate

node -v # 期望 v24.x
pnpm -v # 期望 10.20.0
```

### 1.3 Docker（一键跑依赖组件）

```bash
sudo apt install -y docker.io docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker $USER # 免 sudo，执行后需重新登录生效
```

---

## 2. 一键启动依赖组件（Postgres / Redis / RustFS / SearXNG）

配置值全部对齐仓库 `.env`：Postgres 密码、RustFS AccessKey、端口与 `.env` 一致，省得后面再改。

```bash
sudo mkdir -p /opt/lobe && sudo chown -R $USER:$USER /opt/lobe
cd /opt/lobe

cat > docker-compose.deps.yml << 'YAML'
name: lobe-deps
services:
  postgres:
    image: paradedb/paradedb:latest-pg17
    container_name: lobe-postgres
    restart: always
    ports: ['127.0.0.1:5432:5432']
    environment:
      POSTGRES_DB: lobechat
      POSTGRES_PASSWORD: change_this_password_on_production
    volumes: ['./pgdata:/var/lib/postgresql/data']
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres']
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: lobe-redis
    restart: always
    ports: ['127.0.0.1:6379:6379']
    command: redis-server --save 60 1000 --appendonly yes
    volumes: ['./redis:/data']

  rustfs:
    image: rustfs/rustfs:latest
    container_name: lobe-rustfs
    restart: always
    ports:
      - '127.0.0.1:9000:9000'   # S3 API
      - '127.0.0.1:9001:9001'   # Web 控制台
    environment:
      RUSTFS_CONSOLE_ENABLE: 'true'
      RUSTFS_ACCESS_KEY: admin
      RUSTFS_SECRET_KEY: change_this_password_on_production
    command:
      - '--access-key'
      - 'admin'
      - '--secret-key'
      - 'change_this_password_on_production'
      - '/data'
    volumes: ['./rustfs:/data']

  searxng:
    image: searxng/searxng
    container_name: lobe-searxng
    restart: always
    ports: ['127.0.0.1:8180:8080']
YAML

docker compose -f docker-compose.deps.yml up -d
docker compose -f docker-compose.deps.yml ps
```

> 所有端口绑定到 `127.0.0.1`，只有本机能访问，相当于一层天然防火墙。

### 2.1 初始化 RustFS Bucket（只做一次）

```bash
docker run --rm --network host minio/mc sh -c "\
  mc alias set r http://127.0.0.1:9000 admin change_this_password_on_production && \
  mc mb r/lobe --ignore-existing && \
  mc anonymous set download r/lobe"
```

或在本机浏览器打开 `http://localhost:9001`（账号 `admin` / `change_this_password_on_production`）手动建一个叫 `lobe` 的 Bucket，并把匿名访问策略设为 `readonly/download`。

---

## 3. 拉取源码

```bash
cd /opt/lobe
git clone < 你的仓库地址 > mylob
cd mylob
```

---

## 4. 写入 `.env.production`

**核心思路：直接照搬本地 `.env`**。因为是本机演示，`KEY_VAULTS_SECRET`、`JWKS_KEY`、数据库 / S3 密码等原样保留即可，不需要重新生成。

```bash
cd /opt/lobe/mylob

cat > .env.production << 'EOF'
# LobeHub 本机演示配置（与仓库 .env 基本一致，仅端口改为 3210）

# -------- Application --------
# 本机演示：用 localhost 即可
APP_URL=http://localhost:3210

# 允许访问内网 IP（访问 127.0.0.1 下的 Redis/S3/SearXNG 必需）
SSRF_ALLOW_PRIVATE_IP_ADDRESS=1

# -------- 密钥 (沿用 .env 开发值) --------
KEY_VAULTS_SECRET=ww+0igxjGRAAR/eTNFQ55VmhQB5KE5trFZseuntThJs=
AUTH_SECRET=ww+0igxjGRAAR/eTNFQ55VmhQB5KE5trFZseuntThJs=

# -------- 数据库 --------
DATABASE_DRIVER=node
DATABASE_URL=postgresql://postgres:change_this_password_on_production@localhost:5432/lobechat

# -------- Redis --------
REDIS_URL=redis://localhost:6379
REDIS_PREFIX=lobechat
REDIS_TLS=0

# -------- S3 (RustFS) --------
S3_ACCESS_KEY_ID=admin
S3_SECRET_ACCESS_KEY=change_this_password_on_production
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=lobe
S3_ENABLE_PATH_STYLE=1
S3_SET_ACL=0

# 视觉模型走 base64 直传（和 .env 一致，免去预签名 URL 的各种坑）
LLM_VISION_IMAGE_USE_BASE64=1

# -------- Search (SearXNG) --------
SEARXNG_URL=http://localhost:8180

# -------- AI 模型 Keys (至少启用一个)，按需取消注释 --------
# OPENAI_API_KEY=sk-xxx
# OPENAI_PROXY_URL=https://api.openai.com/v1
# ANTHROPIC_API_KEY=sk-ant-xxx
# ANTHROPIC_PROXY_URL=https://api.anthropic.com

# -------- JWKS (沿用 .env 开发值) --------
JWKS_KEY='{"keys":[{"kty":"RSA","n":"qkWWwUccW-EFepHwHszHKLmzXj2z67DTAoPwiwp8Ia5xv5jV6YMluLLVBbBbt4nSw-YhWdoinnB9uUSVFO1A5EOqgzvEX6Uc2-fDNirw0AvowBRsQQl0_tskpBC4DIplFns040ZLkocZKME9TfpIUIw6hXHKrdqyS10x0YpEf2Q2x9NlAyXjYaaIckvFJK1OONp2g-I1flxm4BWHNcSWjoHB2AzU3VRew-feoY_EcwtVlMPra_wxwHiRzlPHN6GgNJdL930pkojCrQTtYgheWNGYnGUE5OfdlweLc7DxMLuH1H1_ms9bI5zCLLJJePygcyYoAIFAMdnvmfzVbUFqGQ","e":"AQAB","d":"DHHloN7Hrdd2hQzhlf61l75q47pyygk0gvyNujvb8sJDQhOznsudGDDJ7Q6ExZdnNjY9vcl5ukbSiZX_p3XnxkdD0S-vHKZ-w3vfAriEvVABhPh5KQ-941q1BODL8u6ykMAUj3_1yhHhvt7Q0kA2xNxa8qHshGR1n5iCKaSHeSAFcdBSc7wr9cqQLl7H8nt4lNk5GXYwTbkDlFHL5lkqa3fj1bQOr9jqgmy8mnLxTKBtr9pT6BPmn05OxpdqbIy_Ng5BL9wBC3WXR9jxrsU0p4qA3JNM4m-NmH3FU7kQmsKmt6-rDW8c_16YIgB2WJlQTqhfwx_cbA3lL9Gt-ijmAQ","p":"1cSo-oWoYc6RmhCnNFkdsmKjdxgENGPkYw4t0Lx-EZptAr2Q73TeUJon5v--uQsyiaRmTKBxXVJfvDdRSelAnT03RZ75OwxnmIFp1MK9C_uHi_K0m4F3P_v0TM9LTGZeriuR_in9xpae_7VhR8pouk7Fi_6BU0ZLjzicis9Rtzk","q":"y-kY3zXXTztMMcdZnoQwolcG5nrDS2VvSYwjxdup4qlZTMDqnNXUhsT-VfO31QWhTea-sE2jDmgPvo-EaaPvS0mZ_9HFaBX3-Qf_6v7pp9YDKQmqxoDPo3t4Q8zHwCnayzY1AYrIr3YIJ40yaulHNf1u6P60znYRW0PUEEORaeE","dp":"ETqSa-6NzaQ6c_JXp45vKEtu5VBYNmi-pYUlCCfI-V463vesUMBYkqJ6CNIf6wYOAq3vWMmtmVnkQWUr9gsInCOs6r2PVMUBLHdxsiYn2mlhWVQsXkQm-k8yN2aVqQivJNZ6I8P6oiDNm8pglsqneiyTG19dyPpnaJmldEKVUXE","dq":"V8jUElQli1Cl7tA5vsp9_YWlzNeQ-AaFMI6KYAW_T3tEnIx49GgCBLsOG4a-35B67wSll1T1G6ClFo7GnIwc2ram-8EdUUAT7zwIauyvPrgdyC8HPEn8Gg9vqRCh9hKOxOljTHSpDRCtVgmtaOVg6NdgRiJRSIj_0-CRjSbplUE","qi":"wjwKDa0hvp8SkhfkAoLvam51dk6GtFGcDO-EBYz941T1O8QA0oFmV10XzLIAaytl_XZnmh-Xi6IYAxu00USpRe854cl2Q5C65HXxt8gpkBIGQDwSWG1yrwa0NGH6VOzvfY5B7vBkod6YbKwYC6u_s7dhFxlpKYCgESePrhVZy5k","use":"sig","kid":"050d04407adc67de","alg":"RS256"}]}'

# -------- 功能开关 (与 .env 一致，必须原样保留) --------
FEATURE_FLAGS=+ai_image,+speech_to_text,+knowledge_base,-cloud_promotion,-check_updates,-market,+rbac_management,+user_groups
EOF
```

要点说明：

| 字段                              | 为什么这样写                                                           |
| --------------------------------- | ---------------------------------------------------------------------- |
| `APP_URL=http://localhost:3210`   | 本机演示直接用 localhost，better-auth 回调 / Cookie 都用它             |
| 端口 `3210`                       | `next start` 默认端口；`.env` 里的 `3010` 是 `next dev` 专用，不要混用 |
| `SSRF_ALLOW_PRIVATE_IP_ADDRESS=1` | 应用访问本机 Redis、RustFS、SearXNG 必需                               |
| `LLM_VISION_IMAGE_USE_BASE64=1`   | 和本地开发一致，省去 S3 预签名 URL 的所有坑                            |
| `KEY_VAULTS_SECRET` / `JWKS_KEY`  | 直接沿用 `.env` 值，本机演示无泄露风险                                 |
| `FEATURE_FLAGS`                   | **原样保留**，保证能力清单跟本地开发完全一致                           |

> `.env.local` 里的 `WEBHOOK_PROXY_URL` 只服务本地开发，演示机不需要。

---

## 5. 安装依赖并构建

```bash
cd /opt/lobe/mylob

# 国内网络建议换源
# pnpm config set registry https://registry.npmmirror.com

export NODE_OPTIONS=--max-old-space-size=8192
pnpm install --prefer-offline

# 打包生产产物（SPA + Next.js standalone + 迁移 SQL）
pnpm run build:docker
```

构建成功后产物路径：`.next/standalone/`、`.next/static/`、`public/spa/`、`packages/database/migrations/`。

> 内存不足 8G 时，先加 swap：
>
> ```bash
> sudo fallocate -l 8G /swapfile && sudo chmod 600 /swapfile
> sudo mkswap /swapfile && sudo swapon /swapfile
> echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
> ```

---

## 6. 执行数据库迁移

```bash
cd /opt/lobe/mylob
set -a && source .env.production && set +a
pnpm db:migrate
```

迁移脚本会依次建表并启用 `pgvector` 扩展，首次执行后即可看到内置的 `admin` 角色记录已写入（给下一步用）。

---

## 7. 启动应用

### 7.1 前台试跑

```bash
cd /opt/lobe/mylob
set -a && source .env.production && set +a
pnpm start # 等价于 next start -p 3210
```

本机浏览器打开 `http://localhost:3210`，**注册第一个账号**（这个账号后面要升级成超级管理员）。确认能正常登录后按 `Ctrl+C` 停掉，改用 systemd 常驻。

### 7.2 开机自启（systemd）

`/etc/systemd/system/lobe.service`：

```ini
[Unit]
Description=LobeHub Demo
After=network.target docker.service
Wants=docker.service

[Service]
Type=simple
User=USER_PLACEHOLDER
WorkingDirectory=/opt/lobe/mylob
EnvironmentFile=/opt/lobe/mylob/.env.production
ExecStartPre=/usr/bin/pnpm db:migrate
ExecStart=/usr/bin/pnpm start
Restart=always
RestartSec=5
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
```

把 `USER_PLACEHOLDER` 改成当前登录用户（`whoami`），保持和构建时用户一致：

```bash
sudo sed -i "s/USER_PLACEHOLDER/$(whoami)/" /etc/systemd/system/lobe.service
sudo systemctl daemon-reload
sudo systemctl enable --now lobe
sudo journalctl -u lobe -f
```

### 7.3 更简单的做法（不想用 systemd）

```bash
cd /opt/lobe/mylob
set -a && source .env.production && set +a
nohup pnpm start > /opt/lobe/lobe.log 2>&1 &
```

电脑重启后手动再执行一次即可。

---

## 8. 初始化超级管理员

RBAC 数据迁移后会预置 `admin`（超级管理员）角色，但**不会自动绑定任何用户**，需要你手动把第 7.1 步注册的账号升级成超级管理员。

仓库已提供专用脚本：`scripts/init-super-admin.ts`。

### 8.1 先查到你的 userId

用 `DATABASE_URL` 直连 Postgres 查一下：

```bash
cd /opt/lobe/mylob
set -a && source .env.production && set +a

# 方式一：按邮箱查
docker exec -it lobe-postgres psql -U postgres -d lobechat -c \
  "SELECT id, email, username FROM users ORDER BY created_at ASC;"
```

输出示例：

```
              id              |        email         | username
------------------------------+----------------------+----------
 user_2gF...kCz               | admin@example.com    | admin
```

把第一列 `id`（形如 `user_xxx`）记下来。

### 8.2 执行初始化脚本

```bash
cd /opt/lobe/mylob
set -a && source .env.production && set +a

pnpm exec tsx scripts/init-super-admin.ts userId 例： < 你的 > user_6UlqPlBGlUGXM2S3QJ0rbbzyDCk#
# pnpm exec tsx scripts/init-super-admin.ts user_2gF...kCz
```

脚本输出会包含：

```
✓ 已成功为用户 user_xxx 赋予 admin 角色（超级管理员）

用户 user_xxx 的角色信息：
┌─────────┬─────────┬──────────┐
│ (index) │ name    │ ...      │
├─────────┼─────────┼──────────┤
│ 0       │ 'admin' │ ...      │
└─────────┴─────────┴──────────┘

用户 user_xxx 的权限信息：
（一大串权限列表）

✅ 初始化完成！
```

### 8.3 验证

在本机浏览器 `http://localhost:3210` 登录该账号，应该能看到「用户管理 / 角色管理 / 权限管理」等仅管理员可见的菜单项。如未显示，F5 强刷或退出重登一次。

> 脚本是**幂等**的，重复执行不会出错；后续再加超级管理员直接跑同一条命令即可。

---

## 9. FEATURE_FLAGS 开启说明

`.env.production` 与本地 `.env` 保持一致：

| Flag              | 状态 | 说明                                           |
| ----------------- | ---- | ---------------------------------------------- |
| `ai_image`        | 开   | AI 图像生成，需要至少一个图像模型 Key          |
| `speech_to_text`  | 开   | 语音转文本                                     |
| `knowledge_base`  | 开   | 知识库；强依赖 pgvector（ParadeDB 镜像已内置） |
| `rbac_management` | 开   | 角色 / 权限管理（第 8 节用到）                 |
| `user_groups`     | 开   | 用户组                                         |
| `cloud_promotion` | 关   | 云版广告位                                     |
| `check_updates`   | 关   | 升级检查提醒                                   |
| `market`          | 关   | 发现市场（演示机通常无外网）                   |

想开启更多能力（如 `+market`、`+online_search`），直接修改 `FEATURE_FLAGS` 并 `sudo systemctl restart lobe` 即可。

---

## 10. 日常运维

| 场景           | 命令                                                                                                     |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| 查看服务日志   | `sudo journalctl -u lobe -f`                                                                             |
| 重启服务       | `sudo systemctl restart lobe`                                                                            |
| 拉新代码并重建 | `cd /opt/lobe/mylob && git pull && pnpm install && pnpm run build:docker && sudo systemctl restart lobe` |
| 补执行迁移     | `set -a && source .env.production && set +a && pnpm db:migrate`                                          |
| 再授权一个超管 | `pnpm exec tsx scripts/init-super-admin.ts <userId>`                                                     |
| 依赖组件重启   | `cd /opt/lobe && docker compose -f docker-compose.deps.yml restart`                                      |
| 备份数据库     | `docker exec lobe-postgres pg_dump -U postgres lobechat > /opt/lobe/backup-$(date +%F).sql`              |
| 备份 S3 文件   | `tar czf /opt/lobe/rustfs-$(date +%F).tgz /opt/lobe/rustfs`                                              |

---

## 11. 源码更新后重新部署

根据改了什么文件，走不同强度的更新流程。能走「轻量」就别走「完整」，省时间。

### 11.1 决策速查

| 本次改了什么                                                                             | 操作强度 |
| ---------------------------------------------------------------------------------------- | -------- |
| 只改 `.env.production`（非 `NEXT_PUBLIC_*`）                                             | L0 重启  |
| 改了 `src/**` / `packages/**` / `public/**` 下的 ts /tsx/vue / 样式                      | L1 标准  |
| 新增或改了依赖（`package.json` / `pnpm-lock.yaml` / `patches/`）                         | L2 装包  |
| 改了数据库（`packages/database/migrations/**` 新增 SQL）                                 | L3 迁移  |
| 动到 `apps/desktop/**` / 改 `NEXT_PUBLIC_*` 并需要打进前端 / `Dockerfile` / 构建脚本改动 | L4 清构  |

### 11.2 L0：只改配置（最常用）

```bash
sudo systemctl restart lobe
sudo journalctl -u lobe -n 50 --no-pager
```

改 `.env.production` 的 99% 场景都只需要这一步。不影响浏览器缓存的话无需硬刷。

### 11.3 L1：标准更新（只改源码，未动依赖）

```bash
cd /opt/lobe/mylob

# 1) 备份数据库（能避掉 90% 的事故）
docker exec lobe-postgres pg_dump -U postgres lobechat \
  > /opt/lobe/backup-$(date +%F-%H%M).sql

# 2) 拉代码
git fetch --all
git log --oneline HEAD..origin/$(git rev-parse --abbrev-ref HEAD) | head -20 # 看看有哪些提交
git pull --ff-only

# 3) 重新构建
export NODE_OPTIONS=--max-old-space-size=8192
pnpm run build:docker

# 4) 重启
sudo systemctl restart lobe
sudo journalctl -u lobe -f
```

> 看到 `ready - started server on 0.0.0.0:3210` 即可。

### 11.4 L2：依赖变动（`package.json` /lockfile 改了）

在 L1 基础上多一步 `pnpm install`：

```bash
cd /opt/lobe/mylob

docker exec lobe-postgres pg_dump -U postgres lobechat \
  > /opt/lobe/backup-$(date +%F-%H%M).sql

git pull --ff-only

# 关键：装依赖
pnpm install --prefer-offline

# 若 lexical / pdfjs-dist / drizzle-orm 等 overrides 涉及的包升级过，校验只有一个副本
pnpm ls lexical -r --depth=Infinity 2> /dev/null | grep -oE 'lexical [0-9.]+' | sort -u
# 期望只有一行：lexical 0.39.0（以 package.json overrides 为准）

export NODE_OPTIONS=--max-old-space-size=8192
pnpm run build:docker
sudo systemctl restart lobe
```

### 11.5 L3：带数据库迁移（最容易翻车，严格按顺序）

步骤：**备份 → 拉代码 → 装依赖 → 构建 → 迁移 → 重启**。迁移一定要在新构建**之后、服务重启之前**跑。

```bash
cd /opt/lobe/mylob

# 1) 强制备份！
docker exec lobe-postgres pg_dump -U postgres lobechat \
  > /opt/lobe/backup-$(date +%F-%H%M).sql

# 2) 停服务避免并发写
sudo systemctl stop lobe

# 3) 拉代码 / 装包 / 构建
git pull --ff-only
pnpm install --prefer-offline
export NODE_OPTIONS=--max-old-space-size=8192
pnpm run build:docker

# 4) 执行迁移（幂等，已跑过的会自动跳过）
set -a && source .env.production && set +a
pnpm db:migrate

# 5) 重启
sudo systemctl start lobe
sudo journalctl -u lobe -f
```

迁移失败时：

```bash
# 看迁移状态
docker exec -it lobe-postgres psql -U postgres -d lobechat \
  -c "SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 10;"

# 回滚到备份（谨慎！会丢失上次备份之后的数据）
cat /opt/lobe/backup-YYYY-MM-DD-HHMM.sql | docker exec -i lobe-postgres psql -U postgres -d lobechat
```

### 11.6 L4：彻底清构重建（前述方式无效 / 出现诡异编译缓存问题 / 改了 Next/Vite 配置）

```bash
cd /opt/lobe/mylob

docker exec lobe-postgres pg_dump -U postgres lobechat \
  > /opt/lobe/backup-$(date +%F-%H%M).sql

sudo systemctl stop lobe

git pull --ff-only

# 清掉所有缓存
rm -rf .next public/spa
pnpm -r exec rm -rf node_modules
rm -rf node_modules apps/desktop/node_modules
# 若怀疑 lockfile 也有问题：
# cp pnpm-lock.yaml pnpm-lock.yaml.bak && rm pnpm-lock.yaml

pnpm install

# 校验 overrides 生效（单副本）
pnpm ls lexical -r --depth=Infinity 2> /dev/null | grep -oE 'lexical [0-9.]+' | sort -u

export NODE_OPTIONS=--max-old-space-size=8192
pnpm run build:docker

set -a && source .env.production && set +a
pnpm db:migrate

sudo systemctl start lobe
```

### 11.7 更新后客户端必做

应用日志 OK ≠ 浏览器能看到最新版，PWA / Service Worker 会缓存旧资源：

```
浏览器打开演示页
→ F12 → Application → Service Workers → Unregister
→ F12 → Application → Storage → Clear site data
→ Ctrl + Shift + R 硬刷
```

### 11.8 回滚

```bash
cd /opt/lobe/mylob
git log --oneline -20

# 回到某个 commit（举例）
git reset --hard <commit_sha>

# 代码回滚后仍要重新构建 / 视情况迁移（若上次有 schema 变化则先恢复数据库备份）
pnpm install --prefer-offline
pnpm run build:docker
sudo systemctl restart lobe
```

---

## 12. 常见问题

1. **打不开 `http://localhost:3210`**：

- `ss -tlnp | grep 3210` 看是否在监听
- `sudo journalctl -u lobe -n 100` 查启动日志

2. **知识库报 `extension "vector" is not available`**：确认用的是 ParadeDB 镜像；必要时 `docker exec -it lobe-postgres psql -U postgres -d lobechat -c 'CREATE EXTENSION IF NOT EXISTS vector;'`
3. **构建 OOM**：加 swap 或把 `NODE_OPTIONS=--max-old-space-size` 调小到 6144；实在不行在开发机打包完再 `rsync .next public/spa packages/database/migrations` 过来。
4. **脚本报 `找不到 admin 角色`**：说明 `pnpm db:migrate` 还没跑或 `rbac_management` 未开启；检查 `.env.production` 里的 `FEATURE_FLAGS` 后重跑迁移。
5. **想再切回 dev 联调**：直接 `pnpm dev`（读 `.env` + `.env.local`）即可，不影响已部署的生产实例（它跑 `next start` 读 `.env.production`）。
6. **升级超管后仍看不到菜单**：退出重登一次，或清一下浏览器 Cookie；权限缓存在会话里。
7. **更新后前端报 `ActionTagNode does not subclass LexicalNode`**：`@lexical/*` 出现多副本；执行 L4 彻底清构重建，并检查 `pnpm ls lexical -r` 只剩一个版本。
8. **图片链接仍是 `localhost`**：`S3_PUBLIC_DOMAIN` 才是浏览器看到的域名；`S3_ENDPOINT` 是服务端内部地址。改完二者，`systemctl restart lobe` + 清 Service Worker 即可；旧文件的历史 URL 不会自动改写。

---

## 附：与仓库 `.env` / `.env.local` 的差异一览

| 变量                                   | 本地 `.env` / `.env.local` | 本机演示 `.env.production`   |
| -------------------------------------- | -------------------------- | ---------------------------- |
| 启动命令                               | `pnpm dev`                 | `pnpm start`（`next start`） |
| 端口                                   | `3010`                     | `3210`                       |
| `APP_URL`                              | `http://localhost:3010`    | `http://localhost:3210`      |
| `SSRF_ALLOW_PRIVATE_IP_ADDRESS`        | `1`                        | `1`（保留）                  |
| 其余密钥 / S3 / Redis / SearXNG        | 开发值                     | **完全原样保留**             |
| `WEBHOOK_PROXY_URL`（仅 `.env.local`） | Cloudflare Tunnel          | 无需设置                     |
| `FEATURE_FLAGS`                        | 完整开启清单               | **完全一致**                 |

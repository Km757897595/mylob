# 单机 Docker Compose 测试环境 CI/CD 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 LobeHub 增加一套可手动触发的单机测试环境 CI/CD 流程，使用 Docker Hub 分发镜像、通过 SSH 部署到单台云服务器，并支持公网 IP: 端口访问以验证视频生成 webhook 闭环。

**Architecture:** 复用现有 Docker 构建能力，新增测试环境专用 `docker-compose` 文件、手动触发的 GitHub Actions 工作流，以及一份中文部署文档。运行时环境部署在单台云服务器上，应用、数据库、Redis、RustFS、SearXNG 共机运行，部署通过 `docker compose pull && docker compose up -d` 收敛。

**Tech Stack:** GitHub Actions、Docker Hub、Docker Compose、SSH、LobeHub Docker 镜像、RustFS、PostgreSQL、Redis、MDX 文档。

---

## 文件结构与职责

### 新增文件

- `docker-compose/deploy/docker-compose.test.yml`
  测试环境专用 Compose 文件，基于现有 deploy compose 精简公网暴露面，并支持从 `LOBE_IMAGE` 注入镜像 tag。
- `docker-compose/deploy/.env.test.example.zh-CN`
  中文测试环境示例环境变量文件，给服务器首配和 GitHub Secret 录入提供模板。
- `.github/workflows/deploy-test-server.yml`
  手动触发的部署工作流，负责构建镜像、推送 Docker Hub、写入服务器配置并执行远程部署。
- `docs/self-hosting/platform/github-actions-single-server-test.zh-CN.mdx`
  中文部署文档，说明服务器初始化、GitHub Secrets、手动触发部署、回滚与验证步骤。

### 修改文件

- `docs/self-hosting/platform/docker-compose.zh-CN.mdx`
  增加一段 “延伸阅读” 或 “测试环境自动部署” 入口，避免新增文档难以被发现。

## 实施约束

- 不改动现有 `docker-compose/deploy/docker-compose.yml`
- 不改动现有 `pr-build-docker.yml` 和 `release-docker.yml`
- 不把任何服务器 Secret 写进仓库
- 只支持手动触发，不实现 push 自动部署
- 只面向测试环境，不补生产级 HTTPS、域名、WAF、备份设计

## 验证策略

本计划的验证分三层：

1. 配置层
   使用 `docker compose config` 验证测试 compose 与示例 env 是否可展开。
2. 工作流层
   使用 `eslint` 检查新增 workflow YAML 格式。
3. 文档层
   使用 `bun run lint:mdx` 检查新增中文文档与索引修改。

---

### Task 1: 创建测试环境专用 Compose 与中文环境变量模板

**Files:**

- Create: `docker-compose/deploy/docker-compose.test.yml`

- Create: `docker-compose/deploy/.env.test.example.zh-CN`

- Reference: `docker-compose/deploy/docker-compose.yml`

- [ ] **Step 1: 新建测试环境 Compose 文件骨架**

在 `docker-compose/deploy/docker-compose.test.yml` 中写入完整初版内容，基于现有 deploy compose 调整为 “测试环境专用版本”。文件内容直接使用下面这版：

```yaml
name: lobehub-test

services:
  lobe:
    image: ${LOBE_IMAGE}
    container_name: lobehub-test
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
      - 'APP_URL=${APP_URL}'
      - 'DATABASE_URL=postgresql://postgres:${POSTGRES_PASSWORD}@postgresql:5432/${LOBE_DB_NAME}'
      - 'S3_ENDPOINT=${S3_ENDPOINT}'
      - 'S3_BUCKET=${RUSTFS_LOBE_BUCKET}'
      - 'S3_ENABLE_PATH_STYLE=1'
      - 'S3_ACCESS_KEY=${RUSTFS_ACCESS_KEY}'
      - 'S3_ACCESS_KEY_ID=${RUSTFS_ACCESS_KEY}'
      - 'S3_SECRET_ACCESS_KEY=${RUSTFS_SECRET_KEY}'
      - 'S3_SET_ACL=0'
      - 'LLM_VISION_IMAGE_USE_BASE64=1'
      - 'SEARXNG_URL=${SEARXNG_BASE_URL}'
      - 'REDIS_URL=redis://redis:6379'
      - 'REDIS_PREFIX=${REDIS_PREFIX}'
      - 'REDIS_TLS=${REDIS_TLS}'
    env_file:
      - .env
    restart: always
    networks:
      - lobe-network

  postgresql:
    image: paradedb/paradedb:latest-pg17
    container_name: lobe-test-postgres
    volumes:
      - './data/postgres:/var/lib/postgresql/data'
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
    container_name: lobe-test-redis
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
    container_name: lobe-test-rustfs
    ports:
      - '${RUSTFS_PORT}:9000'
      - '${RUSTFS_ADMIN_PORT}:9001'
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
    container_name: lobe-test-rustfs-init
    depends_on:
      rustfs:
        condition: service_healthy
    volumes:
      - ./bucket.config.json:/bucket.config.json:ro
    entrypoint: /bin/sh
    command: >-
      -c '
      set -eux;
      mc --version;
      mc alias set rustfs "http://rustfs:9000" "${RUSTFS_ACCESS_KEY}" "${RUSTFS_SECRET_KEY}";
      mc mb "rustfs/${RUSTFS_LOBE_BUCKET}" --ignore-existing;
      mc anonymous set-json "/bucket.config.json" "rustfs/${RUSTFS_LOBE_BUCKET}";
      '
    restart: 'no'
    networks:
      - lobe-network

  searxng:
    image: searxng/searxng
    container_name: lobe-test-searxng
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

- [ ] **Step 2: 新建中文测试环境变量示例文件**

在 `docker-compose/deploy/.env.test.example.zh-CN` 中写入完整模板，内容如下：

```dotenv
# =========================
# LobeHub 单机测试环境示例
# 使用方式：
# 1. 复制为服务器上的 .env
# 2. 将整份内容保存到 GitHub Secret: TEST_ENV_FILE
# 3. 按实际公网 IP、密钥和模型配置替换
# =========================

# 运行镜像，由 GitHub Actions 在部署时覆盖
LOBE_IMAGE=lobehub/lobehub:test-manual

# 对外访问地址
APP_URL=http://your-server-ip:3210
LOBE_PORT=3210

# 可选：若需要区分容器内回环地址，可显式设置内部访问地址
# INTERNAL_APP_URL=http://127.0.0.1:3210

# 数据库
LOBE_DB_NAME=lobehub
POSTGRES_PASSWORD=replace-with-strong-password

# 应用密钥
KEY_VAULTS_SECRET=replace-with-strong-secret
AUTH_SECRET=replace-with-strong-secret
JWKS_KEY=replace-with-jwks-json

# RustFS / S3
RUSTFS_LOBE_BUCKET=lobe
RUSTFS_ACCESS_KEY=replace-with-rustfs-access-key
RUSTFS_SECRET_KEY=replace-with-rustfs-secret-key
RUSTFS_PORT=9000
RUSTFS_ADMIN_PORT=9001
# 注意：这里必须是浏览器可访问的对象存储地址，不能保留为 127.0.0.1
S3_ENDPOINT=http://your-server-ip:9000

# Redis
REDIS_PREFIX=lobechat
REDIS_TLS=0

# 搜索
SEARXNG_BASE_URL=http://searxng:8080
# 注意：测试环境 compose 不会把 .env 注入 searxng 容器
# 如需自定义 searxng 行为，请直接修改 searxng-settings.yml

# 功能开关
FEATURE_FLAGS=+ai_image,+speech_to_text,+knowledge_base,-cloud_promotion,-check_updates,-market,+rbac_management,+user_groups

# 按需启用你要测试的视频模型供应商
# 示例：火山引擎
VOLCENGINE_API_KEY=replace-with-real-api-key

# 如果未来需要覆盖回调地址，可显式设置
# WEBHOOK_PROXY_URL=http://127.0.0.1:3210
```

- [ ] **Step 3: 用示例 env 验证测试 Compose 可展开**

运行：

```bash
docker compose \
  --env-file docker-compose/deploy/.env.test.example.zh-CN \
  -f docker-compose/deploy/docker-compose.test.yml \
  config > /tmp/lobehub-test-compose.rendered.yml
```

预期：

- 命令退出码为 `0`

- `/tmp/lobehub-test-compose.rendered.yml` 被成功生成

- 输出配置中 `lobe.image` 已被展开为 `lobehub/lobehub:test-manual`

- [ ] **Step 4: 检查测试 Compose 的公网暴露面**

运行：

```bash
rg -n "5432:5432|6379:6379" docker-compose/deploy/docker-compose.test.yml
```

预期：

- 没有任何匹配输出

再运行：

```bash
rg -n "LOBE_PORT|RUSTFS_PORT|RUSTFS_ADMIN_PORT" docker-compose/deploy/docker-compose.test.yml
```

预期：

- 能看到 `lobe`、`rustfs` 的端口绑定仍然存在

- [ ] **Step 5: 提交 Task 1**

```bash
git add docker-compose/deploy/docker-compose.test.yml docker-compose/deploy/.env.test.example.zh-CN
git commit -m ":sparkles: add test server compose and env template"
```

预期：

- commit 成功

---

### Task 2: 新增手动触发的测试环境部署 Workflow

**Files:**

- Create: `.github/workflows/deploy-test-server.yml`

- Reference: `.github/workflows/pr-build-docker.yml`

- Reference: `.github/workflows/release-docker.yml`

- Validate: `.github/workflows/deploy-test-server.yml`

- [ ] **Step 1: 新建 workflow 文件**

在 `.github/workflows/deploy-test-server.yml` 中写入完整工作流内容：

```yaml
name: Deploy Test Server

on:
  workflow_dispatch:
    inputs:
      ref:
        description: '要部署的分支、Tag 或 Commit SHA'
        required: true
        default: 'canary'
        type: string
      image_tag:
        description: '可选：指定已有镜像 Tag。留空时自动按 ref + sha 构建新镜像'
        required: false
        default: ''
        type: string

permissions:
  contents: read

env:
  REGISTRY_IMAGE: lobehub/lobehub

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout target ref
        uses: actions/checkout@v6
        with:
          ref: ${{ inputs.ref }}

      - name: Resolve image tag
        id: vars
        shell: bash
        run: |
          set -euo pipefail

          if [ -n "${{ inputs.image_tag }}" ]; then
            IMAGE_TAG="${{ inputs.image_tag }}"
          else
            REF_NAME="${{ inputs.ref }}"
            REF_SANITIZED=$(echo "${REF_NAME}" | sed -E 's/[^a-zA-Z0-9_.-]+/-/g')
            SHA_SHORT=$(git rev-parse --short HEAD)
            IMAGE_TAG="test-${REF_SANITIZED}-${SHA_SHORT}"
          fi

          echo "image_tag=${IMAGE_TAG}" >> "$GITHUB_OUTPUT"
          echo "full_image=${REGISTRY_IMAGE}:${IMAGE_TAG}" >> "$GITHUB_OUTPUT"
          echo "Resolved image: ${REGISTRY_IMAGE}:${IMAGE_TAG}"

      - name: Docker login
        if: ${{ inputs.image_tag == '' }}
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKER_REGISTRY_USER }}
          password: ${{ secrets.DOCKER_REGISTRY_PASSWORD }}

      - name: Set up Docker Buildx
        if: ${{ inputs.image_tag == '' }}
        uses: docker/setup-buildx-action@v3

      - name: Build and push image
        if: ${{ inputs.image_tag == '' }}
        uses: docker/build-push-action@v6
        with:
          context: .
          file: ./Dockerfile
          push: true
          tags: ${{ steps.vars.outputs.full_image }}
          build-args: |
            SHA=${{ github.sha }}

      - name: Prepare SSH config
        shell: bash
        run: |
          set -euo pipefail
          mkdir -p ~/.ssh
          chmod 700 ~/.ssh
          printf '%s\n' "${{ secrets.TEST_SERVER_SSH_KEY }}" > ~/.ssh/id_ed25519
          chmod 600 ~/.ssh/id_ed25519

          if [ -n "${{ secrets.TEST_SERVER_KNOWN_HOSTS }}" ]; then
            printf '%s\n' "${{ secrets.TEST_SERVER_KNOWN_HOSTS }}" > ~/.ssh/known_hosts
          else
            ssh-keyscan -p "${{ secrets.TEST_SERVER_PORT }}" "${{ secrets.TEST_SERVER_HOST }}" >> ~/.ssh/known_hosts
          fi
          chmod 644 ~/.ssh/known_hosts

      - name: Render remote env file
        shell: bash
        run: |
          set -euo pipefail
          cat > /tmp/lobehub-test.env <<EOF
          LOBE_IMAGE=${{ steps.vars.outputs.full_image }}
          ${{ secrets.TEST_ENV_FILE }}
          EOF

      - name: Prepare remote deploy directory
        shell: bash
        run: |
          set -euo pipefail
          ssh -p "${{ secrets.TEST_SERVER_PORT }}" "${{ secrets.TEST_SERVER_USER }}@${{ secrets.TEST_SERVER_HOST }}" \
            "mkdir -p '${{ secrets.TEST_SERVER_DEPLOY_PATH }}'"

      - name: Upload compose and env files
        shell: bash
        run: |
          set -euo pipefail
          scp -P "${{ secrets.TEST_SERVER_PORT }}" \
            docker-compose/deploy/docker-compose.test.yml \
            "${{ secrets.TEST_SERVER_USER }}@${{ secrets.TEST_SERVER_HOST }}:${{ secrets.TEST_SERVER_DEPLOY_PATH }}/docker-compose.yml"

          scp -P "${{ secrets.TEST_SERVER_PORT }}" \
            docker-compose/deploy/bucket.config.json \
            "${{ secrets.TEST_SERVER_USER }}@${{ secrets.TEST_SERVER_HOST }}:${{ secrets.TEST_SERVER_DEPLOY_PATH }}/bucket.config.json"

          scp -P "${{ secrets.TEST_SERVER_PORT }}" \
            docker-compose/deploy/searxng-settings.yml \
            "${{ secrets.TEST_SERVER_USER }}@${{ secrets.TEST_SERVER_HOST }}:${{ secrets.TEST_SERVER_DEPLOY_PATH }}/searxng-settings.yml"

          scp -P "${{ secrets.TEST_SERVER_PORT }}" \
            /tmp/lobehub-test.env \
            "${{ secrets.TEST_SERVER_USER }}@${{ secrets.TEST_SERVER_HOST }}:${{ secrets.TEST_SERVER_DEPLOY_PATH }}/.env"

      - name: Deploy on remote server
        shell: bash
        run: |
          set -euo pipefail
          ssh -p "${{ secrets.TEST_SERVER_PORT }}" "${{ secrets.TEST_SERVER_USER }}@${{ secrets.TEST_SERVER_HOST }}" <<'EOF'
          set -euo pipefail
          cd "${{ secrets.TEST_SERVER_DEPLOY_PATH }}"
          docker login -u "${{ secrets.DOCKER_REGISTRY_USER }}" -p "${{ secrets.DOCKER_REGISTRY_PASSWORD }}"
          docker compose pull
          docker compose up -d
          docker compose ps
          docker image prune -f
          EOF

      - name: Check app endpoint
        shell: bash
        run: |
          set -euo pipefail
          curl --fail --retry 10 --retry-delay 5 "http://${{ secrets.TEST_SERVER_HOST }}:3210/" >/tmp/lobehub-test-home.html
          test -s /tmp/lobehub-test-home.html

      - name: Print deployment result
        shell: bash
        run: |
          echo "部署完成"
          echo "镜像: ${{ steps.vars.outputs.full_image }}"
          echo "访问地址: http://${{ secrets.TEST_SERVER_HOST }}:3210"
```

- [ ] **Step 2: 用 ESLint 校验新增 workflow**

运行：

```bash
pnpm exec eslint .github/workflows/deploy-test-server.yml
```

预期：

- 命令退出码为 `0`

- [ ] **Step 3: 检查 workflow 具备手动部署与回滚能力**

运行：

```bash
rg -n "workflow_dispatch|image_tag|docker compose pull|docker compose up -d|docker login" .github/workflows/deploy-test-server.yml
```

预期：

- 能看到 `workflow_dispatch`

- 能看到 `image_tag` 输入

- 能看到远端 `docker compose pull`

- 能看到远端 `docker compose up -d`

- 能看到远端 `docker login`

- [ ] **Step 4: 检查 workflow 会上传运行时依赖文件**

运行：

```bash
rg -n "docker-compose.test.yml|bucket.config.json|searxng-settings.yml|lobehub-test.env" .github/workflows/deploy-test-server.yml
```

预期：

- 能看到四个文件都被上传或生成

- [ ] **Step 5: 提交 Task 2**

```bash
git add .github/workflows/deploy-test-server.yml
git commit -m ":rocket: add manual test server deployment workflow"
```

预期：

- commit 成功

---

### Task 3: 补充中文测试环境部署文档

**Files:**

- Create: `docs/self-hosting/platform/github-actions-single-server-test.zh-CN.mdx`

- Modify: `docs/self-hosting/platform/docker-compose.zh-CN.mdx`

- Validate: `docs/self-hosting/platform/github-actions-single-server-test.zh-CN.mdx`

- [ ] **Step 1: 新建中文部署文档**

在 `docs/self-hosting/platform/github-actions-single-server-test.zh-CN.mdx` 中写入下面这份完整文档：

````mdx
---
title: 通过 GitHub Actions 部署单机测试环境
description: 使用 Docker Hub、Docker Compose 和 SSH 将 LobeHub 手动部署到单台公网服务器，用于验证视频生成等需要公网回调的功能。
tags:
  - GitHub Actions
  - Docker Compose
  - Self-Hosting
  - Test Environment
---

# 通过 GitHub Actions 部署单机测试环境

本文档面向“单台云服务器 + Docker Compose + 公网 IP:端口访问”的测试环境，适合验证视频生成 webhook 等本地环境难以完整联调的功能。

## 适用场景

- 你已经有一台可 SSH 登录的 Linux 云服务器
- 服务器已安装 Docker 和 Docker Compose
- 你暂时没有域名，计划直接使用公网 IP:端口访问
- 你希望通过 GitHub Actions 手动触发部署，而不是每次 push 自动发布

## 最终部署结果

部署完成后，服务器上将运行以下服务：

- `lobe`
- `postgresql`
- `redis`
- `rustfs`
- `rustfs-init`
- `searxng`

默认访问地址：

- LobeHub: `http://<服务器公网 IP>:3210`
- RustFS: `http://<服务器公网 IP>:9000`
- RustFS Admin: `http://<服务器公网 IP>:9001`

## 为什么这套方案适合测试视频生成

视频生成依赖外部模型供应商回调应用的 webhook 地址。若应用运行在本地 `localhost`，外部服务无法访问该地址，任务就会停留在处理中。

将 `APP_URL` 配置为公网服务器地址后，外部服务就可以访问：

`http://<服务器公网 IP>:3210/api/webhooks/video/<provider>`

这样就能验证完整的视频生成闭环。

## 服务器初始化

首次部署前，在服务器上执行：

```bash
mkdir -p /opt/lobehub-test
cd /opt/lobehub-test
docker --version
docker compose version
```
````

建议同时开放以下安全组或防火墙端口：

- `3210`
- `9000`
- `9001`
- `22`

不建议对公网开放：

- `5432`
- `6379`

## GitHub Secrets 清单

在仓库的 GitHub Actions Secrets 中添加以下字段：

- `DOCKER_REGISTRY_USER`
- `DOCKER_REGISTRY_PASSWORD`
- `TEST_SERVER_HOST`
- `TEST_SERVER_PORT`
- `TEST_SERVER_USER`
- `TEST_SERVER_SSH_KEY`
- `TEST_SERVER_DEPLOY_PATH`
- `TEST_ENV_FILE`
- 可选：`TEST_SERVER_KNOWN_HOSTS`

其中：

- `TEST_SERVER_DEPLOY_PATH` 推荐设置为 `/opt/lobehub-test`
- `TEST_ENV_FILE` 建议直接保存整份 `.env` 内容

## TEST_ENV_FILE 示例

可以基于 `docker-compose/deploy/.env.test.example.zh-CN` 生成一份实际值版本，再整体复制到 GitHub Secret 中。

至少需要替换：

- `APP_URL`
- `KEY_VAULTS_SECRET`
- `AUTH_SECRET`
- `POSTGRES_PASSWORD`
- `RUSTFS_ACCESS_KEY`
- `RUSTFS_SECRET_KEY`
- 视频模型供应商 API Key

## 手动触发部署

打开 GitHub 仓库：

`Actions` -> `Deploy Test Server`

填写：

- `ref`
  要部署的分支、Tag 或 Commit SHA
- `image_tag`
  留空表示重新构建镜像；填已有 Tag 表示直接部署该 Tag，可用于回滚

触发后，工作流会执行：

1. Checkout 目标代码
2. 构建并推送测试镜像
3. 通过 SSH 将 `docker-compose.yml` 和 `.env` 上传到服务器
4. 在服务器执行 `docker compose pull && docker compose up -d`
5. 检查首页是否可访问

## 回滚

若某次测试部署有问题，可以重新手动触发工作流，并在 `image_tag` 中填写上一个可用镜像 Tag。

例如：

`test-canary-abc1234`

这会跳过构建，直接将服务器切回指定镜像版本。

## 部署后验证

建议按顺序验证：

1. 访问首页\
   `http://<服务器公网 IP>:3210`

2. 查看容器状态

   ```bash
   cd /opt/lobehub-test
   docker compose ps
   ```

3. 查看应用日志

   ```bash
   docker logs --tail=200 lobehub-test
   ```

4. 验证对象存储\
   访问 `http://<服务器公网 IP>:9000`

5. 验证视频生成功能\
   重点检查：
   - 任务是否能成功提交
   - webhook 是否被接收
   - 任务状态是否能从处理中变为成功或失败

## 常见问题

### 1. 页面能打开，但视频任务仍然卡住

优先检查：

- `APP_URL` 是否为公网可达地址
- 服务器 `3210` 端口是否已放行
- 模型供应商是否能回调到 `/api/webhooks/video/<provider>`
- 容器日志中是否出现 webhook 相关报错

### 2. 上传图片或生成资源失败

优先检查：

- `S3_ENDPOINT` 是否配置为浏览器可访问地址
- `9000` 端口是否已放行
- RustFS bucket 是否初始化成功

### 3. SSH 部署失败

优先检查：

- `TEST_SERVER_SSH_KEY` 是否正确
- `TEST_SERVER_USER` 是否具备 Docker 执行权限
- `TEST_SERVER_PORT` 是否和实际 SSH 端口一致

````

- [ ] **Step 2: 在 Docker Compose 中文文档中添加入口链接**

在 `docs/self-hosting/platform/docker-compose.zh-CN.mdx` 的“自定义部署”章节前增加一段简短入口，插入内容如下：

```mdx
## 测试环境自动部署

如果你的目标是快速搭建一套“单台公网服务器 + Docker Compose + GitHub Actions 手动触发”的测试环境，用于验证视频生成 webhook 等需要公网回调的功能，可以继续阅读：

- [通过 GitHub Actions 部署单机测试环境](./github-actions-single-server-test)
````

- [ ] **Step 3: 校验新增中文文档**

运行：

```bash
bun run lint:mdx
```

预期：

- 命令退出码为 `0`

- [ ] **Step 4: 检查中文文档是否覆盖部署、回滚、验证**

运行：

```bash
rg -n "GitHub Secrets|手动触发部署|回滚|部署后验证|视频生成功能" docs/self-hosting/platform/github-actions-single-server-test.zh-CN.mdx
```

预期：

- 五个章节关键词都能命中

- [ ] **Step 5: 提交 Task 3**

```bash
git add docs/self-hosting/platform/github-actions-single-server-test.zh-CN.mdx docs/self-hosting/platform/docker-compose.zh-CN.mdx
git commit -m ":memo: add chinese docs for test server deployment"
```

预期：

- commit 成功

---

### Task 4: 做一次本地静态校验并整理交付说明

**Files:**

- Validate: `docker-compose/deploy/docker-compose.test.yml`

- Validate: `docker-compose/deploy/.env.test.example.zh-CN`

- Validate: `.github/workflows/deploy-test-server.yml`

- Validate: `docs/self-hosting/platform/github-actions-single-server-test.zh-CN.mdx`

- [ ] **Step 1: 一次性跑完配置与文档校验命令**

运行：

```bash
docker compose \
  --env-file docker-compose/deploy/.env.test.example.zh-CN \
  -f docker-compose/deploy/docker-compose.test.yml \
  config > /tmp/lobehub-test-compose.rendered.yml

pnpm exec eslint .github/workflows/deploy-test-server.yml

bun run lint:mdx
```

预期：

- 三条命令全部成功

- [ ] **Step 2: 检查关键文件之间的命名一致性**

运行：

```bash
rg -n "docker-compose.test.yml|TEST_ENV_FILE|LOBE_IMAGE|Deploy Test Server|github-actions-single-server-test" \
  .github/workflows/deploy-test-server.yml \
  docker-compose/deploy/docker-compose.test.yml \
  docker-compose/deploy/.env.test.example.zh-CN \
  docs/self-hosting/platform/github-actions-single-server-test.zh-CN.mdx \
  docs/self-hosting/platform/docker-compose.zh-CN.mdx
```

预期：

- 五个关键命名都存在

- 没有旧文件名或临时命名残留

- [ ] **Step 3: 输出交付说明，确认服务器首配步骤**

把以下交付说明整理到最终说明或 PR 描述中：

```text
1. 在服务器上创建 /opt/lobehub-test
2. 确保服务器已安装 Docker 与 Docker Compose
3. 放行 22、3210、9000、9001 端口
4. 在 GitHub Secrets 中配置 TEST_ENV_FILE 等部署变量
5. 通过 Actions -> Deploy Test Server 手动触发
6. 首次部署完成后访问 http://<server-ip>:3210 验证
7. 再执行视频生成测试，观察 webhook 是否正确收敛
```

- [ ] **Step 4: 提交 Task 4**

```bash
git add docker-compose/deploy/docker-compose.test.yml \
  docker-compose/deploy/.env.test.example.zh-CN \
  .github/workflows/deploy-test-server.yml \
  docs/self-hosting/platform/github-actions-single-server-test.zh-CN.mdx \
  docs/self-hosting/platform/docker-compose.zh-CN.mdx
git commit -m ":white_check_mark: finalize single-server test deployment assets"
```

预期：

- commit 成功

---

## 自检

### Spec 覆盖检查

- 手动触发部署：Task 2
- Docker Hub 构建与分发：Task 2
- 单机 Compose 编排：Task 1
- 中文文档：Task 3
- 回滚与验证步骤：Task 3、Task 4
- 视频 webhook 公网联调前提：Task 1、Task 3

### 占位符检查

- 计划中没有使用 `TBD`、`TODO`、`implement later`
- 所有新增文件都给出了准确路径
- 所有命令都给出了可执行版本

### 一致性检查

- 测试 compose 文件统一命名为 `docker-compose.test.yml`
- workflow 名称统一为 `Deploy Test Server`
- 文档统一引用 `TEST_ENV_FILE` 和 `LOBE_IMAGE`

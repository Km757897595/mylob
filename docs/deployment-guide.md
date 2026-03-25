# AI 多模态交互平台 — 部署指南

本文档面向运维 / 管理员，指导如何在甲方服务器上完成平台的 Docker Compose 全栈部署，并配置在线 API 与离线模型双模式。

---

## 一、服务器要求

| 项目     | 最低配置                       | 推荐配置                              |
| -------- | ------------------------------ | ------------------------------------- |
| CPU      | 4 核                           | 8 核 +                                |
| 内存     | 8 GB                           | 16 GB+（使用离线模型需 32 GB+）       |
| 硬盘     | 50 GB SSD                      | 200 GB+ SSD（离线模型权重需额外空间） |
| GPU      | 无（纯在线 API 模式）          | NVIDIA GPU 16GB+ VRAM（离线推理）     |
| 操作系统 | Ubuntu 22.04 / CentOS 8+       | Ubuntu 22.04 LTS                      |
| Docker   | Docker 24+ / Docker Compose V2 | 最新稳定版                            |

---

## 二、目录结构

```text
/opt/lobehub/
├── docker-compose.yml          # 主编排文件
├── .env                        # 环境变量配置
├── bucket.config.json          # S3 存储桶策略
├── searxng-settings.yml        # 搜索引擎配置
└── data/                       # PostgreSQL 数据持久化（自动创建）
```

---

## 三、快速部署

### 3.1 复制部署文件

```bash
mkdir -p /opt/lobehub && cd /opt/lobehub

# 从项目仓库复制部署文件
cp docker-compose/deploy/docker-compose.yml .
cp docker-compose/deploy/bucket.config.json .
cp docker-compose/deploy/searxng-settings.yml .
```

### 3.2 创建环境变量文件

```bash
cat > .env << 'EOF'
# ============================================================
#  基础配置
# ============================================================

# 应用端口
LOBE_PORT=3210

# 加密密钥（必须修改！建议使用 openssl rand -base64 32 生成）
KEY_VAULTS_SECRET=<替换为随机密钥>
AUTH_SECRET=<替换为随机密钥>

# 应用域名（如果使用反向代理，填写实际域名）
APP_URL=http://your-server-ip:3210

# ============================================================
#  数据库配置
# ============================================================
LOBE_DB_NAME=lobechat
POSTGRES_PASSWORD=<替换为安全密码>

# ============================================================
#  S3 对象存储（RustFS / MinIO 兼容）
# ============================================================
S3_ENDPOINT=http://localhost:9000
RUSTFS_PORT=9000
RUSTFS_ADMIN_PORT=9001
RUSTFS_LOBE_BUCKET=lobe
RUSTFS_ACCESS_KEY=YOUR_S3_ACCESS_KEY
RUSTFS_SECRET_KEY=YOUR_S3_SECRET_KEY

# ============================================================
#  邮箱服务（用户注册邮箱验证）
# ============================================================
# 启用邮箱验证
AUTH_EMAIL_VERIFICATION=1

# SMTP 配置
EMAIL_SERVICE_PROVIDER=smtp
SMTP_HOST=smtp.your-domain.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=noreply@your-domain.com
SMTP_PASS=<邮箱密码或授权码>
SMTP_FROM=北测数字 AI <noreply@your-domain.com>

# ============================================================
#  在线 API 模型配置（按需启用）
# ============================================================

# --- 文生文 ---
# DeepSeek
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxx

# 通义千问（Qwen）
QWEN_API_KEY=sk-xxxxxxxxxxxx

# 智谱（Zhipu / ChatGLM）
ZHIPU_API_KEY=xxxxxxxxxxxx

# --- 文生图（在线）---
# FAL.ai
ENABLED_FAL=1
FAL_API_KEY=key-xxxxxxxxxxxx

# BFL (FLUX)
BFL_API_KEY=xxxxxxxxxxxx

# --- 文生视频（在线）---
# 目前视频生成由平台内置路由处理，需在 UI 的「设置 > 模型服务」中配置
# 豆包视频（火山引擎）
# 在 UI「设置 > 模型服务」中添加并配置

# --- 视觉理解 ---
# 使用上述已配置的多模态模型（Qwen-VL, DeepSeek-V 等）即可

# ============================================================
#  离线模型配置（内网 / 本地推理）
# ============================================================

# Ollama — 文生文本地推理
ENABLED_OLLAMA=1
OLLAMA_PROXY_URL=http://host.docker.internal:11434
# 指定可用的离线模型列表
OLLAMA_MODEL_LIST=qwen2.5:14b,deepseek-r1:14b,llama3.3:latest

# ComfyUI — 图像生成本地推理
ENABLED_COMFYUI=1
COMFYUI_BASE_URL=http://host.docker.internal:8000

# ============================================================
#  TTS 语音服务
# ============================================================
# 平台内置支持 OpenAI TTS / Edge TTS 等，在 UI「设置 > 模型服务」中配置
# 离线 TTS 可使用 Edge TTS（无需 API Key）

# ============================================================
#  Feature Flags（功能开关）
# ============================================================
# 默认已开启: ai_image, speech_to_text, knowledge_base
# 格式: +启用, -禁用。例如:
# FEATURE_FLAGS=+market,-cloud_promotion
FEATURE_FLAGS=+ai_image,+speech_to_text,+knowledge_base,-cloud_promotion,-check_updates

# ============================================================
#  搜索引擎（可选，用于联网搜索）
# ============================================================
# 已内置 SearXNG 容器，无需额外配置

EOF
```

### 3.3 生成密钥

```bash
# 生成 KEY_VAULTS_SECRET
echo "KEY_VAULTS_SECRET=$(openssl rand -base64 32)"

# 生成 AUTH_SECRET
echo "AUTH_SECRET=$(openssl rand -base64 32)"

# 生成数据库密码
echo "POSTGRES_PASSWORD=$(openssl rand -base64 16)"

# 将生成的值替换到 .env 文件中
```

### 3.4 启动服务

```bash
cd /opt/lobehub

# 拉取镜像并启动
docker compose up -d

# 查看日志
docker compose logs -f lobe

# 查看服务状态
docker compose ps
```

### 3.5 验证部署

```bash
# 检查各服务健康状态
docker compose ps

# 预期输出（所有服务应为 healthy/running）：
# lobehub         running (healthy)     0.0.0.0:3210->3210/tcp
# lobe-postgres   running (healthy)     0.0.0.0:5432->5432/tcp
# lobe-redis      running (healthy)     0.0.0.0:6379->6379/tcp
# lobe-rustfs     running (healthy)     0.0.0.0:9000->9000/tcp
# lobe-searxng    running
```

访问 `http://<服务器IP>:3210` 即可进入平台。

---

## 四、离线模型部署

### 4.1 Ollama — 离线文生文

在**同一服务器**或**内网 GPU 服务器**上安装 Ollama：

```bash
# 安装 Ollama
curl -fsSL https://ollama.com/install.sh | sh

# 下载模型（根据 GPU 显存选择合适的模型大小）
ollama pull qwen2.5:14b     # 通义千问 14B（推荐，中文能力强）
ollama pull deepseek-r1:14b # DeepSeek R1 14B（推理能力强）
ollama pull llama3.3:latest # Llama 3.3（通用英文模型）

# 设置监听地址（允许 Docker 容器访问）
# 编辑 /etc/systemd/system/ollama.service，添加：
# Environment="OLLAMA_HOST=0.0.0.0"
sudo systemctl daemon-reload
sudo systemctl restart ollama

# 验证
curl http://localhost:11434/api/tags
```

**Docker 网络说明**：

- 同机部署时，`.env` 中设置 `OLLAMA_PROXY_URL=http://host.docker.internal:11434`
- 独立 GPU 服务器时，替换为该服务器内网 IP：`OLLAMA_PROXY_URL=http://192.168.x.x:11434`

### 4.2 ComfyUI — 离线图像生成

```bash
# 方式一：Docker 部署 ComfyUI（推荐）
docker run -d \
  --name comfyui \
  --gpus all \
  -p 8000:8188 \
  -v /opt/comfyui-models:/app/models \
  ghcr.io/ai-dock/comfyui:latest

# 方式二：手动安装
git clone https://github.com/comfyanonymous/ComfyUI.git
cd ComfyUI
pip install -r requirements.txt
python main.py --listen 0.0.0.0 --port 8000
```

**模型下载**：将 Stable Diffusion / FLUX 模型文件放入 `/opt/comfyui-models/checkpoints/` 目录。

平台已内置以下 ComfyUI 工作流：

- FLUX Schnell（快速文生图）
- FLUX Dev（高质量文生图）
- FLUX Kontext（图生图编辑）
- SD 1.5 / SDXL / SD 3.5（经典 Stable Diffusion）
- 自定义 SD 模型

`.env` 配置：

```env
ENABLED_COMFYUI=1
COMFYUI_BASE_URL=http://host.docker.internal:8000
```

### 4.3 Vision 模型 — 图意理解

通过 Ollama 部署视觉理解模型：

```bash
ollama pull llama3.2-vision:11b # Llama 3.2 Vision
ollama pull qwen2.5-vl:7b       # 通义千问 VL（推荐，中文识图强）
```

在平台聊天页面选择 Vision 模型，上传图片即可进行图意理解。

---

## 五、预置助手模板导入

平台预置了 23 个 AI 助手模板，覆盖文本、图像、视频、语音、知识库等场景。

### 方式一：使用 Seed 脚本（推荐）

```bash
# 进入项目目录
cd /path/to/lobehub

# 执行导入（需要 DATABASE_URL 环境变量，userId 为管理员账号 ID）
DATABASE_URL=postgresql://postgres:<密码>@localhost:5432/lobechat \
  bunx tsx scripts/seed-agent-templates.ts <管理员userId>

# 示例
DATABASE_URL=postgresql://postgres:mypassword@localhost:5432/lobechat \
  bunx tsx scripts/seed-agent-templates.ts user_abc123
```

脚本支持幂等执行，重复运行会自动跳过已存在的助手。

### 方式二：手动导入

1. 登录管理员账号
2. 进入「设置 > 系统工具 > 数据导入」
3. 上传 `docs/agent-templates/agent-templates.json` 文件

### 助手列表

| 类别        | 助手                                         |
| ----------- | -------------------------------------------- |
| 基础对话    | 通用智能助手                                 |
| 文本生成    | 文案创作、学术写作、代码编程、翻译、数据分析 |
| 图像生成    | 海报设计、产品概念图、插画创作               |
| 图像编辑    | 图片风格转换                                 |
| 视觉识别    | 图像理解分析                                 |
| 视频生成    | 短视频创意、产品展示视频、课件动画           |
| 语音交互    | 语音播报、会议纪要                           |
| 知识检索    | 知识库问答、合同审查                         |
| 教育 / 创意 | 教学辅导、创意头脑风暴                       |
| 管理        | 项目规划                                     |
| 综合设计    | 品牌视觉设计、多模态设计总监                 |

---

## 六、反向代理配置（Nginx）

生产环境建议使用 Nginx 反向代理 + HTTPS：

```nginx
server {
    listen 443 ssl http2;
    server_name ai.your-domain.com;

    ssl_certificate     /etc/ssl/certs/your-cert.pem;
    ssl_certificate_key /etc/ssl/private/your-key.pem;

    # 文件上传大小限制（知识库上传需要较大限制）
    client_max_body_size 500m;

    location / {
        proxy_pass http://127.0.0.1:3210;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE 流式输出支持
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 3600s;
    }

    # S3 存储访问（头像/文件上传）
    location /s3/ {
        proxy_pass http://127.0.0.1:9000/;
        proxy_set_header Host $host;
    }
}

server {
    listen 80;
    server_name ai.your-domain.com;
    return 301 https://$server_name$request_uri;
}
```

配置 HTTPS 后，更新 `.env`：

```env
APP_URL=https://ai.your-domain.com
S3_ENDPOINT=https://ai.your-domain.com/s3
AUTH_TRUSTED_ORIGINS=https://ai.your-domain.com
```

---

## 七、功能验证清单

部署完成后，按以下清单逐项验证：

| #   | 功能     | 验证步骤                                       |
| --- | -------- | ---------------------------------------------- |
| 1   | 注册登录 | 新用户注册 → 邮箱验证 → 登录成功               |
| 2   | 文生文   | 聊天页选择模型 → 输入问题 → 获得流式回复       |
| 3   | 文生图   | 进入「图像」页面 → 输入提示词 → 生成图片       |
| 4   | 图生图   | 图像页面上传参考图 → 输入风格描述 → 生成新图   |
| 5   | 图意理解 | 聊天页选 Vision 模型 → 上传图片 → 询问图片内容 |
| 6   | 文生视频 | 进入「视频」页面 → 输入文本描述 → 生成视频     |
| 7   | 图生视频 | 视频页面上传首帧图 → 输入描述 → 生成视频       |
| 8   | TTS 语音 | 聊天页点击播放按钮 → 听到语音播报              |
| 9   | STT 语音 | 聊天页点击麦克风 → 语音输入转文字              |
| 10  | 知识库   | 「资源库」上传文档 → 创建知识库 → 问答验证     |
| 11  | 预置助手 | 助手页面 → 查看 23 个预置助手 → 选择使用       |
| 12  | 离线 LLM | 断网 → 选 Ollama 模型 → 正常对话               |
| 13  | 离线图像 | 断网 → 选 ComfyUI → 正常生成图片               |

---

## 八、运维管理

### 8.1 数据备份

```bash
# 数据库备份
docker exec lobe-postgres pg_dump -U postgres lobechat > backup_$(date +%Y%m%d).sql

# 文件存储备份
docker run --rm -v lobehub_rustfs-data:/data -v /opt/backup:/backup \
  busybox tar czf /backup/rustfs_$(date +%Y%m%d).tar.gz /data

# 自动备份 crontab 示例（每天凌晨 2 点）
# 0 2 * * * /opt/lobehub/backup.sh
```

### 8.2 升级

```bash
cd /opt/lobehub

# 拉取新镜像
docker compose pull

# 重启服务（数据库 migration 自动执行）
docker compose up -d

# 查看升级日志
docker compose logs -f lobe
```

### 8.3 常见问题

| 问题             | 解决方案                                                        |
| ---------------- | --------------------------------------------------------------- |
| 数据库连接失败   | 检查 `POSTGRES_PASSWORD` 是否一致，检查 PostgreSQL 容器健康状态 |
| S3 上传失败      | 检查 `S3_ENDPOINT` 是否可从浏览器访问，检查 bucket.config.json  |
| Ollama 连接失败  | 确认 `OLLAMA_HOST=0.0.0.0`，Docker 使用 `host.docker.internal`  |
| ComfyUI 连接失败 | 确认 ComfyUI 监听 `0.0.0.0`，检查端口映射                       |
| 邮箱验证码收不到 | 检查 SMTP 配置，确认邮箱授权码正确                              |
| 模型列表为空     | 在「设置 > 模型服务」中启用对应的模型提供者                     |

---

## 九、安全建议

1. **修改默认密码**：首次部署后立即修改所有默认密码（数据库、S3、管理员账号）
2. **限制端口暴露**：生产环境仅暴露 443 端口（通过 Nginx 反向代理），关闭数据库和 Redis 的外部端口
3. **HTTPS 强制**：通过 Nginx 配置强制 HTTPS 跳转
4. **防火墙规则**：仅允许必要端口（443、22），内网通信使用 Docker 内部网络
5. **定期备份**：每日自动备份数据库和文件存储
6. **日志审计**：`docker compose logs` 定期检查异常访问

---

## 十、环境变量速查表

### 必填项

| 变量                | 说明         | 示例                      |
| ------------------- | ------------ | ------------------------- |
| `KEY_VAULTS_SECRET` | 密钥加密密钥 | `openssl rand -base64 32` |
| `AUTH_SECRET`       | 认证密钥     | `openssl rand -base64 32` |
| `POSTGRES_PASSWORD` | 数据库密码   | 安全随机密码              |
| `RUSTFS_ACCESS_KEY` | S3 访问密钥  | 自定义字符串              |
| `RUSTFS_SECRET_KEY` | S3 密钥      | 自定义字符串              |

### 模型配置

| 变量                | 说明             | 适用场景              |
| ------------------- | ---------------- | --------------------- |
| `DEEPSEEK_API_KEY`  | DeepSeek API Key | 在线文生文            |
| `QWEN_API_KEY`      | 通义千问 API Key | 在线文生文 + 视觉理解 |
| `ENABLED_OLLAMA=1`  | 启用 Ollama      | 离线文生文            |
| `OLLAMA_PROXY_URL`  | Ollama 服务地址  | 离线文生文            |
| `ENABLED_COMFYUI=1` | 启用 ComfyUI     | 离线图像生成          |
| `COMFYUI_BASE_URL`  | ComfyUI 服务地址 | 离线图像生成          |
| `ENABLED_FAL=1`     | 启用 FAL.ai      | 在线图像生成          |
| `FAL_API_KEY`       | FAL.ai API Key   | 在线图像生成          |
| `BFL_API_KEY`       | BFL API Key      | 在线 FLUX 图像        |

### 功能开关

| Flag              | 默认值  | 说明                     |
| ----------------- | ------- | ------------------------ |
| `ai_image`        | `true`  | 图像生成功能             |
| `speech_to_text`  | `true`  | 语音转文字               |
| `knowledge_base`  | `true`  | 知识库功能               |
| `market`          | `false` | 助手市场                 |
| `check_updates`   | `true`  | 检查更新（内网建议关闭） |
| `cloud_promotion` | `false` | 云端推广（建议关闭）     |
| `rbac_management` | `false` | 企业角色与权限管理       |
| `user_groups`     | `false` | 用户分组管理             |

---

## 八、企业管理功能初始化

启用 `rbac_management` 和 `user_groups` 后，需完成以下初始化步骤。

### 8.1 运行数据库迁移

企业管理功能依赖额外的数据表，首次部署需执行迁移：

```bash
bunx drizzle-kit migrate
```

迁移将创建以下表：`rbac_roles`、`rbac_permissions`、`rbac_role_permissions`、`rbac_user_roles`、`user_groups`、`user_group_members`、`user_hierarchy`、`topic_group_shares`、`topic_locks`、`user_quotas`。

迁移完成后，单独运行种子数据脚本补充预定义角色和权限：

**Linux / macOS**：

```bash
DATABASE_URL=postgresql://... bunx tsx scripts/seed-rbac-data.ts
```

**Windows PowerShell**：

```powershell
$env:DATABASE_URL="postgresql://..."; bunx tsx scripts/seed-rbac-data.ts
```

> 若迁移时已自动写入种子数据（可用 `SELECT count(*) FROM rbac_roles;` 验证，结果为 3），则跳过此步骤。该脚本幂等，重复执行安全。

### 8.2 指定超级管理员

迁移完成后，使用初始化脚本为指定用户赋予 `admin` 角色：

**Linux / macOS**：

```bash
DATABASE_URL=postgresql://... bunx tsx scripts/init-super-admin.ts <userId>
```

**Windows PowerShell**：

```powershell
$env:DATABASE_URL="postgresql://..."; bunx tsx scripts/init-super-admin.ts <userId>
```

**示例（Linux）**：

```bash
DATABASE_URL=postgresql://postgres:password@localhost:5432/lobechat \
  bunx tsx scripts/init-super-admin.ts user_123abc
```

**示例（PowerShell）**：

```powershell
$env:DATABASE_URL="postgresql://postgres:password@localhost:5432/lobechat"; bunx tsx scripts/init-super-admin.ts user_123abc
```

脚本幂等，可重复执行。

**预期输出**：

```text
✓ 已成功为用户 user_123abc 赋予 admin 角色（超级管理员）
✅ 初始化完成！
```

> **说明**：超级管理员（`admin` 角色）在 Settings → Enterprise 中可为其他用户分配 `manager` 或 `user` 角色，普通用户默认不可见 Enterprise 菜单。

### 8.3 预定义角色与权限

| 角色      | 说明       | 权限                                                                                                   |
| --------- | ---------- | ------------------------------------------------------------------------------------------------------ |
| `admin`   | 超级管理员 | 所有权限（7 个）                                                                                       |
| `manager` | 部门管理员 | `chat:create`、`image:generate`、`video:generate`、`kb:manage`、`topic:view_subordinate`、`topic:lock` |
| `user`    | 普通用户   | `chat:create`、`image:generate`、`video:generate`、`kb:manage`                                         |

@echo off
REM LobeHub 企业管理功能部署脚本 (Windows)
REM 用于初始化数据库迁移、种子数据和超级管理员账户

setlocal enabledelayedexpansion

REM Color codes for Windows (requires special handling)
set "BLUE=[94m"
set "GREEN=[92m"
set "RED=[91m"
set "YELLOW=[93m"
set "NC=[0m"

echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║  LobeHub 企业管理功能部署 - Database Initialization Setup  ║
echo ╚════════════════════════════════════════════════════════════╝
echo.

REM Check environment
echo %BLUE%━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━%NC%
echo %BLUE%检查环境%NC%
echo %BLUE%━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━%NC%
echo.

if "!DATABASE_URL!"=="" (
  echo %RED%✗ 未设置 DATABASE_URL 环境变量%NC%
  echo.
  echo 请运行以下命令设置环境变量:
  echo set DATABASE_URL=postgresql://user:password@localhost:5432/dbname
  echo.
  exit /b 1
)

echo %GREEN%✓ DATABASE_URL 已设置%NC%

where bunx >nul 2>&1
if !errorlevel! neq 0 (
  echo %RED%✗ 未找到 bunx 命令%NC%
  echo 请先安装 bun: https://bun.sh
  exit /b 1
)

echo %GREEN%✓ bunx 已安装%NC%
echo.

REM Run migrations
echo %BLUE%━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━%NC%
echo %BLUE%运行数据库迁移%NC%
echo %BLUE%━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━%NC%
echo.

echo %BLUE%ℹ 正在执行数据库迁移...%NC%
cd /d "%~dp0\.."

call bunx drizzle-kit migrate --dialect postgresql
if !errorlevel! neq 0 (
  echo %RED%✗ 数据库迁移失败%NC%
  exit /b 1
)

echo %GREEN%✓ 数据库迁移完成%NC%
echo.

REM Initialize super admin
echo %BLUE%━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━%NC%
echo %BLUE%初始化超级管理员%NC%
echo %BLUE%━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━%NC%
echo.

if "!SUPER_ADMIN_USER_ID!"=="" (
  echo %YELLOW%⚠ 未指定 SUPER_ADMIN_USER_ID%NC%
  echo.
  echo 可选: 为首个用户配置超级管理员权限
  echo 用法: set SUPER_ADMIN_USER_ID=^<userId^> ^&^& deploy-enterprise-features.bat
  echo.
  echo 示例: set SUPER_ADMIN_USER_ID=user_123abc ^&^& deploy-enterprise-features.bat
  echo.
  goto summary
)

echo %BLUE%ℹ 正在为用户 !SUPER_ADMIN_USER_ID! 初始化超级管理员权限...%NC%

call bunx tsx scripts/init-super-admin.ts !SUPER_ADMIN_USER_ID!
if !errorlevel! neq 0 (
  echo %RED%✗ 超级管理员初始化失败%NC%
  exit /b 1
)

echo %GREEN%✓ 超级管理员初始化完成%NC%
echo.

:summary
echo %BLUE%━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━%NC%
echo %BLUE%部署完成%NC%
echo %BLUE%━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━%NC%
echo.

echo 企业管理功能已成功部署！
echo.
echo 📋 后续步骤:
echo.
echo 1. 启用 Feature Flags (在 .env.local 中设置):
echo    %YELLOW%FEATURE_FLAGS=+rbac_management,+user_groups%NC%
echo.
echo 2. 启动开发服务器:
echo    %YELLOW%bun run dev%NC%
echo.
echo 3. 登录应用:
echo    - 使用初始化的超级管理员账户登录
echo    - 进入 Settings ^→ Enterprise
echo    - 访问 "Role ^& Permission" 或 "User Groups"
echo.
echo 📚 更多信息:
echo    - RBAC 路由: GET /api/lambda/rbac
echo    - UserGroup 路由: GET /api/lambda/userGroup
echo    - 初始化脚本: scripts/init-super-admin.ts
echo.
echo %GREEN%✓ 部署完成！%NC%
echo.

endlocal

#!/bin/bash

###############################################################################
# LobeHub 企业管理功能部署脚本
# 用于初始化数据库迁移、种子数据和超级管理员账户
###############################################################################

set -e  # Exit on error

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
print_header() {
  echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

print_success() {
  echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
  echo -e "${RED}✗ $1${NC}"
}

print_warning() {
  echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
  echo -e "${BLUE}ℹ $1${NC}"
}

# Check environment
check_environment() {
  print_header "检查环境"

  if [ -z "$DATABASE_URL" ]; then
    print_error "未设置 DATABASE_URL 环境变量"
    echo "请运行: export DATABASE_URL=postgresql://user:password@localhost:5432/dbname"
    exit 1
  fi

  print_success "DATABASE_URL 已设置"

  if ! command -v bunx &> /dev/null; then
    print_error "未找到 bunx 命令"
    echo "请先安装 bun: https://bun.sh"
    exit 1
  fi

  print_success "bunx 已安装"

  if ! command -v psql &> /dev/null; then
    print_warning "未找到 psql 命令（可选，用于验证）"
  else
    print_success "psql 已安装"
  fi
}

# Run database migrations
run_migrations() {
  print_header "运行数据库迁移"

  print_info "正在执行数据库迁移..."
  cd "$(dirname "$0")/.."

  # Run Drizzle migrations
  if command -v bunx &> /dev/null; then
    bunx drizzle-kit migrate --dialect postgresql || {
      print_error "数据库迁移失败"
      exit 1
    }
  else
    print_error "无法执行迁移"
    exit 1
  fi

  print_success "数据库迁移完成"
}

# Initialize super admin
init_super_admin() {
  print_header "初始化超级管理员"

  if [ -z "$SUPER_ADMIN_USER_ID" ]; then
    print_warning "未指定 SUPER_ADMIN_USER_ID"
    echo ""
    echo "可选：为首个用户配置超级管理员权限"
    echo "用法: SUPER_ADMIN_USER_ID=<userId> $0"
    echo ""
    echo "示例: SUPER_ADMIN_USER_ID=user_123abc $0"
    return
  fi

  print_info "正在为用户 $SUPER_ADMIN_USER_ID 初始化超级管理员权限..."

  DATABASE_URL="$DATABASE_URL" bunx tsx scripts/init-super-admin.ts "$SUPER_ADMIN_USER_ID" || {
    print_error "超级管理员初始化失败"
    exit 1
  }

  print_success "超级管理员初始化完成"
}

# Verify database
verify_database() {
  print_header "验证数据库"

  if ! command -v psql &> /dev/null; then
    print_warning "跳过验证（未安装 psql）"
    return
  fi

  print_info "检查 RBAC 表..."

  TABLES=$(psql "$DATABASE_URL" -t -c "
    SELECT count(*) FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN ('rbac_roles', 'rbac_permissions', 'rbac_user_roles')
  " 2>/dev/null || echo "0")

  if [ "$TABLES" = "3" ]; then
    print_success "RBAC 表已创建"
  else
    print_warning "RBAC 表可能未完全创建"
  fi

  # Check roles
  ROLES=$(psql "$DATABASE_URL" -t -c "SELECT count(*) FROM rbac_roles" 2>/dev/null || echo "0")
  print_info "系统角色数: $ROLES"

  # Check permissions
  PERMS=$(psql "$DATABASE_URL" -t -c "SELECT count(*) FROM rbac_permissions" 2>/dev/null || echo "0")
  print_info "权限数: $PERMS"
}

# Summary
print_summary() {
  print_header "部署完成"

  echo "企业管理功能已成功部署！"
  echo ""
  echo "📋 后续步骤："
  echo ""
  echo "1. 启用 Feature Flags (在 .env.local 中设置):"
  echo "   ${YELLOW}FEATURE_FLAGS=+rbac_management,+user_groups${NC}"
  echo ""
  echo "2. 启动开发服务器:"
  echo "   ${YELLOW}bun run dev${NC}"
  echo ""
  echo "3. 登录应用:"
  echo "   - 使用初始化的超级管理员账户登录"
  echo "   - 进入 Settings → Enterprise"
  echo "   - 访问 \"Role & Permission\" 或 \"User Groups\""
  echo ""
  echo "📚 更多信息:"
  echo "   - RBAC 路由: GET /api/lambda/rbac"
  echo "   - UserGroup 路由: GET /api/lambda/userGroup"
  echo "   - 初始化脚本: scripts/init-super-admin.ts"
  echo ""
  print_success "部署完成！"
}

# Main execution
main() {
  echo ""
  echo "╔════════════════════════════════════════════════════════════╗"
  echo "║  LobeHub 企业管理功能部署 - Database Initialization Setup  ║"
  echo "╚════════════════════════════════════════════════════════════╝"
  echo ""

  check_environment
  run_migrations
  init_super_admin
  verify_database
  print_summary
}

# Run main function
main "$@"

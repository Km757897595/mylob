-- 系统角色
INSERT INTO "rbac_roles" ("id", "name", "display_name", "description", "is_system")
VALUES
  ('role_admin', 'admin', '超级管理员', '拥有所有权限', true),
  ('role_manager', 'manager', '部门管理员', '管理下属用户和查看下属话题', true),
  ('role_user', 'user', '普通用户', '基础使用权限', true)
ON CONFLICT ("name") DO NOTHING;

-- 权限
INSERT INTO "rbac_permissions" ("id", "code", "name", "category")
VALUES
  ('perm_chat', 'chat:create', '创建对话', 'chat'),
  ('perm_img', 'image:generate', '生成图片', 'image'),
  ('perm_vid', 'video:generate', '生成视频', 'video'),
  ('perm_kb', 'kb:manage', '管理知识库', 'knowledge_base'),
  ('perm_user', 'user:manage', '管理用户', 'admin'),
  ('perm_topic_sub', 'topic:view_subordinate', '查看下属话题', 'topic'),
  ('perm_topic_lock', 'topic:lock', '锁定话题', 'topic')
ON CONFLICT ("code") DO NOTHING;

-- 角色-权限映射：admin 拥有所有权限
INSERT INTO "rbac_role_permissions" ("role_id", "permission_id")
SELECT 'role_admin', id FROM "rbac_permissions" WHERE "is_active" = true
ON CONFLICT DO NOTHING;

-- manager 权限
INSERT INTO "rbac_role_permissions" ("role_id", "permission_id")
SELECT 'role_manager', id FROM "rbac_permissions"
WHERE "code" IN ('chat:create','image:generate','video:generate','kb:manage','topic:view_subordinate','topic:lock')
ON CONFLICT DO NOTHING;

-- 普通用户权限
INSERT INTO "rbac_role_permissions" ("role_id", "permission_id")
SELECT 'role_user', id FROM "rbac_permissions"
WHERE "code" IN ('chat:create','image:generate','video:generate','kb:manage')
ON CONFLICT DO NOTHING;

-- 用户组表
CREATE TABLE IF NOT EXISTS "user_groups" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "description" text,
  "parent_id" text,
  "created_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "sort" integer,
  "accessed_at" timestamp with time zone NOT NULL DEFAULT now(),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "user_groups_created_by_idx" ON "user_groups" ("created_by");
CREATE INDEX IF NOT EXISTS "user_groups_parent_id_idx" ON "user_groups" ("parent_id");

-- 用户组成员表
CREATE TABLE IF NOT EXISTS "user_group_members" (
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "group_id" text NOT NULL REFERENCES "user_groups"("id") ON DELETE CASCADE,
  "role" text NOT NULL DEFAULT 'member',
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("user_id", "group_id")
);
CREATE INDEX IF NOT EXISTS "user_group_members_user_id_idx" ON "user_group_members" ("user_id");
CREATE INDEX IF NOT EXISTS "user_group_members_group_id_idx" ON "user_group_members" ("group_id");

-- 用户上下级关系表
CREATE TABLE IF NOT EXISTS "user_hierarchy" (
  "manager_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "subordinate_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("manager_id", "subordinate_id")
);
CREATE INDEX IF NOT EXISTS "user_hierarchy_manager_id_idx" ON "user_hierarchy" ("manager_id");
CREATE INDEX IF NOT EXISTS "user_hierarchy_subordinate_id_idx" ON "user_hierarchy" ("subordinate_id");

-- 话题-组共享表
CREATE TABLE IF NOT EXISTS "topic_group_shares" (
  "id" text PRIMARY KEY,
  "topic_id" text NOT NULL REFERENCES "topics"("id") ON DELETE CASCADE,
  "group_id" text NOT NULL REFERENCES "user_groups"("id") ON DELETE CASCADE,
  "shared_by" text REFERENCES "users"("id") ON DELETE SET NULL,
  "permission" text NOT NULL DEFAULT 'read',
  "accessed_at" timestamp with time zone NOT NULL DEFAULT now(),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "topic_group_shares_topic_group_unique" ON "topic_group_shares" ("topic_id", "group_id");
CREATE INDEX IF NOT EXISTS "topic_group_shares_group_id_idx" ON "topic_group_shares" ("group_id");

-- 话题锁定表
CREATE TABLE IF NOT EXISTS "topic_locks" (
  "topic_id" text NOT NULL REFERENCES "topics"("id") ON DELETE CASCADE,
  "locked_by" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "locked_at" timestamp with time zone NOT NULL DEFAULT now(),
  "expires_at" timestamp with time zone NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "topic_locks_topic_id_unique" ON "topic_locks" ("topic_id");
CREATE INDEX IF NOT EXISTS "topic_locks_locked_by_idx" ON "topic_locks" ("locked_by");
CREATE INDEX IF NOT EXISTS "topic_locks_expires_at_idx" ON "topic_locks" ("expires_at");

-- 用户配额表
CREATE TABLE IF NOT EXISTS "user_quotas" (
  "user_id" text PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "max_file_size_mb" integer NOT NULL DEFAULT 500,
  "max_vector_count" integer NOT NULL DEFAULT 10000,
  "current_file_size_mb" integer NOT NULL DEFAULT 0,
  "current_vector_count" integer NOT NULL DEFAULT 0,
  "accessed_at" timestamp with time zone NOT NULL DEFAULT now(),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

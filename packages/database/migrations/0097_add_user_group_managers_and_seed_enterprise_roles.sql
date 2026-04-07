CREATE TABLE IF NOT EXISTS "user_group_managers" (
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "group_id" text NOT NULL REFERENCES "user_groups"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("user_id", "group_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_group_managers_user_id_idx" ON "user_group_managers" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_group_managers_group_id_idx" ON "user_group_managers" ("group_id");
--> statement-breakpoint
UPDATE "rbac_roles" SET "name" = 'enterprise_admin', "display_name" = '企业管理员', "description" = '拥有企业范围内全部管理权限'
WHERE "name" = 'admin';
--> statement-breakpoint
UPDATE "rbac_roles" SET "name" = 'developer', "display_name" = '开发者', "description" = '拥有被授权用户组的管理和查看权限'
WHERE "name" = 'manager';
--> statement-breakpoint
UPDATE "rbac_roles" SET "name" = 'basic_user', "display_name" = '普通用户', "description" = '基础使用权限'
WHERE "name" = 'user';

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
UPDATE "rbac_roles"
SET "name" = "name" || '__legacy_' || substring("id" from 1 for 8)
WHERE "name" IN ('enterprise_admin', 'developer', 'basic_user')
  AND "id" NOT IN ('role_admin', 'role_manager', 'role_user');
--> statement-breakpoint
UPDATE "rbac_roles"
SET "name" = 'enterprise_admin', "display_name" = '企业管理员', "description" = '拥有企业范围内全部管理权限', "is_system" = true
WHERE "id" = 'role_admin';
--> statement-breakpoint
UPDATE "rbac_roles"
SET "name" = 'developer', "display_name" = '开发者', "description" = '拥有被授权用户组的管理和查看权限', "is_system" = true
WHERE "id" = 'role_manager';
--> statement-breakpoint
UPDATE "rbac_roles"
SET "name" = 'basic_user', "display_name" = '普通用户', "description" = '基础使用权限', "is_system" = true
WHERE "id" = 'role_user';
--> statement-breakpoint
INSERT INTO "rbac_roles" ("id", "name", "display_name", "description", "is_system")
VALUES ('role_admin', 'enterprise_admin', '企业管理员', '拥有企业范围内全部管理权限', true)
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "rbac_roles" ("id", "name", "display_name", "description", "is_system")
VALUES ('role_manager', 'developer', '开发者', '拥有被授权用户组的管理和查看权限', true)
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "rbac_roles" ("id", "name", "display_name", "description", "is_system")
VALUES ('role_user', 'basic_user', '普通用户', '基础使用权限', true)
ON CONFLICT ("id") DO NOTHING;

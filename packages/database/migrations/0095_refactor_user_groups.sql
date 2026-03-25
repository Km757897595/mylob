-- 1. 为 topics 表增加 user_group_id 字段
ALTER TABLE "topics" ADD COLUMN "user_group_id" text;

-- 2. 创建索引
CREATE INDEX IF NOT EXISTS "topics_user_group_id_idx" ON "topics" ("user_group_id");

-- 3. 添加外键约束
ALTER TABLE "topics" ADD CONSTRAINT "topics_user_group_id_user_groups_id_fk"
  FOREIGN KEY ("user_group_id") REFERENCES "user_groups"("id") ON DELETE SET NULL;

-- 4. 删除不再需要的 topic_group_shares 表
DROP TABLE IF EXISTS "topic_group_shares";

-- 5. 删除不再需要的 user_hierarchy 表
DROP TABLE IF EXISTS "user_hierarchy";

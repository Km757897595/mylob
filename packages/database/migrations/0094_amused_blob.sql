CREATE TABLE "topic_group_shares" (
	"id" text PRIMARY KEY NOT NULL,
	"topic_id" text NOT NULL,
	"group_id" text NOT NULL,
	"shared_by" text,
	"permission" text DEFAULT 'read' NOT NULL,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topic_locks" (
	"topic_id" text NOT NULL,
	"locked_by" text NOT NULL,
	"locked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_group_members" (
	"user_id" text NOT NULL,
	"group_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_group_members_user_id_group_id_pk" PRIMARY KEY("user_id","group_id")
);
--> statement-breakpoint
CREATE TABLE "user_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"parent_id" text,
	"created_by" text,
	"sort" integer,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_hierarchy" (
	"manager_id" text NOT NULL,
	"subordinate_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_hierarchy_manager_id_subordinate_id_pk" PRIMARY KEY("manager_id","subordinate_id")
);
--> statement-breakpoint
CREATE TABLE "user_quotas" (
	"user_id" text PRIMARY KEY NOT NULL,
	"max_file_size_mb" integer DEFAULT 500 NOT NULL,
	"max_vector_count" integer DEFAULT 10000 NOT NULL,
	"current_file_size_mb" integer DEFAULT 0 NOT NULL,
	"current_vector_count" integer DEFAULT 0 NOT NULL,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "topic_group_shares" ADD CONSTRAINT "topic_group_shares_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_group_shares" ADD CONSTRAINT "topic_group_shares_group_id_user_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."user_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_group_shares" ADD CONSTRAINT "topic_group_shares_shared_by_users_id_fk" FOREIGN KEY ("shared_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_locks" ADD CONSTRAINT "topic_locks_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic_locks" ADD CONSTRAINT "topic_locks_locked_by_users_id_fk" FOREIGN KEY ("locked_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_group_members" ADD CONSTRAINT "user_group_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_group_members" ADD CONSTRAINT "user_group_members_group_id_user_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."user_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_groups" ADD CONSTRAINT "user_groups_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_hierarchy" ADD CONSTRAINT "user_hierarchy_manager_id_users_id_fk" FOREIGN KEY ("manager_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_hierarchy" ADD CONSTRAINT "user_hierarchy_subordinate_id_users_id_fk" FOREIGN KEY ("subordinate_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_quotas" ADD CONSTRAINT "user_quotas_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "topic_group_shares_topic_group_unique" ON "topic_group_shares" USING btree ("topic_id","group_id");--> statement-breakpoint
CREATE INDEX "topic_group_shares_group_id_idx" ON "topic_group_shares" USING btree ("group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "topic_locks_topic_id_unique" ON "topic_locks" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "topic_locks_locked_by_idx" ON "topic_locks" USING btree ("locked_by");--> statement-breakpoint
CREATE INDEX "topic_locks_expires_at_idx" ON "topic_locks" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "user_group_members_user_id_idx" ON "user_group_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_group_members_group_id_idx" ON "user_group_members" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "user_groups_created_by_idx" ON "user_groups" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "user_groups_parent_id_idx" ON "user_groups" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "user_hierarchy_manager_id_idx" ON "user_hierarchy" USING btree ("manager_id");--> statement-breakpoint
CREATE INDEX "user_hierarchy_subordinate_id_idx" ON "user_hierarchy" USING btree ("subordinate_id");
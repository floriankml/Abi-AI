CREATE TABLE `ai_usage` (
	`id` text PRIMARY KEY NOT NULL,
	`task` text NOT NULL,
	`provider` text NOT NULL,
	`model` text NOT NULL,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`ok` integer NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`session_task_id` text,
	`answer_md` text NOT NULL,
	`hints_used` integer DEFAULT 0 NOT NULL,
	`score` real NOT NULL,
	`max_score` real NOT NULL,
	`evaluation` text NOT NULL,
	`confidence` real NOT NULL,
	`duration_s` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`session_task_id`) REFERENCES `session_tasks`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `attempts_task_idx` ON `attempts` (`task_id`);--> statement-breakpoint
CREATE INDEX `attempts_created_idx` ON `attempts` (`created_at`);--> statement-breakpoint
CREATE TABLE `material_chunks` (
	`id` text PRIMARY KEY NOT NULL,
	`material_id` text NOT NULL,
	`position` integer NOT NULL,
	`page` integer,
	`text` text NOT NULL,
	FOREIGN KEY (`material_id`) REFERENCES `materials`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `chunks_material_idx` ON `material_chunks` (`material_id`);--> statement-breakpoint
CREATE TABLE `materials` (
	`id` text PRIMARY KEY NOT NULL,
	`subject_id` text NOT NULL,
	`topic_id` text,
	`title` text NOT NULL,
	`kind` text NOT NULL,
	`category` text DEFAULT 'notes' NOT NULL,
	`original_name` text NOT NULL,
	`file_path` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`sha256` text NOT NULL,
	`extraction_status` text NOT NULL,
	`extraction_error` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `materials_subject_idx` ON `materials` (`subject_id`);--> statement-breakpoint
CREATE TABLE `session_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`task_id` text NOT NULL,
	`position` integer NOT NULL,
	`purpose` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`hints_revealed` integer DEFAULT 0 NOT NULL,
	`solution_revealed` integer DEFAULT false NOT NULL,
	`explanation_md` text,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `session_tasks_session_idx` ON `session_tasks` (`session_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`mode` text NOT NULL,
	`subject_id` text NOT NULL,
	`topic_id` text,
	`state` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`ended_at` text,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `subjects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`color` text DEFAULT '#64748b' NOT NULL,
	`profile` text NOT NULL,
	`level` text,
	`position` integer DEFAULT 0 NOT NULL,
	`archived_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subjects_slug_unique` ON `subjects` (`slug`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`subject_id` text NOT NULL,
	`topic_id` text,
	`type` text NOT NULL,
	`difficulty` integer NOT NULL,
	`prompt_md` text NOT NULL,
	`max_points` real NOT NULL,
	`solution_md` text NOT NULL,
	`rubric` text NOT NULL,
	`hints` text NOT NULL,
	`concept` text,
	`sources` text NOT NULL,
	`basis` text NOT NULL,
	`generator` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `topics` (
	`id` text PRIMARY KEY NOT NULL,
	`subject_id` text NOT NULL,
	`parent_id` text,
	`title` text NOT NULL,
	`description` text,
	`exam_weight` integer DEFAULT 1 NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `topics_subject_idx` ON `topics` (`subject_id`);
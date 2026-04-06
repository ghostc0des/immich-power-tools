CREATE TABLE `import_job_items` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`item_data` text DEFAULT '{}' NOT NULL,
	`immich_id` text,
	`error` text,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`job_id`) REFERENCES `import_jobs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `import_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`platform` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`url` text NOT NULL,
	`url_config` text DEFAULT '{}' NOT NULL,
	`import_data` text DEFAULT '{}' NOT NULL,
	`total_count` integer DEFAULT 0 NOT NULL,
	`uploaded_count` integer DEFAULT 0 NOT NULL,
	`skipped_count` integer DEFAULT 0 NOT NULL,
	`failed_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer,
	`updated_at` integer
);

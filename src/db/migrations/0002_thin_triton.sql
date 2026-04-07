CREATE TABLE `workflow_edges` (
	`id` text PRIMARY KEY NOT NULL,
	`workflow_id` text NOT NULL,
	`source_node_id` text NOT NULL,
	`target_node_id` text NOT NULL,
	`source_handle` text,
	`created_at` integer,
	FOREIGN KEY (`workflow_id`) REFERENCES `workflows`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`source_node_id`) REFERENCES `workflow_nodes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_node_id`) REFERENCES `workflow_nodes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `workflow_nodes` (
	`id` text PRIMARY KEY NOT NULL,
	`workflow_id` text NOT NULL,
	`type` text NOT NULL,
	`sub_type` text NOT NULL,
	`data` text DEFAULT '{}' NOT NULL,
	`position_x` real DEFAULT 0 NOT NULL,
	`position_y` real DEFAULT 0 NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`workflow_id`) REFERENCES `workflows`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `workflow_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`workflow_id` text NOT NULL,
	`trigger` text NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`result` text DEFAULT '{}',
	`error` text,
	`started_at` integer,
	`completed_at` integer,
	FOREIGN KEY (`workflow_id`) REFERENCES `workflows`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `workflows` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`enabled` integer DEFAULT false NOT NULL,
	`cron_schedule` text,
	`webhook_token` text,
	`viewport` text DEFAULT '{"x":0,"y":0,"zoom":1}' NOT NULL,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workflows_webhook_token_unique` ON `workflows` (`webhook_token`);
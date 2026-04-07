CREATE TABLE `workflow_processed_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`workflow_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`run_id` text NOT NULL,
	`processed_at` integer,
	FOREIGN KEY (`workflow_id`) REFERENCES `workflows`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_id`) REFERENCES `workflow_runs`(`id`) ON UPDATE no action ON DELETE cascade
);

PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`owner_id` text,
	`updated_at` integer
);--> statement-breakpoint
INSERT INTO `__new_settings`("id", "key", "value", "owner_id", "updated_at") SELECT "key", "key", "value", NULL, "updated_at" FROM `settings`;--> statement-breakpoint
DROP TABLE `settings`;--> statement-breakpoint
ALTER TABLE `__new_settings` RENAME TO `settings`;--> statement-breakpoint
PRAGMA foreign_keys=ON;

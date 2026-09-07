ALTER TABLE `user_profile` ADD `bodyweight_set_at` integer;--> statement-breakpoint
ALTER TABLE `user_profile` ADD `healthkit_connected` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `user_profile` ADD `healthkit_last_sync_at` integer;--> statement-breakpoint
ALTER TABLE `user_profile` ADD `healthkit_anchor` text;--> statement-breakpoint
ALTER TABLE `workout` ADD `source` text DEFAULT 'manual';--> statement-breakpoint
ALTER TABLE `workout` ADD `healthkit_uuid` text;
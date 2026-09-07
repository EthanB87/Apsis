ALTER TABLE `exercise` ADD `bw_factor` real;--> statement-breakpoint
ALTER TABLE `exercise` ADD `entry_mode` text;--> statement-breakpoint
ALTER TABLE `exercise` ADD `rest_timer_sec` integer;--> statement-breakpoint
ALTER TABLE `strength_set` ADD `added_load_kg` real;--> statement-breakpoint
ALTER TABLE `strength_set` ADD `duration_s` integer;--> statement-breakpoint
ALTER TABLE `user_profile` ADD `rest_timer_default_sec` integer DEFAULT 120;--> statement-breakpoint
ALTER TABLE `workout` ADD `finished_at` integer;--> statement-breakpoint
ALTER TABLE `workout` ADD `deleted_at` integer;
ALTER TABLE `food` ADD `last_used_unit` text;--> statement-breakpoint
ALTER TABLE `user_profile` ADD `lifts_units` text;--> statement-breakpoint
ALTER TABLE `user_profile` ADD `bodyweight_units` text;--> statement-breakpoint
ALTER TABLE `user_profile` ADD `run_units` text;--> statement-breakpoint
UPDATE `user_profile` SET `lifts_units` = `units`, `bodyweight_units` = `units`, `run_units` = `units`;
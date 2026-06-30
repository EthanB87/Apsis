CREATE TABLE `endurance_segment` (
	`id` text PRIMARY KEY NOT NULL,
	`workout_id` text NOT NULL,
	`activity_type` text NOT NULL,
	`distance_m` real,
	`duration_s` integer NOT NULL,
	`avg_hr` integer,
	`intensity_factor` real,
	`stress_score` real,
	FOREIGN KEY (`workout_id`) REFERENCES `workout`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `exercise` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`body_part` text,
	`is_seeded` integer DEFAULT true
);
--> statement-breakpoint
CREATE TABLE `load_daily` (
	`local_date` text PRIMARY KEY NOT NULL,
	`day_hss` real DEFAULT 0,
	`atl` real DEFAULT 0,
	`ctl` real DEFAULT 0,
	`tsb` real DEFAULT 0,
	`readiness_band` text,
	`updated_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE INDEX `load_daily_date_idx` ON `load_daily` (`local_date`);--> statement-breakpoint
CREATE TABLE `strength_set` (
	`id` text PRIMARY KEY NOT NULL,
	`workout_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`set_number` integer NOT NULL,
	`load_kg` real NOT NULL,
	`reps` integer NOT NULL,
	`rpe` real,
	`is_warmup` integer DEFAULT false,
	`e1rm_kg` real,
	`stress_score` real,
	FOREIGN KEY (`workout_id`) REFERENCES `workout`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercise`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `user_profile` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sex` text,
	`bodyweight_kg` real,
	`threshold_hr` integer,
	`threshold_pace_sec_per_km` integer,
	`units` text DEFAULT 'metric',
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE TABLE `workout` (
	`id` text PRIMARY KEY NOT NULL,
	`local_date` text NOT NULL,
	`type` text NOT NULL,
	`title` text,
	`hss` real DEFAULT 0,
	`created_at` integer DEFAULT (unixepoch())
);

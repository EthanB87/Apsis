CREATE TABLE `food` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`brand` text,
	`barcode` text,
	`source` text NOT NULL,
	`kcal_per_100g` real NOT NULL,
	`protein_g_per_100g` real NOT NULL,
	`carb_g_per_100g` real NOT NULL,
	`fat_g_per_100g` real NOT NULL,
	`fiber_g_per_100g` real,
	`sodium_mg_per_100g` real,
	`serving_name` text,
	`serving_grams` real,
	`verified` integer DEFAULT false,
	`created_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE INDEX `food_barcode_idx` ON `food` (`barcode`);--> statement-breakpoint
CREATE TABLE `food_log` (
	`id` text PRIMARY KEY NOT NULL,
	`local_date` text NOT NULL,
	`meal` text NOT NULL,
	`food_id` text,
	`qty_grams` real NOT NULL,
	`kcal` real NOT NULL,
	`p` real NOT NULL,
	`c` real NOT NULL,
	`f` real NOT NULL,
	`quick_add` integer DEFAULT false,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`food_id`) REFERENCES `food`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `food_log_date_idx` ON `food_log` (`local_date`);--> statement-breakpoint
CREATE TABLE `nutrition_target` (
	`id` text PRIMARY KEY NOT NULL,
	`local_date` text NOT NULL,
	`day_type` text NOT NULL,
	`kcal` real NOT NULL,
	`protein_g` real NOT NULL,
	`carb_g` real NOT NULL,
	`fat_g` real NOT NULL,
	`source` text DEFAULT 'auto' NOT NULL,
	`updated_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE INDEX `nutrition_target_date_idx` ON `nutrition_target` (`local_date`);--> statement-breakpoint
CREATE TABLE `recipe` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`servings` real DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE TABLE `recipe_ingredient` (
	`id` text PRIMARY KEY NOT NULL,
	`recipe_id` text NOT NULL,
	`food_id` text NOT NULL,
	`qty_grams` real NOT NULL,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipe`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`food_id`) REFERENCES `food`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `user_profile` ADD `height_cm` real;--> statement-breakpoint
ALTER TABLE `user_profile` ADD `birth_year` integer;--> statement-breakpoint
ALTER TABLE `user_profile` ADD `goal_mode` text;
CREATE TABLE `chats` (
	`sequence` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` text NOT NULL,
	`fortune_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`fortune_id`) REFERENCES `fortunes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_chats_owner_fortune_sequence` ON `chats` (`owner_id`,`fortune_id`,`sequence`);--> statement-breakpoint
CREATE TABLE `fortunes` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`created_at` text NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_fortunes_owner_created` ON `fortunes` (`owner_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `guin_maps` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`created_at` text NOT NULL,
	`data` text NOT NULL
);

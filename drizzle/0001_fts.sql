-- Volltextindex über Materialausschnitte (SQLite FTS5).
-- chunk_id/subject_id/material_id werden nur mitgeführt, nicht indiziert.
CREATE VIRTUAL TABLE `material_chunks_fts` USING fts5(
  `text`,
  `chunk_id` UNINDEXED,
  `material_id` UNINDEXED,
  `subject_id` UNINDEXED,
  tokenize = 'unicode61 remove_diacritics 2'
);
--> statement-breakpoint
-- Index automatisch synchron halten (auch bei kaskadierendem Löschen).
CREATE TRIGGER `material_chunks_ai` AFTER INSERT ON `material_chunks` BEGIN
  INSERT INTO `material_chunks_fts` (`text`, `chunk_id`, `material_id`, `subject_id`)
  SELECT NEW.`text`, NEW.`id`, NEW.`material_id`, m.`subject_id` FROM `materials` m WHERE m.`id` = NEW.`material_id`;
END;
--> statement-breakpoint
CREATE TRIGGER `material_chunks_ad` AFTER DELETE ON `material_chunks` BEGIN
  DELETE FROM `material_chunks_fts` WHERE `chunk_id` = OLD.`id`;
END;

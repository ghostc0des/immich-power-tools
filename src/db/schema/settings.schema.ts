import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { randomUUID } from "crypto";

export const settings = sqliteTable("settings", {
  id: text("id").primaryKey().$defaultFn(() => randomUUID()),
  key: text("key").notNull(),
  value: text("value").notNull(),
  ownerId: text("owner_id"),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$onUpdate(
    () => new Date()
  ),
});

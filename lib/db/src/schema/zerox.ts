import { createInsertSchema } from "drizzle-zod";
import {
  index,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const usersTable = pgTable(
  "zx_users",
  {
    id: text("id").primaryKey(),
    username: text("username").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    balance: numeric("balance", { precision: 16, scale: 2 }).notNull().default("0"),
    xp: integer("xp").notNull().default(0),
    level: integer("level").notNull().default(1),
    role: text("role", { enum: ["admin", "user"] }).notNull().default("user"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("zx_users_email_unique").on(table.email),
    uniqueIndex("zx_users_username_unique").on(table.username),
  ],
);

export const sessionsTable = pgTable(
  "zx_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("zx_sessions_user_id_idx").on(table.userId)],
);

export const offerwallsTable = pgTable("zx_offerwalls", {
  provider: text("provider", {
    enum: ["mooffers", "offery", "upwall", "gimiwall", "revtoo"],
  }).primaryKey(),
  name: text("name").notNull(),
  url: text("url"),
  badge: text("badge").notNull().default("Earn ZX"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const activityTable = pgTable(
  "zx_activity",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["reward", "withdrawal", "adjustment"] }).notNull(),
    label: text("label").notNull(),
    amount: numeric("amount", { precision: 16, scale: 2 }).notNull(),
    provider: text("provider"),
    transactionId: text("transaction_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("zx_activity_user_created_idx").on(table.userId, table.createdAt),
    uniqueIndex("zx_activity_transaction_unique").on(table.transactionId),
  ],
);

export const withdrawalsTable = pgTable(
  "zx_withdrawals",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    method: text("method").notNull(),
    amount: numeric("amount", { precision: 16, scale: 2 }).notNull(),
    destination: text("destination").notNull(),
    status: text("status", { enum: ["pending", "approved", "rejected"] })
      .notNull()
      .default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  },
  (table) => [
    index("zx_withdrawals_user_created_idx").on(table.userId, table.createdAt),
    index("zx_withdrawals_status_created_idx").on(table.status, table.createdAt),
  ],
);

export const appSettingsTable = pgTable("zx_app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  createdAt: true,
});
export const insertSessionSchema = createInsertSchema(sessionsTable).omit({
  createdAt: true,
});
export const insertOfferwallSchema = createInsertSchema(offerwallsTable).omit({
  updatedAt: true,
});
export const insertActivitySchema = createInsertSchema(activityTable).omit({
  id: true,
  createdAt: true,
});
export const insertWithdrawalSchema = createInsertSchema(withdrawalsTable).omit({
  id: true,
  createdAt: true,
  reviewedAt: true,
});
export const insertAppSettingSchema = createInsertSchema(appSettingsTable).omit({
  updatedAt: true,
});

export type User = typeof usersTable.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Session = typeof sessionsTable.$inferSelect;
export type Offerwall = typeof offerwallsTable.$inferSelect;
export type Activity = typeof activityTable.$inferSelect;
export type Withdrawal = typeof withdrawalsTable.$inferSelect;

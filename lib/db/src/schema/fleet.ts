import { pgTable, serial, text, jsonb, timestamp, integer, uniqueIndex } from "drizzle-orm/pg-core";

// Versioned domain payloads preserve the exact submitted data for auditability.
export const fleetVehicles = pgTable("fleet_vehicles", {
  id: serial("id").primaryKey(),
  plate: text("plate").notNull().unique(),
  data: jsonb("data").notNull(),
});
export const fleetDrivers = pgTable("fleet_drivers", {
  id: serial("id").primaryKey(),
  pinHash: text("pin_hash").notNull(),
  data: jsonb("data").notNull(),
});
export const fleetTrips = pgTable("fleet_trips", {
  id: serial("id").primaryKey(),
  vehicleId: integer("vehicle_id").notNull().references(() => fleetVehicles.id),
  driverId: integer("driver_id").notNull().references(() => fleetDrivers.id),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  data: jsonb("data").notNull(),
});
export const fleetMaintenances = pgTable("fleet_maintenances", {
  id: serial("id").primaryKey(),
  vehicleId: integer("vehicle_id").notNull().references(() => fleetVehicles.id),
  data: jsonb("data").notNull(),
});
export const fleetAdmin = pgTable("fleet_admin", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  pinHash: text("pin_hash").notNull(),
  email: text("email").notNull(),
  sender: text("sender").notNull().default(""),
});
export const fleetSessions = pgTable("fleet_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  role: text("role").notNull(),
  driverId: integer("driver_id").references(() => fleetDrivers.id),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
});
export const fleetAudit = pgTable("fleet_audit", {
  id: serial("id").primaryKey(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  data: jsonb("data").notNull(),
});
export const fleetAlerts = pgTable("fleet_alerts", {
  id: serial("id").primaryKey(),
  vehicleId: integer("vehicle_id").notNull().references(() => fleetVehicles.id),
  cycle: integer("cycle").notNull(),
  status: text("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  nextAttempt: timestamp("next_attempt", { withTimezone: true }).notNull().defaultNow(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
}, (table) => [uniqueIndex("fleet_alert_cycle").on(table.vehicleId, table.cycle)]);
export const fleetLoginAttempts = pgTable("fleet_login_attempts", {
  key: text("key").primaryKey(),
  attempts: integer("attempts").notNull().default(0),
  resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
});

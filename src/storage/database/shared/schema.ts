import { pgTable, serial, varchar, integer, timestamp, text, index, uuid } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const vpnNodes = pgTable(
  "vpn_nodes",
  {
    id: serial().primaryKey(),
    protocol: varchar("protocol", { length: 20 }).notNull(),
    address: varchar("address", { length: 255 }).notNull(),
    port: integer("port").notNull(),
    account: varchar("account", { length: 255 }).default(''),
    password: varchar("password", { length: 255 }).default(''),
    node_name: varchar("node_name", { length: 128 }).notNull(),
    encryption: varchar("encryption", { length: 64 }).default(''),
    network: varchar("network", { length: 20 }).default('tcp'),
    tls: varchar("tls", { length: 20 }).default(''),
    sni: varchar("sni", { length: 255 }).default(''),
    path: varchar("path", { length: 255 }).default(''),
    host: varchar("host", { length: 255 }).default(''),
    alter_id: integer("alter_id").default(0),
    expiry_date: varchar("expiry_date", { length: 32 }).default(''),
    user_id: uuid("user_id"),
    sort_order: integer("sort_order").notNull().default(0),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("vpn_nodes_sort_order_idx").on(table.sort_order),
    index("vpn_nodes_protocol_idx").on(table.protocol),
    index("vpn_nodes_user_id_idx").on(table.user_id),
  ]
);

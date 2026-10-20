import { randomBytes, randomUUID } from "node:crypto";
import { eq, lt } from "drizzle-orm";
import {
  appSettingsTable,
  db,
  offerwallsTable,
  sessionsTable,
  usersTable,
} from "@workspace/db";
import { hashPassword } from "./auth";

export const providerCatalog = [
  { provider: "mooffers", name: "MoOffers", badge: "Popular" },
  { provider: "offery", name: "Offery", badge: "Fast payout" },
  { provider: "upwall", name: "Upwall", badge: "+20% bonus" },
  { provider: "gimiwall", name: "Gimiwall", badge: "New offers" },
  { provider: "revtoo", name: "Revtoo", badge: "Daily picks" },
] as const;

export const cashoutOptions = [
  {
    id: "usdt-trc20",
    name: "USDT TRC20",
    category: "Crypto",
    minimum: 10000,
    description: "Tether on the TRON network",
  },
  {
    id: "litecoin",
    name: "Litecoin",
    category: "Crypto",
    minimum: 8000,
    description: "LTC wallet address",
  },
  {
    id: "paypal",
    name: "PayPal",
    category: "Cash",
    minimum: 12000,
    description: "PayPal account email",
  },
  {
    id: "pubg-uc",
    name: "PUBG UC",
    category: "Gaming",
    minimum: 5000,
    description: "Player ID for PUBG Mobile",
  },
  {
    id: "free-fire-diamonds",
    name: "Free Fire Diamonds",
    category: "Gaming",
    minimum: 5000,
    description: "Player ID for Free Fire",
  },
] as const;

export async function initializePlatform(): Promise<void> {
  const adminPassword = process.env.ZEROX_ADMIN_PASSWORD;
  if (!adminPassword) {
    throw new Error("ZEROX_ADMIN_PASSWORD must be configured to provision the admin account");
  }
  const adminEmail = "zeroxearn2026@gmail.com";
  const passwordHash = await hashPassword(adminPassword);
  const [existingAdmin] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, adminEmail))
    .limit(1);

  if (existingAdmin) {
    await db
      .update(usersTable)
      .set({ role: "admin", passwordHash })
      .where(eq(usersTable.id, existingAdmin.id));
  } else {
    await db.insert(usersTable).values({
      id: randomUUID(),
      username: `zxadmin_${randomBytes(4).toString("hex")}`,
      email: adminEmail,
      passwordHash,
      role: "admin",
    });
  }

  await db
    .insert(offerwallsTable)
    .values(
      providerCatalog.map((provider) => ({
        ...provider,
        url: null,
      })),
    )
    .onConflictDoNothing();

  await db
    .insert(appSettingsTable)
    .values({
      key: "postback_secret",
      value: randomBytes(32).toString("hex"),
    })
    .onConflictDoNothing();

  await db
    .delete(sessionsTable)
    .where(lt(sessionsTable.expiresAt, new Date()));
}

export async function getPostbackSecret(): Promise<string> {
  const [setting] = await db
    .select({ value: appSettingsTable.value })
    .from(appSettingsTable)
    .where(eq(appSettingsTable.key, "postback_secret"))
    .limit(1);
  if (!setting) {
    throw new Error("Postback signing secret has not been initialized");
  }
  return setting.value;
}

export function toOfferwallDto(
  offerwall: typeof offerwallsTable.$inferSelect,
  userId?: string,
) {
  const launchUrl =
    offerwall.url && userId
      ? offerwall.url.replaceAll("{user_id}", encodeURIComponent(userId))
      : null;
  return {
    provider: offerwall.provider,
    name: offerwall.name,
    url: offerwall.url,
    launchUrl,
    online: true,
    badge: offerwall.badge,
  };
}


import { randomUUID, timingSafeEqual } from "node:crypto";
import { and, asc, count, desc, eq, gte, sql } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  Activity,
  activityTable,
  db,
  offerwallsTable,
  usersTable,
  withdrawalsTable,
  type User,
} from "@workspace/db";
import {
  AdjustUserBalanceBody,
  AdjustUserBalanceParams,
  AdjustUserBalanceResponse,
  CreateWithdrawalBody,
  CreateWithdrawalResponse,
  GetActivityResponse,
  GetAdminOfferwallsResponse,
  GetAdminUsersResponse,
  GetAdminWithdrawalsResponse,
  GetCashoutOptionsResponse,
  GetCurrentUserResponse,
  GetDashboardResponse,
  GetLeaderboardResponse,
  GetLiveFeedResponse,
  GetMyWithdrawalsResponse,
  GetOfferwallParams,
  GetOfferwallResponse,
  GetOfferwallsResponse,
  GetPostbackInfoResponse,
  GetPostbackQueryParams,
  GetPostbackResponse,
  GetProfileResponse,
  LoginBody,
  LoginResponse,
  LogoutResponse,
  PostPostbackBody,
  PostPostbackResponse,
  RegisterBody,
  RegisterResponse,
  ReviewWithdrawalBody,
  ReviewWithdrawalParams,
  ReviewWithdrawalResponse,
  UpdateOfferwallBody,
  UpdateOfferwallQueryParams,
  UpdateOfferwallResponse,
} from "@workspace/api-zod";
import {
  createSession,
  deleteCurrentSession,
  getSessionUser,
  hashPassword,
  publicUser,
  setSessionCookie,
  verifyPassword,
} from "../lib/auth";
import {
  cashoutOptions,
  getPostbackSecret,
  providerCatalog,
  toOfferwallDto,
} from "../lib/zerox-platform";

const router: IRouter = Router();
const SESSION_COOKIE = "zx_session";
const providerSet = new Set<string>(providerCatalog.map(({ provider }) => provider));

function badRequest(res: Response, message: string): void {
  res.status(400).json({ error: message });
}

async function requireUser(req: Request, res: Response): Promise<User | null> {
  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: "Sign in to continue" });
    return null;
  }
  return user;
}

async function requireAdmin(req: Request, res: Response): Promise<User | null> {
  const user = await requireUser(req, res);
  if (!user) return null;
  if (user.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return null;
  }
  return user;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

function withdrawalDto(
  withdrawal: typeof withdrawalsTable.$inferSelect,
) {
  return {
    id: withdrawal.id,
    method: withdrawal.method,
    amount: Number(withdrawal.amount),
    destination: withdrawal.destination,
    status: withdrawal.status,
    createdAt: withdrawal.createdAt.toISOString(),
    reviewedAt: withdrawal.reviewedAt?.toISOString() ?? null,
  };
}

function activityDto(activity: Activity) {
  return {
    id: activity.id,
    kind: activity.kind,
    label: activity.label,
    amount: Number(activity.amount),
    createdAt: activity.createdAt.toISOString(),
  };
}

function userDto(user: User) {
  return publicUser(user);
}

function levelForXp(xp: number): number {
  return Math.floor(xp / 1000) + 1;
}

async function getUserOfferwalls(userId: string) {
  const rows = await db.select().from(offerwallsTable);
  const byProvider = new Map(rows.map((row) => [row.provider, row]));
  return providerCatalog.map((provider) => {
    const record = byProvider.get(provider.provider);
    if (!record) {
      return {
        provider: provider.provider,
        name: provider.name,
        url: null,
        launchUrl: null,
        online: true,
        badge: provider.badge,
      };
    }
    return toOfferwallDto(record, userId);
  });
}

function isValidOfferwallUrl(value: string): boolean {
  try {
    const candidate = new URL(value.replaceAll("{user_id}", "sample-user-id"));
    return candidate.protocol === "https:";
  } catch {
    return false;
  }
}

function safeSecretEqual(candidate: string, expected: string): boolean {
  const candidateBytes = Buffer.from(candidate);
  const expectedBytes = Buffer.from(expected);
  return (
    candidateBytes.length === expectedBytes.length &&
    timingSafeEqual(candidateBytes, expectedBytes)
  );
}

async function creditPostback(input: {
  user_id: string;
  reward: number;
  provider: string;
  tx_id: string;
  secret: string;
}): Promise<{ status: number; body: { success: boolean; balance: number; duplicate: boolean } | { error: string } }> {
  const storedSecret = await getPostbackSecret();
  if (!safeSecretEqual(input.secret, storedSecret)) {
    return { status: 401, body: { error: "Invalid postback secret" } };
  }
  if (!providerSet.has(input.provider) || input.reward > 1_000_000) {
    return { status: 400, body: { error: "Invalid provider or reward amount" } };
  }

  const provider = input.provider as typeof providerCatalog[number]["provider"];
  const [configuredProvider] = await db
    .select({ provider: offerwallsTable.provider })
    .from(offerwallsTable)
    .where(eq(offerwallsTable.provider, provider))
    .limit(1);
  if (!configuredProvider) {
    return { status: 400, body: { error: "Unknown offerwall provider" } };
  }

  const [knownUser] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.id, input.user_id))
    .limit(1);
  if (!knownUser) {
    return { status: 404, body: { error: "User not found" } };
  }

  try {
    const transactionKey = `${provider}:${input.tx_id}`;
    const result = await db.transaction(async (tx) => {
      const [duplicate] = await tx
        .select({ id: activityTable.id })
        .from(activityTable)
        .where(eq(activityTable.transactionId, transactionKey))
        .limit(1);
      const [lockedUser] = await tx
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, input.user_id))
        .for("update")
        .limit(1);
      if (!lockedUser) return { status: 404 as const, balance: 0, duplicate: false };
      if (duplicate) {
        return {
          status: 200 as const,
          balance: Number(lockedUser.balance),
          duplicate: true,
        };
      }

      const reward = Math.round(input.reward * 100) / 100;
      const newXp = lockedUser.xp + Math.floor(reward);
      const balance = Number(lockedUser.balance) + reward;
      await tx.insert(activityTable).values({
        userId: input.user_id,
        kind: "reward",
        label: `${providerCatalog.find((entry) => entry.provider === provider)?.name ?? provider} reward`,
        amount: reward.toFixed(2),
        provider,
        transactionId: transactionKey,
      });
      await tx
        .update(usersTable)
        .set({
          balance: balance.toFixed(2),
          xp: newXp,
          level: levelForXp(newXp),
        })
        .where(eq(usersTable.id, input.user_id));
      return { status: 200 as const, balance, duplicate: false };
    });

    if (result.status === 404) {
      return { status: 404, body: { error: "User not found" } };
    }
    return {
      status: 200,
      body: { success: true, balance: result.balance, duplicate: result.duplicate },
    };
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const [user] = await db
      .select({ balance: usersTable.balance })
      .from(usersTable)
      .where(eq(usersTable.id, input.user_id))
      .limit(1);
    return {
      status: 200,
      body: {
        success: true,
        balance: Number(user?.balance ?? 0),
        duplicate: true,
      },
    };
  }
}

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, parsed.error.message);
    return;
  }

  const username = parsed.data.username.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,32}$/.test(username)) {
    badRequest(res, "Username can use letters, numbers, and underscores");
    return;
  }

  let user: User;
  try {
    const passwordHash = await hashPassword(parsed.data.password);
    user = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(90815421)`);
      const [userCount] = await tx.select({ total: count() }).from(usersTable);
      const [soleExistingUser] =
        Number(userCount?.total ?? 0) === 1
          ? await tx.select({ email: usersTable.email }).from(usersTable).limit(1)
          : [undefined];
      const [created] = await tx
        .insert(usersTable)
        .values({
          id: randomUUID(),
          username,
          email: parsed.data.email.trim().toLowerCase(),
          passwordHash,
          role:
            Number(userCount?.total ?? 0) === 0 ||
            (Number(userCount?.total ?? 0) === 1 &&
              soleExistingUser?.email === "zeroxearn2026@gmail.com")
              ? "admin"
              : "user",
        })
        .returning();
      return created;
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      res.status(409).json({ error: "Email or username is already registered" });
      return;
    }
    throw error;
  }

  const sessionId = await createSession(user.id);
  setSessionCookie(res, sessionId);
  res.status(201).json(RegisterResponse.parse({ user: userDto(user) }));
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, parsed.error.message);
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, parsed.data.email.trim().toLowerCase()))
    .limit(1);
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    res.status(401).json({ error: "Email or password is incorrect" });
    return;
  }

  const sessionId = await createSession(user.id);
  setSessionCookie(res, sessionId);
  res.json(LoginResponse.parse({ user: userDto(user) }));
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  await deleteCurrentSession(req);
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
  res.json(LogoutResponse.parse({ success: true }));
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;
  res.json(GetCurrentUserResponse.parse(userDto(user)));
});

router.get("/dashboard", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;
  const [earnedResult] = await db
    .select({ total: sql<string>`coalesce(sum(${activityTable.amount}), 0)` })
    .from(activityTable)
    .where(and(eq(activityTable.userId, user.id), eq(activityTable.kind, "reward")));
  const [pendingResult] = await db
    .select({ total: sql<string>`coalesce(sum(${withdrawalsTable.amount}), 0)` })
    .from(withdrawalsTable)
    .where(
      and(
        eq(withdrawalsTable.userId, user.id),
        eq(withdrawalsTable.status, "pending"),
      ),
    );
  const recent = await db
    .select()
    .from(activityTable)
    .where(eq(activityTable.userId, user.id))
    .orderBy(desc(activityTable.createdAt))
    .limit(8);
  const dashboard = {
    user: userDto(user),
    totalEarned: Number(earnedResult?.total ?? 0),
    pendingWithdrawals: Number(pendingResult?.total ?? 0),
    recentActivity: recent.map(activityDto),
    offerwalls: await getUserOfferwalls(user.id),
  };
  res.json(GetDashboardResponse.parse(dashboard));
});

router.get("/activity", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;
  const recent = await db
    .select()
    .from(activityTable)
    .where(eq(activityTable.userId, user.id))
    .orderBy(desc(activityTable.createdAt))
    .limit(100);
  res.json(GetActivityResponse.parse(recent.map(activityDto)));
});

router.get("/leaderboard", async (_req, res): Promise<void> => {
  const leaders = await db
    .select({
      username: usersTable.username,
      level: usersTable.level,
      balance: usersTable.balance,
    })
    .from(usersTable)
    .orderBy(desc(usersTable.balance), asc(usersTable.username))
    .limit(50);
  res.json(
    GetLeaderboardResponse.parse(
      leaders.map((leader, index) => ({
        rank: index + 1,
        username: leader.username,
        level: leader.level,
        balance: Number(leader.balance),
      })),
    ),
  );
});

router.get("/live-feed", async (_req, res): Promise<void> => {
  const recent = await db
    .select({
      username: usersTable.username,
      amount: activityTable.amount,
      provider: activityTable.provider,
      createdAt: activityTable.createdAt,
    })
    .from(activityTable)
    .innerJoin(usersTable, eq(activityTable.userId, usersTable.id))
    .where(eq(activityTable.kind, "reward"))
    .orderBy(desc(activityTable.createdAt))
    .limit(20);
  res.json(
    GetLiveFeedResponse.parse(
      recent.map((item) => ({
        username: item.username,
        amount: Number(item.amount),
        provider:
          providerCatalog.find((entry) => entry.provider === item.provider)?.name ??
          "Offerwall",
        createdAt: item.createdAt.toISOString(),
      })),
    ),
  );
});

router.get("/profile", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;
  const [earnedResult] = await db
    .select({ total: sql<string>`coalesce(sum(${activityTable.amount}), 0)` })
    .from(activityTable)
    .where(and(eq(activityTable.userId, user.id), eq(activityTable.kind, "reward")));
  const withdrawals = await db
    .select()
    .from(withdrawalsTable)
    .where(eq(withdrawalsTable.userId, user.id))
    .orderBy(desc(withdrawalsTable.createdAt))
    .limit(100);
  res.json(
    GetProfileResponse.parse({
      user: userDto(user),
      withdrawals: withdrawals.map(withdrawalDto),
      totalEarned: Number(earnedResult?.total ?? 0),
    }),
  );
});

router.get("/offerwalls", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;
  res.json(GetOfferwallsResponse.parse(await getUserOfferwalls(user.id)));
});

router.get("/offerwalls/:provider", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;
  const params = GetOfferwallParams.safeParse(req.params);
  if (!params.success) {
    badRequest(res, params.error.message);
    return;
  }

  const [offerwall] = await db
    .select()
    .from(offerwallsTable)
    .where(eq(offerwallsTable.provider, params.data.provider))
    .limit(1);
  if (!offerwall) {
    res.status(404).json({ error: "Offerwall not found" });
    return;
  }
  res.json(GetOfferwallResponse.parse(toOfferwallDto(offerwall, user.id)));
});

router.get("/cashout/options", (_req, res): void => {
  res.json(GetCashoutOptionsResponse.parse(cashoutOptions));
});

router.get("/withdrawals", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;
  const withdrawals = await db
    .select()
    .from(withdrawalsTable)
    .where(eq(withdrawalsTable.userId, user.id))
    .orderBy(desc(withdrawalsTable.createdAt))
    .limit(100);
  res.json(GetMyWithdrawalsResponse.parse(withdrawals.map(withdrawalDto)));
});

router.post("/withdrawals", async (req, res): Promise<void> => {
  const user = await requireUser(req, res);
  if (!user) return;
  const parsed = CreateWithdrawalBody.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, parsed.error.message);
    return;
  }

  const option = cashoutOptions.find((entry) => entry.id === parsed.data.method);
  const amount = Math.round(parsed.data.amount * 100) / 100;
  if (!option || amount < option.minimum) {
    badRequest(res, "Select a valid cashout method and meet its minimum");
    return;
  }

  const created = await db.transaction(async (tx) => {
    const [chargedUser] = await tx
      .update(usersTable)
      .set({ balance: sql`${usersTable.balance} - ${amount.toFixed(2)}` })
      .where(and(eq(usersTable.id, user.id), gte(usersTable.balance, amount.toFixed(2))))
      .returning({ id: usersTable.id });
    if (!chargedUser) return null;

    const [withdrawal] = await tx
      .insert(withdrawalsTable)
      .values({
        userId: user.id,
        method: option.id,
        amount: amount.toFixed(2),
        destination: parsed.data.destination.trim(),
      })
      .returning();
    await tx.insert(activityTable).values({
      userId: user.id,
      kind: "withdrawal",
      label: `${option.name} cashout requested`,
      amount: (-amount).toFixed(2),
    });
    return withdrawal;
  });

  if (!created) {
    badRequest(res, "Your balance is too low for this cashout");
    return;
  }
  res.status(201).json(CreateWithdrawalResponse.parse(withdrawalDto(created)));
});

router.get("/admin/offerwalls", async (req, res): Promise<void> => {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  const rows = await db.select().from(offerwallsTable);
  const rowByProvider = new Map(rows.map((row) => [row.provider, row]));
  const result = providerCatalog.map((provider) => {
    const row = rowByProvider.get(provider.provider);
    return row
      ? toOfferwallDto(row)
      : {
          provider: provider.provider,
          name: provider.name,
          url: null,
          launchUrl: null,
          online: true,
          badge: provider.badge,
        };
  });
  res.json(GetAdminOfferwallsResponse.parse(result));
});

router.put("/admin/offerwalls", async (req, res): Promise<void> => {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  const params = UpdateOfferwallQueryParams.safeParse(req.query);
  const parsed = UpdateOfferwallBody.safeParse(req.body);
  if (!params.success) {
    badRequest(res, params.error.message);
    return;
  }
  if (!parsed.success) {
    badRequest(res, parsed.error.message);
    return;
  }
  const url = parsed.data.url?.trim() || null;
  if (url && !isValidOfferwallUrl(url)) {
    badRequest(res, "Offerwall URLs must use HTTPS");
    return;
  }

  const [updated] = await db
    .update(offerwallsTable)
    .set({ url, updatedAt: new Date() })
    .where(eq(offerwallsTable.provider, params.data.provider))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Offerwall provider not found" });
    return;
  }
  res.json(UpdateOfferwallResponse.parse(toOfferwallDto(updated)));
});

router.get("/admin/users", async (req, res): Promise<void> => {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  const users = await db
    .select()
    .from(usersTable)
    .orderBy(desc(usersTable.createdAt))
    .limit(200);
  res.json(GetAdminUsersResponse.parse(users.map(userDto)));
});

router.post("/admin/users/:userId/balance", async (req, res): Promise<void> => {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  const params = AdjustUserBalanceParams.safeParse(req.params);
  const parsed = AdjustUserBalanceBody.safeParse(req.body);
  if (!params.success) {
    badRequest(res, params.error.message);
    return;
  }
  if (!parsed.success) {
    badRequest(res, parsed.error.message);
    return;
  }
  if (Math.abs(parsed.data.amount) > 10_000_000) {
    badRequest(res, "Balance adjustment is too large");
    return;
  }
  if (parsed.data.amount === 0) {
    badRequest(res, "Adjustment amount cannot be zero");
    return;
  }

  const updated = await db.transaction(async (tx) => {
    const [target] = await tx
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, params.data.userId))
      .for("update")
      .limit(1);
    if (!target) return null;
    const amount = Math.round(parsed.data.amount * 100) / 100;
    const balance = Number(target.balance) + amount;
    if (balance < 0) return { insufficient: true as const };
    const xp = target.xp + (amount > 0 ? Math.floor(amount) : 0);
    const [saved] = await tx
      .update(usersTable)
      .set({
        balance: balance.toFixed(2),
        xp,
        level: levelForXp(xp),
      })
      .where(eq(usersTable.id, target.id))
      .returning();
    await tx.insert(activityTable).values({
      userId: target.id,
      kind: "adjustment",
      label: `Admin adjustment: ${parsed.data.reason.trim()}`,
      amount: amount.toFixed(2),
    });
    return { user: saved };
  });

  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if ("insufficient" in updated) {
    badRequest(res, "This adjustment would make the balance negative");
    return;
  }
  res.json(AdjustUserBalanceResponse.parse(userDto(updated.user)));
});

router.get("/admin/withdrawals", async (req, res): Promise<void> => {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  const rows = await db
    .select({
      withdrawal: withdrawalsTable,
      username: usersTable.username,
      email: usersTable.email,
    })
    .from(withdrawalsTable)
    .innerJoin(usersTable, eq(withdrawalsTable.userId, usersTable.id))
    .orderBy(
      asc(withdrawalsTable.status),
      desc(withdrawalsTable.createdAt),
    )
    .limit(200);
  res.json(
    GetAdminWithdrawalsResponse.parse(
      rows.map(({ withdrawal, username, email }) => ({
        id: withdrawal.id,
        userId: withdrawal.userId,
        username,
        email,
        method: withdrawal.method,
        amount: Number(withdrawal.amount),
        destination: withdrawal.destination,
        status: withdrawal.status,
        createdAt: withdrawal.createdAt.toISOString(),
        reviewedAt: withdrawal.reviewedAt?.toISOString() ?? null,
      })),
    ),
  );
});

router.patch(
  "/admin/withdrawals/:withdrawalId",
  async (req, res): Promise<void> => {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const params = ReviewWithdrawalParams.safeParse(req.params);
    const parsed = ReviewWithdrawalBody.safeParse(req.body);
    if (!params.success) {
      badRequest(res, params.error.message);
      return;
    }
    if (!parsed.success) {
      badRequest(res, parsed.error.message);
      return;
    }

    const result = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(withdrawalsTable)
        .where(eq(withdrawalsTable.id, params.data.withdrawalId))
        .for("update")
        .limit(1);
      if (!existing) return { kind: "missing" as const };
      if (existing.status !== "pending") return { kind: "reviewed" as const };
      const [saved] = await tx
        .update(withdrawalsTable)
        .set({ status: parsed.data.status, reviewedAt: new Date() })
        .where(eq(withdrawalsTable.id, existing.id))
        .returning();
      if (parsed.data.status === "rejected") {
        await tx
          .update(usersTable)
          .set({
            balance: sql`${usersTable.balance} + ${existing.amount}`,
          })
          .where(eq(usersTable.id, existing.userId));
        await tx.insert(activityTable).values({
          userId: existing.userId,
          kind: "adjustment",
          label: "Cashout refund",
          amount: existing.amount,
        });
      }
      return { kind: "saved" as const, withdrawal: saved };
    });

    if (result.kind === "missing") {
      res.status(404).json({ error: "Withdrawal not found" });
      return;
    }
    if (result.kind === "reviewed") {
      res.status(409).json({ error: "This withdrawal has already been reviewed" });
      return;
    }
    res.json(
      ReviewWithdrawalResponse.parse(withdrawalDto(result.withdrawal)),
    );
  },
);

router.get("/admin/postback", async (req, res): Promise<void> => {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  const secret = await getPostbackSecret();
  const base = `${req.protocol}://${req.get("host")}/api/postback`;
  const template = `${base}?user_id={user_id}&reward={amount}&provider={provider}&tx_id={tx_id}&secret=${secret}`;
  res.json(
    GetPostbackInfoResponse.parse({
      url: template,
      template,
      macroHelp:
        "Use the lowercase provider slug (mooffers, offery, upwall, gimiwall, or revtoo). Replace each brace-wrapped value with the matching offerwall macro. Keep the secret private.",
    }),
  );
});

router.get("/postback", async (req, res): Promise<void> => {
  const parsed = GetPostbackQueryParams.safeParse(req.query);
  if (!parsed.success) {
    badRequest(res, parsed.error.message);
    return;
  }
  const result = await creditPostback(parsed.data);
  if (result.status === 200) {
    res.json(GetPostbackResponse.parse(result.body));
    return;
  }
  res.status(result.status).json(result.body);
});

router.post("/postback", async (req, res): Promise<void> => {
  const parsed = PostPostbackBody.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, parsed.error.message);
    return;
  }
  const result = await creditPostback(parsed.data);
  if (result.status === 200) {
    res.json(PostPostbackResponse.parse(result.body));
    return;
  }
  res.status(result.status).json(result.body);
});

export default router;

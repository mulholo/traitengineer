import { OpenAPIHono } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import type { Services } from "@te/core";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";
import type { Auth } from "./auth/better-auth.ts";
import { mountAuth, mountTestSession } from "./auth/routes.ts";
import type { Env } from "./env.ts";
import { authenticate, requestLogger, requireScopes, writeRateLimit } from "./http/middleware.ts";
import { onError, problem } from "./http/problem.ts";
import { mountMcp, mountWellKnown } from "./mcp/mount.ts";
import type { AppEnv } from "./http/types.ts";
import type { Logger } from "./logger.ts";
import { registerChangeTargetRoutes } from "./routes/change-targets.ts";
import { registerDeviceRoutes } from "./routes/devices.ts";
import { registerEntryRoutes } from "./routes/entries.ts";
import { registerHealthRoute } from "./routes/health.ts";
import { registerMeRoutes } from "./routes/me.ts";
import { registerReminderRoutes } from "./routes/reminders.ts";
import { registerToolRoutes } from "./routes/tools.ts";
import { registerTokenRoutes } from "./routes/tokens.ts";

export interface AppDeps {
  env: Env;
  services: Services;
  auth: Auth;
  logger: Logger;
  checkDb: () => Promise<boolean>;
  now?: () => number;
  nowDate?: () => Date;
}

export const OPENAPI_INFO = {
  title: "Trait Engineer API",
  version: "1.0.0",
  description:
    "Track psychological change targets and log evidence against them. All `/v1` routes need a session cookie, " +
    "a session bearer token, or a personal access token (`Authorization: Bearer te_pat_...`).",
};

/** Reserved by the API; everything else falls through to the web app (M4). */
export const RESERVED_PREFIXES = ["/v1", "/mcp", "/api", "/.well-known", "/health", "/openapi.json", "/docs"];

export function createApp(deps: AppDeps) {
  const { env, services, auth } = deps;
  const app = new OpenAPIHono<AppEnv>({
    defaultHook: (result, c) => {
      if (!result.success) {
        const errors = result.error.issues.map((i) => ({
          path: i.path.map(String).join("."),
          message: i.message,
        }));
        return problem(c, "validation_failed", "Request validation failed", { errors });
      }
      return undefined;
    },
  });

  app.use(requestId({ headerName: "X-Request-Id" }));
  app.use(requestLogger(deps.logger));
  if (env.NODE_ENV === "development") {
    app.use(
      "*",
      cors({ origin: (o) => (/^https?:\/\/localhost(:\d+)?$/.test(o) ? o : null), credentials: true }),
    );
  }
  app.onError(onError);

  // Public
  registerHealthRoute(app, deps.checkDb);
  mountAuth(app, { auth, services, env });
  if (env.NODE_ENV === "test") mountTestSession(app, { auth });
  mountWellKnown(app, { auth });
  mountMcp(app, { auth, services, env, ...(deps.nowDate ? { now: deps.nowDate } : {}) });

  // Authenticated REST API
  app.use(
    "/v1/*",
    authenticate({ auth, services }),
    requireScopes(),
    writeRateLimit({ perMinute: env.WRITE_RATE_LIMIT_PER_MINUTE, ...(deps.now ? { now: deps.now } : {}) }),
  );
  registerChangeTargetRoutes(app, services);
  registerToolRoutes(app, services);
  registerEntryRoutes(app, services);
  registerReminderRoutes(app, services);
  registerDeviceRoutes(app, services);
  registerTokenRoutes(app, services);
  registerMeRoutes(app, services);

  app.openAPIRegistry.registerComponent("securitySchemes", "Bearer", {
    type: "http",
    scheme: "bearer",
    description: "Personal access token (`te_pat_...`) or a session token",
  });
  app.openAPIRegistry.registerComponent("securitySchemes", "Cookie", {
    type: "apiKey",
    in: "cookie",
    name: "better-auth.session_token",
  });
  app.get("/openapi.json", (c) => c.json(buildOpenApiDocument(app)));
  app.get("/docs", Scalar({ url: "/openapi.json", pageTitle: "Trait Engineer API" }));

  app.notFound((c) => problem(c, "not_found", `No route for ${c.req.method} ${c.req.path}`));
  return app;
}

export type App = ReturnType<typeof createApp>;

export function buildOpenApiDocument(app: OpenAPIHono<AppEnv>) {
  return app.getOpenAPI31Document({ openapi: "3.1.0", info: OPENAPI_INFO, servers: [{ url: "/" }] });
}

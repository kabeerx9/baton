import { batonIdentityHooks as hooks } from "../baton-hooks";
import { toProviderError } from "./to-provider-error";
import {
  isSmtpConfigured,
  setBrandNameResolver,
  sendPasswordResetEmail,
} from "@baton/email";
import bcrypt from "bcryptjs";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { bearer, openAPI } from "better-auth/plugins";
import { config } from "dotenv-mono";
import { schema } from "../../database";
import { authDatabaseAdapter } from "./session-locking-adapter";
import {
  emailVerificationContext,
  signUpNeedsVerification,
} from "../../instance-settings/email-verification-gate";
import { getInstanceSettings } from "../../instance-settings/get-instance-settings";
import { lockedSessionRevocation } from "./locked-session-revocation";
import { stripAuthImageWrite } from "../../user/avatar-store/strip-auth-image-write";
import deleteAccountData from "../../user/controllers/delete-account-data";
import { resolveAuthSecret } from "../../utils/auth-secret";
import { checkRegistrationAllowed } from "../../utils/check-registration-allowed";
import { getEmailRequestContext } from "../../utils/email-request-context";
import { getDefaultCookieAttributes } from "../../utils/get-default-cookie-attributes";
import { getGithubSsoOAuthCredentials } from "../../utils/github-sso-env";
import {
  assertNoOAuthSignIn,
  assertOAuthCallbackLinks,
  oauthSignInRefused,
} from "./oauth-sign-in-guard";
import { hasRegisteredUsers } from "../../utils/instance-bootstrap";
import { isCloud } from "../../utils/is-cloud";
import { trackPasswordResetDelivery } from "../../utils/password-reset-delivery";
import { logger } from "../../observability/logger";

config();

setBrandNameResolver(async () => (await getInstanceSettings()).instanceName);

const githubLink = getGithubSsoOAuthCredentials();

const apiUrl = process.env.BATON_API_URL || "http://localhost:1337";
const clientUrl = process.env.BATON_CLIENT_URL || "http://localhost:5173";

const trustedOrigins = [clientUrl];
try {
  const apiOrigin = new URL(apiUrl);
  const apiOriginString = `${apiOrigin.protocol}//${apiOrigin.host}`;
  if (!trustedOrigins.includes(apiOriginString)) {
    trustedOrigins.push(apiOriginString);
  }
} catch {}

const baseURLWithoutPath = (() => {
  try {
    const url = new URL(apiUrl);
    return `${url.protocol}//${url.host}`;
  } catch {
    return apiUrl.split("/").slice(0, 3).join("/"); // Get protocol://host
  }
})();

const authSecret = (() => {
  try {
    return resolveAuthSecret();
  } catch (error) {
    logger.error("Auth secret is not configured", { error });
    process.exit(1);
  }
})();

export const auth = betterAuth({
  baseURL: baseURLWithoutPath,
  trustedOrigins,
  secret: authSecret,
  basePath: "/api/auth",
  database: authDatabaseAdapter({
    provider: "pg",
    schema: {
      ...schema,
      user: schema.userTable,
      account: schema.accountTable,
      session: schema.sessionTable,
      verification: schema.verificationTable,
    },
  }),
  user: {
    additionalFields: {
      emailVerificationRequired: {
        type: "boolean",
        input: false,
        required: false,
        defaultValue: false,
        returned: false,
      },
    },
    deleteUser: {
      enabled: true,
      beforeDelete: async (user) => {
        await deleteAccountData(user.id).catch((error) => {
          throw toProviderError(error);
        });
      },
    },
  },
  account: {
    accountLinking: {
      // A signed-in user links their GitHub account so the GitHub App can
      // verify repository access. The GitHub email may differ from theirs.
      enabled: true,
      allowDifferentEmails: true,
      requireLocalEmailVerified: true,
      // Never attach GitHub to an account by matching email on sign-in.
      disableImplicitLinking: true,
    },
    // `assertOAuthCallbackLinks` reads the state's link intent from the
    // verification table, so keep state there rather than in a cookie.
    storeStateStrategy: "database",
  },
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    revokeSessionsOnPasswordReset: true,
    // A reset means someone else may know the password: disconnect agents too.
    onPasswordReset: async ({ user }) => {
      await hooks.passwordReset(user.id);
    },
    resetPasswordTokenExpiresIn: 60 * 60,
    sendResetPassword: async ({ user, url }, request) => {
      const requestContext = getEmailRequestContext(request?.headers);
      // Keep SMTP latency out of the response so it cannot reveal accounts.
      trackPasswordResetDelivery(
        sendPasswordResetEmail(
          user.email,
          (name) => `Reset your ${name} password`,
          {
            resetLink: url,
            userName: user.name,
            ...requestContext,
          },
        ),
      );
    },
    password: {
      hash: async (password) => {
        return await bcrypt.hash(password, 10);
      },
      verify: async ({ hash, password }) => {
        return await bcrypt.compare(password, hash);
      },
    },
  },
  // GitHub only links an account to a signed-in user (`/link-social`) for
  // repository connections. Sign-in and sign-up with it are refused in the
  // hooks below, so email and password stays the only way to sign in.
  socialProviders:
    githubLink.clientId && githubLink.clientSecret
      ? {
          github: {
            clientId: githubLink.clientId,
            clientSecret: githubLink.clientSecret,
            scope: ["user:email"],
            disableSignUp: true,
          },
        }
      : {},
  plugins: [lockedSessionRevocation, bearer(), openAPI()],
  session: {
    cookieCache: {
      // Consult the session store on every request so password recovery
      // immediately rejects revoked cookies, including caches issued before upgrade.
      enabled: false,
    },
  },
  rateLimit: {
    // On when BATON_CLOUD=true (production); off for local dev and tests.
    // Default better-auth rate-limit only kicks in for production; we keep the
    // global limits conservative and tighten signup via customRules.
    enabled: isCloud(),
    window: 10,
    max: 100,
    customRules: {
      "/sign-up/email": { window: 60, max: 10 },
    },
  },
  databaseHooks: {
    user: {
      delete: {
        after: async (user) => {
          await hooks.userDeleted(user.id);
        },
      },
      update: {
        before: async (user) => {
          // `/update-user` must never set the picture.
          stripAuthImageWrite(user);
        },
      },
      create: {
        before: async (user, ctx) => {
          const decision = await hooks.canSignUp({ email: user.email });
          if (!decision.ok) {
            throw new APIError(
              decision.code === "DISPOSABLE_EMAIL_NOT_ALLOWED"
                ? "BAD_REQUEST"
                : "FORBIDDEN",
              { code: decision.code, message: decision.message },
            );
          }
          // A new account has no picture until it uploads one; ignore any
          // `image` sent with sign-up.
          return {
            data: {
              image: null,
              ...((await signUpNeedsVerification(ctx?.path))
                ? { emailVerificationRequired: true }
                : {}),
            },
          };
        },
        after: async (user) => {
          // Baton writes the instance role; the provider does not know it.
          await hooks.userCreated({
            userId: user.id,
            subject: user.id,
            email: user.email,
            name: user.name,
            emailVerified: user.emailVerified,
          });
        },
      },
    },
    session: {
      create: {
        // An OAuth callback only links an account to a signed-in user; it
        // never starts a session (`assertNoOAuthSignIn`). A deactivated
        // user cannot sign in.
        before: async (session, ctx) => {
          assertNoOAuthSignIn(ctx?.path);
          if (!(await hooks.canSignIn({ userId: session.userId })).allowed) {
            throw new APIError("FORBIDDEN", {
              code: "BANNED_USER",
              message: "This account has been deactivated.",
            });
          }
        },
      },
      delete: {
        // Sign-out, revoking other sessions, password resets and deactivation
        // all end sessions here; close their realtime connections right away.
        after: async (session) => {
          await hooks.sessionsEnded(session.userId, [session.id]);
        },
      },
    },
  },
  hooks: {
    before: createAuthMiddleware(
      async (
        ctx,
      ): Promise<void | Awaited<
        ReturnType<typeof emailVerificationContext>
      >> => {
        if (ctx.path === "/sign-in/social") {
          throw oauthSignInRefused();
        }
        await assertOAuthCallbackLinks(ctx);

        if (ctx.path === "/request-password-reset" && !isSmtpConfigured()) {
          throw new APIError("FORBIDDEN", {
            code: "EMAIL_DELIVERY_NOT_CONFIGURED",
            message: "Password reset requires email delivery to be configured.",
          });
        }

        const verification = await emailVerificationContext(ctx);

        if (ctx.path !== "/sign-up/email") {
          return verification;
        }

        const isInstanceAdminSetup = !(await hasRegisteredUsers());
        const settings = await getInstanceSettings();

        if (!settings.passwordRegistrationEnabled && !isInstanceAdminSetup) {
          throw new APIError("FORBIDDEN", {
            code: "PASSWORD_REGISTRATION_DISABLED",
            message: "Password registration is currently disabled.",
          });
        }

        if (settings.registrationEnabled || isInstanceAdminSetup) {
          return verification;
        }

        const result = await checkRegistrationAllowed();
        if (!result.allowed) {
          throw new APIError("FORBIDDEN", {
            code: "REGISTRATION_NOT_ALLOWED",
            message: result.reason,
          });
        }
        return verification;
      },
    ),
  },
  advanced: {
    ipAddress: {
      // Set only by the Node transport middleware, never accepted from clients.
      ipAddressHeaders: ["x-baton-client-ip"],
      trustedProxies: [],
    },
    defaultCookieAttributes: getDefaultCookieAttributes({
      apiUrl,
      clientUrl,
      cookieDomain: process.env.COOKIE_DOMAIN,
    }),
  },
});

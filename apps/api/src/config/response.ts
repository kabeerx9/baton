import { z } from "../openapi";

export const configSchema = z
  .object({
    isCloud: z.boolean(),
    instanceName: z.string().openapi({
      description: "Name shown in page titles and emails. Defaults to Baton.",
    }),
    disableRegistration: z.boolean(),
    disablePasswordRegistration: z.boolean(),
    disableWorkspaceCreation: z.boolean(),
    disabledIntegrations: z.array(z.string()).openapi({
      description:
        "Integration provider types an administrator turned off, such as `github`.",
    }),
    hasSmtp: z.boolean(),
    hasImageUploads: z.boolean().openapi({
      description:
        "Whether S3-compatible storage is configured, so task images can be uploaded.",
    }),
  })
  .openapi("Config");

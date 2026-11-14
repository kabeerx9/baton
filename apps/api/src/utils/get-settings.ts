import { isSmtpConfigured } from "@baton/email";
import { config } from "dotenv-mono";
import {
  DEFAULT_STORED_SETTINGS,
  type InstanceSettings,
  resolveInstanceSettings,
} from "../instance-settings/resolve-instance-settings";
import { isStorageConfigured } from "../storage/s3";
import { isCloud } from "./is-cloud";

config();

function getSettings(
  instance: InstanceSettings = resolveInstanceSettings(
    DEFAULT_STORED_SETTINGS,
    process.env,
  ),
) {
  return {
    isCloud: isCloud(),
    instanceName: instance.instanceName,
    disableRegistration: !instance.registrationEnabled,
    disablePasswordRegistration: !instance.passwordRegistrationEnabled,
    disableWorkspaceCreation: instance.workspaceCreationRestricted,
    disabledIntegrations: instance.disabledIntegrations,
    hasSmtp: isSmtpConfigured(),
    hasImageUploads: isStorageConfigured(),
  };
}

export default getSettings;

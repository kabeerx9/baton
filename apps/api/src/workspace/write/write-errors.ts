import { ApiError } from "../../errors/api-error";

export const membershipRequiredError = () =>
  new ApiError(403, {
    code: "MEMBERSHIP_REQUIRED",
    message: "Only a member can change this workspace.",
  });

export const ownerRequiredError = () =>
  new ApiError(403, {
    code: "OWNER_REQUIRED",
    message: "Only a workspace owner can do this to an owner.",
  });

export const onlyOwnerError = (message: string) =>
  new ApiError(409, { code: "ONLY_OWNER", message });

export const memberNotFoundError = () =>
  new ApiError(404, { code: "MEMBER_NOT_FOUND", message: "Member not found" });

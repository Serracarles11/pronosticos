import assert from "node:assert/strict";
import test from "node:test";
import {
  PROFILE_AVATAR_MAX_FILE_SIZE,
  profileAvatarStoragePath,
  validateProfileAvatarFile,
} from "../lib/profile-avatar.ts";

test("validates supported profile avatar images", () => {
  assert.equal(validateProfileAvatarFile({ size: 1200, type: "image/jpeg" }).ok, true);
  assert.equal(validateProfileAvatarFile({ size: 1200, type: "image/png" }).ok, true);
  assert.equal(validateProfileAvatarFile({ size: 1200, type: "image/webp" }).ok, true);
});

test("rejects unsupported or oversized profile avatars", () => {
  assert.equal(validateProfileAvatarFile({ size: 1200, type: "image/svg+xml" }).ok, false);
  assert.equal(
    validateProfileAvatarFile({ size: PROFILE_AVATAR_MAX_FILE_SIZE + 1, type: "image/png" }).ok,
    false
  );
});

test("stores profile avatars in the user's own folder", () => {
  assert.equal(profileAvatarStoragePath("user-123"), "user-123/avatar");
});

import { describe, it, expect } from "vitest";
import { newInviteCode, inviteUrl } from "../invites";
import { contactChannels } from "../contact";
import { joinSchema, profileSchema } from "../validation";

describe("invite codes", () => {
  it("are 12 unambiguous characters", () => {
    const code = newInviteCode();
    expect(code).toMatch(/^[2-9a-km-zA-HJ-NP-Z]{12}$/);
  });

  it("don't repeat", () => {
    const codes = new Set(Array.from({ length: 1000 }, newInviteCode));
    expect(codes.size).toBe(1000);
  });

  it("make a /join link", () => {
    expect(inviteUrl("abc")).toMatch(/\/join\/abc$/);
  });
});

describe("asking to join", () => {
  it("is just a profile: a name and a few lines about you, photo optional", () => {
    expect(joinSchema.safeParse({ code: "x", name: "", bio: "Tidy, plays guitar" }).success).toBe(false);
    expect(joinSchema.safeParse({ code: "x", name: "Finn", bio: "" }).success).toBe(false);
    expect(joinSchema.safeParse({ code: null, name: "Finn", bio: "Tidy, plays guitar" }).success).toBe(true);
    expect(joinSchema.safeParse({
      code: "x", name: "Finn", bio: "Tidy", avatarKey: "avatars/0f8fad5b-d9cb-469f-a165-70867728950e.jpg",
    }).success).toBe(true);
    expect(joinSchema.safeParse({ code: "x", name: "Finn", bio: "Tidy", avatarKey: "elsewhere/x.jpg" }).success).toBe(false);
  });
});

describe("profile", () => {
  it("accepts only our own avatar uploads", () => {
    const key = "avatars/0b6e7c1e-3f4a-4c55-9a6d-2b1f0c9e8d7a.jpg";
    expect(profileSchema.safeParse({ avatarKey: key }).success).toBe(true);
    expect(profileSchema.safeParse({ avatarKey: null }).success).toBe(true);
    expect(profileSchema.safeParse({ avatarKey: "https://evil.example/x.jpg" }).success).toBe(false);
    expect(profileSchema.safeParse({ avatarKey: "uploads/0b6e7c1e-3f4a-4c55-9a6d-2b1f0c9e8d7a.jpg" }).success).toBe(false);
  });

  it("caps the description", () => {
    expect(profileSchema.safeParse({ bio: "x".repeat(601) }).success).toBe(false);
  });
});

describe("contact", () => {
  it("is Telegram only", () => {
    expect(contactChannels({ telegramHandle: "@anna_b" })).toEqual([
      { method: "telegram", handle: "@anna_b", url: "https://t.me/anna_b" },
    ]);
    expect(contactChannels({ telegramHandle: null })).toEqual([]);
  });
});

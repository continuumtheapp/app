import { describe, it, expect } from "vitest";
import {
  telegramUserInfo, telegramIdentity, claimsFromStoredIdToken,
  placeholderEmail,
} from "../telegram";

const claims = {
  iss: "https://oauth.telegram.org", sub: "1234123412341234123", id: 987654321,
  name: "Anna B", preferred_username: "anna_b", picture: "https://t.me/i/anna.jpg",
};

/** A JWT-shaped string. Unsigned: these helpers only decode. */
const jwt = (payload: object) =>
  `e30.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.sig`;

describe("user info from Telegram claims", () => {
  it("keys the account on the OIDC subject and maps the profile", () => {
    expect(telegramUserInfo(claims)).toMatchObject({
      id: claims.sub, name: "Anna B", image: claims.picture, emailVerified: false,
    });
  });

  it("gives every user a placeholder email that can never receive mail", () => {
    const email = telegramUserInfo(claims)!.email;
    expect(email).toBe(placeholderEmail(claims.sub));
    expect(email.endsWith(".invalid")).toBe(true);
  });

  it("refuses a token without a subject", () => {
    expect(telegramUserInfo({ name: "No sub" })).toBeNull();
  });
});

describe("identity synced on sign-in", () => {
  it("takes the numeric ID and prefixes the username with @", () => {
    expect(telegramIdentity(claims)).toEqual({ telegramId: 987654321, telegramHandle: "@anna_b" });
  });

  it("clears the handle when the user has no username, so they can't post", () => {
    expect(telegramIdentity({ ...claims, preferred_username: undefined }).telegramHandle).toBeNull();
    expect(telegramIdentity({ ...claims, preferred_username: "  " }).telegramHandle).toBeNull();
  });

  it("doesn't double the @ if Telegram already includes it", () => {
    expect(telegramIdentity({ ...claims, preferred_username: "@anna_b" }).telegramHandle).toBe("@anna_b");
  });

  it("ignores an ID that isn't a usable number", () => {
    expect(telegramIdentity({ ...claims, id: "abc" }).telegramId).toBeNull();
    expect(telegramIdentity({ ...claims, id: undefined }).telegramId).toBeNull();
  });
});

describe("decoding a stored ID token", () => {
  it("reads the claims", () => {
    expect(claimsFromStoredIdToken(jwt(claims))).toMatchObject({ sub: claims.sub, id: 987654321 });
  });

  it("returns null for anything that isn't a token", () => {
    expect(claimsFromStoredIdToken("not-a-token")).toBeNull();
    expect(claimsFromStoredIdToken("a.!!!.b")).toBeNull();
  });
});

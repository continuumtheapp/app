import { describe, it, expect, vi, afterEach } from "vitest";
import { isDevSignInEnabled, testSignInNeedsCode } from "../dev-sign-in";

afterEach(() => vi.unstubAllEnvs());

describe("test sign-in", () => {
  it("is on, without a code, under next dev", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("TEST_SIGN_IN_CODE", "");
    expect(isDevSignInEnabled()).toBe(true);
    expect(testSignInNeedsCode()).toBe(false);
  });

  it("is off on the published site unless a code is set", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TEST_SIGN_IN_CODE", "");
    expect(isDevSignInEnabled()).toBe(false);
  });

  it("needs the code on the published site when it is set", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TEST_SIGN_IN_CODE", "a-long-test-code");
    expect(isDevSignInEnabled()).toBe(true);
    expect(testSignInNeedsCode()).toBe(true);
  });
});

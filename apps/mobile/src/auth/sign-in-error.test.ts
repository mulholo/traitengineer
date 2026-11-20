import { ApiError, authFetch } from "../api/client";
import { INCORRECT_CREDENTIALS, signInErrorMessage } from "./sign-in-error";

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

function respond(body: string, init: ResponseInit) {
  global.fetch = jest.fn(async () => new Response(body, init)) as typeof fetch;
}

describe("sign-in errors", () => {
  it("says the credentials are wrong when the API answers 401", async () => {
    respond(JSON.stringify({ message: "Invalid email or password", code: "INVALID_EMAIL_OR_PASSWORD" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
    const error = await authFetch("/sign-in/email", { body: { email: "a@b.c", password: "x" } }).catch(
      (e) => e,
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(signInErrorMessage(error)).toBe(INCORRECT_CREDENTIALS);
  });

  it("does not blame the password when a 200 comes back that isn't the API (Expo dev server's index.html)", async () => {
    respond("<!DOCTYPE html><html></html>", { status: 200, headers: { "content-type": "text/html" } });
    const error = await authFetch("/sign-in/email", { body: { email: "a@b.c", password: "right" } }).catch(
      (e) => e,
    );
    expect(error).toBeInstanceOf(Error);
    const message = signInErrorMessage(error);
    expect(message).not.toBe(INCORRECT_CREDENTIALS);
    expect(message).toMatch(
      /Expected JSON from .*\/api\/auth\/sign-in\/email but got text\/html \(HTTP 200\)/,
    );
  });

  it("passes rate limiting and network failures through", () => {
    expect(signInErrorMessage(new ApiError(429, undefined))).toBe("Request failed (429)");
    expect(signInErrorMessage(new TypeError("Network request failed"))).toBe("Network request failed");
    expect(signInErrorMessage("??")).toBe("Sign in failed. Please try again.");
  });
});

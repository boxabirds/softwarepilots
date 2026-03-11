import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiError } from "./api-client";

describe("ApiError", () => {
  it("includes status and body in message", () => {
    const err = new ApiError(404, "Not found");
    expect(err.message).toContain("404");
    expect(err.message).toContain("Not found");
    expect(err.status).toBe(404);
    expect(err.body).toBe("Not found");
  });
});

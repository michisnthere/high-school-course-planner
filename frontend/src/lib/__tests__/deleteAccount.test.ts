import { describe, it, expect, beforeEach, vi } from "vitest";

const fetchMock = vi.hoisted(() => vi.fn());

vi.stubGlobal("fetch", fetchMock);

const { deleteAccount } = await import("@/lib/auth");

beforeEach(() => {
  fetchMock.mockReset();
});

describe("deleteAccount", () => {
  it("sends DELETE /auth/account with credentials included", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ deleted: true }),
    });

    await deleteAccount();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/auth/account", {
      method: "DELETE",
      credentials: "include",
    });
  });

  it("returns the parsed success body", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ deleted: true }),
    });

    await expect(deleteAccount()).resolves.toEqual({ deleted: true });
  });

  it("throws the server error message when the request fails", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Failed to delete account" }),
    });

    await expect(deleteAccount()).rejects.toThrow("Failed to delete account");
  });

  it("throws a generic error when the failure body has no message", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({}),
    });

    await expect(deleteAccount()).rejects.toThrow("Failed to delete account");
  });
});

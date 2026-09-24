// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
  cleanup,
} from "@testing-library/react";
import React from "react";
import ProfilePage from "@/app/profile/page";

const authMock = vi.hoisted(() => ({
  useAuth: vi.fn(),
}));
const i18nMock = vi.hoisted(() => ({
  useTranslation: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => authMock);
vi.mock("@/context/I18nContext", () => i18nMock);

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode;
    href: unknown;
  } & Record<string, unknown>) => (
    <a href={typeof href === "string" ? href : "#"} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/context/PreferencesContext", () => ({
  usePreferences: () => ({ resetTutorial: vi.fn() }),
}));

const authenticatedUser = {
  id: 1,
  googleId: "google-1",
  email: "alice@example.com",
  name: "Alice Smith",
  picture: null,
  firstName: "Alice",
  lastName: "Smith",
  preferredName: null,
  grade: "12",
  graduationYear: 2027,
};

function setAuthState(overrides: Record<string, unknown> = {}) {
  authMock.useAuth.mockReturnValue({
    user: authenticatedUser,
    mode: "authenticated",
    loading: false,
    isAuthenticated: true,
    isGuest: false,
    refresh: vi.fn(),
    logout: vi.fn(),
    loginAsGuest: vi.fn(),
    updateProfile: vi.fn(),
    deleteAccount: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  });
}

beforeEach(() => {
  i18nMock.useTranslation.mockReturnValue({
    t: (key: string) => key,
    locale: "en",
    setLocale: vi.fn(),
    availableLocales: ["en"],
  });
});

afterEach(() => {
  cleanup();
});

describe("DeleteAccountSection on the profile page", () => {
  it("renders the delete account section for authenticated users", () => {
    setAuthState();
    render(<ProfilePage />);
    expect(
      screen.getByRole("button", { name: "profile.deleteAccount" })
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "profile.deleteAccount" })
    ).toBeTruthy();
    expect(
      screen.getByText("profile.deleteAccountDescription")
    ).toBeTruthy();
  });

  it("is hidden for guests", () => {
    setAuthState({
      user: null,
      mode: "guest",
      isAuthenticated: false,
      isGuest: true,
    });
    render(<ProfilePage />);
    expect(
      screen.queryByRole("button", { name: "profile.deleteAccount" })
    ).toBeNull();
    // Guest accounts still see the guest-account explanation instead.
    expect(screen.getByText("profile.guestAccountDescription")).toBeTruthy();
  });

  it("is hidden when signed out", () => {
    setAuthState({
      user: null,
      mode: null,
      isAuthenticated: false,
      isGuest: false,
    });
    render(<ProfilePage />);
    expect(
      screen.queryByRole("button", { name: "profile.deleteAccount" })
    ).toBeNull();
    expect(screen.getByText("profile.signInRequired")).toBeTruthy();
  });

  it("opens an accessible confirmation dialog and focuses Cancel", () => {
    setAuthState();
    render(<ProfilePage />);
    fireEvent.click(
      screen.getByRole("button", { name: "profile.deleteAccount" })
    );

    const dialog = screen.getByRole("dialog", {
      name: "profile.deleteAccountConfirmTitle",
    });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-describedby")).toBe(
      "delete-account-description"
    );
    expect(
      within(dialog).getByText("profile.deleteAccountConfirmBody")
    ).toBeTruthy();

    const cancel = within(dialog).getByRole("button", {
      name: "common.cancel",
    });
    expect(document.activeElement).toBe(cancel);
  });

  it("closes without calling deleteAccount when Cancel is clicked", () => {
    const deleteAccount = vi.fn();
    setAuthState({ deleteAccount });
    render(<ProfilePage />);
    fireEvent.click(
      screen.getByRole("button", { name: "profile.deleteAccount" })
    );
    const dialog = screen.getByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "common.cancel" })
    );

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it("closes the dialog on Escape without deleting", () => {
    const deleteAccount = vi.fn();
    setAuthState({ deleteAccount });
    render(<ProfilePage />);
    fireEvent.click(
      screen.getByRole("button", { name: "profile.deleteAccount" })
    );
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it("closes when the backdrop is clicked without deleting", () => {
    const deleteAccount = vi.fn();
    setAuthState({ deleteAccount });
    render(<ProfilePage />);
    fireEvent.click(
      screen.getByRole("button", { name: "profile.deleteAccount" })
    );
    const dialog = screen.getByRole("dialog");
    fireEvent.click(dialog);

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it("calls deleteAccount when the destructive confirm is clicked", async () => {
    const deleteAccount = vi.fn().mockResolvedValue(undefined);
    setAuthState({ deleteAccount });
    render(<ProfilePage />);
    fireEvent.click(
      screen.getByRole("button", { name: "profile.deleteAccount" })
    );
    const dialog = screen.getByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "profile.deleteAccountConfirmButton",
      })
    );

    await waitFor(() => expect(deleteAccount).toHaveBeenCalledTimes(1));
  });

  it("shows an inline error and keeps the dialog open when deletion fails", async () => {
    const deleteAccount = vi
      .fn()
      .mockRejectedValue(new Error("Failed to delete account"));
    setAuthState({ deleteAccount });
    render(<ProfilePage />);
    fireEvent.click(
      screen.getByRole("button", { name: "profile.deleteAccount" })
    );
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "profile.deleteAccountConfirmButton",
      })
    );

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Failed to delete account");
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("locks the confirm and cancel buttons while deletion is in flight", async () => {
    let resolveDelete!: () => void;
    const deleteAccount = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveDelete = resolve;
        })
    );
    setAuthState({ deleteAccount });
    render(<ProfilePage />);
    fireEvent.click(
      screen.getByRole("button", { name: "profile.deleteAccount" })
    );
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "profile.deleteAccountConfirmButton",
      })
    );

    const dialog = await screen.findByRole("dialog");
    const deleting = within(dialog).getByRole("button", {
      name: "profile.deleteAccountDeleting",
    }) as HTMLButtonElement;
    expect(deleting.disabled).toBe(true);
    const cancel = within(dialog).getByRole("button", {
      name: "common.cancel",
    }) as HTMLButtonElement;
    expect(cancel.disabled).toBe(true);

    resolveDelete();
    await waitFor(() => expect(deleteAccount).toHaveBeenCalledTimes(1));
  });
});

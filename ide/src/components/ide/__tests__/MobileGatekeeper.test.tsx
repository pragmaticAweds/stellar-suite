import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MobileGatekeeper } from "../MobileGatekeeper";


// Mock matchMedia
const mockMatchMedia = (isMobile: boolean) => {
  return vi.fn().mockImplementation((query) => ({
    matches: query === "(max-width: 768px)" ? isMobile : !isMobile,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
};

describe("MobileGatekeeper", () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("should not display on desktop viewports", () => {
    // Mock matchMedia for desktop
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: mockMatchMedia(false),
    });

    render(<MobileGatekeeper />);

    const modal = screen.queryByText("Desktop Recommended");
    expect(modal).not.toBeInTheDocument();
  });

  it("should display modal on mobile viewports", async () => {
    // Mock matchMedia for mobile
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: mockMatchMedia(true),
    });

    render(<MobileGatekeeper />);

    // Wait for hydration and modal to appear
    await waitFor(() => {
      const heading = screen.getByText("Desktop Recommended");
      expect(heading).toBeInTheDocument();
    });

    const message = screen.getByText(
      /Stellar Kit Canvas is best experienced on a Desktop environment/
    );
    expect(message).toBeInTheDocument();

    const button = screen.getByRole("button", { name: /Continue Anyway/ });
    expect(button).toBeInTheDocument();
  });

  it("should dismiss warning when 'Continue Anyway' is clicked", async () => {
    // Mock matchMedia for mobile
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: mockMatchMedia(true),
    });

    render(<MobileGatekeeper />);

    // Wait for modal to appear
    await waitFor(() => {
      expect(screen.getByText("Desktop Recommended")).toBeInTheDocument();
    });

    const button = screen.getByRole("button", { name: /Continue Anyway/ });
    fireEvent.click(button);

    // Verify localStorage was set
    expect(localStorage.getItem("mobile-warning-dismissed")).toBe("true");

    // Modal should be hidden after dismissal
    await waitFor(() => {
      expect(screen.queryByText("Desktop Recommended")).not.toBeInTheDocument();
    });
  });

  it("should not display if warning was previously dismissed", async () => {
    // Set dismissal flag
    localStorage.setItem("mobile-warning-dismissed", "true");

    // Mock matchMedia for mobile
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: mockMatchMedia(true),
    });

    render(<MobileGatekeeper />);

    // Wait to ensure hydration happens
    await waitFor(() => {
      const modal = screen.queryByText("Desktop Recommended");
      expect(modal).not.toBeInTheDocument();
    });
  });

  it("should have accessible close button", async () => {
    // Mock matchMedia for mobile
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: mockMatchMedia(true),
    });

    render(<MobileGatekeeper />);

    // Wait for modal to appear
    await waitFor(() => {
      expect(screen.getByText("Desktop Recommended")).toBeInTheDocument();
    });

    // Find close button by aria-label
    const closeButton = screen.getByLabelText("Close warning");
    expect(closeButton).toBeInTheDocument();

    // Click close button
    fireEvent.click(closeButton);

    // Verify dismissal was recorded
    expect(localStorage.getItem("mobile-warning-dismissed")).toBe("true");

    // Modal should be hidden
    await waitFor(() => {
      expect(screen.queryByText("Desktop Recommended")).not.toBeInTheDocument();
    });
  });
});


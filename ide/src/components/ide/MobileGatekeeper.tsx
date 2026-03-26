"use client";

import { useEffect, useState } from "react";
import { AlertCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MobileGatekeeper() {
  const [isMobile, setIsMobile] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    // Hydration: Run only on client
    setIsHydrated(true);

    // Check localStorage for dismissal state
    try {
      const dismissed = localStorage.getItem("mobile-warning-dismissed");
      setIsDismissed(dismissed === "true");
    } catch (error) {
      // localStorage might not be available
      console.debug("localStorage not available:", error);
    }

    // Media query for mobile viewport
    const mediaQuery = window.matchMedia("(max-width: 768px)");

    const handleChange = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
    };

    // Initial check
    setIsMobile(mediaQuery.matches);

    // Add listener for viewport changes
    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  const handleDismiss = () => {
    try {
      localStorage.setItem("mobile-warning-dismissed", "true");
    } catch (error) {
      console.debug("localStorage not available:", error);
    }
    setIsDismissed(true);
  };

  // Don't show until hydrated to avoid hydration mismatch
  if (!isHydrated || !isMobile || isDismissed) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      {/* Modal */}
      <div className="bg-card border border-border rounded-lg shadow-2xl max-w-md w-full p-8">
        {/* Close button */}
        <div className="flex justify-end mb-4">
          <button
            onClick={handleDismiss}
            className="p-2 hover:bg-secondary rounded-md transition-colors"
            aria-label="Close warning"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Icon */}
        <div className="flex justify-center mb-6">
          <AlertCircle className="w-12 h-12 text-warning" />
        </div>

        {/* Content */}
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold text-foreground">
            Desktop Recommended
          </h2>

          <p className="text-muted-foreground text-sm leading-relaxed">
            Stellar Kit Canvas is best experienced on a Desktop environment.
            Please switch devices to continue.
          </p>
        </div>

        {/* Actions */}
        <div className="mt-8 space-y-3">
          <Button
            onClick={handleDismiss}
            className="w-full"
            variant="default"
          >
            Continue Anyway
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            You can dismiss this warning at any time
          </p>
        </div>
      </div>
    </div>
  );
}

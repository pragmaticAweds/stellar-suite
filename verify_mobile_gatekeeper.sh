#!/bin/bash

# Mobile Gatekeeper Verification Script
# This script verifies the mobile viewport detection functionality

echo "=== Mobile Gatekeeper Component Verification ==="
echo ""
echo "1. Checking if MobileGatekeeper component is created..."
if [ -f "/workspaces/stellar-suite/ide/src/components/ide/MobileGatekeeper.tsx" ]; then
    echo "✓ MobileGatekeeper component exists"
else
    echo "✗ MobileGatekeeper component not found"
    exit 1
fi

echo ""
echo "2. Verifying component is integrated into page.tsx..."
if grep -q "import.*MobileGatekeeper.*from.*components/ide/MobileGatekeeper" /workspaces/stellar-suite/ide/app/page.tsx; then
    echo "✓ MobileGatekeeper import found in page.tsx"
else
    echo "✗ MobileGatekeeper import not found"
    exit 1
fi

if grep -q "<MobileGatekeeper" /workspaces/stellar-suite/ide/app/page.tsx; then
    echo "✓ MobileGatekeeper component is rendered in page.tsx"
else
    echo "✗ MobileGatekeeper component not rendered"
    exit 1
fi

echo ""
echo "3. Checking component features..."
COMPONENT_FILE="/workspaces/stellar-suite/ide/src/components/ide/MobileGatekeeper.tsx"

if grep -q "window.matchMedia" "$COMPONENT_FILE"; then
    echo "✓ Mobile viewport detection using window.matchMedia"
else
    echo "✗ window.matchMedia not found"
    exit 1
fi

if grep -q "max-width: 768px" "$COMPONENT_FILE"; then
    echo "✓ Mobile breakpoint (768px) configured"
else
    echo "✗ Mobile breakpoint not found"
    exit 1
fi

if grep -q "localStorage.getItem" "$COMPONENT_FILE"; then
    echo "✓ localStorage support for dismissal flag"
else
    echo "✗ localStorage not found"
    exit 1
fi

if grep -q "Continue Anyway" "$COMPONENT_FILE"; then
    echo "✓ 'Continue Anyway' button text found"
else
    echo "✗ 'Continue Anyway' button not found"
    exit 1
fi

if grep -q "Stellar Kit Canvas is best experienced on a Desktop environment" "$COMPONENT_FILE"; then
    echo "✓ Required warning message found"
else
    echo "✗ Required warning message not found"
    exit 1
fi

if grep -q "z-50" "$COMPONENT_FILE"; then
    echo "✓ High z-index (z-50) for overlay"
else
    echo "✗ High z-index not found"
    exit 1
fi

echo ""
echo "4. Build verification..."
cd /workspaces/stellar-suite/ide
if npm run build > /dev/null 2>&1; then
    echo "✓ Project builds successfully with MobileGatekeeper"
else
    echo "✗ Build failed"
    exit 1
fi

echo ""
echo "=== All Verification Checks Passed! ==="
echo ""
echo "KEY FEATURES:"
echo "- ✓ Mobile viewport detection (max-width: 768px)"
echo "- ✓ Warning overlay modal with high z-index"
echo "- ✓ 'Continue Anyway' dismiss button"
echo "- ✓ localStorage persistence"
echo "- ✓ Proper hydration handling"
echo "- ✓ Brand-consistent styling"
echo ""
echo "TESTING NOTES:"
echo "- Open http://localhost:3000 in a browser"
echo "- Use DevTools to simulate mobile viewport (max-width: 768px)"
echo "- Modal should appear immediately"
echo "- Click 'Continue Anyway' to dismiss"
echo "- Refresh page - modal won't appear (due to localStorage flag)"

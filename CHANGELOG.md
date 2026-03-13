# Changelog

All notable changes to the **Kit Studio** extension will be documented in this file.

## [0.1.4] - 2026-03-13

### Added
- **Live Transaction IDs:** Run Tx now captures the real world Transaction ID from the blockchain and provides a direct link to view it on Stellar Expert 
- **Unified Brand Experience:** Updated all webview panels (Simulation Result, Contract Info and Sidebar) to match the Stellar Kit ecosystem branding

### Changed
- **Dynamic Result Panels**
- **Improved Real-time Feedback**

## [0.1.3] - 2026-03-12

### Added
- **Performance Optimization:** Successfully bundled the extension into a single file, resulting in faster load times and a much smaller package.

### Changed
- **Smart Function Selection:** You don't have to manually type function names anymore we now fetch the contract interface directly from the network, so you just pick the function you want to run or simulate
- **Improved Argument Prompting:** After you pick a function we'll walk you through each parameter it needs showing you exactly what types it expects (like Symbols, Addresses or Vecs)
- **Network Passphrase Support:** Added a "Network Passphrase" setting to fix RPC connection errors. Everything (Simulate, Run, Info) now works smoothly with custom RPC endpoints
- **Cleaner Sidebar UI:** We decluttered the sidebar by removing the bulky functions list. All functions are now tucked into the "Simulate" and "Run" dropdowns. We also polished the layout with left-aligned buttons for a more professional feel
- **Copy-to-Clipboard:** Click any Contract ID to copy it instantly. No more emojis—just a clean, functional UI

### Fixed
- **Contract Optimization:** The "Optimize" button targets the right contract now.
- **Deployment History:** The "Clear" button in deployments is working again, including a helpful confirmation modal so you don't delete history by accident

## [0.1.0] - 2026-03-09

### Changed
- **Rebranding:** Logo, theme system updated and backward compatibility maintained and extension renamed to Kit Studio while Stellar Kit remains the distributor
[ext name was updated to stellar-kit-studio so version is reset to 0.1.0]

## [0.1.2] - 2026-03-02

### Changed
- **Product rename:** Stellar Suite is now **Stellar Kit**. The extension is published on the VS Code Marketplace as `0xVida.stellar-kit-studio`. User-facing names, docs, and marketing have been updated to Stellar Kit; repo name and config keys (e.g. `stellarSuite.*`, `stellar-suite.templates.json`) stay the same for compatibility. MVP screenshots and some assets may still show "Stellar Suite" in the UI — they refer to this same product.

## [0.1.0] - 2026-02-23

### Added
- Initial MVP release.
- One-click contract build and deployment.
- Interactive Sidebar for contract management.
- Soroban transaction simulation with resource profiling.
- Support for multiple signing methods (Interactive, File, Secure Storage, External).
- Enhanced CLI error guidance.
- Contract template detection and classification.
- RPC configuration management with fallback support.
- API Documentation generation via TypeDoc.
- GitHub Actions workflow for automated documentation deployment.

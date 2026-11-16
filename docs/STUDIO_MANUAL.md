# KubeSmith Web Studio Manual

A guide to the interactive dark-mode Web Studio on port 5454.

---

### Features
1. **Bento Grid Overview**: Live circular SVG health meter displaying overall compliance rating (A+, A, B, C, F), total resources count, container count, and routing status.
2. **Split Source & Diagnostic Viewer**: Line-numbered manifest display with color-coded warning/critical lines and inline diagnostic cards.
3. **Interactive Topology Visualizer**: Graphical rendering of Ingress, Service, and Deployment nodes with orphaned service indicators.
4. **Side-by-Side Auto-Hardening Diff**: Compare your existing manifest with the hardened version and click `Save to Disk` to apply patches instantly.
5. **Keyboard Shortcuts**:
   - `/`: Focus search input
   - `1-4`: Switch tabs
   - `H`: 1-Click Auto-Harden
   - `R`: Refresh scan

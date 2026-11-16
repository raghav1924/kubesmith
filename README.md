# KubeSmith

> Developer-First Kubernetes Manifest Linter, Pod Security Standards (PSS) Auditor, Resource Limits Analyzer & Visual Architecture Studio.

Built with pure TypeScript and Node.js standard libraries. Zero external npm dependencies.

Developed by [Jatin Sharma](https://jatinsh.netlify.app/) ([@raghav1924](https://github.com/raghav1924)).

---

## Overview

Kubernetes deployments regularly suffer from silent configuration issues:
- **Pod Security Standards (PSS) Breaches**: Containers executing as root (UID 0), privileged mode, or with broad Linux capabilities expose cluster worker nodes to breakout hazards.
- **Resource Starvation & OOMKilled Crashes**: Omitting CPU and memory limits causes noisy neighbors, scheduling failures, and memory eviction cascades.
- **Missing Healthcheck Probes**: Workloads lacking liveness and readiness probes receive user traffic before warm-up and cannot recover automatically from application deadlocks.
- **Service Disconnects**: Selector label mismatches (`selector.app`) between Services and Deployments cause silent `503 Service Unavailable` routing blackholes.

**KubeSmith** resolves these risks with static YAML analysis, automated one-click hardening, multi-resource routing topology mapping, and an embedded dark-mode Web Studio on port `5454`.

---

## Features

- **14+ Pod Security Standards & Reliability Audits**:
  - `SEC-001`: Privileged container execution auditing (`securityContext.privileged: true`)
  - `SEC-002`: Non-root user execution enforcement (`runAsNonRoot: true`)
  - `SEC-003`: Linux capabilities dropped (`capabilities.drop: ["ALL"]`)
  - `SEC-004`: Host namespace sharing detection (`hostNetwork`, `hostPID`, `hostIPC`)
  - `SEC-005`: Read-only root filesystem verification (`readOnlyRootFilesystem: true`)
  - `REL-001`: CPU and memory limits inspection (OOMKilled prevention)
  - `REL-002`: CPU and memory requests validation (Deterministic scheduling)
  - `REL-003`: Liveness probe presence verification
  - `REL-004`: Readiness probe presence verification
  - `REL-005`: Floating / mutable image tag auditing (`:latest`)
  - `NET-001`: Disconnected service selector detection
  - `NET-002`: Plaintext ingress missing TLS secret auditing
  - `CFG-001`: Default namespace isolation audit
- **Automated Manifest Hardener (`kubesmith fix`)**: Automatically injects restricted PSS securityContext, default resource limits, and healthcheck probes into workload specs.
- **Resource Routing Topology**: Discovers relationships across Ingresses, Services, Deployments, and Pods, highlighting orphaned or disconnected services with Mermaid flowchart syntax.
- **Embedded Web Studio**: Zero-dependency local dashboard on port `5454` incorporating Bento Grid (Pattern #12), Dark Mode UI (Pattern #20), and Cybercore (Pattern #24) with interactive SVG health gauge, source split view with line diagnostics, topology viewer, and side-by-side diff.
- **CI / CD Quality Gates**: Configurable exit codes (`--min-score`, `--fail-on-sec`, `--json`).
- **High Performance**: Sub-50ms audit throughput on complex multi-resource manifests.

---

## Installation & Quick Start

```bash
# Clone the repository
git clone https://github.com/raghav1924/kubesmith.git
cd kubesmith

# Compile TypeScript
npm run build

# Run unit test suite
npm test
```

---

## CLI Usage

```bash
# Audit all Kubernetes manifests in a directory
node dist/bin.js audit ./k8s

# Enforce strict CI quality gates
node dist/bin.js audit ./manifests --min-score=85 --fail-on-sec

# Inspect multi-resource routing topology
node dist/bin.js topology ./examples

# Automatically patch and harden manifests
node dist/bin.js fix examples/vulnerable-deployment.yaml

# Launch interactive Web Studio
node dist/bin.js studio --port=5454
```

---

## Programmatic API

```typescript
import { KubeYamlParser, KubeAuditor, KubeHardener, KubeTopology } from 'kubesmith';

const manifest = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-api
  namespace: prod
spec:
  template:
    spec:
      containers:
      - name: api
        image: api:v1.0.0
`;

// Parse
const resources = KubeYamlParser.parse(manifest);

// Audit
const report = KubeAuditor.audit(resources);
console.log(`Score: ${report.score}% [Grade ${report.grade}]`);

// Topology
const topology = KubeTopology.build(resources);
console.log(topology.mermaid);

// Auto-harden
const result = KubeHardener.harden(manifest);
console.log(result.hardenedYaml);
```

---

## Author

**Jatin Sharma**
- Portfolio: [https://jatinsh.netlify.app/](https://jatinsh.netlify.app/)
- GitHub: [@raghav1924](https://github.com/raghav1924)
- Email: raghavjatin245@gmail.com

---

## License

MIT License. See [LICENSE](LICENSE) for details.

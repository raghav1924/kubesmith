# Product Brief — KubeSmith (`kubesmith`)

## Executive Summary
**KubeSmith** is a developer-first Kubernetes manifest linter, Pod Security Standards (PSS) auditor, resource quota analyzer, and visual architecture topology studio built with zero external npm dependencies using pure TypeScript and Node.js standard libraries.

It enables cloud-native engineers and platform teams to catch Kubernetes misconfigurations—such as privileged containers, root execution, missing probes, OOMKilled risks from unbounded memory, and silent service selector mismatches—before deploying to staging or production clusters.

---

## The Problem
Kubernetes manifests are notoriously difficult to audit statically without spinning up full clusters or installing heavyweight tooling:
1. **Security Vulnerabilities (Pod Security Standards breaches)**:
   - Containers running as root (`UID 0`) or privileged mode can escape container isolation to compromise host nodes.
   - Excessive Linux capabilities (`NET_ADMIN`, `SYS_ADMIN`) retained instead of `ALL` dropped.
   - Writable root filesystems allowing persistent malware payloads.
2. **Reliability & Availability Landmines**:
   - Omitting `resources.requests` and `resources.limits` causes noisy neighbors, CPU starvation, and sudden Kubernetes `OOMKilled` eviction cascades.
   - Missing `livenessProbe` and `readinessProbe` routes traffic into unready containers and fails to recover frozen workloads.
   - Mutable floating image tags (`image: myapp:latest`) introduce silent supply-chain and version drift bugs.
3. **Network & Service Disconnects**:
   - `Service` selector labels (`selector.app`) frequently mismatch `Deployment` pod labels (`spec.template.metadata.labels.app`), resulting in silent `503 Service Unavailable` routing failures.
   - Ingress rules missing TLS declarations expose plain HTTP endpoints.

---

## The Solution: KubeSmith
- **Zero-Dependency Multi-Document YAML Parser**: Custom lexer capable of parsing single and multi-document (`---`) Kubernetes manifests into typed AST representations.
- **14+ Production Heuristics**:
  - `SEC-001`: Privileged Container Flag (`securityContext.privileged: true`)
  - `SEC-002`: Root User Execution (`runAsNonRoot: false` or missing)
  - `SEC-003`: Linux Capabilities Dropping (`capabilities.drop: ["ALL"]`)
  - `SEC-004`: Host Namespace Sharing (`hostNetwork`, `hostPID`, `hostIPC`)
  - `SEC-005`: Writable Root Filesystem (`readOnlyRootFilesystem: false`)
  - `REL-001`: Missing CPU/Memory Limits (OOMKilled Risk)
  - `REL-002`: Missing Liveness / Readiness Probes
  - `REL-003`: Floating / Mutable Base Image Tag (`:latest`)
  - `NET-001`: Disconnected Service Selector (No matching pods found)
  - `NET-002`: Plaintext Ingress Missing TLS Secret
  - `CFG-001`: Missing Resource Namespace Specification
- **Topological Resource Graph**: Maps `Ingress` ➔ `Service` ➔ `Deployment` ➔ `ConfigMap`/`Secret` relationships into a visual topology DAG with Mermaid.js diagram synthesis.
- **Automated Manifest Hardener (`kubesmith fix`)**: Automatically injects restricted PSS securityContext (`runAsNonRoot: true`, `drop: ["ALL"]`, `readOnlyRootFilesystem: true`), baseline resource limits, and healthcheck probe scaffolding.
- **Interactive Dark Mode Web Studio**: Embedded local dashboard on port `5454` incorporating Bento Grid (Pattern #12), Dark Mode UI (Pattern #20), and Cybercore (Pattern #24) with interactive SVG health gauge, source split view with line diagnostics, topology viewer, and side-by-side diff.

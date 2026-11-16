# Kubernetes Pod Security Standards (PSS) Guide

A practical guide for implementing Kubernetes Restricted Pod Security Standards across microservices.

---

### 1. Non-Root Execution Enforcement
Running containers as root (UID 0) gives an attacker the ability to interact with host node devices if container isolation breaks.

**Best Practice:**
```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 10001
  allowPrivilegeEscalation: false
```

---

### 2. Dropping Linux Capabilities
Default Docker runtimes grant several unnecessary Linux capabilities. The restricted PSS profile mandates dropping `ALL` capabilities and re-adding only explicitly required privileges.

**Best Practice:**
```yaml
securityContext:
  capabilities:
    drop:
    - ALL
```

---

### 3. Read-Only Root Filesystem
Prevent attackers from installing rootkits, modifying configuration files, or persisting malware inside container layers.

**Best Practice:**
```yaml
securityContext:
  readOnlyRootFilesystem: true
```
Mount ephemeral `emptyDir` volumes to specific writable directories like `/tmp` or cache folders.

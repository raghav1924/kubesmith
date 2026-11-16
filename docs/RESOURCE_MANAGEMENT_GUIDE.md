# Kubernetes Resource Limits & OOMKilled Prevention

Resource configuration guidelines to prevent cluster-wide noisy neighbor issues and sudden pod terminations.

---

### 1. The Risk of Unbounded Memory
When a container exceeds the memory limits of its host node without an explicit container memory limit, the Linux kernel Out-Of-Memory (OOM) killer arbitrarily kills processes, often terminating critical system services.

**Best Practice:**
Always specify `resources.limits.memory` and `resources.requests.memory`:
```yaml
resources:
  limits:
    cpu: "500m"
    memory: "512Mi"
  requests:
    cpu: "100m"
    memory: "128Mi"
```

---

### 2. Sizing Requests for Reliable Scheduling
The Kubernetes kube-scheduler places pods onto nodes based strictly on `resources.requests`. If requests are omitted or set to zero, pods are scheduled onto already saturated nodes.

# Service Mesh & Routing Topology Guide

How KubeSmith discovers and validates traffic routing paths from Ingresses through Services to Pods.

---

### 1. Service Selector Validation
A Kubernetes `Service` directs traffic to pods via label matching:
```yaml
# Service
spec:
  selector:
    app: order-api

# Deployment Pod Template
spec:
  template:
    metadata:
      labels:
        app: order-api
```
If the selector keys or values mismatch by even a single character, the service endpoints list remains empty (`<none>`), silently dropping all user requests with `503 Service Unavailable`.

KubeSmith maps every `Service` against all discovered `Deployment` and `Pod` specs, immediately alerting you if a service has zero backing pods.

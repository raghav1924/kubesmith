# Service Account Token Automount & RBAC Security

By default, Kubernetes mounts a service account JWT token into every container under `/var/run/secrets/kubernetes.io/serviceaccount`.
If an application does not need to communicate with the Kubernetes API server, automounting should be disabled:
```yaml
spec:
  automountServiceAccountToken: false
```

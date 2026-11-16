# GitOps CI Validation for ArgoCD & Flux

Integrate KubeSmith into pull request checks before GitOps sync:
```yaml
- name: Validate Kubernetes Manifests
  run: kubesmith audit ./manifests --min-score=90 --fail-on-sec
```
Prevents deploying workloads that violate cluster Pod Security Admission controllers.

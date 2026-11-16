# Linting Helm Charts with KubeSmith

Audit rendered Helm templates before deploying with Helm or ArgoCD:
```bash
helm template my-release ./charts/my-app | kubesmith audit - --fail-on-sec
```
Catches unconstrained container templates and missing Pod Security Standards before cluster submission.

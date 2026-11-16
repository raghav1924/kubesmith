# Kustomize Overlay Auditing

Validate merged Kustomize overlays in CI:
```bash
kustomize build overlays/production | kubesmith audit - --min-score=90
```
Verifies that environment patches retain required resource limits and security contexts.

# KubeSmith CLI Cheatsheet

```bash
# Audit all Kubernetes manifests in directory
kubesmith audit ./k8s

# Enforce strict CI quality gates
kubesmith audit ./manifests --min-score=85 --fail-on-sec

# Visualize Service & Workload routing topology
kubesmith topology ./k8s

# Automatically harden manifests with Restricted PSS
kubesmith fix deployment.yaml

# Launch Web Studio
kubesmith studio --port 5454
```

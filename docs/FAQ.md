# KubeSmith FAQ

### Does KubeSmith require a live Kubernetes cluster or kubectl?
No. KubeSmith executes purely as a static analysis engine with zero external dependencies and zero network requirements.

### Can it detect service selector mismatches?
Yes. The built-in topology engine maps every `Service.spec.selector` against `Deployment.spec.template.metadata.labels` to detect disconnected routing paths.

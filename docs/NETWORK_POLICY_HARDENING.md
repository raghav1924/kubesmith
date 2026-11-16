# Kubernetes NetworkPolicy Isolation

By default, all pods in a Kubernetes cluster can communicate with all other pods across all namespaces:
- Enforce default-deny ingress and egress NetworkPolicies in production namespaces.
- Allow traffic only from explicitly labeled ingress controllers and microservice dependencies.

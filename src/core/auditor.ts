import path from 'node:path';
import { AuditFinding, KubeAuditReport, KubeResource } from './types.js';
import { KubeTopology } from './topology.js';
import { KubeYamlParser } from './parser.js';

export class KubeAuditor {
  /**
   * Run comprehensive Pod Security Standards and reliability audit on Kubernetes resources.
   */
  public static audit(resourcesOrYaml: KubeResource[] | string, filePath = 'manifest.yaml'): KubeAuditReport {
    const resources: KubeResource[] = typeof resourcesOrYaml === 'string'
      ? KubeYamlParser.parse(resourcesOrYaml, filePath)
      : resourcesOrYaml;

    const findings: AuditFinding[] = [];
    const topology = KubeTopology.build(resources);

    let totalContainers = 0;

    for (const res of resources) {
      const isWorkload = ['Deployment', 'StatefulSet', 'DaemonSet', 'Job', 'CronJob', 'Pod'].includes(res.kind);

      // CFG-001: Default Namespace Usage
      if (res.namespace === 'default' && res.kind !== 'Namespace') {
        findings.push({
          id: 'CFG-001',
          ruleId: 'CFG-001',
          title: 'Workload Placed in Default Namespace',
          category: 'HYGIENE',
          severity: 'LOW',
          resourceKind: res.kind,
          resourceName: res.name,
          line: res.line,
          message: `Resource '${res.name}' is defined in the 'default' namespace. Workloads should be isolated in dedicated namespaces with RBAC and NetworkPolicies.`,
          remediation: `Set metadata.namespace to a dedicated project namespace (e.g. metadata.namespace: production).`,
          autoFixSnippet: 'metadata:\n  namespace: production',
        });
      }

      if (isWorkload) {
        // SEC-004: Host Namespace Sharing
        if (res.hostNetwork || res.hostPID || res.hostIPC) {
          findings.push({
            id: 'SEC-004',
            ruleId: 'SEC-004',
            title: 'Host Namespace Sharing Enabled (hostNetwork / hostPID / hostIPC)',
            category: 'SECURITY',
            severity: 'CRITICAL',
            resourceKind: res.kind,
            resourceName: res.name,
            line: res.line,
            message: `Workload '${res.name}' enables hostNetwork, hostPID, or hostIPC. Containers can snoop on host processes, bind to host ports, and bypass network policy isolation.`,
            remediation: `Set hostNetwork: false, hostPID: false, and hostIPC: false in pod spec.`,
            autoFixSnippet: 'spec:\n  hostNetwork: false\n  hostPID: false\n  hostIPC: false',
          });
        }

        for (const c of res.containers) {
          totalContainers++;

          // SEC-001: Privileged Container Execution
          if (c.privileged) {
            findings.push({
              id: 'SEC-001',
              ruleId: 'SEC-001',
              title: `Privileged Container Execution in '${c.name}'`,
              category: 'SECURITY',
              severity: 'CRITICAL',
              resourceKind: res.kind,
              resourceName: res.name,
              line: c.line,
              message: `Container '${c.name}' runs with securityContext.privileged: true. An attacker inside the container has root access to all host kernel devices.`,
              remediation: `Remove privileged: true or set securityContext.privileged: false.`,
              autoFixSnippet: 'securityContext:\n  privileged: false',
            });
          }

          // SEC-002: Container Runs as Root
          if (c.runAsNonRoot === false || c.runAsUser === 0 || (c.runAsNonRoot === undefined && c.runAsUser === undefined)) {
            findings.push({
              id: 'SEC-002',
              ruleId: 'SEC-002',
              title: `Container '${c.name}' Allowed to Run as Root (UID 0)`,
              category: 'SECURITY',
              severity: 'CRITICAL',
              resourceKind: res.kind,
              resourceName: res.name,
              line: c.line,
              message: `Container '${c.name}' does not enforce runAsNonRoot: true. If breached, the process executes with root privileges inside the container.`,
              remediation: `Set securityContext.runAsNonRoot: true and define an unprivileged runAsUser (e.g. 10001).`,
              autoFixSnippet: 'securityContext:\n  runAsNonRoot: true\n  runAsUser: 10001',
            });
          }

          // SEC-003: Linux Capabilities Not Dropped
          const hasDroppedAll = c.capabilitiesDrop && c.capabilitiesDrop.some(cap => cap.toUpperCase() === 'ALL');
          if (!hasDroppedAll) {
            findings.push({
              id: 'SEC-003',
              ruleId: 'SEC-003',
              title: `Linux Capabilities Not Dropped in '${c.name}'`,
              category: 'SECURITY',
              severity: 'HIGH',
              resourceKind: res.kind,
              resourceName: res.name,
              line: c.line,
              message: `Container '${c.name}' does not drop all Linux capabilities. Pod Security Standards (Restricted) requires dropping ALL capabilities.`,
              remediation: `Configure securityContext.capabilities.drop: ["ALL"].`,
              autoFixSnippet: 'securityContext:\n  capabilities:\n    drop: ["ALL"]',
            });
          }

          // SEC-005: Writable Root Filesystem
          if (!c.readOnlyRootFilesystem) {
            findings.push({
              id: 'SEC-005',
              ruleId: 'SEC-005',
              title: `Root Filesystem is Writable in '${c.name}'`,
              category: 'SECURITY',
              severity: 'MEDIUM',
              resourceKind: res.kind,
              resourceName: res.name,
              line: c.line,
              message: `Container '${c.name}' does not configure readOnlyRootFilesystem: true. Malware or compromised processes can write malicious executables directly to the filesystem.`,
              remediation: `Set securityContext.readOnlyRootFilesystem: true and mount emptyDir volumes for writable directories (/tmp).`,
              autoFixSnippet: 'securityContext:\n  readOnlyRootFilesystem: true',
            });
          }

          // REL-001: Missing Memory / CPU Limits
          if (!c.hasMemoryLimit || !c.hasCpuLimit) {
            const missing = [];
            if (!c.hasMemoryLimit) missing.push('memory');
            if (!c.hasCpuLimit) missing.push('cpu');
            findings.push({
              id: 'REL-001',
              ruleId: 'REL-001',
              title: `Missing Resource Limits (${missing.join(', ')}) in '${c.name}'`,
              category: 'RELIABILITY',
              severity: 'HIGH',
              resourceKind: res.kind,
              resourceName: res.name,
              line: c.line,
              message: `Container '${c.name}' is missing ${missing.join(' and ')} limits. Unbounded memory causes silent OOMKilled crashes and node-wide resource starvation.`,
              remediation: `Define resources.limits for cpu (e.g. 500m) and memory (e.g. 512Mi).`,
              autoFixSnippet: 'resources:\n  limits:\n    cpu: "500m"\n    memory: "512Mi"',
            });
          }

          // REL-002: Missing Resource Requests
          if (!c.hasMemoryRequest || !c.hasCpuRequest) {
            const missing = [];
            if (!c.hasMemoryRequest) missing.push('memory');
            if (!c.hasCpuRequest) missing.push('cpu');
            findings.push({
              id: 'REL-002',
              ruleId: 'REL-002',
              title: `Missing Resource Requests (${missing.join(', ')}) in '${c.name}'`,
              category: 'RELIABILITY',
              severity: 'MEDIUM',
              resourceKind: res.kind,
              resourceName: res.name,
              line: c.line,
              message: `Container '${c.name}' is missing ${missing.join(' and ')} requests. The Kubernetes scheduler cannot place pods deterministically without requests.`,
              remediation: `Define resources.requests for cpu (e.g. 100m) and memory (e.g. 128Mi).`,
              autoFixSnippet: 'resources:\n  requests:\n    cpu: "100m"\n    memory: "128Mi"',
            });
          }

          // REL-003: Missing Liveness Probe
          if (!c.hasLivenessProbe && res.kind !== 'Job' && res.kind !== 'CronJob') {
            findings.push({
              id: 'REL-003',
              ruleId: 'REL-003',
              title: `Missing Liveness Probe in '${c.name}'`,
              category: 'RELIABILITY',
              severity: 'MEDIUM',
              resourceKind: res.kind,
              resourceName: res.name,
              line: c.line,
              message: `Container '${c.name}' does not configure a livenessProbe. Kubernetes cannot detect deadlocks or automatically restart frozen processes.`,
              remediation: `Add a livenessProbe (e.g. httpGet /health or tcpSocket).`,
              autoFixSnippet: 'livenessProbe:\n  httpGet:\n    path: /health\n    port: 8080\n  initialDelaySeconds: 15',
            });
          }

          // REL-004: Missing Readiness Probe
          if (!c.hasReadinessProbe && res.kind !== 'Job' && res.kind !== 'CronJob') {
            findings.push({
              id: 'REL-004',
              ruleId: 'REL-004',
              title: `Missing Readiness Probe in '${c.name}'`,
              category: 'RELIABILITY',
              severity: 'MEDIUM',
              resourceKind: res.kind,
              resourceName: res.name,
              line: c.line,
              message: `Container '${c.name}' does not configure a readinessProbe. Kubernetes will route client traffic to the pod before it finishes warming up.`,
              remediation: `Add a readinessProbe (e.g. httpGet /ready).`,
              autoFixSnippet: 'readinessProbe:\n  httpGet:\n    path: /ready\n    port: 8080\n  initialDelaySeconds: 5',
            });
          }

          // REL-005: Floating / Mutable Base Image Tag
          if (c.image.endsWith(':latest') || (!c.image.includes(':') && !c.image.includes('@sha256:'))) {
            findings.push({
              id: 'REL-005',
              ruleId: 'REL-005',
              title: `Floating / Mutable Image Tag in '${c.name}' (${c.image})`,
              category: 'RELIABILITY',
              severity: 'HIGH',
              resourceKind: res.kind,
              resourceName: res.name,
              line: c.line,
              message: `Container '${c.name}' uses floating tag ':latest'. Production builds should pin immutable semantic version tags or sha256 digests.`,
              remediation: `Pin image to specific version (e.g. image: app:v1.4.2 or app@sha256:...).`,
            });
          }
        }
      }

      // NET-001: Disconnected Service Selector
      if (res.kind === 'Service' && topology.unconnectedServices.includes(res.name)) {
        findings.push({
          id: 'NET-001',
          ruleId: 'NET-001',
          title: `Disconnected Service Selector in '${res.name}'`,
          category: 'NETWORKING',
          severity: 'HIGH',
          resourceKind: res.kind,
          resourceName: res.name,
          line: res.line,
          message: `Service '${res.name}' has selector labels (${JSON.stringify(res.serviceSelector)}) that match ZERO workloads in the manifests. Traffic routed to this service will fail with 503 Service Unavailable.`,
          remediation: `Align Service spec.selector with target Deployment spec.template.metadata.labels.`,
        });
      }

      // NET-002: Plaintext Ingress Missing TLS Secret
      if (res.kind === 'Ingress' && !res.rawYaml.includes('tls:')) {
        findings.push({
          id: 'NET-002',
          ruleId: 'NET-002',
          title: `Ingress '${res.name}' Exposes Plaintext HTTP Without TLS`,
          category: 'NETWORKING',
          severity: 'MEDIUM',
          resourceKind: res.kind,
          resourceName: res.name,
          line: res.line,
          message: `Ingress '${res.name}' has no 'tls:' section defined. Client credentials and payload data will be transmitted unencrypted over plain HTTP.`,
          remediation: `Add spec.tls with secretName containing a valid TLS certificate.`,
          autoFixSnippet: 'spec:\n  tls:\n  - hosts:\n    - example.com\n    secretName: tls-secret',
        });
      }
    }

    // Scoring & Grade
    let score = 100;
    const stats = {
      totalResources: resources.length,
      totalContainers,
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
    };

    for (const f of findings) {
      if (f.severity === 'CRITICAL') {
        score -= 25;
        stats.criticalCount++;
      } else if (f.severity === 'HIGH') {
        score -= 15;
        stats.highCount++;
      } else if (f.severity === 'MEDIUM') {
        score -= 8;
        stats.mediumCount++;
      } else if (f.severity === 'LOW') {
        score -= 3;
        stats.lowCount++;
      }
    }

    score = Math.max(0, Math.min(100, score));

    let grade: 'A+' | 'A' | 'B' | 'C' | 'F' = 'A+';
    if (score >= 95) grade = 'A+';
    else if (score >= 85) grade = 'A';
    else if (score >= 70) grade = 'B';
    else if (score >= 50) grade = 'C';
    else grade = 'F';

    return {
      filePath,
      fileName: path.basename(filePath),
      score,
      grade,
      resources,
      findings,
      stats,
      topology,
      rawContent: typeof resourcesOrYaml === 'string' ? resourcesOrYaml : undefined,
    };
  }
}

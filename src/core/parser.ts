import path from 'node:path';
import { KubeContainer, KubeResource, ResourceKind } from './types.js';

export class KubeYamlParser {
  /**
   * Parse a single or multi-document Kubernetes YAML string into KubeResource AST objects.
   */
  public static parse(rawContent: string, filePath = 'manifest.yaml'): KubeResource[] {
    const documents = this.splitDocuments(rawContent);
    const resources: KubeResource[] = [];

    for (const doc of documents) {
      if (!doc.trim()) continue;
      const res = this.parseDocument(doc);
      if (res) {
        resources.push(res);
      }
    }

    return resources;
  }

  private static splitDocuments(raw: string): string[] {
    const lines = raw.split(/\r?\n/);
    const docs: string[] = [];
    let currentLines: string[] = [];

    for (const line of lines) {
      if (line.trim() === '---') {
        if (currentLines.length > 0) {
          docs.push(currentLines.join('\n'));
          currentLines = [];
        }
      } else {
        currentLines.push(line);
      }
    }

    if (currentLines.length > 0) {
      docs.push(currentLines.join('\n'));
    }

    return docs;
  }

  private static parseDocument(docContent: string): KubeResource | null {
    const lines = docContent.split(/\r?\n/);
    let kind: ResourceKind = 'Unknown';
    let apiVersion = 'v1';
    let name = '';
    let namespace = 'default';
    const labels: Record<string, string> = {};
    const podLabels: Record<string, string> = {};
    const serviceSelector: Record<string, string> = {};
    const containers: KubeContainer[] = [];
    let hostNetwork = false;
    let hostPID = false;
    let hostIPC = false;
    let serviceType = 'ClusterIP';
    const servicePorts: number[] = [];
    const ingressRules: Array<{ host?: string; paths: string[]; serviceName?: string }> = [];
    const ingressTlsHosts: string[] = [];

    let inMetadata = false;
    let inLabels = false;
    let inPodMetadata = false;
    let inPodLabels = false;
    let inServiceSelector = false;
    let inContainers = false;
    let currentContainer: Partial<KubeContainer> | null = null;
    let inResources = false;
    let inLimits = false;
    let inRequests = false;
    let inSecurityContext = false;
    let inCapsDrop = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const indent = line.search(/\S|$/);

      // Top-level fields
      if (trimmed.startsWith('kind:')) {
        const val = trimmed.replace('kind:', '').trim();
        kind = this.normalizeKind(val);
        continue;
      }
      if (trimmed.startsWith('apiVersion:')) {
        apiVersion = trimmed.replace('apiVersion:', '').trim();
        continue;
      }

      // Metadata section
      if (trimmed === 'metadata:' && indent <= 2) {
        inMetadata = true;
        inLabels = false;
        continue;
      }

      if (inMetadata) {
        if (indent > 0) {
          if (trimmed.startsWith('name:')) {
            name = trimmed.replace('name:', '').trim().replace(/['"]/g, '');
          } else if (trimmed.startsWith('namespace:')) {
            namespace = trimmed.replace('namespace:', '').trim().replace(/['"]/g, '');
          } else if (trimmed === 'labels:') {
            inLabels = true;
          } else if (inLabels && indent >= 4 && trimmed.includes(':')) {
            const [k, v] = trimmed.split(':').map(s => s.trim().replace(/['"]/g, ''));
            if (k && v !== undefined) labels[k] = v;
          }
        } else {
          inMetadata = false;
          inLabels = false;
        }
      }

      // Pod Template Metadata / Labels for Deployments, StatefulSets, DaemonSets
      if (trimmed === 'template:') {
        inPodMetadata = false;
        inContainers = false;
      }
      if (trimmed === 'metadata:' && indent >= 4) {
        inPodMetadata = true;
        continue;
      }
      if (inPodMetadata) {
        if (trimmed === 'labels:') {
          inPodLabels = true;
          continue;
        }
        if (inPodLabels && indent >= 8 && trimmed.includes(':')) {
          const [k, v] = trimmed.split(':').map(s => s.trim().replace(/['"]/g, ''));
          if (k && v !== undefined) podLabels[k] = v;
        }
      }

      // Service Selector
      if (trimmed === 'selector:' && kind === 'Service') {
        inServiceSelector = true;
        continue;
      }
      if (inServiceSelector) {
        if (indent >= 4 && trimmed.includes(':')) {
          const [k, v] = trimmed.split(':').map(s => s.trim().replace(/['"]/g, ''));
          if (k && v !== undefined) serviceSelector[k] = v;
        } else if (indent < 4) {
          inServiceSelector = false;
        }
      }

      // Workload Pod Spec host options
      if (trimmed.startsWith('hostNetwork:')) hostNetwork = trimmed.includes('true');
      if (trimmed.startsWith('hostPID:')) hostPID = trimmed.includes('true');
      if (trimmed.startsWith('hostIPC:')) hostIPC = trimmed.includes('true');

      // Containers parsing
      if (trimmed === 'containers:') {
        inContainers = true;
        continue;
      }

      if (inContainers) {
        if (trimmed.startsWith('- name:')) {
          if (currentContainer && currentContainer.name) {
            containers.push(this.finalizeContainer(currentContainer));
          }
          currentContainer = {
            name: trimmed.replace('- name:', '').trim().replace(/['"]/g, ''),
            line: i + 1,
            hasCpuLimit: false,
            hasMemoryLimit: false,
            hasCpuRequest: false,
            hasMemoryRequest: false,
            hasLivenessProbe: false,
            hasReadinessProbe: false,
          };
          inResources = false;
          inLimits = false;
          inRequests = false;
          inSecurityContext = false;
          continue;
        }

        if (currentContainer) {
          if (trimmed.startsWith('image:')) {
            currentContainer.image = trimmed.replace('image:', '').trim().replace(/['"]/g, '');
          }

          // Probes
          if (trimmed.startsWith('livenessProbe:')) currentContainer.hasLivenessProbe = true;
          if (trimmed.startsWith('readinessProbe:')) currentContainer.hasReadinessProbe = true;

          // Resources
          if (trimmed === 'resources:') { inResources = true; continue; }
          if (inResources) {
            if (trimmed === 'limits:') { inLimits = true; inRequests = false; continue; }
            if (trimmed === 'requests:') { inRequests = true; inLimits = false; continue; }
            if (inLimits) {
              if (trimmed.startsWith('cpu:')) currentContainer.hasCpuLimit = true;
              if (trimmed.startsWith('memory:')) currentContainer.hasMemoryLimit = true;
            }
            if (inRequests) {
              if (trimmed.startsWith('cpu:')) currentContainer.hasCpuRequest = true;
              if (trimmed.startsWith('memory:')) currentContainer.hasMemoryRequest = true;
            }
          }

          // Security Context
          if (trimmed === 'securityContext:') { inSecurityContext = true; continue; }
          if (inSecurityContext) {
            if (trimmed.startsWith('privileged:')) currentContainer.privileged = trimmed.includes('true');
            if (trimmed.startsWith('runAsNonRoot:')) currentContainer.runAsNonRoot = trimmed.includes('true');
            if (trimmed.startsWith('runAsUser:')) {
              const u = parseInt(trimmed.replace('runAsUser:', '').trim(), 10);
              if (!isNaN(u)) currentContainer.runAsUser = u;
            }
            if (trimmed.startsWith('readOnlyRootFilesystem:')) {
              currentContainer.readOnlyRootFilesystem = trimmed.includes('true');
            }
            if (trimmed === 'drop:') { inCapsDrop = true; continue; }
            if (inCapsDrop && trimmed.startsWith('-')) {
              const cap = trimmed.replace('-', '').trim().replace(/['"]/g, '');
              currentContainer.capabilitiesDrop = currentContainer.capabilitiesDrop || [];
              currentContainer.capabilitiesDrop.push(cap);
            }
          }
        }
      }
    }

    if (currentContainer && currentContainer.name) {
      containers.push(this.finalizeContainer(currentContainer));
    }

    if (!name && !kind) return null;

    return {
      kind,
      apiVersion,
      name: name || 'unnamed',
      namespace: namespace || 'default',
      labels,
      line: 1,
      rawYaml: docContent,
      podLabels: Object.keys(podLabels).length > 0 ? podLabels : labels,
      containers,
      hostNetwork,
      hostPID,
      hostIPC,
      serviceSelector: Object.keys(serviceSelector).length > 0 ? serviceSelector : undefined,
      serviceType,
      servicePorts,
      ingressRules,
      ingressTlsHosts,
    };
  }

  private static finalizeContainer(c: Partial<KubeContainer>): KubeContainer {
    return {
      name: c.name || 'unnamed-container',
      image: c.image || 'unknown',
      line: c.line || 1,
      privileged: Boolean(c.privileged),
      runAsNonRoot: c.runAsNonRoot,
      runAsUser: c.runAsUser,
      readOnlyRootFilesystem: c.readOnlyRootFilesystem,
      capabilitiesDrop: c.capabilitiesDrop || [],
      hasCpuLimit: Boolean(c.hasCpuLimit),
      hasMemoryLimit: Boolean(c.hasMemoryLimit),
      hasCpuRequest: Boolean(c.hasCpuRequest),
      hasMemoryRequest: Boolean(c.hasMemoryRequest),
      hasLivenessProbe: Boolean(c.hasLivenessProbe),
      hasReadinessProbe: Boolean(c.hasReadinessProbe),
    };
  }

  private static normalizeKind(kindStr: string): ResourceKind {
    const k = kindStr.trim();
    if (k.toLowerCase() === 'deployment') return 'Deployment';
    if (k.toLowerCase() === 'statefulset') return 'StatefulSet';
    if (k.toLowerCase() === 'daemonset') return 'DaemonSet';
    if (k.toLowerCase() === 'job') return 'Job';
    if (k.toLowerCase() === 'cronjob') return 'CronJob';
    if (k.toLowerCase() === 'pod') return 'Pod';
    if (k.toLowerCase() === 'service') return 'Service';
    if (k.toLowerCase() === 'ingress') return 'Ingress';
    if (k.toLowerCase() === 'configmap') return 'ConfigMap';
    if (k.toLowerCase() === 'secret') return 'Secret';
    if (k.toLowerCase() === 'persistentvolumeclaim') return 'PersistentVolumeClaim';
    if (k.toLowerCase() === 'namespace') return 'Namespace';
    return 'Unknown';
  }
}

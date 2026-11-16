export type ResourceKind =
  | 'Deployment'
  | 'StatefulSet'
  | 'DaemonSet'
  | 'Job'
  | 'CronJob'
  | 'Pod'
  | 'Service'
  | 'Ingress'
  | 'ConfigMap'
  | 'Secret'
  | 'PersistentVolumeClaim'
  | 'Namespace'
  | 'Unknown';

export type FindingSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
export type FindingCategory = 'SECURITY' | 'RELIABILITY' | 'NETWORKING' | 'HYGIENE';

export interface AuditFinding {
  id: string;
  ruleId?: string;
  title: string;
  category: FindingCategory;
  severity: FindingSeverity;
  resourceKind: string;
  resourceName: string;
  line: number;
  message: string;
  remediation: string;
  autoFixSnippet?: string;
}

export interface KubeContainer {
  name: string;
  image: string;
  line: number;
  privileged?: boolean;
  runAsNonRoot?: boolean;
  runAsUser?: number;
  readOnlyRootFilesystem?: boolean;
  capabilitiesDrop?: string[];
  hasCpuLimit: boolean;
  hasMemoryLimit: boolean;
  hasCpuRequest: boolean;
  hasMemoryRequest: boolean;
  hasLivenessProbe: boolean;
  hasReadinessProbe: boolean;
}

export interface KubeResource {
  kind: ResourceKind;
  apiVersion: string;
  name: string;
  namespace?: string;
  labels: Record<string, string>;
  line: number;
  rawYaml: string;
  // Workload specific
  podLabels?: Record<string, string>;
  containers: KubeContainer[];
  hostNetwork?: boolean;
  hostPID?: boolean;
  hostIPC?: boolean;
  // Service specific
  serviceSelector?: Record<string, string>;
  serviceType?: string;
  servicePorts?: number[];
  // Ingress specific
  ingressRules?: Array<{ host?: string; paths: string[]; serviceName?: string }>;
  ingressTlsHosts?: string[];
}

export interface TopologyNode {
  id: string;
  kind: ResourceKind;
  name: string;
  namespace: string;
  connectedTo: string[];
  isOrphaned: boolean;
}

export interface KubeAuditReport {
  filePath: string;
  fileName: string;
  score: number; // 0 - 100
  grade: 'A+' | 'A' | 'B' | 'C' | 'F';
  resources: KubeResource[];
  findings: AuditFinding[];
  stats: {
    totalResources: number;
    totalContainers: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
  };
  topology: {
    nodes: TopologyNode[];
    mermaid: string;
    unconnectedServices: string[];
  };
  rawContent?: string;
}

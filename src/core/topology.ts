import { KubeResource, TopologyNode } from './types.js';

export interface TopologyResult {
  nodes: TopologyNode[];
  mermaid: string;
  unconnectedServices: string[];
}

export class KubeTopology {
  /**
   * Link Kubernetes resources into an architectural topology graph and compute Mermaid flowchart.
   */
  public static build(resources: KubeResource[]): TopologyResult {
    const nodes: TopologyNode[] = [];
    const nodeMap = new Map<string, TopologyNode>();
    const unconnectedServices: string[] = [];

    // 1. Create topology nodes for each resource
    for (const r of resources) {
      const id = `${r.kind.toLowerCase()}_${r.name}`;
      const node: TopologyNode = {
        id,
        kind: r.kind,
        name: r.name,
        namespace: r.namespace || 'default',
        connectedTo: [],
        isOrphaned: false,
      };
      nodes.push(node);
      nodeMap.set(id, node);
    }

    // Workload kinds
    const workloads = resources.filter(r =>
      ['Deployment', 'StatefulSet', 'DaemonSet', 'Job', 'CronJob', 'Pod'].includes(r.kind)
    );
    const services = resources.filter(r => r.kind === 'Service');
    const ingresses = resources.filter(r => r.kind === 'Ingress');

    // 2. Link Services to matching Workloads via Selector
    for (const svc of services) {
      const svcId = `service_${svc.name}`;
      const svcNode = nodeMap.get(svcId);
      if (!svcNode) continue;

      const selector = svc.serviceSelector;
      if (!selector || Object.keys(selector).length === 0) {
        // Headless or selectorless service
        continue;
      }

      let matchCount = 0;
      for (const w of workloads) {
        const podLabels = w.podLabels || {};
        let matches = true;

        for (const [k, v] of Object.entries(selector)) {
          if (podLabels[k] !== v) {
            matches = false;
            break;
          }
        }

        if (matches) {
          matchCount++;
          const targetId = `${w.kind.toLowerCase()}_${w.name}`;
          svcNode.connectedTo.push(targetId);
        }
      }

      if (matchCount === 0) {
        svcNode.isOrphaned = true;
        unconnectedServices.push(svc.name);
      }
    }

    // 3. Link Ingresses to Services
    for (const ing of ingresses) {
      const ingId = `ingress_${ing.name}`;
      const ingNode = nodeMap.get(ingId);
      if (!ingNode) continue;

      // Extract service references from YAML if not in AST
      for (const svc of services) {
        if (ing.rawYaml.includes(svc.name)) {
          ingNode.connectedTo.push(`service_${svc.name}`);
        }
      }
    }

    // 4. Generate Mermaid Flowchart Syntax
    const mermaidLines = ['flowchart TD'];

    for (const node of nodes) {
      const label = `${node.kind}: ${node.name}`;
      if (node.isOrphaned) {
        mermaidLines.push(`  ${node.id}["⚠️ ${label} (DISCONNECTED)"]:::orphaned`);
      } else {
        mermaidLines.push(`  ${node.id}["${label}"]`);
      }

      for (const target of node.connectedTo) {
        mermaidLines.push(`  ${node.id} --> ${target}`);
      }
    }

    mermaidLines.push('  classDef orphaned fill:#ef444422,stroke:#ef4444,stroke-width:2px,color:#f87171;');
    mermaidLines.push('  classDef default fill:#0f172a,stroke:#38bdf8,stroke-width:1px,color:#f8fafc;');

    return {
      nodes,
      mermaid: mermaidLines.join('\n'),
      unconnectedServices,
    };
  }
}

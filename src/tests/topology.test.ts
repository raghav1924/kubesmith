import { describe, it } from 'node:test';
import assert from 'node:assert';
import { KubeYamlParser } from '../core/parser.js';
import { KubeTopology } from '../core/topology.js';

describe('KubeTopology', () => {
  it('should link Service to matching Deployment pod labels', () => {
    const yaml = `
apiVersion: v1
kind: Service
metadata:
  name: web-service
spec:
  selector:
    app: frontend
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-deploy
spec:
  template:
    metadata:
      labels:
        app: frontend
    spec:
      containers:
      - name: web
        image: nginx:1.27
`;
    const resources = KubeYamlParser.parse(yaml);
    const topology = KubeTopology.build(resources);

    assert.strictEqual(topology.nodes.length, 2);
    assert.strictEqual(topology.unconnectedServices.length, 0);

    const svcNode = topology.nodes.find(n => n.name === 'web-service');
    assert.ok(svcNode);
    assert.deepStrictEqual(svcNode?.connectedTo, ['deployment_web-deploy']);
  });

  it('should detect orphaned or disconnected Service selector mismatches', () => {
    const yaml = `
apiVersion: v1
kind: Service
metadata:
  name: orphaned-service
spec:
  selector:
    app: non-existent-workload
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: actual-deploy
spec:
  template:
    metadata:
      labels:
        app: real-workload
    spec:
      containers:
      - name: api
        image: api:v1.0.0
`;
    const resources = KubeYamlParser.parse(yaml);
    const topology = KubeTopology.build(resources);

    assert.ok(topology.unconnectedServices.includes('orphaned-service'));
    const orphanedNode = topology.nodes.find(n => n.name === 'orphaned-service');
    assert.strictEqual(orphanedNode?.isOrphaned, true);
  });

  it('should generate valid Mermaid flowchart syntax', () => {
    const yaml = `
apiVersion: v1
kind: Service
metadata:
  name: api-svc
spec:
  selector:
    app: api
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-deploy
spec:
  template:
    metadata:
      labels:
        app: api
    spec:
      containers:
      - name: api
        image: api:v1.0.0
`;
    const resources = KubeYamlParser.parse(yaml);
    const topology = KubeTopology.build(resources);

    assert.ok(topology.mermaid.startsWith('flowchart TD'));
    assert.ok(topology.mermaid.includes('service_api-svc --> deployment_api-deploy'));
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { KubeYamlParser } from '../core/parser.js';
import { KubeTopology } from '../core/topology.js';

describe('Multi-Port and Advanced Workloads', () => {
  it('should parse StatefulSet and link headless Service', () => {
    const yaml = `
apiVersion: v1
kind: Service
metadata:
  name: db-headless
spec:
  clusterIP: None
  selector:
    app: postgres
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres-cluster
spec:
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:16-alpine
`;
    const resources = KubeYamlParser.parse(yaml);
    const topology = KubeTopology.build(resources);
    assert.strictEqual(topology.nodes.length, 2);
    assert.strictEqual(topology.unconnectedServices.length, 0);
  });
});

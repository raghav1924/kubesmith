import { describe, it } from 'node:test';
import assert from 'node:assert';
import { KubeAuditor } from '../core/auditor.js';
import { KubeHardener } from '../core/hardener.js';
import { KubeTopology } from '../core/topology.js';
import { KubeYamlParser } from '../core/parser.js';

describe('Performance Benchmarks', () => {
  it('should parse, audit, and build topology in sub-50ms', () => {
    const complexManifest = `
apiVersion: v1
kind: Service
metadata:
  name: api-service
  namespace: prod
spec:
  selector:
    app: backend-api
  ports:
  - port: 80
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend-api-deployment
  namespace: prod
spec:
  template:
    metadata:
      labels:
        app: backend-api
    spec:
      containers:
      - name: api
        image: api:v1.0.0
        resources:
          limits:
            cpu: "1"
            memory: "1Gi"
          requests:
            cpu: "250m"
            memory: "256Mi"
        securityContext:
          runAsNonRoot: true
          runAsUser: 10001
          capabilities:
            drop:
            - ALL
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
`;

    const start = performance.now();
    for (let i = 0; i < 50; i++) {
      const resources = KubeYamlParser.parse(complexManifest);
      KubeAuditor.audit(resources);
      KubeTopology.build(resources);
      KubeHardener.harden(complexManifest);
    }
    const elapsed = performance.now() - start;
    const avgPerRun = elapsed / 50;

    assert.ok(avgPerRun < 50, `Average time per cycle was ${avgPerRun.toFixed(2)}ms, expected < 50ms`);
  });
});

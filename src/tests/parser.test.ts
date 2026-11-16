import { describe, it } from 'node:test';
import assert from 'node:assert';
import { KubeYamlParser } from '../core/parser.js';

describe('KubeYamlParser', () => {
  it('should parse single document Kubernetes manifests', () => {
    const yaml = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-server
  namespace: prod
  labels:
    app: web
spec:
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
      - name: nginx
        image: nginx:1.27-alpine
`;
    const resources = KubeYamlParser.parse(yaml);
    assert.strictEqual(resources.length, 1);
    assert.strictEqual(resources[0].kind, 'Deployment');
    assert.strictEqual(resources[0].name, 'web-server');
    assert.strictEqual(resources[0].namespace, 'prod');
    assert.strictEqual(resources[0].containers.length, 1);
    assert.strictEqual(resources[0].containers[0].name, 'nginx');
  });

  it('should parse multi-document manifests separated by ---', () => {
    const multiDoc = `
apiVersion: v1
kind: Service
metadata:
  name: api-svc
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-deploy
`;
    const resources = KubeYamlParser.parse(multiDoc);
    assert.strictEqual(resources.length, 2);
    assert.strictEqual(resources[0].kind, 'Service');
    assert.strictEqual(resources[1].kind, 'Deployment');
  });

  it('should extract container securityContext and resources', () => {
    const yaml = `
apiVersion: v1
kind: Pod
metadata:
  name: secured-pod
spec:
  containers:
  - name: app
    image: app:v1.0.0
    securityContext:
      privileged: false
      runAsNonRoot: true
      runAsUser: 10001
      readOnlyRootFilesystem: true
      capabilities:
        drop:
        - ALL
    resources:
      limits:
        cpu: "500m"
        memory: "512Mi"
      requests:
        cpu: "100m"
        memory: "128Mi"
`;
    const resources = KubeYamlParser.parse(yaml);
    const container = resources[0].containers[0];
    assert.strictEqual(container.privileged, false);
    assert.strictEqual(container.runAsNonRoot, true);
    assert.strictEqual(container.runAsUser, 10001);
    assert.strictEqual(container.readOnlyRootFilesystem, true);
    assert.deepStrictEqual(container.capabilitiesDrop, ['ALL']);
    assert.strictEqual(container.hasCpuLimit, true);
    assert.strictEqual(container.hasMemoryLimit, true);
  });
});

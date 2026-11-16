import { describe, it } from 'node:test';
import assert from 'node:assert';
import { KubeHardener } from '../core/hardener.js';

describe('KubeHardener', () => {
  it('should disable privileged mode in manifests', () => {
    const raw = `
apiVersion: v1
kind: Pod
metadata:
  name: priv
spec:
  containers:
  - name: box
    image: alpine:latest
    securityContext:
      privileged: true
`;
    const result = KubeHardener.harden(raw);
    assert.ok(result.hardenedYaml.includes('privileged: false'));
    assert.ok(!result.hardenedYaml.includes('privileged: true'));
  });

  it('should inject runAsNonRoot and capabilities drop', () => {
    const raw = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  template:
    spec:
      containers:
      - name: api
        image: api:v1.0.0
`;
    const result = KubeHardener.harden(raw);
    assert.ok(result.hardenedYaml.includes('runAsNonRoot: true'));
    assert.ok(result.hardenedYaml.includes('runAsUser: 10001'));
    assert.ok(result.hardenedYaml.includes('drop:'));
    assert.ok(result.hardenedYaml.includes('- ALL'));
  });

  it('should inject default resources and probes', () => {
    const raw = `
apiVersion: v1
kind: Pod
metadata:
  name: app
spec:
  containers:
  - name: app
    image: app:v1.0.0
`;
    const result = KubeHardener.harden(raw);
    assert.ok(result.hardenedYaml.includes('resources:'));
    assert.ok(result.hardenedYaml.includes('limits:'));
    assert.ok(result.hardenedYaml.includes('livenessProbe:'));
    assert.ok(result.hardenedYaml.includes('readinessProbe:'));
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { KubeAuditor } from '../core/auditor.js';
import { AuditFinding } from '../core/types.js';

describe('KubeAuditor', () => {
  it('should flag privileged container execution (SEC-001)', () => {
    const yaml = `
apiVersion: v1
kind: Pod
metadata:
  name: test-pod
  namespace: test
spec:
  containers:
  - name: priv-box
    image: alpine:3.20
    securityContext:
      privileged: true
`;
    const report = KubeAuditor.audit(yaml);
    const sec001 = report.findings.find((f: AuditFinding) => f.id === 'SEC-001');
    assert.ok(sec001, 'Should find SEC-001 privileged finding');
    assert.strictEqual(sec001?.severity, 'CRITICAL');
  });

  it('should flag host namespace sharing (SEC-004)', () => {
    const yaml = `
apiVersion: v1
kind: Pod
metadata:
  name: host-snoop
  namespace: test
spec:
  hostNetwork: true
  containers:
  - name: box
    image: busybox:1.36
`;
    const report = KubeAuditor.audit(yaml);
    const sec004 = report.findings.find((f: AuditFinding) => f.id === 'SEC-004');
    assert.ok(sec004, 'Should find SEC-004 hostNetwork finding');
    assert.strictEqual(sec004?.severity, 'CRITICAL');
  });

  it('should flag missing resource limits (REL-001)', () => {
    const yaml = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: unconstrained-api
  namespace: test
spec:
  template:
    spec:
      containers:
      - name: api
        image: api:v1.0.0
`;
    const report = KubeAuditor.audit(yaml);
    const rel001 = report.findings.find((f: AuditFinding) => f.id === 'REL-001');
    assert.ok(rel001, 'Should find REL-001 missing resource limits');
  });

  it('should grant A or A+ grade to a compliant hardened manifest', () => {
    const yaml = `
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hardened-api
  namespace: production
  labels:
    app: secure-app
spec:
  template:
    metadata:
      labels:
        app: secure-app
    spec:
      containers:
      - name: main
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
        livenessProbe:
          httpGet:
            path: /healthz
            port: 8080
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
`;
    const report = KubeAuditor.audit(yaml);
    assert.ok(report.score >= 85, `Expected score >= 85, got ${report.score}`);
    assert.ok(['A', 'A+'].includes(report.grade), `Expected grade A or A+, got ${report.grade}`);
  });
});

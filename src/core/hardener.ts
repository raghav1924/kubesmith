import { KubeYamlParser } from './parser.js';

export interface HardeningResult {
  hardenedYaml: string;
  appliedFixes: string[];
}

export class KubeHardener {
  /**
   * Automatically patch and harden Kubernetes YAML manifests.
   */
  public static harden(rawYaml: string): HardeningResult {
    const appliedFixes: string[] = [];
    let updated = rawYaml;

    // 1. Remove or disable privileged: true
    if (/privileged:\s*true/i.test(updated)) {
      updated = updated.replace(/privileged:\s*true/gi, 'privileged: false');
      appliedFixes.push('Disabled privileged container execution (privileged: false)');
    }

    // 2. Inject Pod Security Standards restricted securityContext into container blocks if missing
    if (!/runAsNonRoot:\s*true/i.test(updated) && /image:\s*[^\n]+/i.test(updated)) {
      const securityContextSnippet = [
        '        securityContext:',
        '          runAsNonRoot: true',
        '          runAsUser: 10001',
        '          readOnlyRootFilesystem: true',
        '          allowPrivilegeEscalation: false',
        '          capabilities:',
        '            drop:',
        '            - ALL',
      ].join('\n');

      if (/securityContext:/i.test(updated)) {
        // update existing
        if (!/runAsNonRoot/i.test(updated)) {
          updated = updated.replace(/securityContext:\s*\n/gi, 'securityContext:\n          runAsNonRoot: true\n          runAsUser: 10001\n');
          appliedFixes.push('Injected runAsNonRoot: true and runAsUser: 10001');
        }
      } else {
        // inject under image:
        updated = updated.replace(/(image:\s*[^\n]+)/i, `$1\n${securityContextSnippet}`);
        appliedFixes.push('Injected Restricted Pod Security Standards securityContext');
      }
    }

    // 3. Inject Resource Limits & Requests if missing
    if (!/resources:\s*\n/i.test(updated) && /image:\s*[^\n]+/i.test(updated)) {
      const resourceSnippet = [
        '        resources:',
        '          limits:',
        '            cpu: "500m"',
        '            memory: "512Mi"',
        '          requests:',
        '            cpu: "100m"',
        '            memory: "128Mi"',
      ].join('\n');

      updated = updated.replace(/(image:\s*[^\n]+)/i, `$1\n${resourceSnippet}`);
      appliedFixes.push('Injected default CPU/Memory resource limits and requests to prevent OOMKilled risks');
    }

    // 4. Inject Liveness & Readiness Probes if missing
    if (!/livenessProbe:/i.test(updated) && /image:\s*[^\n]+/i.test(updated)) {
      const probeSnippet = [
        '        livenessProbe:',
        '          httpGet:',
        '            path: /healthz',
        '            port: 8080',
        '          initialDelaySeconds: 15',
        '          periodSeconds: 20',
        '        readinessProbe:',
        '          httpGet:',
        '            path: /ready',
        '            port: 8080',
        '          initialDelaySeconds: 5',
        '          periodSeconds: 10',
      ].join('\n');

      updated = updated.replace(/(image:\s*[^\n]+)/i, `$1\n${probeSnippet}`);
      appliedFixes.push('Injected container livenessProbe and readinessProbe health checks');
    }

    // 5. Pin :latest to semantic placeholder if present
    if (/:latest\b/i.test(updated)) {
      updated = updated.replace(/:latest\b/gi, ':v1.0.0');
      appliedFixes.push("Replaced mutable ':latest' image tag with pinned ':v1.0.0'");
    }

    return {
      hardenedYaml: updated,
      appliedFixes,
    };
  }
}

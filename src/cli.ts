import fs from 'node:fs';
import path from 'node:path';
import { KubeYamlParser } from './core/parser.js';
import { KubeAuditor } from './core/auditor.js';
import { KubeHardener } from './core/hardener.js';
import { KubeTopology } from './core/topology.js';
import { KubeSmithStudio } from './server/studio.js';
import { Logger, colors } from './utils/logger.js';

export function runCli(args: string[]): void {
  const command = args[0] || 'help';

  switch (command) {
    case 'audit':
    case 'lint':
    case 'scan':
    case 'check':
      handleAudit(args.slice(1));
      break;

    case 'fix':
    case 'harden':
      handleHarden(args.slice(1));
      break;

    case 'topology':
    case 'graph':
      handleTopology(args.slice(1));
      break;

    case 'studio':
    case 'ui':
      handleStudio(args.slice(1));
      break;

    case 'version':
    case '-v':
    case '--version':
      console.log('KubeSmith v1.0.0 — Crafted by Jatin Sharma (https://jatinsh.netlify.app/)');
      break;

    case 'help':
    case '--help':
    default:
      printHelp();
      break;
  }
}

function handleAudit(args: string[]): void {
  const targetPath = args.find(a => !a.startsWith('--')) || '.';
  const minScoreArg = args.find(a => a.startsWith('--min-score='));
  const minScore = minScoreArg ? parseInt(minScoreArg.split('=')[1], 10) : 75;
  const failOnSec = args.includes('--fail-on-sec');
  const jsonOutput = args.includes('--json');

  const filesToScan: string[] = [];
  const fullTarget = path.resolve(process.cwd(), targetPath);

  if (fs.existsSync(fullTarget)) {
    if (fs.statSync(fullTarget).isFile()) {
      filesToScan.push(fullTarget);
    } else {
      const entries = fs.readdirSync(fullTarget, { recursive: true }) as string[];
      for (const entry of entries) {
        if (entry.endsWith('.yaml') || entry.endsWith('.yml')) {
          filesToScan.push(path.join(fullTarget, entry));
        }
      }
    }
  }

  if (filesToScan.length === 0) {
    if (jsonOutput) {
      console.log(JSON.stringify({ error: 'No YAML manifest files found', filesScanned: 0 }));
    } else {
      Logger.warn(`No Kubernetes YAML files found in '${targetPath}'.`);
    }
    return;
  }

  const reports = filesToScan.map(file => {
    const content = fs.readFileSync(file, 'utf-8');
    return KubeAuditor.audit(content, file);
  });

  if (jsonOutput) {
    console.log(JSON.stringify({ reports, targetPath, totalFiles: reports.length }, null, 2));
    return;
  }

  Logger.header('KubeSmith — Kubernetes Pod Security Standards & Reliability Audit');
  console.log(`Target: ${colors.dim}${fullTarget}${colors.reset}\n`);

  let totalCritical = 0;
  let lowestScore = 100;

  for (const r of reports) {
    totalCritical += r.stats.criticalCount;
    if (r.score < lowestScore) lowestScore = r.score;

    const gradeColor = r.score >= 90 ? colors.green : r.score >= 75 ? colors.cyan : r.score >= 50 ? colors.yellow : colors.red;

    console.log(`${colors.bold}${r.fileName}${colors.reset} • ${gradeColor}${r.score}% [${r.grade}]${colors.reset}`);
    console.log(`  Resources: ${r.stats.totalResources} | Containers: ${r.stats.totalContainers}`);
    console.log(`  Findings: ${colors.red}${r.stats.criticalCount} Critical${colors.reset}, ${colors.yellow}${r.stats.highCount} High${colors.reset}, ${colors.cyan}${r.stats.mediumCount} Medium${colors.reset}, ${colors.gray}${r.stats.lowCount} Low${colors.reset}`);

    if (r.findings.length > 0) {
      for (const f of r.findings) {
        const sevColor = f.severity === 'CRITICAL' ? colors.red : f.severity === 'HIGH' ? colors.yellow : f.severity === 'MEDIUM' ? colors.cyan : colors.gray;
        console.log(`    [${sevColor}${f.severity}${colors.reset}] ${colors.bold}${f.id}: ${f.title}${colors.reset} (Line ${f.line})`);
        console.log(`      ${colors.dim}${f.message}${colors.reset}`);
        console.log(`      ${colors.green}Fix: ${f.remediation}${colors.reset}`);
      }
    } else {
      console.log(`    ${colors.green}✔ Compliant with Restricted Pod Security Standards${colors.reset}`);
    }
    console.log('');
  }

  console.log('─'.repeat(56));
  console.log(`Audited ${reports.length} manifest file(s).`);

  const failedQualityGate = lowestScore < minScore || (failOnSec && totalCritical > 0);
  if (failedQualityGate) {
    Logger.error(`Audit failed quality gates! (Min Score: ${minScore}%, Fail-On-Security: ${failOnSec})`);
    process.exit(1);
  } else {
    Logger.success('All Kubernetes manifests passed quality gates!');
  }
}

function handleHarden(args: string[]): void {
  const targetFile = args[0];
  if (!targetFile || !fs.existsSync(targetFile)) {
    Logger.error('Please specify a valid Kubernetes manifest file to harden. (e.g. kubesmith fix deployment.yaml)');
    return;
  }

  const content = fs.readFileSync(targetFile, 'utf-8');
  const result = KubeHardener.harden(content);

  fs.writeFileSync(targetFile, result.hardenedYaml, 'utf-8');
  Logger.success(`Successfully hardened ${targetFile}!`);
  console.log(`Applied ${result.appliedFixes.length} security & reliability transformations:`);
  for (const fix of result.appliedFixes) {
    console.log(`  ${colors.cyan}•${colors.reset} ${fix}`);
  }
}

function handleTopology(args: string[]): void {
  const targetPath = args.find(a => !a.startsWith('--')) || '.';
  const fullTarget = path.resolve(process.cwd(), targetPath);

  const filesToScan: string[] = [];
  if (fs.existsSync(fullTarget)) {
    if (fs.statSync(fullTarget).isFile()) {
      filesToScan.push(fullTarget);
    } else {
      const entries = fs.readdirSync(fullTarget, { recursive: true }) as string[];
      for (const entry of entries) {
        if (entry.endsWith('.yaml') || entry.endsWith('.yml')) {
          filesToScan.push(path.join(fullTarget, entry));
        }
      }
    }
  }

  const allResources = filesToScan.flatMap(f => {
    const raw = fs.readFileSync(f, 'utf-8');
    return KubeYamlParser.parse(raw, f);
  });

  const topology = KubeTopology.build(allResources);

  Logger.header(`Kubernetes Routing Topology (${allResources.length} Resources)`);
  console.log(`Total Nodes: ${topology.nodes.length}`);
  console.log(`Unconnected / Orphaned Services: ${topology.unconnectedServices.length > 0 ? colors.red + topology.unconnectedServices.join(', ') + colors.reset : colors.green + 'None' + colors.reset}\n`);

  console.log(`${colors.bold}Mermaid Flowchart Syntax:${colors.reset}`);
  console.log(colors.cyan + topology.mermaid + colors.reset);
}

function handleStudio(args: string[]): void {
  const portArg = args.find(a => a.startsWith('--port='));
  const port = portArg ? parseInt(portArg.split('=')[1], 10) : 5454;
  const dirArg = args.find(a => !a.startsWith('--')) || process.cwd();

  const studio = new KubeSmithStudio(port, dirArg);
  studio.start();
}

function printHelp(): void {
  console.log(`
☸️  ${colors.bold}KubeSmith — Kubernetes Pod Security Standards & Topology Studio${colors.reset}
Crafted by Jatin Sharma (${colors.cyan}https://jatinsh.netlify.app/${colors.reset}) • GitHub: ${colors.cyan}@raghav1924${colors.reset}

${colors.bold}USAGE:${colors.reset}
  $ kubesmith <command> [options]

${colors.bold}COMMANDS:${colors.reset}
  audit [path]             Audit manifests for PSS security, OOMKilled risks & probe missing
  fix <file>               Auto-harden manifests (inject runAsNonRoot, drop caps, limits, probes)
  topology [path]          Map Ingress -> Service -> Workload routing & detect orphaned services
  studio [--port=5454]     Launch interactive dark-mode Web Studio on localhost
  version                  Print version information
  help                     Show this help message

${colors.bold}OPTIONS:${colors.reset}
  --min-score=<n>       Minimum acceptable health score (default: 75)
  --fail-on-sec         Exit with code 1 if any CRITICAL security flaw exists
  --json                Output machine-readable JSON for CI integration

${colors.bold}EXAMPLES:${colors.reset}
  $ kubesmith audit ./k8s --min-score=85 --fail-on-sec
  $ kubesmith fix deployment.yaml
  $ kubesmith topology ./manifests
  $ kubesmith studio --port=5454
`);
}

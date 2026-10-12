import type { SchemaTag } from "../types";

export interface CliPreset {
  id: string;
  family: string;
  title: string;
  command: string;
  description: string;
  tags: SchemaTag[];
}

const standardTag = (name: string, color: string): SchemaTag => ({ name, color });

export const cliPresets: CliPreset[] = [
  {
    id: "drs-verify-manifest",
    family: "DRS",
    title: "Verify Manifest",
    command: 'powershell -NoProfile -ExecutionPolicy Bypass -File "D:\\.city_hall\\DRS\\drs.ps1" verify-manifest',
    description: "Checks version, release status, installer fields, and manifest consistency from the current project root.",
    tags: [standardTag("DRS", "#21C6B8"), standardTag("release", "#D9A441")]
  },
  {
    id: "drs-check-release",
    family: "DRS",
    title: "Check Release Gate",
    command: 'powershell -NoProfile -ExecutionPolicy Bypass -File "D:\\.city_hall\\DRS\\drs.ps1" check-release',
    description: "Runs the DRS release gate after manifest, release note, checklist, and artifact hash are aligned.",
    tags: [standardTag("DRS", "#21C6B8"), standardTag("gate", "#FF884D")]
  },
  {
    id: "drs-hash-installer",
    family: "DRS",
    title: "Hash Installer",
    command: 'powershell -NoProfile -ExecutionPolicy Bypass -File "D:\\.city_hall\\DRS\\drs.ps1" hash artifacts\\installer\\CommandWizard-2.0.0.0-win-x64.exe',
    description: "Creates the SHA-256 snippet used by the manifest and release note.",
    tags: [standardTag("DRS", "#21C6B8"), standardTag("artifact", "#65F2FF")]
  },
  {
    id: "wgs-city-hall-audit",
    family: "WGS",
    title: "City Hall Audit",
    command: 'python D:\\.city_hall\\WGS\\tools\\city_hall_audit.py --root .',
    description: "Runs the WGS structural audit for a governed workspace or standard suite.",
    tags: [standardTag("WGS", "#9C7CFF"), standardTag("audit", "#30D58C")]
  },
  {
    id: "wgs-workspace-inventory",
    family: "WGS",
    title: "Workspace Inventory",
    command: 'python D:\\.city_hall\\WGS\\tools\\workspace_inventory.py --workspace-root D:/ --format jsonl',
    description: "Exports a JSONL inventory of governed workspace entities.",
    tags: [standardTag("WGS", "#9C7CFF"), standardTag("inventory", "#65F2FF")]
  },
  {
    id: "wgs-link-integrity",
    family: "WGS",
    title: "Link Integrity",
    command: 'python D:\\.city_hall\\WGS\\tools\\link_integrity.py WGS SFDS DRS CTS WDS PPS SESM AAMHS LDS',
    description: "Checks standard-suite links across the core Aptlantis standards folders.",
    tags: [standardTag("WGS", "#9C7CFF"), standardTag("links", "#D9A441")]
  },
  {
    id: "pps-validate",
    family: "PPS",
    title: "Validate Proposal Manifest",
    command: 'python D:\\.city_hall\\PPS\\tools\\pps_validate.py Project-Proposal.manifest.toml --json',
    description: "Validates a PPS proposal manifest and emits machine-readable review output.",
    tags: [standardTag("PPS", "#00D8FF"), standardTag("proposal", "#30D58C")]
  },
  {
    id: "pps-dry-run-new",
    family: "PPS",
    title: "Dry Run Project Proposal",
    command: 'python D:\\.city_hall\\PPS\\tools\\pps_new.py ExampleTool --type cli --dry-run',
    description: "Previews PPS project scaffolding without writing files.",
    tags: [standardTag("PPS", "#00D8FF"), standardTag("scaffold", "#D9A441")]
  }
];

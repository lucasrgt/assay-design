import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';
import { designContext, verifyEvidence, type DesignEvidence, type StyleDeclaration } from './index.js';
import { auditFleet, auditPopulation, recallDesign, type FleetMember } from './coherence.js';
import { loadContract } from './node.js';

const result = (value: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(value) }], structuredContent: value as Record<string, unknown> });
export const mcpOperations = {
  async context(contractPath: string) { return designContext(await loadContract(contractPath)); },
  async export(contractPath: string) { return loadContract(contractPath); },
  async verify(contractPath: string, evidence: DesignEvidence) { return verifyEvidence(await loadContract(contractPath), evidence); },
  async audit(contractPath: string, declarations: StyleDeclaration[], sources: string[] = [], threshold = 8) { return auditPopulation(await loadContract(contractPath), declarations, { systematicThreshold: threshold, sources, requireSubjects: true }); },
  async recall(contractPath: string, task?: string, paths: string[] = []) { return recallDesign(await loadContract(contractPath), { ...(task ? { task } : {}), paths }); },
  async fleet(contractPath: string, members: FleetMember[], threshold = 8) { return auditFleet(await loadContract(contractPath), members, threshold); },
};

export function createMcpServer(defaultContract = '.design/contract.toml'): McpServer {
  const server = new McpServer({ name: 'assay-design', version: '0.4.0' });
  const pathSchema = z.object({ contract: z.string().optional() });
  server.registerTool('design_context', { description: 'Return the compact agent context and Agent First Graph projection.', inputSchema: pathSchema, annotations: { readOnlyHint: true, idempotentHint: true } }, async ({ contract }) => result(await mcpOperations.context(contract ?? defaultContract)));
  server.registerTool('design_export', { description: 'Export the canonical design contract as JSON for adapters such as Figma.', inputSchema: pathSchema, annotations: { readOnlyHint: true, idempotentHint: true } }, async ({ contract }) => result(await mcpOperations.export(contract ?? defaultContract)));
  server.registerTool('design_verify', { description: 'Verify normalized UI evidence and return an AVP verdict.', inputSchema: z.object({ contract: z.string().optional(), evidence: z.custom<DesignEvidence>() }), annotations: { readOnlyHint: true, idempotentHint: true } }, async ({ contract, evidence }) => result(await mcpOperations.verify(contract ?? defaultContract, evidence)));
  server.registerTool('design_audit', { description: 'Lint collected design facts; missing observations or comparable subjects fail closed.', inputSchema: z.object({ contract: z.string().optional(), declarations: z.array(z.custom<StyleDeclaration>()), sources: z.array(z.string()).optional(), threshold: z.number().optional() }), annotations: { readOnlyHint: true, idempotentHint: true } }, async ({ contract, declarations, sources, threshold }) => result(await mcpOperations.audit(contract ?? defaultContract, declarations, sources ?? [], threshold ?? 8)));
  server.registerTool('design_recall', { description: 'Recall design-language constraints before editing UI.', inputSchema: z.object({ contract: z.string().optional(), task: z.string().optional(), paths: z.array(z.string()).optional() }), annotations: { readOnlyHint: true, idempotentHint: true } }, async ({ contract, task, paths }) => result(await mcpOperations.recall(contract ?? defaultContract, task, paths ?? [])));
  server.registerTool('design_fleet', { description: 'Audit multiple apps against one shared design language.', inputSchema: z.object({ contract: z.string().optional(), members: z.array(z.object({ name: z.string(), declarations: z.array(z.custom()), sources: z.array(z.string()).optional() })), threshold: z.number().optional() }), annotations: { readOnlyHint: true, idempotentHint: true } }, async ({ contract, members, threshold }) => result(await mcpOperations.fleet(contract ?? defaultContract, members as FleetMember[], threshold ?? 8)));
  return server;
}

export function startMcp(defaultContract?: string) { return serveStdio(() => createMcpServer(defaultContract)); }

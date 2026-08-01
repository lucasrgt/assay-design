import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import * as z from 'zod/v4';
import { designContext, verifyEvidence, type DesignEvidence } from './index.js';
import { loadContract } from './node.js';

const result = (value: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(value) }], structuredContent: value as Record<string, unknown> });
export const mcpOperations = {
  async context(contractPath: string) { return designContext(await loadContract(contractPath)); },
  async export(contractPath: string) { return loadContract(contractPath); },
  async verify(contractPath: string, evidence: DesignEvidence) { return verifyEvidence(await loadContract(contractPath), evidence); },
};

export function createMcpServer(defaultContract = '.design/contract.toml'): McpServer {
  const server = new McpServer({ name: 'assay-design', version: '0.1.2' });
  const pathSchema = z.object({ contract: z.string().optional() });
  server.registerTool('design_context', { description: 'Return the compact agent context and Agent First Graph projection.', inputSchema: pathSchema, annotations: { readOnlyHint: true, idempotentHint: true } }, async ({ contract }) => result(await mcpOperations.context(contract ?? defaultContract)));
  server.registerTool('design_export', { description: 'Export the canonical design contract as JSON for adapters such as Figma.', inputSchema: pathSchema, annotations: { readOnlyHint: true, idempotentHint: true } }, async ({ contract }) => result(await mcpOperations.export(contract ?? defaultContract)));
  server.registerTool('design_verify', { description: 'Verify normalized UI evidence and return an AVP verdict.', inputSchema: z.object({ contract: z.string().optional(), evidence: z.custom<DesignEvidence>() }), annotations: { readOnlyHint: true, idempotentHint: true } }, async ({ contract, evidence }) => result(await mcpOperations.verify(contract ?? defaultContract, evidence)));
  return server;
}

export function startMcp(defaultContract?: string) { return serveStdio(() => createMcpServer(defaultContract)); }

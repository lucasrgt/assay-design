import { verifyEvidence, type DesignContract, type DesignEvidence, type EvidenceNode } from './index.js';

interface FigmaNode { name: string; type: string; children?: readonly FigmaNode[] }
interface FigmaApi {
  currentPage: { name: string; findAllWithCriteria(criteria: { types: readonly string[] }): FigmaNode[] };
  variables: { getLocalVariablesAsync(): Promise<readonly { name: string }[]> };
  ui: { onmessage?: (message: any) => void; postMessage(message: unknown): void };
  showUI(html: string, options: { width: number; height: number }): void;
}

export async function scanFigma(api: FigmaApi): Promise<DesignEvidence> {
  const frames = api.currentPage.findAllWithCriteria({ types: ['COMPONENT', 'COMPONENT_SET'] });
  const variables = await api.variables.getLocalVariablesAsync();
  const nodes = frames.map((node): EvidenceNode => {
    const raw = node.name.split(/[/=]/)[0]!;
    const slots = node.children?.filter((child) => child.name.toLowerCase().startsWith('slot:')).map((child) => child.name.slice(5).trim()).filter(Boolean);
    return { component: raw.trim().toLowerCase(), ...(slots?.length ? { slots } : {}) };
  });
  return { surface: api.currentPage.name.toLowerCase(), source: 'figma', nodes, tokens: variables.map((variable) => variable.name.replaceAll('/', '.')) };
}

export function activateFigma(api: FigmaApi, html: string) {
  api.showUI(html, { width: 420, height: 480 });
  api.ui.onmessage = async (message) => {
    const evidence = await scanFigma(api);
    if (message.type === 'scan') return api.ui.postMessage({ type: 'evidence', evidence });
    if (message.type === 'verify') {
      try { api.ui.postMessage({ type: 'verdict', verdict: await verifyEvidence(message.contract as DesignContract, evidence) }); }
      catch (error) { api.ui.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) }); }
    }
  };
}

if (typeof figma !== 'undefined') activateFigma(figma as unknown as FigmaApi, __html__);

import { fileURLToPath } from 'node:url';

export const managerEntries = (entries: string[] = []) => [...entries, fileURLToPath(import.meta.resolve('./manager.js'))];
export const previewAnnotations = (entries: string[] = []) => [...entries, fileURLToPath(import.meta.resolve('./preview.js'))];

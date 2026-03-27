/**
 * Prompt store types.
 */

export interface Prompt {
  id: number;
  key: string;
  content: string;
  version: number;
  deleted: number;
  created_at: string;
  created_by: string | null;
  reason: string | null;
}

export interface SaveOptions {
  createdBy?: string;
  reason?: string;
}

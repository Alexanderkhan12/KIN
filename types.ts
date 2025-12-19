
export type FolderType = 'invoices' | 'waybills' | 'contracts' | 'taxes' | 'misc';

export interface Folder {
  id: FolderType;
  name: string;
  description: string;
  color: string;
  command: string;
  icon: string;
}

export interface Document {
  id: string;
  name: string;
  folder: FolderType;
  date: string;
  size: string;
  user: string;
}

// Added AIAnalysisResult interface to fix missing exported member error
export interface AIAnalysisResult {
  suggestedFolder: FolderType;
  reasoning: string;
}

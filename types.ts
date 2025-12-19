
export type FolderType = 'invoices' | 'waybills' | 'contracts' | 'misc' | 'taxes';

export interface Folder {
  id: FolderType;
  name: string;
  description: string;
  color: string;
  icon: React.ReactNode;
}

export interface Document {
  id: string;
  name: string;
  folder: FolderType;
  uploadDate: string;
  size: string;
  uploader: string;
  url: string;
}

export interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'system';
  timestamp: string;
  attachedDocId?: string;
}

export interface AIAnalysisResult {
  suggestedFolder: FolderType;
  reasoning: string;
}

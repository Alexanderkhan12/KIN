
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Type } from "@google/genai";

// --- TYPES ---
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
}

export interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'system';
  timestamp: string;
  attachedDocId?: string;
}

// --- CONSTANTS ---
export const FOLDERS: Folder[] = [
  {
    id: 'invoices',
    name: 'Счета и спецификации',
    description: 'Входящие и исходящие счета',
    color: 'bg-blue-500',
    icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
  },
  {
    id: 'waybills',
    name: 'Накладная',
    description: 'Отгрузочные документы',
    color: 'bg-emerald-500',
    icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
  },
  {
    id: 'contracts',
    name: 'Договоры',
    description: 'Соглашения с контрагентами',
    color: 'bg-amber-500',
    icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
  },
  {
    id: 'taxes',
    name: 'Налоги и отчетность',
    description: 'Декларации и сверки',
    color: 'bg-indigo-500',
    icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
  },
  {
    id: 'misc',
    name: 'Разное',
    description: 'Прочие документы',
    color: 'bg-slate-500',
    icon: <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9l-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
  },
];

const COMMAND_MAP: Record<string, FolderType> = {
  '/счета': 'invoices',
  '/инвойс': 'invoices',
  '/накладные': 'waybills',
  '/упд': 'waybills',
  '/договоры': 'contracts',
  '/контракт': 'contracts',
  '/налоги': 'taxes',
  '/отчет': 'taxes',
  '/разное': 'misc',
};

// --- AI SERVICE ---
const analyzeDocument = async (fileName: string) => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) return { suggestedFolder: 'misc', reasoning: 'Локальные правила' };

  try {
    const ai = new GoogleGenAI({ apiKey });
    // Fix: Using string for contents and accessing response.text safely
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Определи категорию документа: "${fileName}". Категории: invoices, waybills, contracts, taxes, misc. Ответ в JSON.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestedFolder: { type: Type.STRING },
            reasoning: { type: Type.STRING },
          },
          required: ["suggestedFolder", "reasoning"],
        },
      },
    });
    return JSON.parse(response.text || "{}") as { suggestedFolder: FolderType; reasoning: string };
  } catch {
    return { suggestedFolder: 'misc', reasoning: 'Ошибка AI' };
  }
};

// --- COMPONENT ---
const App: React.FC = () => {
  const [view, setView] = useState<'chat' | 'folders' | 'setup'>('chat');
  const [currentFolder, setCurrentFolder] = useState<FolderType | null>(null);
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  useEffect(() => {
    // Fix: Casting window to any to access Telegram WebApp without TypeScript errors
    const telegram = (window as any).Telegram;
    if (telegram?.WebApp) {
      telegram.WebApp.ready();
      telegram.WebApp.expand();
    }
    const saved = localStorage.getItem('accounting_docs');
    if (saved) setDocuments(JSON.parse(saved));
    
    setMessages([{
      id: 'welcome',
      text: '📂 Архив готов. Присылайте файлы или используйте /команды.',
      sender: 'system',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);
  }, []);

  useEffect(() => {
    localStorage.setItem('accounting_docs', JSON.stringify(documents));
  }, [documents]);

  const handleSend = async (text: string, file?: File) => {
    if (!text.trim() && !file) return;

    let targetFolder: FolderType = 'misc';
    let reasoning = "";

    if (file) {
      setIsUploading(true);
      const lowerText = text.toLowerCase();
      const cmdFolder = Object.keys(COMMAND_MAP).find(cmd => lowerText.includes(cmd));
      
      if (cmdFolder) {
        targetFolder = COMMAND_MAP[cmdFolder];
      } else {
        const ai = await analyzeDocument(file.name);
        targetFolder = ai.suggestedFolder as FolderType;
        reasoning = ai.reasoning;
      }

      const newDoc: Document = {
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        folder: targetFolder,
        uploadDate: new Date().toLocaleDateString('ru-RU'),
        size: `${(file.size / 1024).toFixed(1)} KB`,
        uploader: 'Вы',
      };

      setDocuments(prev => [newDoc, ...prev]);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        text: text || `📄 Загружен: ${file.name}\n💡 ${reasoning || 'Автоматически определено'}`,
        sender: 'user',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        attachedDocId: newDoc.id
      }]);
      setIsUploading(false);
    } else {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        text,
        sender: 'user',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    }
    setInputText('');
  };

  const copyLink = (id: string) => {
    const url = `${window.location.origin}${window.location.pathname}#doc=${id}`;
    navigator.clipboard.writeText(url);
    setToastMsg('Ссылка скопирована!');
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  };

  return (
    <div className="flex flex-col h-screen bg-[#eef1f4]">
      {/* Header */}
      <header className="bg-white px-4 py-3 flex items-center justify-between border-b shadow-sm">
        <div className="flex items-center gap-3">
          <div onClick={() => setView('setup')} className="w-8 h-8 rounded-full bg-[#0088cc] flex items-center justify-center text-white cursor-pointer shadow-lg active:scale-95 transition-transform">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
          </div>
          <h1 className="font-bold text-sm tracking-tight text-gray-800">Архив Бухгалтерии</h1>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-xl">
          <button onClick={() => setView('chat')} className={`px-4 py-1.5 text-[11px] font-bold rounded-lg transition-all ${view === 'chat' ? 'bg-white shadow-sm text-[#0088cc]' : 'text-gray-500'}`}>Чат</button>
          <button onClick={() => {setView('folders'); setCurrentFolder(null);}} className={`px-4 py-1.5 text-[11px] font-bold rounded-lg transition-all ${view === 'folders' ? 'bg-white shadow-sm text-[#0088cc]' : 'text-gray-500'}`}>Папки</button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative">
        {view === 'chat' ? (
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map(m => (
                <div key={m.id} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-3 rounded-2xl shadow-sm text-[13px] ${m.sender === 'user' ? 'bg-[#effdde] border border-[#d6e8c1]' : 'bg-white border'}`}>
                    {m.text && <p className="whitespace-pre-wrap">{m.text}</p>}
                    {m.attachedDocId && (
                      <div onClick={() => copyLink(m.attachedDocId!)} className="mt-2 p-2 bg-black/5 rounded-xl flex items-center gap-2 cursor-pointer active:bg-black/10">
                        <div className="p-1.5 bg-[#0088cc] rounded-lg text-white"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg></div>
                        <span className="text-[11px] font-bold truncate">{documents.find(d => d.id === m.attachedDocId)?.name}</span>
                      </div>
                    )}
                    <div className="text-[9px] text-gray-400 mt-1 text-right">{m.timestamp}</div>
                  </div>
                </div>
              ))}
            </div>
            {/* Input */}
            <div className="p-3 bg-white border-t">
              <div className="flex items-center gap-2 max-w-2xl mx-auto">
                <input type="file" id="f" className="hidden" onChange={(e) => {const file = e.target.files?.[0]; if(file) handleSend(inputText, file)}} />
                <label htmlFor="f" className="p-2 text-gray-400 cursor-pointer hover:text-[#0088cc]"><svg className="w-6 h-6 rotate-45" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.414a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg></label>
                <input value={inputText} onChange={e => setInputText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend(inputText)} placeholder="Сообщение или /команда..." className="flex-1 bg-gray-100 rounded-xl px-4 py-2 text-sm focus:outline-none" />
                <button onClick={() => handleSend(inputText)} className="p-2.5 bg-[#0088cc] text-white rounded-full"><svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg></button>
              </div>
            </div>
          </div>
        ) : view === 'folders' ? (
          <div className="p-4 h-full overflow-y-auto">
            {!currentFolder ? (
              <div className="grid grid-cols-1 gap-3">
                {FOLDERS.map(f => (
                  <div key={f.id} onClick={() => setCurrentFolder(f.id)} className="flex items-center gap-4 p-4 bg-white rounded-2xl shadow-sm cursor-pointer active:scale-[0.98] transition-all">
                    <div className={`${f.color} w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-md`}>{f.icon}</div>
                    <div className="flex-1">
                      <h3 className="font-bold text-sm text-gray-800">{f.name}</h3>
                      <p className="text-[10px] text-gray-400 font-bold uppercase">{documents.filter(d => d.folder === f.id).length} файлов</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm h-full flex flex-col overflow-hidden">
                <div className="p-4 border-b flex items-center justify-between">
                  <button onClick={() => setCurrentFolder(null)} className="text-xs font-black text-[#0088cc] uppercase flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg> Назад
                  </button>
                  <span className="text-[11px] font-black text-gray-400 uppercase">{FOLDERS.find(f => f.id === currentFolder)?.name}</span>
                </div>
                <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
                  {documents.filter(d => d.folder === currentFolder).map(d => (
                    <div key={d.id} className="p-4 flex items-center justify-between group">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-8 h-8 rounded bg-blue-50 text-[#0088cc] flex items-center justify-center shrink-0">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-[13px] font-bold text-gray-800 truncate">{d.name}</p>
                          <p className="text-[10px] text-gray-400">{d.uploadDate} • {d.size}</p>
                        </div>
                      </div>
                      <button onClick={() => copyLink(d.id)} className="p-2 text-gray-300 hover:text-[#0088cc]"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg></button>
                    </div>
                  ))}
                  {documents.filter(d => d.folder === currentFolder).length === 0 && (
                    <div className="p-12 text-center text-gray-400 text-xs font-bold uppercase opacity-50">Папка пуста</div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-6 bg-white h-full overflow-y-auto">
            <h2 className="text-xl font-black mb-6">Настройка</h2>
            <div className="space-y-6">
              <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                <p className="text-[11px] font-bold text-blue-600 uppercase mb-2">Статус</p>
                <p className="text-[13px] text-blue-900 leading-relaxed">Приложение запущено локально. Все данные сохраняются только в этом браузере.</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-3">Команды</p>
                <div className="space-y-2">
                  {Object.entries(COMMAND_MAP).map(([cmd, folder]) => (
                    <div key={cmd} className="flex justify-between items-center text-[12px] p-2 bg-gray-50 rounded-lg">
                      <span className="font-mono font-bold text-[#0088cc]">{cmd}</span>
                      <span className="text-gray-500">{FOLDERS.find(f => f.id === folder)?.name}</span>
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={() => setView('chat')} className="w-full py-3 bg-[#0088cc] text-white rounded-xl font-bold text-sm shadow-md active:scale-95 transition-transform">Вернуться в чат</button>
            </div>
          </div>
        )}

        {isUploading && (
          <div className="absolute top-0 left-0 w-full h-1 bg-blue-100 overflow-hidden z-50">
            <div className="h-full bg-[#0088cc] animate-[loading_1s_linear_infinite] w-1/3"></div>
          </div>
        )}
      </main>

      {showToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-[#333] text-white text-[11px] font-bold px-4 py-2 rounded-full shadow-2xl z-50 animate-bounce">
          {toastMsg}
        </div>
      )}

      <style>{`
        @keyframes loading { 0% { transform: translateX(-100%); } 100% { transform: translateX(300%); } }
      `}</style>
    </div>
  );
};

export default App;

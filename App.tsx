
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Type } from "@google/genai";

// --- ТИПЫ ДАННЫХ ---
type FolderType = 'invoices' | 'waybills' | 'contracts' | 'misc' | 'taxes';

interface Folder {
  id: FolderType;
  name: string;
  description: string;
  color: string;
  icon: React.ReactNode;
}

interface Document {
  id: string;
  name: string;
  folder: FolderType;
  uploadDate: string;
  size: string;
  uploader: string;
}

interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'system';
  timestamp: string;
  attachedDocId?: string;
}

// --- КОНСТАНТЫ ---
const FOLDERS: Folder[] = [
  {
    id: 'invoices',
    name: 'Счета и спецификации',
    description: 'Входящие и исходящие счета',
    color: 'bg-blue-500',
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
  },
  {
    id: 'waybills',
    name: 'Накладные',
    description: 'Отгрузочные документы и УПД',
    color: 'bg-emerald-500',
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
  },
  {
    id: 'contracts',
    name: 'Договоры',
    description: 'Соглашения с контрагентами',
    color: 'bg-amber-500',
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
  },
  {
    id: 'taxes',
    name: 'Налоги и отчетность',
    description: 'Декларации и сверки',
    color: 'bg-indigo-500',
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
  },
  {
    id: 'misc',
    name: 'Разное',
    description: 'Прочие документы',
    color: 'bg-slate-500',
    icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9l-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
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

// --- СЕРВИС AI ---
const analyzeFileWithAI = async (fileName: string): Promise<{ suggestedFolder: FolderType; reasoning: string }> => {
  const apiKey = (window as any).process?.env?.API_KEY;
  if (!apiKey) {
    const name = fileName.toLowerCase();
    if (name.includes('счет') || name.includes('inv')) return { suggestedFolder: 'invoices', reasoning: 'Ключевое слово "Счет"' };
    if (name.includes('накл') || name.includes('упд')) return { suggestedFolder: 'waybills', reasoning: 'Ключевое слово "Накладная"' };
    if (name.includes('дог')) return { suggestedFolder: 'contracts', reasoning: 'Ключевое слово "Договор"' };
    return { suggestedFolder: 'misc', reasoning: 'Категория не определена' };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
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
    return JSON.parse(response.text || "{}");
  } catch (e) {
    console.error("AI Analysis failed:", e);
    return { suggestedFolder: 'misc', reasoning: 'Ошибка анализа' };
  }
};

// --- ОСНОВНОЙ КОМПОНЕНТ ---
const App: React.FC = () => {
  const [view, setView] = useState<'chat' | 'folders' | 'setup'>('chat');
  const [currentFolderId, setCurrentFolderId] = useState<FolderType | null>(null);
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [toast, setToast] = useState<{ show: boolean; msg: string }>({ show: false, msg: '' });

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
    }
    
    const saved = localStorage.getItem('account_archive_docs');
    if (saved) {
      try {
        setDocuments(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load docs:", e);
      }
    }

    setMessages([{
      id: 'init',
      text: '📂 Добро пожаловать в Архив.\nПришлите файл, и я автоматически сохраню его в нужную папку.\n\nКоманды: /счета, /накладные, /договоры, /налоги',
      sender: 'system',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);
  }, []);

  useEffect(() => {
    if (documents.length >= 0) {
      localStorage.setItem('account_archive_docs', JSON.stringify(documents));
    }
  }, [documents]);

  const showToastMsg = (msg: string) => {
    setToast({ show: true, msg });
    setTimeout(() => setToast({ show: false, msg: '' }), 2500);
  };

  const handleSend = async (text: string, file?: File) => {
    if (!text.trim() && !file) return;

    let attachedId: string | undefined;

    if (file) {
      setIsUploading(true);
      const { suggestedFolder, reasoning } = await analyzeFileWithAI(file.name);
      
      const newDoc: Document = {
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        folder: suggestedFolder,
        uploadDate: new Date().toLocaleDateString('ru-RU'),
        size: `${(file.size / 1024).toFixed(1)} KB`,
        uploader: 'Вы',
      };

      setDocuments(prev => [newDoc, ...prev]);
      attachedId = newDoc.id;
      
      const messageText = text.trim() || `📄 Файл: ${file.name}\n💡 AI: ${reasoning}`;
      
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        text: messageText,
        sender: 'user',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        attachedDocId: attachedId
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

  const copyDocUrl = (docId: string) => {
    const url = `${window.location.origin}${window.location.pathname}#doc=${docId}`;
    navigator.clipboard.writeText(url).then(() => {
      showToastMsg('Ссылка скопирована!');
    });
  };

  return (
    <div className="flex flex-col h-screen bg-[#f0f2f5] max-w-xl mx-auto border-x border-gray-200 shadow-2xl relative overflow-hidden">
      <header className="bg-white px-4 py-3 flex items-center justify-between border-b shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div onClick={() => setView('setup')} className="w-9 h-9 rounded-full bg-[#0088cc] flex items-center justify-center text-white cursor-pointer shadow-lg active:scale-95 transition-transform">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
          </div>
          <h1 className="font-extrabold text-[15px] tracking-tight text-gray-800">Архив Бухгалтерии</h1>
        </div>
        <div className="flex bg-gray-100 p-1 rounded-xl">
          <button onClick={() => setView('chat')} className={`px-4 py-1.5 text-[11px] font-bold rounded-lg transition-all ${view === 'chat' ? 'bg-white shadow-sm text-[#0088cc]' : 'text-gray-500'}`}>ЧАТ</button>
          <button onClick={() => {setView('folders'); setCurrentFolderId(null);}} className={`px-4 py-1.5 text-[11px] font-bold rounded-lg transition-all ${view === 'folders' ? 'bg-white shadow-sm text-[#0088cc]' : 'text-gray-500'}`}>ПАПКИ</button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative">
        {view === 'chat' && (
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map(m => (
                <div key={m.id} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-3 rounded-2xl shadow-sm text-[13.5px] leading-relaxed ${m.sender === 'user' ? 'bg-[#effdde] border border-[#d1e3b8]' : 'bg-white border border-gray-100'}`}>
                    {m.text && <p className="whitespace-pre-wrap text-gray-800">{m.text}</p>}
                    {m.attachedDocId && (
                      <div onClick={() => copyDocUrl(m.attachedDocId!)} className="mt-2.5 p-2 bg-black/5 rounded-xl flex items-center gap-3 cursor-pointer active:bg-black/10 transition-colors">
                        <div className="p-2 bg-[#0088cc] rounded-lg text-white"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg></div>
                        <div className="overflow-hidden">
                          <p className="text-[11px] font-bold truncate text-gray-700">{documents.find(d => d.id === m.attachedDocId)?.name}</p>
                          <p className="text-[9px] text-gray-400 font-bold uppercase">Нажми, чтобы скопировать ссылку</p>
                        </div>
                      </div>
                    )}
                    <div className="text-[9px] text-gray-400 mt-1.5 font-bold text-right uppercase opacity-60 tracking-tighter">{m.timestamp}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 bg-white border-t shrink-0">
              <div className="flex items-center gap-2 max-w-2xl mx-auto">
                <input type="file" id="file-upload" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if(f) handleSend(inputText, f); }} />
                <label htmlFor="file-upload" className="p-2.5 text-gray-400 cursor-pointer hover:text-[#0088cc] active:scale-90 transition-transform"><svg className="w-6 h-6 rotate-45" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.414a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg></label>
                <input value={inputText} onChange={e => setInputText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend(inputText)} placeholder="Сообщение или команда..." className="flex-1 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-2.5 text-sm focus:ring-1 focus:ring-[#0088cc] outline-none transition-all" />
                <button onClick={() => handleSend(inputText)} className="p-3 bg-[#0088cc] text-white rounded-full shadow-lg active:scale-95 transition-transform"><svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg></button>
              </div>
            </div>
          </div>
        )}

        {view === 'folders' && (
          <div className="p-5 h-full overflow-y-auto">
            {!currentFolderId ? (
              <div className="grid grid-cols-1 gap-4">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[2px] mb-1">Ваше хранилище</p>
                {FOLDERS.map(f => (
                  <div key={f.id} onClick={() => setCurrentFolderId(f.id)} className="flex items-center gap-5 p-5 bg-white rounded-2xl shadow-sm border border-transparent hover:border-gray-200 cursor-pointer active:scale-[0.98] transition-all">
                    <div className={`${f.color} w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-md`}>{f.icon}</div>
                    <div className="flex-1">
                      <h3 className="font-extrabold text-[15px] text-gray-800">{f.name}</h3>
                      <p className="text-[11px] text-gray-400 font-bold uppercase tracking-tight">{documents.filter(d => d.folder === f.id).length} файлов</p>
                    </div>
                    <svg className="w-5 h-5 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-3xl shadow-xl h-full flex flex-col overflow-hidden border border-gray-100">
                <div className="p-5 border-b bg-gray-50 flex items-center justify-between">
                  <button onClick={() => setCurrentFolderId(null)} className="text-[11px] font-black text-[#0088cc] uppercase flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg> НАЗАД
                  </button>
                  <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">{FOLDERS.find(f => f.id === currentFolderId)?.name}</span>
                </div>
                <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
                  {documents.filter(d => d.folder === currentFolderId).map(d => (
                    <div key={d.id} className="p-5 flex items-center justify-between group hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-4 overflow-hidden">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0088cc] flex items-center justify-center shrink-0">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-[13.5px] font-extrabold text-gray-800 truncate leading-tight mb-1">{d.name}</p>
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">{d.uploadDate} • {d.size}</p>
                        </div>
                      </div>
                      <button onClick={() => copyDocUrl(d.id)} className="p-3 text-gray-300 hover:text-[#0088cc] active:scale-90 transition-all"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg></button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {view === 'setup' && (
          <div className="p-8 bg-white h-full overflow-y-auto">
            <h2 className="text-2xl font-black mb-8 tracking-tighter">Настройки</h2>
            <button onClick={() => setView('chat')} className="w-full py-4 bg-[#0088cc] text-white rounded-2xl font-black text-[13px] shadow-xl uppercase tracking-widest">Вернуться</button>
          </div>
        )}

        {isUploading && (
          <div className="absolute top-0 left-0 w-full h-1 bg-blue-100 overflow-hidden z-50">
            <div className="h-full bg-[#0088cc] animate-[progress_1.5s_ease-in-out_infinite] w-1/3"></div>
          </div>
        )}
      </main>

      {toast.show && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-[#1f2937] text-white text-[11px] font-black px-6 py-3 rounded-2xl shadow-2xl z-50 animate-bounce border border-white/10">
          {toast.msg}
        </div>
      )}

      <style>{`
        @keyframes progress { 0% { transform: translateX(-100%); } 100% { transform: translateX(300%); } }
      `}</style>
    </div>
  );
};

// Экспортируем в глобальную область для Babel
(window as any).App = App;
export default App;

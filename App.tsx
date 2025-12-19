
import React, { useState, useRef, useEffect } from 'react';
import { FOLDERS } from './constants';
import { FolderType, Document, ChatMessage } from './types';
import { analyzeDocument } from './services/geminiService';

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

const App: React.FC = () => {
  const [view, setView] = useState<'chat' | 'folders'>('chat');
  const [currentFolder, setCurrentFolder] = useState<FolderType | null>(null);
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [highlightedDocId, setHighlightedDocId] = useState<string | null>(null);

  // Initialize and handle Deep Linking
  useEffect(() => {
    // 1. Initial Greeting
    setMessages([
      {
        id: 'welcome',
        text: '👋 Привет! Это ваш рабочий архив.\n\nКидай сюда любые документы. Если хочешь сразу в папку, используй команды:\n\n/счета, /накладные, /договоры, /налоги',
        sender: 'system',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
    ]);

    // 2. Load documents from localStorage (simple persistence for demo)
    const savedDocs = localStorage.getItem('accounting_docs');
    if (savedDocs) {
      setDocuments(JSON.parse(savedDocs));
    }

    // 3. Handle Hash Routing (Deep Links)
    const handleHash = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#doc=')) {
        const docId = hash.replace('#doc=', '');
        setHighlightedDocId(docId);
        // Find folder for this doc
        const allDocs = JSON.parse(localStorage.getItem('accounting_docs') || '[]');
        const doc = allDocs.find((d: any) => d.id === docId);
        if (doc) {
          setCurrentFolder(doc.folder);
          setView('folders');
        }
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // Persist docs
  useEffect(() => {
    if (documents.length > 0) {
      localStorage.setItem('accounting_docs', JSON.stringify(documents));
    }
  }, [documents]);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const detectFolder = (text: string): FolderType | null => {
    const lowerText = text.toLowerCase();
    for (const [cmd, folder] of Object.entries(COMMAND_MAP)) {
      if (lowerText.includes(cmd)) return folder;
    }
    return null;
  };

  const handleFileUpload = async (file: File, text: string) => {
    setIsUploading(true);
    let targetFolder = detectFolder(text);

    if (!targetFolder) {
      const aiResult = await analyzeDocument(file.name);
      targetFolder = aiResult.suggestedFolder;
    }

    const newDoc: Document = {
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      folder: targetFolder,
      uploadDate: new Date().toLocaleDateString('ru-RU'),
      size: `${(file.size / 1024).toFixed(1)} KB`,
      uploader: 'Вы',
      url: '#'
    };

    setDocuments(prev => [newDoc, ...prev]);

    const newMessage: ChatMessage = {
      id: Math.random().toString(36).substr(2, 9),
      text: text || `📄 Загружен файл: ${file.name}`,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      attachedDocId: newDoc.id,
    };

    setMessages(prev => [...prev, newMessage]);
    setIsUploading(false);
    setInputText('');
  };

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file, inputText);
  };

  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const newMessage: ChatMessage = {
      id: Math.random().toString(36).substr(2, 9),
      text: inputText,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, newMessage]);
    setInputText('');
  };

  const copyDocLink = (docId: string) => {
    const doc = documents.find(d => d.id === docId);
    if (doc) {
      const baseUrl = window.location.origin + window.location.pathname;
      const shareUrl = `${baseUrl}#doc=${docId}`;
      const shareText = `📎 Документ: ${doc.name}\n📂 Папка: ${FOLDERS.find(f => f.id === doc.folder)?.name}\n🔗 Открыть в приложении: ${shareUrl}`;
      
      navigator.clipboard.writeText(shareText);
      setToastMessage('Ссылка для чата скопирована!');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);
    }
  };

  return (
    <div className="max-w-md mx-auto h-screen flex flex-col bg-[#e6ebee] font-sans shadow-xl overflow-hidden relative">
      {/* Header */}
      <header className="bg-white px-4 py-3 flex items-center justify-between border-b shrink-0 z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#0088cc] flex items-center justify-center text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-900 leading-tight">Бухгалтерия Архив</h1>
            <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Online</p>
          </div>
        </div>
        
        <div className="flex bg-gray-100 p-1 rounded-xl">
          <button 
            onClick={() => setView('chat')}
            className={`px-4 py-1.5 text-xs rounded-lg transition-all duration-200 ${view === 'chat' ? 'bg-white shadow-sm text-[#0088cc] font-bold' : 'text-gray-500'}`}
          >
            Чат
          </button>
          <button 
            onClick={() => { setView('folders'); setHighlightedDocId(null); }}
            className={`px-4 py-1.5 text-xs rounded-lg transition-all duration-200 ${view === 'folders' ? 'bg-white shadow-sm text-[#0088cc] font-bold' : 'text-gray-500'}`}
          >
            Папки
          </button>
        </div>
      </header>

      {/* Main Area */}
      <main className="flex-1 overflow-hidden relative">
        {view === 'chat' ? (
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl p-3 shadow-sm relative ${
                    msg.sender === 'user' 
                      ? 'bg-[#effdde] text-gray-800 rounded-tr-none border border-[#dae6cc]' 
                      : 'bg-white text-gray-800 rounded-tl-none border border-gray-100'
                  }`}>
                    {msg.text && <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{msg.text}</p>}
                    
                    {msg.attachedDocId && (
                      <div 
                        onClick={() => copyDocLink(msg.attachedDocId!)}
                        className="mt-2 p-2.5 rounded-xl flex items-center gap-3 cursor-pointer bg-black/5 hover:bg-black/10 transition-colors"
                      >
                        <div className="p-2 bg-[#0088cc] rounded-lg text-white">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-[11px] font-bold truncate">
                            {documents.find(d => d.id === msg.attachedDocId)?.name}
                          </p>
                          <p className="text-[9px] opacity-70 uppercase font-black text-[#0088cc]">
                            Папка: {FOLDERS.find(f => f.id === documents.find(d => d.id === msg.attachedDocId)?.folder)?.name}
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="flex justify-end mt-1">
                      <span className="text-[9px] font-medium opacity-40">{msg.timestamp}</span>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Input Bar */}
            <div className="p-3 bg-white border-t shrink-0">
              <form onSubmit={handleSendText} className="flex items-center gap-2 max-w-screen-sm mx-auto">
                <button 
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2.5 text-gray-400 hover:text-[#0088cc]"
                >
                  <svg className="w-6 h-6 rotate-45" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.414a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                </button>
                <input 
                  type="text" 
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Сообщение или /слэш..."
                  className="flex-1 bg-gray-100 border-none rounded-2xl px-4 py-2.5 text-sm focus:ring-0 focus:outline-none"
                />
                <button 
                  type="submit"
                  className="p-2.5 bg-[#0088cc] text-white rounded-full disabled:opacity-50"
                  disabled={!inputText.trim()}
                >
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                  </svg>
                </button>
                <input type="file" ref={fileInputRef} className="hidden" onChange={onFileSelect} />
              </form>
            </div>
          </div>
        ) : (
          /* Folders View */
          <div className="p-4 h-full overflow-y-auto pb-20">
            {!currentFolder ? (
              <div className="space-y-3">
                <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest px-2">Категории</p>
                {FOLDERS.map((folder) => (
                  <button
                    key={folder.id}
                    onClick={() => setCurrentFolder(folder.id)}
                    className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-transparent hover:border-blue-100 transition-all text-left w-full shadow-sm"
                  >
                    <div className={`${folder.color} p-2.5 rounded-xl text-white`}>
                      <div className="w-6 h-6">{folder.icon}</div>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-800 text-sm">{folder.name}</h3>
                      <p className="text-[10px] text-gray-400 font-bold uppercase">{documents.filter(d => d.folder === folder.id).length} файлов</p>
                    </div>
                    <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border flex flex-col max-h-full">
                <div className="p-4 bg-gray-50 border-b flex items-center justify-between">
                  <button onClick={() => {setCurrentFolder(null); setHighlightedDocId(null);}} className="text-xs text-[#0088cc] font-black flex items-center gap-1.5 uppercase">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Назад
                  </button>
                  <span className="text-[10px] font-black text-gray-400 uppercase">
                    {FOLDERS.find(f => f.id === currentFolder)?.name}
                  </span>
                </div>
                <div className="divide-y divide-gray-50 overflow-y-auto">
                  {documents.filter(d => d.folder === currentFolder).length === 0 ? (
                    <div className="p-16 text-center">
                      <p className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Папка пуста</p>
                    </div>
                  ) : (
                    documents.filter(d => d.folder === currentFolder).map(doc => (
                      <div 
                        key={doc.id} 
                        id={`doc-${doc.id}`}
                        className={`p-4 flex items-center justify-between transition-colors ${highlightedDocId === doc.id ? 'bg-blue-50 border-l-4 border-blue-500' : 'hover:bg-gray-50'}`}
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className="bg-blue-50 p-2 rounded-lg text-[#0088cc]">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <div className="overflow-hidden">
                            <p className="text-[13px] font-bold text-gray-800 truncate">{doc.name}</p>
                            <p className="text-[10px] text-gray-400 font-bold">{doc.uploadDate} • {doc.size}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => copyDocLink(doc.id)}
                          className="p-2 text-gray-300 hover:text-[#0088cc]"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                          </svg>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {isUploading && (
          <div className="absolute top-0 left-0 w-full h-1 bg-blue-100 overflow-hidden z-30">
            <div className="h-full bg-[#0088cc] animate-[loading_1s_linear_infinite] w-1/3"></div>
          </div>
        )}
      </main>

      {showToast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-[#333] text-white text-[11px] font-bold px-6 py-3 rounded-full shadow-2xl z-50 uppercase tracking-widest border border-white/10">
          {toastMessage}
        </div>
      )}

      <style>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default App;

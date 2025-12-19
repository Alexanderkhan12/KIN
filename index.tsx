
import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";

// Конфигурация папок
const FOLDERS = [
  { id: 'invoices', name: 'Счета и спецификации', cmd: 'invoice', icon: '📄', color: 'bg-blue-500' },
  { id: 'waybills', name: 'Накладные и УПД', cmd: 'waybill', icon: '🚚', color: 'bg-emerald-500' },
  { id: 'contracts', name: 'Договоры', cmd: 'contract', icon: '📝', color: 'bg-orange-500' },
  { id: 'taxes', name: 'Налоги и отчеты', cmd: 'tax', icon: '📊', color: 'bg-indigo-500' },
  { id: 'misc', name: 'Разное', cmd: 'misc', icon: '📁', color: 'bg-slate-400' },
];

const App = () => {
  const [view, setView] = useState('main'); 
  const [activeFolder, setActiveFolder] = useState(null);
  const [storage, setStorage] = useState([]);
  const [botName, setBotName] = useState(localStorage.getItem('bot_name') || 'YourBotName_bot');
  const [loading, setLoading] = useState(false);

  const tg = (window as any).Telegram?.WebApp;

  useEffect(() => {
    if (tg) {
      tg.ready();
      tg.expand();
      
      // Обработка параметров запуска (Deep Links)
      const startParam = tg.initDataUnsafe?.start_param;
      if (startParam) {
        const folder = FOLDERS.find(f => f.id === startParam || f.cmd === startParam);
        if (folder) {
          setActiveFolder(folder);
          setView('folder');
        }
      }
    }
    
    const saved = localStorage.getItem('kin_archive_v2');
    if (saved) setStorage(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem('kin_archive_v2', JSON.stringify(storage));
  }, [storage]);

  useEffect(() => {
    localStorage.setItem('bot_name', botName);
  }, [botName]);

  useEffect(() => {
    if (tg) {
      if (view !== 'main') {
        tg.BackButton.show();
        tg.BackButton.onClick(() => setView('main'));
      } else {
        tg.BackButton.hide();
      }
    }
  }, [view, tg]);

  const analyzeFileWithAI = async (fileName: string) => {
    const apiKey = (process.env as any).API_KEY;
    if (!apiKey) return 'misc';
    
    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Определи категорию документа по названию: "${fileName}". 
        Доступные категории: invoices, waybills, contracts, taxes, misc.
        Верни ТОЛЬКО id категории в формате JSON.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              category: { type: Type.STRING }
            }
          }
        }
      });
      
      const result = JSON.parse(response.text);
      return FOLDERS.some(f => f.id === result.category) ? result.category : 'misc';
    } catch (e) {
      console.error(e);
      return 'misc';
    }
  };

  const onFileAdd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setLoading(true);
    let folderId = activeFolder?.id;
    
    if (!folderId) {
      folderId = await analyzeFileWithAI(file.name);
    }

    const newDoc = {
      id: Date.now().toString(),
      name: file.name,
      folder: folderId,
      date: new Date().toLocaleDateString('ru-RU'),
      user: tg?.initDataUnsafe?.user?.first_name || 'Сотрудник'
    };
    
    setStorage(prev => [newDoc, ...prev]);
    setLoading(false);
    tg?.HapticFeedback.notificationOccurred('success');
    
    if (!activeFolder) {
      const target = FOLDERS.find(f => f.id === folderId);
      setActiveFolder(target);
      setView('folder');
    }
  };

  const copyToClipboard = (text: string, msg = 'Скопировано!') => {
    navigator.clipboard.writeText(text);
    tg?.HapticFeedback.impactOccurred('medium');
    tg?.showAlert(msg);
  };

  const getDeepLink = (folderId = '') => {
    const cleanName = botName.replace('@','').trim();
    return `https://t.me/${cleanName}/app${folderId ? '?startapp=' + folderId : ''}`;
  };

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto overflow-hidden bg-[var(--tg-sec-bg)]">
      
      <header className="bg-[var(--tg-bg)] px-6 pt-10 pb-6 border-b border-black/5 flex justify-between items-center sticky top-0 z-50">
        <div>
          <h1 className="text-xl font-extrabold text-[var(--tg-text)]">
            {view === 'folder' ? activeFolder.name : (view === 'setup' ? 'Настройки' : 'Архив')}
          </h1>
          <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">
            {view === 'folder' ? 'Бухгалтерия' : 'Общие файлы'}
          </p>
        </div>
        {view === 'main' && (
          <button onClick={() => setView('setup')} className="w-10 h-10 flex items-center justify-center bg-blue-50 rounded-full text-blue-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
          </button>
        )}
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-3 relative">
        {loading && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-[10px] font-black uppercase text-blue-600">Анализ документа...</p>
            </div>
          </div>
        )}

        {view === 'main' && (
          <>
            <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm mb-2">
              <p className="text-gray-900 font-bold text-sm mb-3">Ссылка для чата группы:</p>
              <button 
                onClick={() => copyToClipboard(getDeepLink())}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold text-xs uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                Копировать общую ссылку
              </button>
            </div>

            {FOLDERS.map(f => (
              <div 
                key={f.id} 
                onClick={() => { setActiveFolder(f); setView('folder'); }}
                className="bg-white p-4 rounded-3xl flex items-center justify-between shadow-sm active:scale-[0.98] transition-all cursor-pointer border border-transparent active:border-blue-100"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl ${f.color} flex items-center justify-center text-2xl text-white shadow-inner`}>
                    {f.icon}
                  </div>
                  <div>
                    <div className="font-bold text-[15px] text-gray-900">{f.name}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[9px] font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">/{f.cmd}</span>
                      <span className="text-[10px] text-gray-400 font-bold uppercase">
                        {storage.filter(d => d.folder === f.id).length} файлов
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-gray-300">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                </div>
              </div>
            ))}
          </>
        )}

        {view === 'folder' && (
          <div className="space-y-3">
            <div className="bg-white p-4 rounded-3xl border border-gray-100 flex justify-between items-center shadow-sm">
              <span className="text-[10px] font-black uppercase text-gray-400">Команда: /{activeFolder.cmd}</span>
              <button 
                onClick={() => copyToClipboard(getDeepLink(activeFolder.id))}
                className="text-blue-600 font-bold text-xs"
              >
                Копировать ссылку
              </button>
            </div>

            {storage.filter(d => d.folder === activeFolder.id).length > 0 ? (
              storage.filter(d => d.folder === activeFolder.id).map(doc => (
                <div key={doc.id} className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center gap-4 shadow-sm animate-in fade-in slide-in-from-bottom-2">
                  <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-xl">📄</div>
                  <div className="overflow-hidden flex-1">
                    <div className="text-[14px] font-bold truncate text-gray-800">{doc.name}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5 font-bold uppercase">
                      {doc.date} • {doc.user}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-20 text-center flex flex-col items-center opacity-30">
                <div className="text-5xl mb-4">📂</div>
                <p className="text-[10px] font-black uppercase tracking-widest">Папка пуста</p>
              </div>
            )}
          </div>
        )}

        {view === 'setup' && (
          <div className="space-y-4">
            <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
              <h3 className="font-bold text-gray-900 mb-2">Название бота</h3>
              <input 
                type="text" 
                value={botName}
                onChange={(e) => setBotName(e.target.value)}
                placeholder="MyBot_bot"
                className="w-full bg-gray-50 p-3 rounded-xl border border-gray-200 font-bold text-sm outline-none focus:border-blue-400 transition-colors"
              />
              <p className="text-[9px] text-gray-400 mt-2 uppercase font-bold">Нужно для генерации ссылок на папки</p>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-gray-100 space-y-3">
              <h3 className="font-bold text-gray-900">Ссылки для кнопок</h3>
              {FOLDERS.map(f => (
                <div key={f.id} className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-xs text-gray-700">{f.name}</span>
                    <span className="text-[10px] font-mono text-blue-600">/{f.cmd}</span>
                  </div>
                  <button 
                    onClick={() => copyToClipboard(getDeepLink(f.id))}
                    className="w-full text-left py-1 text-[9px] text-gray-400 truncate font-mono"
                  >
                    {getDeepLink(f.id)}
                  </button>
                </div>
              ))}
            </div>
            
            <button 
              onClick={() => setView('main')}
              className="w-full bg-gray-900 text-white py-4 rounded-2xl font-bold text-xs uppercase tracking-widest"
            >
              Вернуться
            </button>
          </div>
        )}
      </main>

      <footer className="bg-[var(--tg-bg)] p-5 border-t border-black/5 pb-10">
        <input type="file" id="up-file" className="hidden" onChange={onFileAdd} />
        <label 
          htmlFor="up-file"
          className="w-full py-4 bg-blue-600 text-white rounded-2xl flex items-center justify-center font-bold text-[13px] uppercase tracking-widest shadow-lg shadow-blue-100 active:scale-95 transition-all cursor-pointer"
        >
          {view === 'folder' ? `Загрузить в "${activeFolder.name}"` : 'Загрузить новый файл'}
        </label>
      </footer>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);

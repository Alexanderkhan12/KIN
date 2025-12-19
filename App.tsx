
import React, { useState, useEffect } from 'react';
import { FOLDERS } from './constants';
import { Folder, Document } from './types';
import { analyzeDocument } from './services/geminiService';

const App: React.FC = () => {
  const [view, setView] = useState<'main' | 'folder' | 'setup'>('main');
  const [activeFolder, setActiveFolder] = useState<Folder | null>(null);
  const [storage, setStorage] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [botName, setBotName] = useState(localStorage.getItem('bot_name_v3') || 'MyBot_bot');

  const tg = (window as any).Telegram?.WebApp;

  useEffect(() => {
    if (tg) {
      tg.ready();
      tg.expand();
      
      const startParam = tg.initDataUnsafe?.start_param;
      if (startParam) {
        const folder = FOLDERS.find(f => f.id === startParam);
        if (folder) {
          setActiveFolder(folder);
          setView('folder');
        }
      }
    }
    const saved = localStorage.getItem('kin_archive_v4');
    if (saved) setStorage(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem('kin_archive_v4', JSON.stringify(storage));
  }, [storage]);

  useEffect(() => {
    if (tg) {
      if (view !== 'main') {
        tg.BackButton.show();
        tg.BackButton.onClick(() => setView('main'));
      } else {
        tg.BackButton.hide();
      }
    }
  }, [view]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const analysis = await analyzeDocument(file.name);
    
    const newDoc: Document = {
      id: Date.now().toString(),
      name: file.name,
      folder: activeFolder?.id || analysis.suggestedFolder,
      date: new Date().toLocaleDateString('ru-RU'),
      size: (file.size / 1024).toFixed(1) + ' KB',
      user: tg?.initDataUnsafe?.user?.first_name || 'Сотрудник'
    };

    setStorage(prev => [newDoc, ...prev]);
    setLoading(false);
    tg?.HapticFeedback?.notificationOccurred('success');

    if (!activeFolder) {
      const target = FOLDERS.find(f => f.id === analysis.suggestedFolder);
      if (target) {
        setActiveFolder(target);
        setView('folder');
      }
    }
  };

  const getDeepLink = (id = '') => {
    const name = botName.replace('@', '').trim();
    return `https://t.me/${name}/app${id ? '?startapp=' + id : ''}`;
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    tg?.showAlert('Скопировано!');
  };

  return (
    <div className="flex flex-col min-h-screen bg-[var(--tg-sec-bg)]">
      <header className="bg-[var(--tg-bg)] p-6 pt-10 border-b border-black/5 flex justify-between items-center sticky top-0 z-30">
        <div>
          <h1 className="text-xl font-extrabold text-[var(--tg-text)]">
            {view === 'folder' ? activeFolder?.name : (view === 'setup' ? 'Настройки' : 'Архив Группы')}
          </h1>
          <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Бухгалтерия</p>
        </div>
        {view === 'main' && (
          <button onClick={() => setView('setup')} className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
            ⚙️
          </button>
        )}
      </header>

      <main className="p-4 flex-1 pb-32 space-y-3">
        {loading && (
          <div className="fixed inset-0 bg-white/70 backdrop-blur-sm z-50 flex items-center justify-center flex-col gap-4">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs font-black uppercase text-blue-600">AI сортировка...</p>
          </div>
        )}

        {view === 'main' && (
          <>
            <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm mb-4">
              <button onClick={() => copy(getDeepLink())} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest">
                Ссылка для чата
              </button>
            </div>
            {FOLDERS.map(f => (
              <div 
                key={f.id} 
                onClick={() => { setActiveFolder(f); setView('folder'); }}
                className="bg-white p-4 rounded-3xl flex items-center justify-between shadow-sm active:scale-95 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl ${f.color} flex items-center justify-center text-2xl text-white`}>{f.icon}</div>
                  <div>
                    <div className="font-bold text-[15px]">{f.name}</div>
                    <div className="text-[10px] text-gray-400 font-bold uppercase">{storage.filter(d => d.folder === f.id).length} файлов</div>
                  </div>
                </div>
                <div className="text-gray-300">▶</div>
              </div>
            ))}
          </>
        )}

        {view === 'folder' && activeFolder && (
          <div className="space-y-3">
             <div className="bg-white p-4 rounded-3xl border border-gray-100 flex justify-between items-center shadow-sm">
                <span className="text-[10px] font-black uppercase text-gray-400">Ссылка раздела</span>
                <button onClick={() => copy(getDeepLink(activeFolder.id))} className="text-blue-600 font-bold text-xs">Копировать</button>
             </div>
             {storage.filter(d => d.folder === activeFolder.id).map(doc => (
               <div key={doc.id} className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center gap-4">
                 <div className="text-2xl">📄</div>
                 <div className="flex-1 overflow-hidden">
                   <div className="text-sm font-bold truncate">{doc.name}</div>
                   <div className="text-[10px] text-gray-400 uppercase font-bold">{doc.date} • {doc.user}</div>
                 </div>
               </div>
             ))}
             {storage.filter(d => d.folder === activeFolder.id).length === 0 && (
               <div className="py-20 text-center opacity-20">📂 ПУСТО</div>
             )}
          </div>
        )}

        {view === 'setup' && (
          <div className="space-y-4">
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
              <h3 className="font-black text-xs uppercase mb-3">Username Бота</h3>
              <input 
                type="text" 
                value={botName} 
                onChange={(e) => setBotName(e.target.value)}
                className="w-full bg-gray-50 p-4 rounded-2xl border-none font-bold text-blue-600 outline-none"
              />
            </div>
            <button onClick={() => setView('main')} className="w-full bg-gray-900 text-white py-5 rounded-3xl font-black text-[11px] uppercase tracking-widest">
              Готово
            </button>
          </div>
        )}
      </main>

      <footer className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[var(--tg-bg)] via-[var(--tg-bg)] to-transparent z-40">
        <input type="file" id="up" className="hidden" onChange={handleFileUpload} />
        <label htmlFor="up" className="w-full bg-blue-600 text-white py-5 rounded-[32px] flex items-center justify-center font-black text-[14px] uppercase tracking-widest shadow-2xl shadow-blue-200 cursor-pointer active:scale-95 transition-all">
          {view === 'folder' ? 'Добавить в папку' : 'Загрузить файл'}
        </label>
      </footer>
    </div>
  );
};

export default App;

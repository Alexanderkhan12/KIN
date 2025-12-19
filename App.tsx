
import React, { useState, useEffect } from 'react';
import { FOLDERS } from './constants';
import { Folder, Document } from './types';
import { analyzeDocument } from './services/geminiService';

const App: React.FC = () => {
  const [view, setView] = useState<'main' | 'folder' | 'setup' | 'instructions'>('main');
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
        // Ищем папку по ID или по команде (без слеша)
        const folder = FOLDERS.find(f => f.id === startParam || f.command.replace('/', '') === startParam);
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

  const getDeepLink = (idOrCmd = '') => {
    const name = botName.replace('@', '').trim();
    const param = idOrCmd.startsWith('/') ? idOrCmd.replace('/', '') : idOrCmd;
    return `https://t.me/${name}/app${param ? '?startapp=' + param : ''}`;
  };

  const copy = (text: string, msg = 'Скопировано!') => {
    navigator.clipboard.writeText(text);
    tg?.HapticFeedback?.impactOccurred('medium');
    tg?.showAlert(msg);
  };

  const getBotFatherCommands = () => {
    return FOLDERS.map(f => `${f.command.replace('/', '')} - ${f.name}`).join('\n');
  };

  return (
    <div className="flex flex-col min-h-screen bg-[var(--tg-sec-bg)]">
      <header className="bg-[var(--tg-bg)] p-6 pt-10 border-b border-black/5 flex justify-between items-center sticky top-0 z-30">
        <div>
          <h1 className="text-xl font-extrabold text-[var(--tg-text)]">
            {view === 'folder' ? activeFolder?.name : (view === 'setup' ? 'Настройки' : (view === 'instructions' ? 'Инструкция' : 'Архив Группы'))}
          </h1>
          <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">
            {view === 'folder' ? `Команда: ${activeFolder?.command}` : 'Бухгалтерия'}
          </p>
        </div>
        {view === 'main' && (
          <div className="flex gap-2">
            <button onClick={() => setView('instructions')} className="w-10 h-10 bg-orange-50 rounded-full flex items-center justify-center text-orange-600 text-lg">
              ❓
            </button>
            <button onClick={() => setView('setup')} className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 text-lg">
              ⚙️
            </button>
          </div>
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
              <h3 className="text-xs font-black text-gray-400 uppercase mb-3 tracking-widest text-center">Главная ссылка для чата</h3>
              <button onClick={() => copy(getDeepLink())} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-blue-100 active:scale-95 transition-all">
                Копировать общую ссылку
              </button>
            </div>
            {FOLDERS.map(f => (
              <div 
                key={f.id} 
                onClick={() => { setActiveFolder(f); setView('folder'); }}
                className="bg-white p-4 rounded-3xl flex items-center justify-between shadow-sm active:scale-95 transition-all cursor-pointer border border-transparent hover:border-blue-50"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl ${f.color} flex items-center justify-center text-2xl text-white shadow-inner`}>{f.icon}</div>
                  <div>
                    <div className="font-bold text-[15px]">{f.name}</div>
                    <div className="flex gap-2 mt-0.5">
                      <span className="text-[9px] font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">{f.command}</span>
                      <span className="text-[10px] text-gray-400 font-bold uppercase">{storage.filter(d => d.folder === f.id).length} файлов</span>
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

        {view === 'folder' && activeFolder && (
          <div className="space-y-3">
             <div className="bg-white p-4 rounded-3xl border border-gray-100 flex justify-between items-center shadow-sm">
                <div className="flex flex-col">
                  <span className="text-[9px] font-black uppercase text-gray-400 tracking-widest">Прямая ссылка</span>
                  <span className="text-[11px] font-mono text-blue-600 truncate max-w-[150px]">{getDeepLink(activeFolder.command)}</span>
                </div>
                <button onClick={() => copy(getDeepLink(activeFolder.command))} className="bg-blue-50 text-blue-600 px-4 py-2 rounded-xl font-bold text-xs active:scale-90 transition-all">Копировать</button>
             </div>
             {storage.filter(d => d.folder === activeFolder.id).map(doc => (
               <div key={doc.id} className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center gap-4 shadow-sm">
                 <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-xl">📄</div>
                 <div className="flex-1 overflow-hidden">
                   <div className="text-sm font-bold truncate text-gray-800">{doc.name}</div>
                   <div className="text-[10px] text-gray-400 uppercase font-bold mt-0.5">{doc.date} • {doc.user}</div>
                 </div>
               </div>
             ))}
             {storage.filter(d => d.folder === activeFolder.id).length === 0 && (
               <div className="py-24 text-center opacity-30">
                 <div className="text-6xl mb-4">📁</div>
                 <div className="text-[10px] font-black uppercase tracking-[0.3em]">Здесь пока пусто</div>
               </div>
             )}
          </div>
        )}

        {view === 'setup' && (
          <div className="space-y-4">
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
              <h3 className="font-black text-xs uppercase mb-3 tracking-widest text-gray-500">Username Вашего Бота</h3>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">@</span>
                <input 
                  type="text" 
                  value={botName.replace('@', '')} 
                  onChange={(e) => setBotName(e.target.value)}
                  placeholder="CompanyBot"
                  className="w-full bg-gray-50 p-4 pl-9 rounded-2xl border-none font-bold text-blue-600 outline-none focus:ring-2 ring-blue-100 transition-all"
                />
              </div>
              <p className="text-[9px] text-gray-400 mt-3 font-bold uppercase leading-relaxed">Это нужно для того, чтобы ссылки на разделы ( Deep Links ) открывали именно ваше приложение.</p>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
              <h3 className="font-black text-xs uppercase mb-3 tracking-widest text-gray-500">Команды для @BotFather</h3>
              <div className="bg-gray-50 p-3 rounded-xl font-mono text-[11px] text-gray-600 whitespace-pre mb-3 overflow-x-auto">
                {getBotFatherCommands()}
              </div>
              <button 
                onClick={() => copy(getBotFatherCommands(), 'Список команд скопирован для BotFather')}
                className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-bold text-xs uppercase tracking-widest active:scale-95 transition-all"
              >
                Скопировать список команд
              </button>
            </div>

            <button onClick={() => setView('main')} className="w-full bg-gray-900 text-white py-5 rounded-3xl font-black text-[11px] uppercase tracking-widest shadow-xl active:scale-95 transition-all">
              Сохранить изменения
            </button>
          </div>
        )}

        {view === 'instructions' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
              <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center text-2xl mb-4">🚀</div>
              <h3 className="font-black text-lg text-gray-900 mb-2">Как запустить в чате?</h3>
              <ol className="text-sm text-gray-600 space-y-4 list-decimal pl-5">
                <li>Добавьте вашего бота в <b>групповой чат</b> бухгалтерии и сделайте его администратором.</li>
                <li>Перейдите в <b>@BotFather</b>, выберите вашего бота и пункт <code>/setcommands</code>.</li>
                <li>Вставьте список команд из раздела <b>Настройки</b> этого приложения.</li>
                <li>Теперь ваш бот (через backend) должен при вводе команды отправлять кнопку со ссылкой на нужный раздел.</li>
              </ol>
            </div>
            
            <div className="bg-blue-600 p-6 rounded-3xl text-white shadow-lg">
              <h3 className="font-bold mb-2">Пример ссылки раздела:</h3>
              <div className="bg-blue-700/50 p-3 rounded-xl font-mono text-[10px] break-all mb-4 opacity-80">
                {getDeepLink('/счет')}
              </div>
              <p className="text-[11px] leading-relaxed opacity-90">
                Эта ссылка откроет приложение сразу на папке <b>Счета</b>. Бот должен подставлять такую ссылку в кнопку <code>WebAppInfo</code>.
              </p>
            </div>

            <button onClick={() => setView('main')} className="w-full bg-white border border-gray-100 py-5 rounded-3xl font-black text-[11px] uppercase tracking-widest shadow-sm active:scale-95 transition-all">
              Понятно
            </button>
          </div>
        )}
      </main>

      <footer className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[var(--tg-bg)] via-[var(--tg-bg)] to-transparent z-40">
        <input type="file" id="up" className="hidden" onChange={handleFileUpload} />
        <label htmlFor="up" className="w-full bg-blue-600 text-white py-5 rounded-[32px] flex items-center justify-center font-black text-[14px] uppercase tracking-widest shadow-2xl shadow-blue-200 cursor-pointer active:scale-95 transition-all">
          {view === 'folder' ? `Добавить в "${activeFolder?.name}"` : 'Загрузить новый документ'}
        </label>
      </footer>
    </div>
  );
};

export default App;

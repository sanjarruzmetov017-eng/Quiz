
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, LayoutGrid, BarChart3, Trash2, CheckCircle2, XCircle, Trophy, Flame, ChevronRight, RotateCcw, Award, History, Search, AlertCircle, Play, X, Loader2 } from 'lucide-react';
import { Word, QuizQuestion, UserStats, Tab, QuizOption } from './types';

/**
 * MUHIM: 
 * Backend (FastAPI) ishga tushganda Ngrok bergan URL'ni shu yerga qo'ying.
 * Masalan: const API_BASE = "https://a1b2-c3d4.ngrok-free.app";
 * Agar bo'sh qoldirilsa, ilova local rejimda (localStorage) ishlaydi.
 */
const API_BASE = ""; 

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('add');
  const [words, setWords] = useState<Word[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<UserStats>({
    correct: 0,
    wrong: 0,
    streak: 0,
    bestStreak: 0,
    totalWords: 0
  });
  const [showStats, setShowStats] = useState(false);
  const [userId, setUserId] = useState<number>(0);
  
  // Session State
  const [sessionWords, setSessionWords] = useState<Word[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  
  // Quiz State
  const [currentQuestion, setCurrentQuestion] = useState<QuizQuestion | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  
  // Form State
  const [enInput, setEnInput] = useState('');
  const [uzInput, setUzInput] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const isQuizInProgress = activeTab === 'quiz' && currentQuestion !== null && !isFinished;

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      const user = tg.initDataUnsafe?.user;
      if (user?.id) {
        setUserId(user.id);
        fetchData(user.id);
      } else {
        // Local test mode
        setUserId(12345);
        fetchData(12345);
      }
    }
  }, []);

  const fetchData = async (uid: number) => {
    if (!API_BASE) {
      const saved = localStorage.getItem('proskill_words');
      if (saved) setWords(JSON.parse(saved));
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [wordsRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/api/words/list?user_id=${uid}`),
        fetch(`${API_BASE}/api/stats?user_id=${uid}`)
      ]);
      
      if (wordsRes.ok) setWords(await wordsRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
    } catch (e) {
      console.error("Backend error, local storage activated", e);
      const saved = localStorage.getItem('proskill_words');
      if (saved) setWords(JSON.parse(saved));
    } finally {
      setLoading(false);
    }
  };

  const handleAddWord = async () => {
    const en = enInput.trim();
    const uz = uzInput.trim();

    if (!en || !uz) {
      setFormError("Iltimos, barcha maydonlarni to'ldiring!");
      return;
    }

    // Duplicate check
    if (words.some(w => w.en.toLowerCase() === en.toLowerCase())) {
      setFormError("Bu so'z allaqachon mavjud!");
      return;
    }

    if (!API_BASE) {
      // Local mode
      const newWord: Word = { id: Date.now().toString(), en, uz };
      const updated = [newWord, ...words];
      setWords(updated);
      localStorage.setItem('proskill_words', JSON.stringify(updated));
      setEnInput('');
      setUzInput('');
      setFormError(null);
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/words`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, en, uz })
      });

      if (response.ok) {
        const result = await response.json();
        setWords([{ id: result.id.toString(), en, uz }, ...words]);
        setEnInput('');
        setUzInput('');
        setFormError(null);
      }
    } catch (e) {
      setFormError("Serverga ulanishda xatolik.");
    }
  };

  const handleDeleteWord = async (id: string) => {
    if (!window.confirm("O'chirilsinmi?")) return;

    if (!API_BASE) {
      const updated = words.filter(w => w.id !== id);
      setWords(updated);
      localStorage.setItem('proskill_words', JSON.stringify(updated));
      return;
    }

    try {
      await fetch(`${API_BASE}/api/words/${id}?user_id=${userId}`, { method: 'DELETE' });
      setWords(words.filter(w => w.id !== id));
    } catch (e) {
      alert("Xatolik yuz berdi");
    }
  };

  const startQuizSession = () => {
    if (words.length < 5) return;
    const shuffled = [...words].sort(() => 0.5 - Math.random());
    setSessionWords(shuffled);
    setCurrentIndex(0);
    setSessionCorrect(0);
    setIsFinished(false);
    setActiveTab('quiz');
    generateQuestion(shuffled[0], shuffled);
  };

  const quitQuiz = () => {
    if (window.confirm("Testni to'xtatmoqchimisiz?")) {
      setCurrentQuestion(null);
      setSessionWords([]);
      setActiveTab('add');
    }
  };

  const generateQuestion = (target: Word, pool: Word[]) => {
    const others = pool
      .filter(w => w.id !== target.id)
      .sort(() => 0.5 - Math.random())
      .slice(0, 3);
    
    const options: QuizOption[] = [
      { id: target.id, text: target.uz },
      ...others.map(w => ({ id: w.id, text: w.uz }))
    ].sort(() => 0.5 - Math.random());

    setCurrentQuestion({
      wordId: target.id,
      questionText: target.en,
      options,
      correctId: target.id
    });
    setSelectedOption(null);
    setIsAnswered(false);
  };

  const handleAnswer = async (optionId: string) => {
    if (isAnswered) return;
    setSelectedOption(optionId);
    setIsAnswered(true);
    
    const isCorrect = optionId === currentQuestion?.correctId;
    if (isCorrect) setSessionCorrect(prev => prev + 1);

    if (API_BASE) {
      try {
        const res = await fetch(`${API_BASE}/api/quiz/answer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: userId, is_correct: isCorrect })
        });
        if (res.ok) setStats(await res.json());
      } catch (e) {
        console.error("Stats sync error");
      }
    }
  };

  const handleNext = () => {
    const nextIdx = currentIndex + 1;
    if (nextIdx < sessionWords.length) {
      setCurrentIndex(nextIdx);
      generateQuestion(sessionWords[nextIdx], sessionWords);
    } else {
      setIsFinished(true);
    }
  };

  const filteredWords = useMemo(() => {
    return words.filter(w => 
      w.en.toLowerCase().includes(searchQuery.toLowerCase()) || 
      w.uz.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [words, searchQuery]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Loader2 className="w-10 h-10 text-amber-500 animate-spin mb-4" />
        <p className="text-neutral-500 font-medium tracking-tight">ProSkill Quiz yuklanmoqda...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen max-w-md mx-auto px-4">
      {!isQuizInProgress && (
        <header className="flex items-center justify-between pt-6 pb-4 animate-in fade-in duration-300">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]">
              ProSkill Quiz
            </h1>
            <p className="text-xs text-neutral-400">Lug'at boyligingizni oshiring</p>
          </div>
          <button 
            onClick={() => setShowStats(true)}
            className="p-2 glass rounded-full text-neutral-300 hover:text-amber-500 transition-colors btn-press"
          >
            <BarChart3 size={20} />
          </button>
        </header>
      )}

      {isQuizInProgress && (
        <header className="flex items-center justify-between pt-8 pb-6 animate-in fade-in slide-in-from-top-4 duration-500">
           <div className="flex flex-col">
             <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Savol {currentIndex + 1} / {sessionWords.length}</span>
             <h2 className="text-lg font-bold text-white">Focus Mode</h2>
           </div>
           <button onClick={quitQuiz} className="p-3 bg-white/5 border border-white/10 rounded-2xl text-neutral-400 hover:text-white btn-press">
             <X size={20} />
           </button>
        </header>
      )}

      <main className={`flex-1 ${!isQuizInProgress ? 'pb-28' : 'pb-10'}`}>
        {activeTab === 'add' ? (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="glass p-5 rounded-2xl border-white/5 space-y-4">
              <h3 className="text-sm font-semibold text-neutral-300 flex items-center gap-2">
                <Plus size={16} className="text-amber-500" /> Yangi so'z
              </h3>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-neutral-500 ml-1 font-bold uppercase tracking-wider">English</label>
                  <input type="text" placeholder="Masalan: Apple" value={enInput} onChange={(e) => { setEnInput(e.target.value); if (formError) setFormError(null); }} className={`w-full bg-black/40 border ${formError ? 'border-red-500/50' : 'border-white/10'} rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500/50 transition-all`} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-neutral-500 ml-1 font-bold uppercase tracking-wider">O'zbekcha</label>
                  <input type="text" placeholder="Masalan: Olma" value={uzInput} onChange={(e) => { setUzInput(e.target.value); if (formError) setFormError(null); }} className={`w-full bg-black/40 border ${formError ? 'border-red-500/50' : 'border-white/10'} rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500/50 transition-all`} />
                </div>
                {formError && <div className="flex items-center gap-2 text-red-400 text-xs font-bold px-1 animate-in fade-in duration-200"><AlertCircle size={14} /> {formError}</div>}
                <button onClick={handleAddWord} className="w-full py-4 bg-white/5 border border-white/10 text-white font-bold rounded-xl text-xs btn-press">RO'YXATGA QO'SHISH</button>
                {words.length >= 5 && <button onClick={startQuizSession} className="w-full py-4 bg-amber-500 text-black font-black rounded-xl text-xs btn-press amber-glow animate-pulse flex items-center justify-center gap-2 mt-2"><Play size={16} fill="black" /> TESTNI BOSHLASH</button>}
              </div>
            </div>
            
            <div className="glass p-5 rounded-2xl border-white/5 flex items-center justify-between">
              <div><p className="text-xs text-neutral-400">Jami so'zlar</p><p className="text-xl font-black text-white">{words.length}</p></div>
              <button onClick={() => setActiveTab('history')} className="p-3 bg-white/5 rounded-xl text-amber-500 btn-press"><History size={20} /></button>
            </div>
          </div>
        ) : activeTab === 'history' ? (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" size={16} />
              <input type="text" placeholder="So'zlarni qidirish..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-2xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:border-amber-500/50 transition-all" />
            </div>
            {words.length >= 5 && <button onClick={startQuizSession} className="w-full py-4 bg-amber-500/10 border border-amber-500/30 text-amber-500 font-black rounded-2xl flex items-center justify-center gap-2 btn-press"><Play size={18} fill="currentColor" /> TESTNI BOSHLASH</button>}
            <div className="space-y-2">
              {filteredWords.length === 0 ? <div className="glass rounded-2xl p-10 text-center border-dashed border-white/10 text-sm text-neutral-500">Hech narsa topilmadi</div> : filteredWords.map(word => (
                <div key={word.id} className="glass rounded-2xl p-4 flex items-center justify-between border-white/5">
                  <div><p className="text-sm font-black text-white">{word.en}</p><p className="text-xs text-neutral-500 font-medium">{word.uz}</p></div>
                  <button onClick={() => handleDeleteWord(word.id)} className="p-2 text-neutral-700 hover:text-red-500 btn-press"><Trash2 size={16} /></button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            {words.length < 5 ? (
              <div className="glass rounded-2xl p-10 text-center space-y-4 border-dashed border-white/10">
                <div className="w-16 h-16 bg-neutral-900 rounded-full flex items-center justify-center mx-auto border border-white/5"><LayoutGrid size={24} className="text-neutral-700" /></div>
                <div><h4 className="font-bold text-white">Test qulflangan</h4><p className="text-xs text-neutral-500 mt-1">Kamida 5 ta so'z bo'lishi shart.</p></div>
                <button onClick={() => setActiveTab('add')} className="px-6 py-2 bg-neutral-800 text-white rounded-lg text-xs font-bold btn-press">So'z qo'shish</button>
              </div>
            ) : isFinished ? (
              <div className="glass p-8 rounded-3xl border-white/10 text-center space-y-6 animate-in zoom-in-95 duration-500">
                <div className="w-20 h-20 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto amber-glow"><Trophy size={40} className="text-amber-500" /></div>
                <div><h2 className="text-2xl font-black text-white">Test yakunlandi!</h2><p className="text-neutral-400 text-sm mt-1">Natijangiz:</p></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/5"><p className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">To'g'ri</p><p className="text-xl font-black text-amber-500">{sessionCorrect} / {sessionWords.length}</p></div>
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/5"><p className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">Aniq'lik</p><p className="text-xl font-black text-white">{Math.round((sessionCorrect / sessionWords.length) * 100)}%</p></div>
                </div>
                <div className="space-y-3">
                  <button onClick={startQuizSession} className="w-full py-4 bg-amber-500 text-black font-black rounded-2xl flex items-center justify-center gap-2 btn-press"><RotateCcw size={18} /> Qayta boshlash</button>
                  <button onClick={() => { setActiveTab('history'); setCurrentQuestion(null); }} className="w-full py-4 glass border-white/10 text-white font-bold rounded-2xl btn-press">Tarixga qaytish</button>
                </div>
              </div>
            ) : currentQuestion ? (
              <div className="space-y-6">
                <div className="h-1.5 bg-neutral-900 rounded-full overflow-hidden mt-2"><div className="h-full bg-amber-500 transition-all duration-500" style={{ width: `${((currentIndex + 1) / sessionWords.length) * 100}%` }} /></div>
                <div className="glass p-10 rounded-3xl border-white/10 text-center space-y-2 relative overflow-hidden shadow-2xl">
                   <p className="text-xs text-neutral-500 font-medium uppercase tracking-widest">Ma'nosi nima?</p>
                   <h2 className="text-4xl font-black text-white tracking-tight">{currentQuestion.questionText}</h2>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {currentQuestion.options.map(option => {
                    const isSelected = selectedOption === option.id;
                    const isCorrect = option.id === currentQuestion.correctId;
                    let cardStyles = "glass border-white/5 p-4 rounded-xl text-center transition-all btn-press h-24 flex items-center justify-center text-sm font-bold";
                    if (isAnswered) {
                      if (isCorrect) cardStyles = "bg-green-500/20 border-green-500 text-green-400 p-4 rounded-xl text-center h-24 flex items-center justify-center text-sm font-bold shadow-[0_0_15px_rgba(34,197,94,0.2)] scale-[1.02]";
                      else if (isSelected && !isCorrect) cardStyles = "bg-red-500/20 border-red-500 text-red-400 p-4 rounded-xl text-center h-24 flex items-center justify-center text-sm font-bold";
                      else cardStyles = "glass opacity-40 border-white/5 p-4 rounded-xl text-center h-24 flex items-center justify-center text-sm font-medium";
                    }
                    return <button key={option.id} disabled={isAnswered} onClick={() => handleAnswer(option.id)} className={cardStyles}>{option.text}</button>;
                  })}
                </div>
                {isAnswered && <button onClick={handleNext} className="w-full py-4 bg-white text-black font-black rounded-2xl flex items-center justify-center gap-2 btn-press animate-in zoom-in-95 duration-200">{currentIndex + 1 < sessionWords.length ? "Keyingi savol" : "Natijani ko'rish"} <ChevronRight size={20} /></button>}
              </div>
            ) : (
              <div className="glass p-10 rounded-2xl text-center space-y-6">
                <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto border border-amber-500/20"><LayoutGrid size={32} className="text-amber-500" /></div>
                <div className="space-y-2"><h3 className="text-lg font-bold text-white">Quiz boshlash</h3><p className="text-xs text-neutral-500">Barcha {words.length} ta so'zingiz bo'yicha bilimingizni sinab ko'ring.</p></div>
                <button onClick={startQuizSession} className="w-full py-4 bg-amber-500 text-black font-black rounded-2xl btn-press amber-glow">TESTNI BOSHLASH</button>
              </div>
            )}
          </div>
        )}
      </main>

      {!isQuizInProgress && (
        <nav className="fixed bottom-0 left-0 right-0 p-4 pb-8 z-40 bg-gradient-to-t from-black via-black/80 to-transparent pointer-events-none">
          <div className="max-w-md mx-auto flex p-1 glass rounded-2xl relative overflow-hidden animate-in slide-in-from-bottom-5 duration-500 pointer-events-auto shadow-2xl backdrop-blur-xl border-white/10">
            <div 
              className="absolute inset-y-1 bg-amber-500/10 border border-amber-500/30 rounded-xl tab-indicator transition-all duration-300 ease-out"
              style={{ 
                width: 'calc(33.33% - 4px)',
                transform: `translateX(${activeTab === 'add' ? '0%' : activeTab === 'history' ? '100%' : '200%'})`
              }}
            />
            <button onClick={() => setActiveTab('add')} className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 text-[10px] font-bold z-10 transition-colors ${activeTab === 'add' ? 'text-amber-500' : 'text-neutral-500'}`}>
              <Plus size={18} /> QO'SHISH
            </button>
            <button onClick={() => setActiveTab('history')} className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 text-[10px] font-bold z-10 transition-colors ${activeTab === 'history' ? 'text-amber-500' : 'text-neutral-500'}`}>
              <History size={18} /> TARIX
            </button>
            <button onClick={() => setActiveTab('quiz')} className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 text-[10px] font-bold z-10 transition-colors ${activeTab === 'quiz' ? 'text-amber-500' : 'text-neutral-500'}`}>
              <LayoutGrid size={18} /> TEST
            </button>
          </div>
        </nav>
      )}

      {showStats && (
        <div className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowStats(false)} />
          <div className="relative w-full max-w-md glass border-white/10 rounded-3xl p-6 space-y-6 animate-in slide-in-from-bottom-10 duration-500 shadow-2xl">
            <div className="flex items-center justify-between"><h3 className="text-lg font-bold">Mening natijalarim</h3><button onClick={() => setShowStats(false)} className="p-2 glass rounded-full text-neutral-400"><XCircle size={20} /></button></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-neutral-900/50 rounded-2xl border border-white/5 text-center"><Award className="mx-auto text-amber-500 mb-2" size={24} /><p className="text-[10px] text-neutral-500 uppercase font-bold">Jami to'g'ri</p><p className="text-xl font-black">{stats.correct}</p></div>
              <div className="p-4 bg-neutral-900/50 rounded-2xl border border-white/5 text-center"><Flame className="mx-auto text-orange-500 mb-2" size={24} /><p className="text-[10px] text-neutral-500 uppercase font-bold">Best Streak</p><p className="text-xl font-black">{stats.bestStreak}</p></div>
            </div>
            <button onClick={() => setShowStats(false)} className="w-full py-4 glass border-white/10 rounded-2xl font-bold text-sm btn-press">Yopish</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;

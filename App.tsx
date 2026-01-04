
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { NumberStatus, Participant, RaffleState, Purchase } from './types';
import NumberGrid from './components/NumberGrid';
import Dashboard from './components/Dashboard';
import { generateRaffleDescription, announceWinner, generatePrizeImage } from './services/geminiService';

const PAGE_SIZE = 100;
const INITIAL_PRICE = 10.00;
const INITIAL_LIMIT = 50;
const INITIAL_PHONE_LIMIT = 100;
const TOTAL_NUMBERS = 1000000;
const RESERVATION_TIME = 5 * 60 * 1000;
const ADMIN_PASSWORD = "198830cb";

const DEFAULT_DESCRIPTION = ` 🏁 PIX DE R$ 500 OU CAPACETE ZERO: QUAL VAI SER? 🏁

O mês está acabando, mas a sua sorte está só começando! Participar da nossa rifa é simples, barato e pode te render um prêmio sensacional. 🤩

✨ O QUE ESTÁ EM JOGO:
1️⃣ R$ 500,00 NO PIX (Dinheiro na mão, sem burocracia!)
2️⃣ OU UM CAPACETE ZERO (Novinho, direto para você!)

📊 **NÚMEROS DA SORTE:
Temos 1 milhão de bilhetes disponíveis. É o "Rifão do Milhão"! Escolha seus números favoritos e entre na disputa.

⚠️ **REGRAS DO JOGO:**
Sorteio realizado pela Federal no último dia do mês. É seguro, é justo, é a sua chance! 🏦✨`;

const App: React.FC = () => {
  // Carregar estado inicial do localStorage se existir
  const loadInitialState = (): RaffleState => {
    const saved = localStorage.getItem('raffle_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as any;
        return {
          ...parsed,
          soldNumbers: new Set(parsed.soldNumbers || []),
          numberOwners: new Map(parsed.numberOwners || []),
          reservedNumbers: new Map(),
          participants: new Map(parsed.participants || []),
          phoneToNumbers: new Map(parsed.phoneToNumbers || []),
        };
      } catch (e) {
        console.error("Erro ao carregar configurações salvas", e);
      }
    }
    return {
      totalNumbers: TOTAL_NUMBERS,
      pricePerNumber: INITIAL_PRICE,
      maxPurchaseLimit: INITIAL_LIMIT,
      maxEntriesPerPhone: INITIAL_PHONE_LIMIT,
      soldNumbers: new Set<number>(),
      numberOwners: new Map<number, string>(),
      reservedNumbers: new Map<number, { expiresAt: number }>(),
      participants: new Map<string, Participant>(),
      phoneToNumbers: new Map<string, number[]>(),
    };
  };

  const [raffle, setRaffle] = useState<RaffleState>(loadInitialState);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdminLoginOpen, setIsAdminLoginOpen] = useState(false);
  const [isAdminSettingsOpen, setIsAdminSettingsOpen] = useState(false);
  const [adminPassInput, setAdminPassInput] = useState("");
  
  const [description, setDescription] = useState(() => localStorage.getItem('raffle_description') || DEFAULT_DESCRIPTION);
  const [prizeName, setPrizeName] = useState(() => localStorage.getItem('raffle_prize_name') || "PIX DA SORTE $500 OU CAPACETE ZERO");
  const [prizeImage, setPrizeImage] = useState(() => localStorage.getItem('raffle_prize_image') || "");
  
  const [tempDescription, setTempDescription] = useState(description);
  const [tempPrizeName, setTempPrizeName] = useState(prizeName);
  const [tempImageUrl, setTempImageUrl] = useState("");
  const [aiInstruction, setAiInstruction] = useState("");
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [isGeneratingImg, setIsGeneratingImg] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [isPurchasing, setIsPurchasing] = useState<number[] | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [winnerMessage, setWinnerMessage] = useState<string | null>(null);
  
  const [userName, setUserName] = useState("");
  const [userPhone, setUserPhone] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [myPurchases, setMyPurchases] = useState<Purchase[]>([]);
  
  const hasInitialData = useRef(false);

  useEffect(() => {
    localStorage.setItem('raffle_description', description);
    localStorage.setItem('raffle_prize_name', prizeName);
    localStorage.setItem('raffle_prize_image', prizeImage);
  }, [description, prizeName, prizeImage]);

  useEffect(() => {
    const settingsToSave = {
      ...raffle,
      soldNumbers: Array.from(raffle.soldNumbers),
      numberOwners: Array.from(raffle.numberOwners.entries()),
      participants: Array.from(raffle.participants.entries()),
      phoneToNumbers: Array.from(raffle.phoneToNumbers.entries()),
    };
    localStorage.setItem('raffle_settings', JSON.stringify(settingsToSave));
  }, [raffle]);

  const currentUserEntryCount = useMemo(() => {
    const normalized = userPhone.replace(/\D/g, "");
    if (normalized.length < 8) return 0;
    return raffle.phoneToNumbers.get(normalized)?.length || 0;
  }, [userPhone, raffle.phoneToNumbers]);

  const isLimitExceeded = useMemo(() => {
    if (!isPurchasing) return false;
    return (currentUserEntryCount + isPurchasing.length) > raffle.maxEntriesPerPhone;
  }, [currentUserEntryCount, isPurchasing, raffle.maxEntriesPerPhone]);

  useEffect(() => {
    const saved = localStorage.getItem('raffle_purchase_history');
    if (saved) {
      try {
        setMyPurchases(JSON.parse(saved) as Purchase[]);
      } catch (e) {
        console.error("Error loading history", e);
      }
    }
    const adminSaved = localStorage.getItem('raffle_is_admin');
    if (adminSaved === 'true') setIsAdmin(true);
  }, []);

  useEffect(() => {
    localStorage.setItem('raffle_purchase_history', JSON.stringify(myPurchases));
  }, [myPurchases]);

  useEffect(() => {
    if (!hasInitialData.current) {
      const initData = async () => {
        if (!prizeImage || prizeImage === "") {
          const img = await generatePrizeImage(prizeName);
          if (img) setPrizeImage(img);
        }
        hasInitialData.current = true;
      };
      initData();
    }
  }, [prizeName, prizeImage]);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      let changed = false;
      const nextReserved = new Map<number, { expiresAt: number }>(raffle.reservedNumbers);

      nextReserved.forEach((data, num) => {
        if (now >= data.expiresAt) {
          nextReserved.delete(num);
          changed = true;
          setIsPurchasing(prev => {
            if (prev && prev.includes(num)) return null;
            return prev;
          });
        }
      });

      if (changed) {
        setRaffle(prev => ({ ...prev, reservedNumbers: nextReserved }));
      }

      if (isPurchasing && isPurchasing.length > 0) {
        const currentRes = raffle.reservedNumbers.get(isPurchasing[0]);
        if (currentRes) {
          setTimeLeft(Math.max(0, Math.floor((currentRes.expiresAt - now) / 1000)));
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [raffle.reservedNumbers, isPurchasing]);

  const handleAdminLogout = () => {
    setIsAdmin(false);
    localStorage.removeItem('raffle_is_admin');
    setIsAdminSettingsOpen(false);
  };

  const handleAdminLogin = () => {
    if (adminPassInput === ADMIN_PASSWORD) {
      setIsAdmin(true);
      setIsAdminLoginOpen(false);
      setAdminPassInput("");
      localStorage.setItem('raffle_is_admin', 'true');
    } else {
      alert("Senha administrativa incorreta.");
    }
  };

  const handlePhoneBlur = () => {
    const phoneRegex = /^(?:(?:\+|00)?55\s?)?(?:\(?([1-9][0-9])\)?\s?)?(?:((?:9\d|[2-9])\d{3})\-?(\d{4}))$/;
    const digitsOnly = userPhone.replace(/\D/g, "");
    if (userPhone && !phoneRegex.test(userPhone)) {
      setPhoneError("Telefone inválido.");
    } else if (userPhone && (digitsOnly.length < 10 || digitsOnly.length > 11)) {
       setPhoneError("Deve ter 10 ou 11 dígitos.");
    } else {
      setPhoneError(null);
    }
  };

  const handleEmailBlur = () => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (userEmail && !emailRegex.test(userEmail)) {
      setEmailError("E-mail inválido.");
    } else {
      setEmailError(null);
    }
  };

  const handleSelectNumber = (num: number) => {
    if (raffle.soldNumbers.has(num) || raffle.reservedNumbers.has(num)) return;
    const expiresAt = Date.now() + RESERVATION_TIME;
    setRaffle(prev => {
      const nextReserved = new Map<number, { expiresAt: number }>(prev.reservedNumbers);
      nextReserved.set(num, { expiresAt });
      return { ...prev, reservedNumbers: nextReserved };
    });
    setIsPurchasing([num]);
    setTimeLeft(Math.floor(RESERVATION_TIME / 1000));
  };

  const buyRandom = (count: number) => {
    if (count > raffle.maxPurchaseLimit) {
      alert(`O limite máximo por transação é de ${raffle.maxPurchaseLimit} bilhetes.`);
      return;
    }
    const available: number[] = [];
    const start = currentPage * PAGE_SIZE;
    for (let i = start; i < start + PAGE_SIZE; i++) {
      if (i < TOTAL_NUMBERS && !raffle.soldNumbers.has(i) && !raffle.reservedNumbers.has(i)) {
        available.push(i);
      }
    }
    
    if (available.length < count) {
      alert("Números insuficientes livres nesta página.");
      return;
    }

    const chosen: number[] = [];
    const tempAvailable = [...available];
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(Math.random() * tempAvailable.length);
      chosen.push(tempAvailable.splice(idx, 1)[0]);
    }

    const expiresAt = Date.now() + RESERVATION_TIME;
    setRaffle(prev => {
      const nextReserved = new Map(prev.reservedNumbers);
      chosen.forEach(n => nextReserved.set(n, { expiresAt }));
      return { ...prev, reservedNumbers: nextReserved };
    });
    setIsPurchasing(chosen);
    setTimeLeft(Math.floor(RESERVATION_TIME / 1000));
  };

  const handlePurchase = useCallback(() => {
    if (!isPurchasing || isPurchasing.length === 0) return;
    if (!userName.trim() || !userPhone.trim() || !userEmail.trim() || emailError || phoneError) {
      alert("Preencha seus dados corretamente.");
      return;
    }
    
    const ticketsToBuy = isPurchasing;
    const normalizedPhone = userPhone.replace(/\D/g, "");
    const existingNumbers = raffle.phoneToNumbers.get(normalizedPhone) || [];

    if (existingNumbers.length + ticketsToBuy.length > raffle.maxEntriesPerPhone) {
      alert(`Limite de ${raffle.maxEntriesPerPhone} bilhetes por telefone excedido! Você já possui ${existingNumbers.length} e está tentando adquirir mais ${ticketsToBuy.length}.`);
      return;
    }

    const now = Date.now();
    const participantId = `p-${now}-${Math.random().toString(36).substr(2, 5)}`;
    
    setRaffle((prev: RaffleState) => {
      const nextSold = new Set(prev.soldNumbers);
      const nextOwners = new Map(prev.numberOwners);
      const nextReserved = new Map(prev.reservedNumbers);
      const nextParticipants = new Map(prev.participants);
      const nextPhoneToNumbers = new Map(prev.phoneToNumbers);

      ticketsToBuy.forEach(n => {
        nextSold.add(n);
        nextOwners.set(n, participantId);
        nextReserved.delete(n);
      });

      nextParticipants.set(participantId, { 
        id: participantId, 
        name: userName, 
        phone: userPhone, 
        email: userEmail 
      });

      const updatedPhoneList = [...(nextPhoneToNumbers.get(normalizedPhone) || []), ...ticketsToBuy];
      nextPhoneToNumbers.set(normalizedPhone, updatedPhoneList);

      return { 
        ...prev, 
        soldNumbers: nextSold, 
        numberOwners: nextOwners, 
        reservedNumbers: nextReserved, 
        participants: nextParticipants,
        phoneToNumbers: nextPhoneToNumbers
      };
    });

    const newPurchases: Purchase[] = ticketsToBuy.map(n => ({ number: n, date: now, prizeName: prizeName }));
    setMyPurchases(prev => [...newPurchases, ...prev]);
    setIsPurchasing(null);
    setUserName(""); setUserPhone(""); setUserEmail("");
  }, [isPurchasing, userName, userPhone, userEmail, emailError, phoneError, prizeName, raffle]);

  const handleCancelPurchase = () => {
    if (isPurchasing) {
      setRaffle(prev => {
        const nextReserved = new Map(prev.reservedNumbers);
        isPurchasing.forEach(n => nextReserved.delete(n));
        return { ...prev, reservedNumbers: nextReserved };
      });
    }
    setIsPurchasing(null);
    setUserName(""); setUserPhone(""); setUserEmail("");
  };

  const saveAdminSettings = () => {
    setPrizeName(tempPrizeName);
    setDescription(tempDescription);
    if (tempImageUrl.trim() !== "") {
      setPrizeImage(tempImageUrl);
      setTempImageUrl("");
    }
    setIsAdminSettingsOpen(false);
  };

  const handleRegenerateDescription = async () => {
    setIsGeneratingAi(true);
    const newDesc = await generateRaffleDescription(tempPrizeName, aiInstruction);
    setTempDescription(newDesc);
    setIsGeneratingAi(false);
  };

  const handleRegenerateImage = async () => {
    setIsGeneratingImg(true);
    const newImg = await generatePrizeImage(tempPrizeName);
    if (newImg) setPrizeImage(newImg);
    setIsGeneratingImg(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setPrizeImage(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const numbersToDisplay = useMemo(() => {
    if (!searchQuery) {
      const start = currentPage * PAGE_SIZE;
      return Array.from({ length: PAGE_SIZE }, (_, i) => start + i).filter(n => n < TOTAL_NUMBERS);
    }
    const query = searchQuery.toLowerCase().trim();
    const num = parseInt(query, 10);
    if (!isNaN(num) && num >= 0 && num < TOTAL_NUMBERS && query.match(/^\d+$/)) return [num];

    const foundNumbers: number[] = [];
    const queryDigits = query.replace(/\D/g, "");
    
    if (queryDigits.length >= 8) {
      raffle.phoneToNumbers.forEach((nums, phone) => {
        if (phone.includes(queryDigits)) {
          nums.forEach(n => foundNumbers.push(n));
        }
      });
    }

    raffle.participants.forEach((participant, pId) => {
      const nameMatch = participant.name.toLowerCase().includes(query);
      if (nameMatch) {
        raffle.numberOwners.forEach((ownerId, numberId) => {
          if (ownerId === pId) foundNumbers.push(numberId);
        });
      }
    });
    
    return foundNumbers
      .filter((item, index) => foundNumbers.indexOf(item) === index)
      .sort((a, b) => a - b)
      .slice(0, 100);
  }, [currentPage, searchQuery, raffle.participants, raffle.numberOwners, raffle.phoneToNumbers]);

  const runDraw = async () => {
    if (!isAdmin) return alert("Acesso ADM necessário.");
    if (raffle.soldNumbers.size === 0) return alert("Nenhum número vendido.");
    
    const soldArray: number[] = [];
    raffle.soldNumbers.forEach(n => soldArray.push(n));
    
    const winningNumber = soldArray[Math.floor(Math.random() * soldArray.length)];
    const ownerId = raffle.numberOwners.get(winningNumber);
    const winner = ownerId ? raffle.participants.get(ownerId) : null;
    
    if (winner) {
      const message = await announceWinner(winner.name, prizeName, winningNumber);
      setWinnerMessage(message);
      setRaffle(prev => ({ ...prev, winner: { number: winningNumber, participant: winner } }));
    }
  };

  return (
    <div className="min-h-screen pb-40">
      {isAdmin && (
        <div className="fixed top-4 left-4 z-[90] flex gap-2">
          <button onClick={handleAdminLogout} className="bg-red-600 text-white px-4 py-2 rounded-full text-xs font-bold shadow-xl hover:bg-red-700 transition-all flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            SAIR ADM
          </button>
          <button onClick={() => setIsAdminSettingsOpen(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-full text-xs font-bold shadow-xl hover:bg-indigo-700 transition-all flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924-1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            CONFIGURAÇÕES
          </button>
        </div>
      )}

      {/* Sidebar de Histórico */}
      <div className={`fixed inset-y-0 right-0 w-full md:w-96 bg-white shadow-2xl z-[60] transform transition-transform duration-300 ease-in-out ${isHistoryOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex flex-col h-full">
          <div className="p-6 bg-indigo-900 text-white flex items-center justify-between">
            <h2 className="text-xl font-bold">Seus Bilhetes</h2>
            <button onClick={() => setIsHistoryOpen(false)} className="hover:rotate-90 transition-transform p-1"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
            {myPurchases.length === 0 ? (
              <div className="text-center py-20">
                <div className="text-slate-300 mb-4"><svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg></div>
                <p className="text-slate-400 font-medium">Nenhum bilhete local.</p>
                <button onClick={() => setSearchQuery("")} className="mt-4 text-indigo-600 font-bold text-sm underline">Ver todos os bilhetes</button>
              </div>
            ) : (
              myPurchases.map((p, idx) => (
                <div key={idx} className="p-4 bg-white rounded-2xl mb-4 border border-slate-200 shadow-sm">
                  <div className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-1">{p.prizeName}</div>
                  <div className="text-2xl font-mono font-black text-indigo-600">#{p.number.toString().padStart(6, '0')}</div>
                  <div className="text-[10px] text-slate-400 mt-2 flex justify-between">
                    <span>{new Date(p.date).toLocaleDateString()}</span>
                    <span>{new Date(p.date).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <header className="bg-indigo-900 text-white pt-10 pb-24 px-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-12 items-start relative z-10">
          <div className="flex-1 space-y-8">
             <div className="space-y-4">
               <h1 className="text-4xl md:text-6xl font-black leading-tight">{prizeName}</h1>
               <p className="text-indigo-100 text-lg opacity-90 leading-relaxed max-w-2xl whitespace-pre-wrap">{description}</p>
             </div>
             
             {prizeImage && (
               <div className="relative group max-w-2xl rounded-[40px] overflow-hidden shadow-2xl border-4 border-white/10 aspect-video">
                 <img src={prizeImage} alt={prizeName} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                 <div className="absolute inset-0 bg-gradient-to-t from-indigo-900/40 to-transparent pointer-events-none" />
               </div>
             )}
          </div>
          
          <div className="shrink-0 w-full md:w-96 bg-white/5 backdrop-blur-xl p-8 rounded-[40px] border border-white/10 text-center shadow-2xl sticky top-8">
            <span className="text-xs uppercase opacity-60 font-bold tracking-[0.2em]">Adquira já o seu</span>
            <div className="text-6xl font-black my-4">R$ {raffle.pricePerNumber.toFixed(2)}</div>
            <div className="space-y-3 mt-8">
              <button onClick={() => buyRandom(10)} className="w-full bg-white text-indigo-900 py-4 rounded-2xl font-black text-lg shadow-xl hover:scale-[1.02] active:scale-95 transition-all">Comprar Bilhete</button>
            </div>
            <p className="text-[10px] mt-6 opacity-50 uppercase tracking-widest font-black">Limite global: {raffle.maxEntriesPerPhone} un. por telefone</p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 -mt-12 relative z-20">
        <Dashboard total={raffle.totalNumbers} sold={raffle.soldNumbers.size} reserved={raffle.reservedNumbers.size} revenue={raffle.soldNumbers.size * raffle.pricePerNumber} isAdmin={isAdmin} />
        
        <div className="bg-white p-4 rounded-[32px] shadow-xl border border-slate-100 mb-8 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative flex-1 w-full group">
            <input type="text" placeholder="Busque por nome, telefone ou nº do bilhete..." className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium" value={searchQuery} onChange={e => {setSearchQuery(e.target.value); setCurrentPage(0);}} />
            <svg className="w-6 h-6 text-slate-300 absolute left-4 top-4 group-focus-within:text-indigo-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
          {!searchQuery && (
            <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-2xl">
              <button onClick={() => setCurrentPage(p => Math.max(0, p-1))} className="p-2 bg-white rounded-xl shadow-sm hover:bg-slate-100 transition-colors disabled:opacity-30" disabled={currentPage === 0}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg></button>
              <div className="px-4 text-center"><span className="font-bold text-slate-700">Pág. {currentPage + 1}</span></div>
              <button onClick={() => setCurrentPage(p => p + 1)} className="p-2 bg-white rounded-xl shadow-sm hover:bg-slate-100 transition-colors"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg></button>
            </div>
          )}
        </div>

        <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-2xl">
          <NumberGrid numbers={numbersToDisplay} soldNumbers={raffle.soldNumbers} reservedNumbers={raffle.reservedNumbers} numberOwners={raffle.numberOwners} participants={raffle.participants} onSelect={handleSelectNumber} isAdmin={isAdmin} />
        </div>
      </main>

      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 z-50">
        <button onClick={() => setIsHistoryOpen(true)} className="bg-indigo-900 text-white px-8 py-4 rounded-full shadow-2xl flex items-center gap-3 font-black hover:scale-105 transition-all">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
          Meus Bilhetes ({myPurchases.length})
        </button>
        {!isAdmin && (
          <button onClick={() => setIsAdminLoginOpen(true)} className="bg-white p-4 rounded-full shadow-2xl text-slate-300 hover:text-indigo-600 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
          </button>
        )}
      </div>

      {isPurchasing && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-[40px] p-10 shadow-2xl animate-in fade-in zoom-in duration-300">
            <h3 className="text-3xl font-black text-slate-900 mb-2">Identificação</h3>
            <p className="text-slate-500 mb-4">Vincule seus {isPurchasing.length} bilhetes. Limite global: {raffle.maxEntriesPerPhone} un.</p>
            
            <div className="space-y-5">
              <input type="text" placeholder="Nome Completo" value={userName} onChange={e => setUserName(e.target.value)} className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold" />
              
              <div className="relative">
                <input 
                  type="tel" 
                  placeholder="Telefone (DDD + Número)" 
                  value={userPhone} 
                  onChange={e => setUserPhone(e.target.value)} 
                  onBlur={handlePhoneBlur} 
                  className={`w-full p-4 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 ${phoneError || isLimitExceeded ? 'ring-red-500 ring-2' : 'focus:ring-indigo-500'} font-bold`} 
                />
                {userPhone.replace(/\D/g, "").length >= 8 && (
                  <div className={`mt-2 text-xs font-bold px-2 flex justify-between ${isLimitExceeded ? 'text-red-500' : 'text-slate-400'}`}>
                    <span>Bilhetes atuais: {currentUserEntryCount}</span>
                    <span>{isLimitExceeded ? 'Limite excedido!' : `Restante: ${raffle.maxEntriesPerPhone - currentUserEntryCount}`}</span>
                  </div>
                )}
                {phoneError && <p className="text-red-500 text-[10px] mt-1 font-bold uppercase tracking-wider">{phoneError}</p>}
              </div>

              <input type="email" placeholder="E-mail" value={userEmail} onChange={e => setUserEmail(e.target.value)} onBlur={handleEmailBlur} className={`w-full p-4 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 ${emailError ? 'ring-red-500 ring-2' : 'focus:ring-indigo-500'} font-bold`} />
              
              <div className="flex gap-4 pt-6">
                <button onClick={handleCancelPurchase} className="flex-1 py-4 text-slate-400 font-bold">Cancelar</button>
                <button 
                  disabled={isLimitExceeded || !!phoneError || !!emailError}
                  onClick={handlePurchase} 
                  className={`flex-[2] py-4 text-white rounded-2xl font-black shadow-xl transition-all ${isLimitExceeded || phoneError || emailError ? 'bg-slate-200 cursor-not-allowed text-slate-400' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                >
                  {isLimitExceeded ? 'LIMITE EXCEDIDO' : 'FINALIZAR COMPRA'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isAdminSettingsOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl z-[150] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-3xl rounded-[40px] overflow-hidden shadow-2xl flex flex-col max-h-[95vh]">
             <div className="p-8 bg-indigo-900 text-white flex justify-between items-center">
                <h3 className="text-2xl font-black">Configurações da Rifa</h3>
                <button onClick={() => setIsAdminSettingsOpen(false)} className="opacity-60 hover:opacity-100"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
             </div>
             <div className="p-8 overflow-y-auto space-y-8">
                <div>
                   <label className="block text-[10px] uppercase font-black text-slate-400 mb-2">Prêmio Principal</label>
                   <input 
                    type="text" 
                    value={tempPrizeName} 
                    onChange={e => setTempPrizeName(e.target.value)}
                    className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-xl"
                   />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <label className="text-[10px] uppercase font-black text-slate-400">Gerenciar Foto do Prêmio</label>
                    <div className="aspect-video bg-slate-100 rounded-3xl overflow-hidden border-2 border-dashed border-slate-300 relative group flex items-center justify-center">
                      {prizeImage ? (
                        <img src={prizeImage} className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-slate-300 flex flex-col items-center">
                          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2-2v12a2 2 0 002 2z" /></svg>
                          <span className="font-bold text-xs mt-2 uppercase tracking-widest">Sem Imagem</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-white border-2 border-slate-200 text-slate-700 p-4 rounded-2xl font-black text-xs uppercase tracking-widest flex flex-col items-center gap-2 hover:border-indigo-500 hover:text-indigo-600 transition-all"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                        Upload
                      </button>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileUpload} 
                        className="hidden" 
                        accept="image/*" 
                      />
                      
                      <button 
                        onClick={handleRegenerateImage}
                        disabled={isGeneratingImg}
                        className="bg-indigo-50 text-indigo-600 p-4 rounded-2xl font-black text-xs uppercase tracking-widest flex flex-col items-center gap-2 hover:bg-indigo-100 transition-all disabled:opacity-50"
                      >
                        <svg className={`w-5 h-5 ${isGeneratingImg ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        Gerar c/ IA
                      </button>
                    </div>

                    <div className="space-y-2">
                       <label className="text-[9px] uppercase font-black text-slate-400 px-2">Ou cole um Link (URL)</label>
                       <div className="relative">
                          <input 
                            type="text" 
                            placeholder="https://..." 
                            value={tempImageUrl}
                            onChange={e => setTempImageUrl(e.target.value)}
                            className="w-full p-4 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-sm"
                          />
                          <svg className="w-5 h-5 absolute right-4 top-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                       </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-[10px] uppercase font-black text-slate-400">Descrição Detalhada</label>
                        <button onClick={handleRegenerateDescription} disabled={isGeneratingAi} className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1 hover:underline disabled:opacity-30">
                          {isGeneratingAi ? 'GERANDO...' : 'REGERAR IA'}
                        </button>
                      </div>
                      <textarea value={tempDescription} onChange={e => setTempDescription(e.target.value)} rows={10} className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700 leading-relaxed text-sm" />
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-amber-50 rounded-3xl border-2 border-dashed border-amber-200">
                   <label className="block text-[10px] uppercase font-black text-amber-600 mb-2">Instrução para a IA (Opcional)</label>
                   <input type="text" placeholder="Ex: 'mais formal', 'destaque que é beneficente'" value={aiInstruction} onChange={e => setAiInstruction(e.target.value)} className="w-full p-3 bg-white rounded-xl border border-amber-100 outline-none focus:ring-2 focus:ring-amber-400 text-sm italic" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div>
                      <label className="block text-[10px] uppercase font-black text-slate-400 mb-2">Preço por Número (R$)</label>
                      <input type="number" step="0.5" value={raffle.pricePerNumber} onChange={e => setRaffle({...raffle, pricePerNumber: parseFloat(e.target.value)})} className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-indigo-500 font-bold" />
                   </div>
                   <div>
                      <label className="block text-[10px] uppercase font-black text-slate-400 mb-2">Limite p/ Telefone</label>
                      <input type="number" value={raffle.maxEntriesPerPhone} onChange={e => setRaffle({...raffle, maxEntriesPerPhone: parseInt(e.target.value)})} className="w-full p-4 bg-slate-50 rounded-2xl border-none outline-none focus:ring-2 focus:ring-indigo-500 font-bold" />
                   </div>
                </div>

                <button onClick={runDraw} className="w-full bg-amber-500 text-white py-4 rounded-2xl font-black text-lg shadow-xl hover:bg-amber-600 transition-all uppercase tracking-widest">Sorteio Instantâneo</button>
             </div>
             <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-4">
                <button onClick={() => setIsAdminSettingsOpen(false)} className="flex-1 py-4 font-bold text-slate-400">Descartar</button>
                <button onClick={saveAdminSettings} className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg">SALVAR ALTERAÇÕES</button>
             </div>
          </div>
        </div>
      )}

      {winnerMessage && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl z-[200] flex items-center justify-center p-4">
          <div className="bg-white max-w-2xl w-full rounded-[60px] p-12 text-center shadow-2xl animate-in zoom-in duration-500">
            <h2 className="text-4xl font-black mb-8 text-slate-900">🎉 TEMOS UM GANHADOR!</h2>
            <div className="bg-indigo-50 p-10 rounded-[40px] mb-8 border-2 border-indigo-100">
              <div className="text-7xl font-mono text-indigo-600 font-black mb-6">#{raffle.winner?.number.toString().padStart(6, '0')}</div>
              <div className="text-3xl font-black text-slate-800">{raffle.winner?.participant.name}</div>
            </div>
            <p className="italic text-slate-600 leading-relaxed px-6">"{winnerMessage}"</p>
            <button onClick={() => setWinnerMessage(null)} className="mt-12 bg-indigo-600 text-white px-12 py-5 rounded-3xl font-black text-xl transition-all">FECHAR</button>
          </div>
        </div>
      )}

      {isAdminLoginOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-sm rounded-[32px] p-8 shadow-2xl">
            <h3 className="text-xl font-black mb-6">Acesso ADM</h3>
            <input type="password" placeholder="Senha" value={adminPassInput} onChange={e => setAdminPassInput(e.target.value)} className="w-full p-4 bg-slate-50 border-none rounded-xl mb-6 outline-none focus:ring-2 focus:ring-indigo-500 font-bold" />
            <div className="flex gap-2">
              <button onClick={() => setIsAdminLoginOpen(false)} className="flex-1 py-3 font-bold text-slate-400">Voltar</button>
              <button onClick={handleAdminLogin} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold">Entrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;

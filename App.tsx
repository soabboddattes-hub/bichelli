
import React, { useState, useEffect, useMemo } from 'react';
import { Schedule, Page } from './types';
import { WATER_BRANCHES, ARABIC_DAYS } from './constants';
import Layout from './components/Layout';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { 
  getFirestore, 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc, 
  query 
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// تنبيه: تأكد من تغيير "YOUR_PROJECT_ID" إلى المعرف الخاص بمشروعك في Firebase Console
const firebaseConfig = {
  apiKey: process.env.API_KEY,
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID", 
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const isFirebaseConfigured = firebaseConfig.projectId !== "YOUR_PROJECT_ID";

let db: any = null;
try {
  if (isFirebaseConfigured) {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
  }
} catch (e) {
  console.error("Firebase Init Error:", e);
}

const ADMIN_PHONE = '11112222';
const WORKING_HOURS_PER_DAY = 19.5;
const PAUSE_DURATION = 4.5;

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('login');
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  const [currentFarmer, setCurrentFarmer] = useState<Schedule | null>(null);
  const [phoneInput, setPhoneInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [activeBranchTab, setActiveBranchTab] = useState('1');

  useEffect(() => {
    if (!isFirebaseConfigured || !db) {
      loadLocalData();
      return;
    }

    let unsubscribe: () => void = () => {};
    try {
      const q = query(collection(db, "schedules"));
      unsubscribe = onSnapshot(q, (querySnapshot) => {
        const docs: Schedule[] = [];
        querySnapshot.forEach((doc) => {
          docs.push(doc.data() as Schedule);
        });
        setSchedules(docs);
        setConnectionStatus('online');
        setIsLoading(false);
        localStorage.setItem('bashli_schedules_backup', JSON.stringify(docs));
      }, (err) => {
        loadLocalData();
      });
    } catch (e) {
      loadLocalData();
    }
    return () => unsubscribe();
  }, []);

  const loadLocalData = () => {
    const local = localStorage.getItem('bashli_schedules_backup');
    if (local) setSchedules(JSON.parse(local));
    setConnectionStatus('offline');
    setIsLoading(false);
  };

  const toHoursMins = (decimal: number) => {
    const h = Math.floor(decimal);
    const m = Math.round((decimal - h) * 60);
    return { h, m };
  };

  const fromHoursMins = (h: number, m: number) => h + (m / 60);

  const autoScheduledList = useMemo(() => {
    const branches = ['1', '2', '3', '4'];
    let finalSchedules: Schedule[] = [];

    branches.forEach(bId => {
      const branchSchedules = schedules.filter(s => s.branch === bId);
      const uniqueValves = Array.from(new Set(branchSchedules.map(s => s.valve)))
        .sort((a, b) => (a as string).localeCompare(b as string, undefined, { numeric: true }));

      let cumulativeOffset = 0;
      uniqueValves.forEach(vName => {
        branchSchedules.filter(s => s.valve === vName).forEach(farmer => {
          const numPausesStart = Math.floor(cumulativeOffset / WORKING_HOURS_PER_DAY);
          const totalMinutesFromStart = (22 * 60 + 30) + (cumulativeOffset * 60) + (numPausesStart * PAUSE_DURATION * 60);
          
          const startDayShift = Math.floor(totalMinutesFromStart / 1440);
          const startTimeInMinutes = totalMinutesFromStart % 1440;
          const startHour = Math.floor(startTimeInMinutes / 60);
          const startMins = Math.floor(startTimeInMinutes % 60);

          const nextCumulativeOffset = cumulativeOffset + farmer.irrigationHours;
          const numPausesEnd = Math.floor(nextCumulativeOffset / WORKING_HOURS_PER_DAY);
          const totalMinutesEnd = (22 * 60 + 30) + (nextCumulativeOffset * 60) + (numPausesEnd * PAUSE_DURATION * 60);

          const endDayShift = Math.floor(totalMinutesEnd / 1440);
          const endTimeInMinutes = totalMinutesEnd % 1440;
          const endHour = Math.floor(endTimeInMinutes / 60);
          const endMins = Math.floor(endTimeInMinutes % 60);

          finalSchedules.push({
            ...farmer,
            day: ARABIC_DAYS[(0 + startDayShift) % 7],
            time: `${startHour.toString().padStart(2, '0')}:${startMins.toString().padStart(2, '0')}`,
            endDay: ARABIC_DAYS[(0 + endDayShift) % 7],
            endTime: `${endHour.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`
          });
          cumulativeOffset += farmer.irrigationHours;
        });
      });
    });
    return finalSchedules;
  }, [schedules]);

  const filteredSchedules = useMemo(() => {
    return autoScheduledList.filter(s => 
      s.farmerName.includes(searchQuery) || s.phoneNumber.includes(searchQuery) || s.valve.includes(searchQuery)
    );
  }, [autoScheduledList, searchQuery]);

  const groupedSchedules = useMemo(() => {
    const branches: Record<string, Record<string, Schedule[]>> = { '1': {}, '2': {}, '3': {}, '4': {} };
    filteredSchedules.forEach(s => {
      if (s.branch === activeBranchTab) {
        if (!branches[s.branch][s.valve]) branches[s.branch][s.valve] = [];
        branches[s.branch][s.valve].push(s);
      }
    });
    return branches;
  }, [filteredSchedules, activeBranchTab]);

  const handleLogin = () => {
    if (isLoading) return;
    setError('');
    if (!phoneInput.trim()) { setError('يرجى إدخال رقم الهاتف'); return; }
    if (phoneInput === ADMIN_PHONE) { setCurrentPage('admin-panel'); return; }

    const found = autoScheduledList.find(s => s.phoneNumber === phoneInput);
    if (found) {
      setCurrentFarmer(found);
      setCurrentPage('farmer-dashboard');
    } else {
      setError('الرقم غير مسجل. يرجى مراجعة إدارة الجمعية.');
    }
  };

  const handleSaveSchedule = async (updated: Schedule) => {
    if (!updated.farmerName || !updated.phoneNumber || !updated.valve) { alert('يرجى إكمال البيانات.'); return; }
    
    setEditingSchedule(null);
    setSearchQuery('');
    setActiveBranchTab(updated.branch);

    if (connectionStatus === 'online' && db) {
      try { 
        await setDoc(doc(db, "schedules", updated.id), updated); 
      } catch (e) { 
        saveLocally(updated); 
      }
    } else {
      saveLocally(updated);
    }
  };

  const saveLocally = (updated: Schedule) => {
    const newSchedules = schedules.filter(s => s.id !== updated.id);
    newSchedules.push(updated);
    setSchedules(newSchedules);
    localStorage.setItem('bashli_schedules_backup', JSON.stringify(newSchedules));
  };

  const handleDeleteSchedule = async (id: string) => {
    if(!confirm('حذف هذا الفلاح؟')) return;
    if (connectionStatus === 'online' && db) {
      try { await deleteDoc(doc(db, "schedules", id)); } catch (e) { deleteLocally(id); }
    } else { deleteLocally(id); }
  };

  const deleteLocally = (id: string) => {
    const newSchedules = schedules.filter(s => s.id !== id);
    setSchedules(newSchedules);
    localStorage.setItem('bashli_schedules_backup', JSON.stringify(newSchedules));
  };

  const handleLogout = () => {
    setCurrentFarmer(null);
    setPhoneInput('');
    setSearchQuery('');
    setCurrentPage('login');
  };

  if (currentPage === 'login') {
    return (
      <div className="min-h-screen palm-pattern flex flex-col items-center justify-center p-6" dir="rtl">
        <div className="w-full max-w-md">
          <div className="text-center mb-10">
            <div className="bg-white/10 backdrop-blur-md w-24 h-24 rounded-3xl mx-auto flex items-center justify-center border border-white/20 shadow-2xl mb-6 float-animation">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
            </div>
            <h1 className="text-3xl font-black text-white mb-2 tracking-tight">الجمعية المائية ببشلي</h1>
            <p className="text-indigo-200 font-bold opacity-70">نظام تتبع ري النخيل</p>
          </div>

          <div className="bg-white rounded-[2.5rem] p-8 md:p-10 shadow-2xl">
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-black text-slate-400 mb-3 mr-1 uppercase tracking-widest">أدخل رقم هاتفك للمتابعة</label>
                <input 
                  type="tel" 
                  placeholder="00 00 00 00"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-5 focus:border-indigo-600 focus:bg-white transition-all text-center text-2xl font-mono tracking-widest outline-none"
                />
              </div>
              {error && <div className="p-4 bg-red-50 text-red-600 rounded-xl text-xs font-black text-center border border-red-100 animate-bounce">{error}</div>}
              <button 
                onClick={handleLogin} 
                disabled={isLoading}
                className="w-full bg-indigo-950 hover:bg-black text-white font-black py-5 rounded-2xl shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {isLoading ? 'جاري التحميل...' : 'دخول الفلاح'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Layout title={currentPage === 'admin-panel' ? "إدارة الدورة المائية" : "جدول ري فلاح"} onLogout={handleLogout} onNavigateToHome={() => { setCurrentPage(currentPage); setSearchQuery(''); }}>
      <div className="mb-6">
        <div className={`p-3 rounded-2xl flex items-center justify-center gap-2 text-[10px] font-black transition-all ${connectionStatus === 'online' ? 'bg-green-50 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
          <div className={`w-1.5 h-1.5 rounded-full ${connectionStatus === 'online' ? 'bg-green-500' : 'bg-slate-400'}`}></div>
          {connectionStatus === 'online' ? 'متصل بالسحابة' : 'يعمل بدون مزامنة'}
        </div>
      </div>

      {currentPage === 'farmer-dashboard' && currentFarmer ? (
        <div className="space-y-6">
          <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-5">
              <div className="bg-amber-100 p-4 rounded-3xl text-amber-700">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <div>
                <h3 className="text-2xl font-black text-indigo-950">{currentFarmer.farmerName}</h3>
                <p className="text-amber-600 font-bold text-sm">موقع الفانة: {currentFarmer.valve}</p>
              </div>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[10px] font-black text-slate-400 uppercase mb-1">مدة الري</span>
              <div className="bg-indigo-950 text-white px-8 py-3 rounded-2xl font-black shadow-lg text-xl">
                {toHoursMins(currentFarmer.irrigationHours).h}س : {toHoursMins(currentFarmer.irrigationHours).m}د
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-[2rem] p-8 border-r-8 border-indigo-600 shadow-sm transition-transform hover:scale-[1.01]">
              <p className="text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">تاريخ البدء</p>
              <h4 className="text-2xl font-black text-indigo-950">{currentFarmer.day}</h4>
              <p className="text-indigo-600 font-black text-3xl mt-2">{currentFarmer.time}</p>
            </div>
            <div className="bg-white rounded-[2rem] p-8 border-r-8 border-amber-500 shadow-sm transition-transform hover:scale-[1.01]">
              <p className="text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">تاريخ الانتهاء</p>
              <h4 className="text-2xl font-black text-indigo-950">{currentFarmer.endDay}</h4>
              <p className="text-amber-600 font-black text-3xl mt-2">{currentFarmer.endTime}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
            <div className="relative mb-6">
              <input 
                type="text" 
                placeholder="ابحث عن فلاح بالاسم أو الهاتف أو الفانة..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl py-4 pr-12 pl-4 font-bold outline-none focus:border-indigo-600 transition-all"
              />
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 absolute right-4 top-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>

            <div className="flex flex-wrap gap-2 bg-slate-100 p-2 rounded-2xl">
              {WATER_BRANCHES.map(branch => (
                <button key={branch.id} onClick={() => setActiveBranchTab(branch.id)} className={`flex-1 px-4 py-3 rounded-xl font-black text-xs transition-all ${activeBranchTab === branch.id ? 'bg-indigo-950 text-white shadow-md' : 'text-slate-500 hover:bg-slate-200'}`}>{branch.name}</button>
              ))}
            </div>
          </div>

          <div className="flex justify-between items-center gap-4">
            <button onClick={() => setEditingSchedule({ id: Date.now().toString(), farmerName: '', phoneNumber: '', fieldName: '', branch: activeBranchTab, valve: '', day: '', time: '', irrigationHours: 2, supervisorName: 'الجمعية', supervisorPhone: '000', status: 'upcoming' })} className="flex-1 bg-indigo-950 text-white font-black py-5 rounded-3xl shadow-xl flex items-center justify-center gap-3 transition-transform active:scale-95">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              إضافة فلاح جديد
            </button>
          </div>

          <div className="space-y-12 pb-20">
            {Object.entries(groupedSchedules[activeBranchTab] || {}).length === 0 ? (
              <div className="text-center py-20 opacity-30 font-black text-xl">لا توجد بيانات حالياً</div>
            ) : (
              Object.entries(groupedSchedules[activeBranchTab] || {}).map(([valve, farmers]) => (
                <div key={valve} className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="bg-amber-600 text-white px-6 py-2 rounded-full font-black text-sm shadow-md">الفانة {valve}</div>
                    <div className="h-[2px] flex-grow bg-slate-200"></div>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    {(farmers as Schedule[]).map((s) => (
                      <div key={s.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-wrap justify-between items-center gap-4 group hover:border-indigo-200 transition-all">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-900 font-black">{s.farmerName.charAt(0)}</div>
                          <div>
                            <h5 className="font-black text-indigo-950 text-lg">{s.farmerName}</h5>
                            <p className="text-xs font-mono text-slate-400">{s.phoneNumber}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-8">
                          <div className="text-right">
                            <p className="font-black text-indigo-950 text-sm">{s.day}</p>
                            <p className="text-indigo-600 font-black text-xl">{s.time}</p>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => setEditingSchedule(s)} className="p-3 bg-slate-50 text-indigo-950 rounded-xl hover:bg-indigo-950 hover:text-white transition-all"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                            <button onClick={() => handleDeleteSchedule(s.id)} className="p-3 bg-slate-50 text-red-600 rounded-xl hover:bg-red-600 hover:text-white transition-all"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {editingSchedule && (
        <div className="fixed inset-0 bg-indigo-950/80 backdrop-blur-md z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-300" dir="rtl">
          <div className="bg-white rounded-t-[3rem] sm:rounded-[3rem] w-full max-w-md p-8 shadow-2xl relative max-h-[95vh] overflow-y-auto custom-scrollbar">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 to-amber-500"></div>
            <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto mb-6 sm:hidden"></div>
            
            <h3 className="text-2xl font-black mb-8 text-indigo-950 flex items-center gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              {editingSchedule.farmerName ? 'تعديل بيانات فلاح' : 'إضافة فلاح جديد'}
            </h3>
            
            <div className="space-y-6 pb-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">اسم الفلاح الرباعي</label>
                <input 
                  type="text" 
                  placeholder="مثال: أحمد بن علي البشلي" 
                  autoFocus
                  value={editingSchedule.farmerName} 
                  onChange={e => setEditingSchedule({...editingSchedule, farmerName: e.target.value})} 
                  className="w-full bg-slate-50 p-4 rounded-2xl border-2 border-slate-100 font-bold outline-none focus:border-indigo-600 transition-all text-lg" 
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">رقم الجوال المسجل</label>
                <input 
                  type="tel" 
                  placeholder="99 99 99 99" 
                  value={editingSchedule.phoneNumber} 
                  onChange={e => setEditingSchedule({...editingSchedule, phoneNumber: e.target.value})} 
                  className="w-full bg-slate-50 p-4 rounded-2xl border-2 border-slate-100 font-mono text-center text-xl outline-none focus:border-indigo-600 transition-all" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">الخط المائي</label>
                  <select 
                    value={editingSchedule.branch} 
                    onChange={e => setEditingSchedule({...editingSchedule, branch: e.target.value})} 
                    className="w-full bg-slate-50 p-4 rounded-2xl border-2 border-slate-100 font-bold outline-none focus:border-indigo-600 appearance-none text-center"
                  >
                    {(WATER_BRANCHES as any[]).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest">رقم الفانة</label>
                  <input 
                    type="text" 
                    placeholder="V-01" 
                    value={editingSchedule.valve} 
                    onChange={e => setEditingSchedule({...editingSchedule, valve: e.target.value})} 
                    className="w-full bg-slate-50 p-4 rounded-2xl border-2 border-slate-100 font-black text-center outline-none focus:border-indigo-600 transition-all" 
                  />
                </div>
              </div>

              <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100">
                <p className="text-center text-[10px] font-black text-indigo-900 mb-4 uppercase tracking-[0.2em]">تحديد مدة الري (ساعات : دقائق)</p>
                <div className="flex justify-center gap-4 items-center">
                   <div className="flex flex-col items-center gap-1">
                     <input 
                       type="number" 
                       min="0" 
                       max="48" 
                       value={toHoursMins(editingSchedule.irrigationHours).h} 
                       onChange={e => setEditingSchedule({...editingSchedule, irrigationHours: fromHoursMins(parseInt(e.target.value)||0, toHoursMins(editingSchedule.irrigationHours).m)})} 
                       className="w-20 p-4 rounded-2xl text-center font-black text-2xl shadow-inner border border-indigo-200 outline-none focus:border-indigo-600" 
                     />
                     <span className="text-[8px] font-bold text-indigo-400">ساعة</span>
                   </div>
                   <span className="font-black text-3xl text-indigo-300">:</span>
                   <div className="flex flex-col items-center gap-1">
                     <input 
                       type="number" 
                       min="0" 
                       max="59" 
                       value={toHoursMins(editingSchedule.irrigationHours).m} 
                       onChange={e => setEditingSchedule({...editingSchedule, irrigationHours: fromHoursMins(toHoursMins(editingSchedule.irrigationHours).h, parseInt(e.target.value)||0)})} 
                       className="w-20 p-4 rounded-2xl text-center font-black text-2xl shadow-inner border border-indigo-200 outline-none focus:border-indigo-600" 
                     />
                     <span className="text-[8px] font-bold text-indigo-400">دقيقة</span>
                   </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 mt-4 pt-4 border-t border-slate-100">
                <button 
                  onClick={() => handleSaveSchedule(editingSchedule)} 
                  className="w-full bg-indigo-950 text-white font-black py-5 rounded-2xl shadow-xl transition-all hover:bg-black active:scale-[0.98] text-lg"
                >
                  حفظ وتحديث الجدولة
                </button>
                <button 
                  onClick={() => setEditingSchedule(null)} 
                  className="w-full text-slate-400 font-bold py-3 hover:text-red-500 transition-colors flex items-center justify-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  إلغاء وإغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default App;

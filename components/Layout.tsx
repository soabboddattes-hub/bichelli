
import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
  title: string;
  onLogout?: () => void;
  onNavigateToHome?: () => void;
}

const Layout: React.FC<LayoutProps> = ({ 
  children, 
  title, 
  onLogout, 
  onNavigateToHome 
}) => {
  const handleShare = () => {
    const shareData = {
      title: 'الجمعية المائية ببشلي',
      text: 'أخي الفلاح، يمكنك متابعة مواعيد ري النخيل الخاصة بك عبر هذا الرابط:',
      url: window.location.href,
    };
    if (navigator.share) {
      navigator.share(shareData);
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('تم نسخ رابط التطبيق، يمكنك الآن إرساله عبر الواتساب');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-white/90 backdrop-blur-lg border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center">
          <div 
            className="flex items-center gap-3 cursor-pointer group" 
            onClick={onNavigateToHome}
          >
            <div className="bg-indigo-950 p-2 rounded-xl shadow-lg shadow-indigo-100 group-hover:scale-105 transition-all duration-300">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-black text-indigo-950 leading-none">الجمعية المائية ببشلي</h1>
              <span className="text-[10px] font-black text-amber-600 tracking-[0.2em] uppercase">نظام الري المتكامل</span>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <button 
              onClick={handleShare}
              className="p-2.5 bg-green-50 text-green-600 rounded-xl hover:bg-green-100 transition-all border border-green-100 flex items-center gap-2"
              title="مشاركة التطبيق"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 100-2.684 3 3 0 000 2.684zm0 9a3 3 0 100-2.684 3 3 0 000 2.684z" />
              </svg>
              <span className="hidden sm:inline font-bold text-xs">نشر التطبيق</span>
            </button>
            
            {onLogout && (
              <button 
                onClick={onLogout}
                className="flex items-center gap-2 text-slate-400 font-bold hover:text-red-600 p-2 rounded-xl transition-all"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </header>
      
      <main className="flex-grow max-w-5xl mx-auto w-full p-4 md:p-6">
        <div className="mb-8 mt-4 flex items-center justify-between">
          <h2 className="text-2xl md:text-3xl font-black text-indigo-950 relative inline-block">
            {title}
            <span className="absolute -bottom-2 right-0 w-10 h-1 bg-amber-500 rounded-full"></span>
          </h2>
        </div>
        {children}
      </main>

      <footer className="bg-indigo-950 text-slate-400 py-10 mt-20 relative overflow-hidden">
        <div className="max-w-5xl mx-auto px-6 text-center relative z-10">
          <p className="font-black text-white text-base mb-1">الجمعية المائية ببشلي</p>
          <p className="text-xs opacity-50">نظام المزامنة السحابية الموحد</p>
        </div>
      </footer>
    </div>
  );
};

export default Layout;

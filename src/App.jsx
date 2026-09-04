import React, { useState } from 'react';
import OtpMailboxPage from './components/OtpMailboxPage';
import Toast from './components/Toast';

export default function App() {
  const [toast, setToast] = useState({ isVisible: false, message: '', icon: '✨' });

  // Read initial email from URL query if present (e.g. /?email=...)
  const getInitialEmailFromUrl = () => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('email') || '';
    } catch {
      return '';
    }
  };

  const [initialEmail] = useState(getInitialEmailFromUrl);

  const showToast = (message, icon = '✨') => {
    setToast({ isVisible: true, message, icon });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, isVisible: false }));
    }, 3500);
  };

  return (
    <div className="min-h-screen bg-[#FDF5F8] flex flex-col justify-between font-['Prompt'] text-[#374151] selection:bg-pink-200 selection:text-pink-900">
      
      {/* Standalone Top Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-pink-100 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl overflow-hidden shadow-xs ring-2 ring-pink-200 bg-white flex items-center justify-center">
              <img src="/images/logo.jpg" alt="BA STORE" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base sm:text-lg tracking-tight bg-gradient-to-r from-rose-500 via-pink-600 to-purple-600 bg-clip-text text-transparent font-['Prompt']">
                  BA STORE
                </span>
                <span className="text-[10px] bg-pink-100 text-pink-700 font-bold px-2 py-0.5 rounded-md">
                  Mailbox OTP
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-gray-500 font-normal">ระบบดึงรหัสยืนยัน OTP อัตโนมัติ 24 ชม.</p>
            </div>
          </div>

        </div>
      </header>

      {/* Main Mailbox Content */}
      <main className="max-w-5xl mx-auto px-4 py-6 sm:py-10 w-full flex-1">
        <OtpMailboxPage
          initialEmail={initialEmail}
          onShowToast={showToast}
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-pink-100 bg-white/80 py-6 text-center text-xs text-gray-500">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>© 2026 BA STORE — ระบบอัตโนมัติ 24 ชม.</span>
          <span className="text-gray-400">ให้บริการกล่องข้อความและรับรหัส OTP อย่างปลอดภัย</span>
        </div>
      </footer>

      {/* Toast Notification */}
      <Toast
        isVisible={toast.isVisible}
        message={toast.message}
        icon={toast.icon}
        onClose={() => setToast((prev) => ({ ...prev, isVisible: false }))}
      />

    </div>
  );
}

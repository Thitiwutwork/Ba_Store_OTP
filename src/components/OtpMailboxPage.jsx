import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Mail, 
  Copy, 
  Check, 
  RefreshCw, 
  Clock, 
  KeyRound, 
  ChevronDown, 
  ChevronUp, 
  Sparkles,
  AlertCircle
} from 'lucide-react';

/**
 * Intelligent OTP Extractor from mail subject and body text
 */
function extractOtpFromMail(mail) {
  if (!mail) return null;
  const subject = mail.subject || '';
  const text = mail.text || mail.searchText || mail.snippet || '';
  const fullContent = `${subject} ${text}`.replace(/[\u00a0\u200b\u200c\u200d]/g, ' ');

  // 1. Check for explicit keywords like "code is 123456", "OTP: 123456", "รหัสยืนยัน: 123456"
  const keywordRegex = /(?:otp|code|verification|verification code|security code|passcode|pin|รหัส|รหัสยืนยัน|รหัสชั่วคราว|รหัสความปลอดภัย)[\s:：\-–—isareคือได้แก่]*([0-9]{4,8})\b/i;
  const kwMatch = fullContent.match(keywordRegex);
  if (kwMatch && kwMatch[1]) {
    return kwMatch[1];
  }

  // 1b. Check for number followed by keyword e.g. "060159 คือรหัส OTP", "123456 is your code"
  const revRegex = /\b([0-9]{4,8})[\s:：\-–—isareคือได้แก่]*(?:otp|code|verification|รหัส|ยืนยัน)/i;
  const revMatch = fullContent.match(revRegex);
  if (revMatch && revMatch[1]) {
    return revMatch[1];
  }

  // 2. Standalone 4-8 digits in Subject (very common in service emails e.g. "Your Netflix code is 123456")
  const subjectMatch = subject.match(/\b([0-9]{4,8})\b/);
  if (subjectMatch && subjectMatch[1]) {
    return subjectMatch[1];
  }

  // 3. Look for typical 6-digit code anywhere in the content
  const sixDigit = fullContent.match(/\b([0-9]{6})\b/);
  if (sixDigit && sixDigit[1]) {
    return sixDigit[1];
  }

  // 4. Any 4-8 digit standalone number
  const anyDigit = fullContent.match(/\b([0-9]{4,8})\b/);
  if (anyDigit && anyDigit[1]) {
    return anyDigit[1];
  }

  return null;
}

export default function OtpMailboxPage({ initialEmail = '', onShowToast }) {
  const [emailInput, setEmailInput] = useState(initialEmail || '');
  const [activeEmail, setActiveEmail] = useState(initialEmail || '');
  const [mails, setMails] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [warningMessage, setWarningMessage] = useState('');
  const [copiedOtpId, setCopiedOtpId] = useState(null);
  const [expandedMailId, setExpandedMailId] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [recentEmails, setRecentEmails] = useState(() => {
    try {
      const saved = localStorage.getItem('BA_STORE_RECENT_OTP_EMAILS');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const timerRef = useRef(null);

  // Save recent search email
  const saveRecentEmail = (email) => {
    const clean = email.trim().toLowerCase();
    if (!clean) return;
    const updated = [clean, ...recentEmails.filter((e) => e !== clean)].slice(0, 5);
    setRecentEmails(updated);
    try {
      localStorage.setItem('BA_STORE_RECENT_OTP_EMAILS', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  const removeRecentEmail = (e, emailToRemove) => {
    e.stopPropagation();
    const updated = recentEmails.filter((e) => e !== emailToRemove);
    setRecentEmails(updated);
    try {
      localStorage.setItem('BA_STORE_RECENT_OTP_EMAILS', JSON.stringify(updated));
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch Mails: Multi-Tier Resilient Fetch Strategy
  // Tier 1: Direct Client Browser Call to Maily Space REST API (bypasses datacenter Cloudflare WAF)
  // Tier 2: Direct Client Browser Call to Maily Space Public Mailbox API (the exact API used by maily.space web)
  const fetchMails = async (targetEmail, isSilent = false) => {
    const clean = (targetEmail || emailInput).trim().toLowerCase();
    if (!clean || !clean.includes('@')) {
      if (!isSilent) {
        setErrorMessage('กรุณาระบุที่อยู่อีเมลที่ถูกต้อง (เช่น example@baxsv.store)');
      }
      return;
    }

    if (!isSilent) {
      setIsLoading(true);
      setErrorMessage('');
      setWarningMessage('');
    }

    let fetchedMails = null;

    // Tier 1: Direct Browser API Call to Maily Space REST API
    // Maily Space sends Access-Control-Allow-Origin: * so browsers can call it directly.
    // Client browser has real residential IP, avoiding Cloudflare 403 blocks against AWS/Vercel servers.
    try {
      const directRes = await fetch('https://api.maily.space/v1/mails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/plain, */*'
        },
        body: JSON.stringify({
          apiKey: 'sk_v1_phbofy2tb4gvtmsq4g7nw1ywmmwv6c9p',
          email: clean,
          size: 40,
          page: 1
        })
      });

      if (directRes.ok) {
        const directData = await directRes.json();
        const list = Array.isArray(directData?.data?.mails)
          ? directData.data.mails
          : (Array.isArray(directData?.mails) ? directData.mails : []);
        if (list.length > 0) {
          fetchedMails = list;
        } else if (directData?.statusCode === 200 || directRes.status === 200 || directRes.status === 201) {
          fetchedMails = [];
        }
      }
    } catch (directErr) {
      console.warn('Tier 1 direct fetch error:', directErr);
    }

    // Tier 2: Direct Browser Call to Public Mailbox API (exact same endpoint maily.space web uses)
    if (!fetchedMails || fetchedMails.length === 0) {
      try {
        const [accountName, domainPart] = clean.split('@');
        if (accountName && domainPart) {
          const domainId = domainPart.replace(/\./g, '');
          const pubUrl = `https://api.maily.space/mail/public/mails?accountName=${encodeURIComponent(accountName)}&domainId=${encodeURIComponent(domainId)}&size=40`;
          const pubRes = await fetch(pubUrl);
          if (pubRes.ok) {
            const pubData = await pubRes.json();
            const list = Array.isArray(pubData?.data?.mails)
              ? pubData.data.mails
              : (Array.isArray(pubData?.mails) ? pubData.mails : (Array.isArray(pubData) ? pubData : []));
            if (list.length > 0) {
              fetchedMails = list.map((m) => ({
                id: m.id || `mail-${Math.random().toString(36).substr(2, 9)}`,
                from: m.from || m.sender || 'ไม่ระบุผู้ส่ง',
                to: clean,
                subject: m.subject || '(ไม่มีหัวข้อ)',
                html: m.html || '',
                text: m.text || m.body || m.searchText || m.snippet || '',
                createdAt: m.createdAt || m.date || new Date().toISOString()
              }));
            }
          }
        }
      } catch (pubErr) {
        console.warn('Tier 2 public mailbox fetch error:', pubErr);
      }
    }

    if (fetchedMails && fetchedMails.length > 0) {
      setMails(fetchedMails);
      setActiveEmail(clean);
      setEmailInput(clean);
      saveRecentEmail(clean);
      setLastUpdated(new Date());
      setWarningMessage('');
      if (!isSilent && onShowToast) {
        onShowToast(`📬 ดึงข้อความเรียบร้อยแล้ว (${fetchedMails.length} รายการ)`, '✨');
      }
    } else {
      setMails([]);
      setActiveEmail(clean);
      saveRecentEmail(clean);
      setLastUpdated(new Date());
      setWarningMessage('ยังไม่มีข้อความเข้าในกล่องจดหมายนี้ (หากเพิ่งขอ OTP กรุณารอสักครู่แล้วกดรีเฟรช)');
    }

    if (!isSilent) {
      setIsLoading(false);
    }
  };

  // Trigger search on form submit
  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    fetchMails(emailInput);
  };

  // If initialEmail changes, auto-search
  useEffect(() => {
    if (initialEmail && initialEmail.trim()) {
      setEmailInput(initialEmail.trim());
      fetchMails(initialEmail.trim());
    }
  }, [initialEmail]);

  // Auto-refresh countdown effect
  useEffect(() => {
    if (!autoRefresh || !activeEmail) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchMails(activeEmail, true);
          return 5;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [autoRefresh, activeEmail]);

  // Copy OTP handler
  const handleCopyOtp = (id, otp) => {
    if (!otp) return;
    navigator.clipboard.writeText(otp);
    setCopiedOtpId(id);
    if (onShowToast) onShowToast(`🔑 คัดลอกรหัส OTP ${otp} เรียบร้อยแล้ว`, '✅');
    setTimeout(() => {
      setCopiedOtpId(null);
    }, 2500);
  };

  // Toggle full email preview
  const toggleExpand = (id) => {
    setExpandedMailId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Top Status */}
      {lastUpdated && (
        <div className="flex items-center justify-end">
          <div className="text-[11px] text-gray-400 flex items-center gap-1.5 bg-white/80 px-3.5 py-1.5 rounded-full border border-pink-100 shadow-2xs">
            <Clock className="w-3.5 h-3.5 text-pink-400" />
            <span>อัปเดตล่าสุด: {lastUpdated.toLocaleTimeString('th-TH')}</span>
          </div>
        </div>
      )}

      {/* Main Mailbox Search Card (Styled matching store theme) */}
      <div className="bg-white rounded-3xl p-6 sm:p-10 border border-pink-100 shadow-sm text-center space-y-6 relative overflow-hidden">
        
        {/* Subtle decorative glow */}
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-pink-100/50 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-rose-100/50 rounded-full blur-2xl pointer-events-none" />

        {/* Title & Store Logo */}
        <div className="space-y-2 relative">
          <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-xs ring-2 ring-pink-200 bg-white mx-auto flex items-center justify-center">
            <img src="/images/logo.jpg" alt="BA STORE" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-pink-50 text-pink-600 text-xs font-bold border border-pink-100 mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>ระบบดึงรหัส OTP อัตโนมัติ 24 ชม.</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-gray-900 tracking-tight font-['Prompt']">
            กล่องข้อความ
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 max-w-md mx-auto">
            กรอกอีเมลที่คุณได้รับจากคำสั่งซื้อ เพื่อค้นหาและแสดงรหัส OTP ทันที
          </p>
        </div>

        {/* Search Input Bar matching store theme */}
        <form onSubmit={handleSearchSubmit} className="max-w-xl mx-auto flex flex-col sm:flex-row items-stretch gap-2.5">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
              <Mail className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="example@baxsv.store"
              className="w-full pl-10 pr-4 py-3 sm:py-3.5 bg-gray-50/70 hover:bg-white focus:bg-white border border-gray-300 focus:border-pink-500 focus:ring-4 focus:ring-pink-100 rounded-2xl text-sm sm:text-base font-mono tracking-wide text-gray-800 transition-all outline-none"
            />
            {emailInput && (
              <button
                type="button"
                onClick={() => setEmailInput('')}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-xs text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="px-7 py-3 sm:py-3.5 rounded-2xl bg-gradient-to-r from-rose-500 via-pink-600 to-purple-600 hover:opacity-95 active:scale-98 text-white font-bold text-sm sm:text-base shadow-md transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>กำลังค้นหา...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>ค้นหา</span>
              </>
            )}
          </button>
        </form>

        {/* Recent Email Chips */}
        {recentEmails.length > 0 && (
          <div className="flex items-center justify-center gap-1.5 flex-wrap pt-1 text-xs">
            <span className="text-gray-400 text-[11px]">ค้นหาล่าสุด:</span>
            {recentEmails.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setEmailInput(item);
                  fetchMails(item);
                }}
                className={`group px-2.5 py-1 rounded-full text-[11px] font-medium transition-all flex items-center gap-1 border ${
                  activeEmail === item
                    ? 'bg-pink-50 text-rose-600 border-pink-200 font-bold'
                    : 'bg-gray-100/80 text-gray-600 hover:bg-gray-200/80 border-gray-200'
                }`}
              >
                <span>{item}</span>
                <span
                  onClick={(e) => removeRecentEmail(e, item)}
                  className="opacity-40 group-hover:opacity-100 hover:text-red-500 ml-0.5"
                  title="ลบออกจากประวัติ"
                >
                  ✕
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Error / Warning Alert */}
        {errorMessage && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-2 max-w-xl mx-auto">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {warningMessage && !errorMessage && (
          <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-2 max-w-xl mx-auto">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{warningMessage}</span>
          </div>
        )}

      </div>

      {/* Mailbox Results Section */}
      {activeEmail && (
        <div className="space-y-4">
          
          {/* Action & Status Header */}
          <div className="bg-white rounded-2xl p-4 border border-pink-100 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-pink-100 text-pink-700 flex items-center justify-center text-base shrink-0 font-bold">
                📫
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-800 text-sm sm:text-base">
                    กล่องจดหมายของ:
                  </span>
                  <span className="font-mono text-rose-600 font-bold text-xs sm:text-sm bg-rose-50 px-2.5 py-1 rounded-xl border border-rose-200">
                    {activeEmail}
                  </span>
                </div>
                <div className="text-[11px] text-gray-500 mt-0.5">
                  พบทั้งหมด <strong className="text-gray-800">{mails.length}</strong> ข้อความ
                </div>
              </div>
            </div>

            {/* Controls: Auto-Refresh & Manual Refresh */}
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                  autoRefresh
                    ? 'bg-emerald-500 text-white border-emerald-600 shadow-xs'
                    : 'bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-200'
                }`}
                title="เปิด/ปิดการเช็คข้อความใหม่อัตโนมัติทุก 5 วินาที"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${autoRefresh ? 'animate-spin' : ''}`} />
                <span>
                  {autoRefresh ? `เช็คอัตโนมัติ (${countdown}s)` : 'เช็คอัตโนมัติ (ปิด)'}
                </span>
              </button>

              <button
                onClick={() => fetchMails(activeEmail)}
                disabled={isLoading}
                className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span>รีเฟรช</span>
              </button>
            </div>
          </div>

          {/* Mail List */}
          {mails.length === 0 ? (
            <div className="bg-white rounded-3xl p-10 sm:p-14 text-center border border-pink-100 shadow-2xs space-y-4">
              <div className="w-16 h-16 rounded-full bg-pink-50 text-pink-400 flex items-center justify-center text-3xl mx-auto animate-pulse">
                📭
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-gray-800">
                  ยังไม่มีข้อความเข้าสำหรับอีเมลนี้
                </h3>
                <p className="text-xs sm:text-sm text-gray-500 mt-1 max-w-md mx-auto">
                  หากคุณเพิ่งกดยืนยันหรือขอรหัส OTP จากแอพ ข้อความอาจใช้เวลาเดินทางประมาณ 10-30 วินาที กรุณากดปุ่ม <strong>"รีเฟรช"</strong> หรือเปิด <strong>"เช็คอัตโนมัติ"</strong> ไว้
                </p>
              </div>

              <div className="pt-2 flex items-center justify-center gap-2">
                <button
                  onClick={() => fetchMails(activeEmail)}
                  disabled={isLoading}
                  className="px-5 py-2.5 rounded-2xl bg-rose-500 text-white text-xs font-bold shadow-xs hover:bg-rose-600 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>ตรวจหาข้อความใหม่อีกครั้ง</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {mails.map((mail, index) => {
                const otpCode = extractOtpFromMail(mail);
                const isCopied = copiedOtpId === mail.id;
                const isExpanded = expandedMailId === mail.id;
                const isLatest = index === 0;

                const mailDate = mail.createdAt
                  ? new Date(mail.createdAt).toLocaleString('th-TH', {
                      dateStyle: 'medium',
                      timeStyle: 'medium'
                    })
                  : 'ไม่ระบุเวลา';

                return (
                  <div
                    key={mail.id || index}
                    className={`bg-white rounded-3xl border transition-all overflow-hidden ${
                      isLatest
                        ? 'border-rose-300 shadow-sm ring-2 ring-rose-100'
                        : 'border-pink-100 shadow-2xs hover:border-pink-200'
                    }`}
                  >
                    {/* Top Ribbon for Latest Mail */}
                    {isLatest && (
                      <div className="bg-gradient-to-r from-rose-500 to-pink-600 text-white text-[11px] font-bold py-1 px-4 flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>ข้อความล่าสุดที่ได้รับ</span>
                        </span>
                        <span>{mailDate}</span>
                      </div>
                    )}

                    <div className="p-5 sm:p-6 space-y-4">
                      
                      {/* PROMINENT OTP SHOWCASE BOX */}
                      {otpCode ? (
                        <div className="bg-gradient-to-br from-rose-50 via-pink-50 to-orange-50 rounded-2xl p-4 sm:p-5 border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700">
                              <KeyRound className="w-4 h-4 text-rose-600" />
                              <span>รหัสยืนยัน OTP ที่ตรวจพบ:</span>
                            </div>
                            <div className="font-mono text-3xl sm:text-4xl font-black text-rose-600 tracking-wider">
                              {otpCode.split('').join(' ')}
                            </div>
                            <div className="text-[11px] text-gray-500">
                              คัดลอกรหัสนี้ไปวางในแอพหรือเว็บไซต์ที่ต้องการยืนยันตัวตนได้ทันที
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleCopyOtp(mail.id, otpCode)}
                            className={`px-5 py-3 rounded-2xl font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 shadow-sm shrink-0 cursor-pointer ${
                              isCopied
                                ? 'bg-emerald-600 text-white'
                                : 'bg-rose-500 hover:bg-rose-600 active:scale-95 text-white'
                            }`}
                          >
                            {isCopied ? (
                              <>
                                <Check className="w-4 h-4 stroke-[3]" />
                                <span>คัดลอกสำเร็จ!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-4 h-4" />
                                <span>คัดลอกรหัส OTP</span>
                              </>
                            )}
                          </button>
                        </div>
                      ) : (
                        <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200 text-xs text-amber-800 flex items-center justify-between">
                          <span>ไม่พบรหัสตัวเลข OTP อัตโนมัติ (อาจเป็นลิงก์ยืนยันตัวตน กรุณากดดูเนื้อหาฉบับเต็มด้านล่าง)</span>
                        </div>
                      )}

                      {/* Mail Metadata Card */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-600 pt-1">
                        <div>
                          <span className="text-gray-400 block text-[10px]">จาก (Sender):</span>
                          <span className="font-semibold text-gray-800 break-all">{mail.from}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 block text-[10px]">เวลาที่ส่ง:</span>
                          <span className="font-medium text-gray-700">{mailDate}</span>
                        </div>
                        <div className="sm:col-span-2">
                          <span className="text-gray-400 block text-[10px]">หัวข้ออีเมล (Subject):</span>
                          <span className="font-bold text-gray-900 text-xs sm:text-sm">
                            {mail.subject || '(ไม่มีหัวข้อ)'}
                          </span>
                        </div>
                      </div>

                      {/* Toggle Full Email Content */}
                      <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => toggleExpand(mail.id)}
                          className="text-xs font-semibold text-gray-500 hover:text-rose-600 flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="w-4 h-4" />
                              <span>ซ่อนเนื้อหาฉบับเต็ม</span>
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-4 h-4" />
                              <span>ดูเนื้อหาอีเมลฉบับเต็ม</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCopyOtp(mail.id, mail.text || mail.searchText || mail.snippet || mail.subject)}
                          className="text-[11px] text-gray-400 hover:text-gray-600 flex items-center gap-1"
                          title="คัดลอกข้อความในอีเมลทั้งหมด"
                        >
                          <Copy className="w-3 h-3" />
                          <span>คัดลอกข้อความทั้งหมด</span>
                        </button>
                      </div>

                      {/* Expanded View: HTML or Text preview */}
                      {isExpanded && (
                        <div className="mt-3 p-4 rounded-2xl bg-gray-50 border border-gray-200 text-xs text-gray-700 space-y-3">
                          {mail.html ? (
                            <div className="w-full overflow-x-auto bg-white p-3 rounded-xl border border-gray-200 max-h-96 overflow-y-auto">
                              <div
                                dangerouslySetInnerHTML={{ __html: mail.html }}
                                className="prose prose-xs max-w-none"
                              />
                            </div>
                          ) : (
                            <pre className="whitespace-pre-wrap font-sans text-xs bg-white p-3 rounded-xl border border-gray-200 max-h-80 overflow-y-auto">
                              {mail.text || mail.searchText || mail.snippet || '(ไม่มีเนื้อหาข้อความ)'}
                            </pre>
                          )}
                        </div>
                      )}

                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* Guide & Help Card */}
      <div className="bg-pink-50/60 rounded-3xl p-5 border border-pink-100 text-xs text-gray-600 space-y-2">
        <h4 className="font-bold text-gray-800 flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-rose-500" />
          <span>คำแนะนำการใช้งานหน้ารับ OTP</span>
        </h4>
        <ul className="list-disc list-inside space-y-1 text-[11px] sm:text-xs text-gray-500 leading-relaxed">
          <li>บริการนี้สร้างขึ้นเพื่อให้คุณรับรหัสยืนยัน OTP ได้โดยตรงและรวดเร็วตลอด 24 ชม.</li>
          <li>เมื่อคุณสั่งซื้อสินค้าประเภท OTP หรือได้รับอีเมลจากระบบ ให้นำอีเมลนั้นมากรอกในช่องค้นหาด้านบน</li>
          <li>ระบบจะดึงข้อความที่ส่งมายังอีเมลดังกล่าวและแสดงเฉพาะรหัส OTP ให้คุณคัดลอกได้อย่างรวดเร็ว</li>
          <li>หากมีปัญหาในการรับรหัส สามารถติดต่อแอดมินผ่าน LINE ร้านค้าได้ตลอดเวลาทำการครับ</li>
        </ul>
      </div>

    </div>
  );
}

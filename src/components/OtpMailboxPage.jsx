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
  ArrowLeft, 
  Sparkles,
  AlertCircle,
  ExternalLink,
  Trash2,
  Lock,
  Unlock,
  X
} from 'lucide-react';

/**
 * Helper to fetch mail detail directly (returns { html, text, snippet } or null)
 */
async function fetchMailDetailDirect(mailId, targetEmail, pin) {
  if (!mailId) return null;
  const clean = (targetEmail || '').trim().toLowerCase();
  const [accountName, domainPart] = clean.split('@');
  if (!accountName || !domainPart) return null;
  const domainId = domainPart.replace(/\./g, '');
  const cleanPin = pin ? String(pin).trim() : '';

  // Omit Content-Type on GET to avoid strict CORS preflight issues
  const headers = {
    'Accept': 'application/json, text/plain, */*'
  };
  if (cleanPin) {
    headers['X-Mailbox-Pin'] = cleanPin;
  }

  // 1. Try public mailbox detail endpoints in order
  const detailUrls = [
    `https://api.maily.space/mail/public/mails/${encodeURIComponent(mailId)}?accountName=${encodeURIComponent(accountName)}&domainId=${encodeURIComponent(domainId)}&size=1`,
    `https://api.maily.space/mail/public/mails/detail?id=${encodeURIComponent(mailId)}&accountName=${encodeURIComponent(accountName)}&domainId=${encodeURIComponent(domainId)}`,
    `https://api.maily.space/mail/public/mails/${encodeURIComponent(mailId)}?accountName=${encodeURIComponent(accountName)}&domainId=${encodeURIComponent(domainId)}`
  ];

  for (const url of detailUrls) {
    try {
      const res = await fetch(url, { headers });
      if (!res.ok) continue;
      const json = await res.json().catch(() => null);
      if (!json) continue;

      const full = Array.isArray(json.data)
        ? json.data[0]
        : (Array.isArray(json.mails)
            ? json.mails[0]
            : (json.data?.mail || json.data || json.mail || json));

      if (full) {
        const html = full.html || full.bodyHtml || full.contentHtml || full.body_html || '';
        const text = full.text || full.body || full.bodyText || full.contentText || full.body_text || '';
        const snippet = full.snippet || '';

        if (html || text) {
          return { html, text, snippet };
        }
      }
    } catch (err) {
      console.warn('Public detail fetch error on', url, err);
    }
  }

  // 2. Fallback: Serverless Proxy /api/get-otp
  try {
    const proxyHeaders = {
      'Content-Type': 'application/json'
    };
    if (cleanPin) {
      proxyHeaders['X-Mailbox-Pin'] = cleanPin;
    }
    const proxyRes = await fetch('/api/get-otp', {
      method: 'POST',
      headers: proxyHeaders,
      body: JSON.stringify({ email: clean, mailId: mailId, pin: cleanPin, size: 1 })
    });
    const proxyJson = await proxyRes.json().catch(() => null);
    if (proxyJson?.mail) {
      const m = proxyJson.mail;
      const html = m.html || m.bodyHtml || '';
      const text = m.text || m.body || '';
      if (html || text) {
        return { html, text, snippet: m.snippet || '' };
      }
    }
  } catch (proxyErr) {
    console.warn('Proxy detail fetch error:', proxyErr);
  }

  // 3. Fallback: Developer REST API (Tier 2)
  try {
    const tier2Headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/plain, */*'
    };
    if (cleanPin) {
      tier2Headers['X-Mailbox-Pin'] = cleanPin;
    }

    const tier2Body = {
      apiKey: 'sk_v1_phbofy2tb4gvtmsq4g7nw1ywmmwv6c9p',
      email: clean,
      mailId: mailId,
      size: 1,
      page: 1
    };
    if (cleanPin) tier2Body.pin = cleanPin;

    const directRes = await fetch(`https://api.maily.space/v1/mails/${mailId}`, {
      method: 'POST',
      headers: tier2Headers,
      body: JSON.stringify(tier2Body)
    });
    const directJson = await directRes.json().catch(() => null);
    if (directJson) {
      const full = Array.isArray(directJson.data)
        ? directJson.data[0]
        : (directJson.data?.mail || directJson.data || directJson.mail || directJson);
      if (full) {
        const html = full.html || full.bodyHtml || full.contentHtml || '';
        const text = full.text || full.body || full.bodyText || '';
        if (html || text) {
          return { html, text, snippet: full.snippet || '' };
        }
      }
    }
  } catch (tier2Err) {
    console.warn('Tier 2 detail fetch error:', tier2Err);
  }

  return null;
}

/**
 * Validation helper: ensures a candidate code is a real OTP and not a hex color (e.g. #000000) or year
 */
function isValidOtp(code) {
  if (!code) return false;
  const cleanCode = String(code).replace(/\s+/g, '');
  if (cleanCode.length < 4 || cleanCode.length > 8) return false;
  // Reject all zeroes (which comes from #000000 black hex color in HTML/markdown)
  if (/^0+$/.test(cleanCode)) return false;
  // Reject years
  if (cleanCode.length === 4 && (cleanCode.startsWith('19') || cleanCode.startsWith('20'))) return false;
  return true;
}

/**
 * Intelligent OTP Extractor from mail subject, body text, and HTML
 */
function extractOtpFromMail(mail) {
  if (!mail) return null;
  if (mail.otpCode && isValidOtp(mail.otpCode)) return String(mail.otpCode).trim();

  const subject = (mail.subject || '').trim();
  const text = (mail.text || mail.searchText || mail.snippet || mail.body || '').trim();
  const html = (mail.html || mail.bodyHtml || mail.contentHtml || '').trim();

  // Helper to extract clean plain text from HTML
  const htmlToText = (rawHtml) => {
    if (!rawHtml) return '';
    return rawHtml
      .replace(/<!--[\s\S]*?-->/g, ' ') // Strip HTML comments
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<br\s*[\/]?>/gi, '\n')
      .replace(/<\/(?:p|div|tr|h[1-6]|table|section|article)>/gi, '\n')
      .replace(/<\/td>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&#39;/gi, "'")
      .replace(/&quot;/gi, '"')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/[\u00a0\u200b\u200c\u200d]/g, ' ');
  };

  const parsedHtmlText = htmlToText(html);

  // Clean URLs & bracketed links so long tokens with digits don't block regex matching
  // ALSO strip hex color codes (e.g. #000000, #ffffff, #111111) and CSS color declarations
  const cleanSubject = subject
    .replace(/https?:\/\/[^\s\]>'"]+/gi, ' ')
    .replace(/#[0-9a-fA-F]{3,8}\b/gi, ' ');

  const cleanText = text
    .replace(/\[?https?:\/\/[^\s\]>'"]+\]?/gi, ' ')
    .replace(/#[0-9a-fA-F]{3,8}\b/gi, ' ')
    .replace(/\[#[0-9a-fA-F]{3,8}\]/gi, ' ')
    .replace(/\b(?:color|background|bgcolor|fill|stroke)\s*[:=]\s*["']?#?[0-9a-fA-F]{3,8}["']?/gi, ' ');

  const cleanHtmlText = parsedHtmlText
    .replace(/https?:\/\/[^\s\]>'"]+/gi, ' ')
    .replace(/#[0-9a-fA-F]{3,8}\b/gi, ' ')
    .replace(/\[#[0-9a-fA-F]{3,8}\]/gi, ' ')
    .replace(/\b(?:color|background|bgcolor|fill|stroke)\s*[:=]\s*["']?#?[0-9a-fA-F]{3,8}["']?/gi, ' ');

  const fullContent = `${cleanSubject}\n${cleanText}\n${cleanHtmlText}`
    .replace(/#[0-9a-fA-F]{3,8}\b/gi, ' ');

  // 1. Disney+ / MyDisney explicit pattern (contiguous or space-separated 6 digits)
  const isDisney = /disney/i.test(mail.from || '') || /disney/i.test(subject) || /mydisney/i.test(fullContent);
  if (isDisney) {
    const disneyPatterns = [
      // Pattern A: Passcode near/after "one-time passcode" even across duration like "expire in 15 minutes"
      /(?:one-time passcode|passcode|code|รหัสผ่านแบบใช้ครั้งเดียว|รหัสยืนยัน)[\s\S]{0,350}?(?:expire[s]? in \d+\s*(?:minutes?|mins?|นาที))?[\s\S]{0,120}?(?<![\d#])([0-9](?:[\s\u00a0]*[0-9]){5})(?!\d)/i,
      /(?:enter this code|verify your account|passcode is|passcode:?|code:?|one-time passcode|รหัสผ่านแบบใช้ครั้งเดียว(?:ของคุณ)?(?:สำหรับ)?(?:คือ)?|รหัสผ่าน|รหัสยืนยัน)[^\d]{0,150}(\b[0-9](?:[\s\u00a0]*[0-9]){5}\b)/i,
      /(?:passcode|code|รหัส)[^a-zA-Z0-9#]{0,40}(\b[0-9](?:[\s\u00a0]*[0-9]){5}\b)/i
    ];
    for (const pat of disneyPatterns) {
      const dMatch = fullContent.match(pat);
      if (dMatch && dMatch[1]) {
        const code = dMatch[1].replace(/\s+/g, '');
        if (code.length === 6 && isValidOtp(code)) return code;
      }
    }
  }

  // 2. Keyword followed by 4-8 digits (contiguous or space-separated)
  const keywordRegex = /(?:otp|verification code|security code|passcode|one-time password|login code|pin|รหัสยืนยัน|รหัสชั่วคราว|รหัสความปลอดภัย|รหัส OTP|รหัสของคุณคือ|your code is|code is)[\s:：\-–—isareคือได้แก่]*(\b[0-9](?:[\s\u00a0]*[0-9]){3,7}\b)/i;
  const kwMatch = fullContent.match(keywordRegex);
  if (kwMatch && kwMatch[1]) {
    const code = kwMatch[1].replace(/\s+/g, '');
    if (isValidOtp(code)) return code;
  }

  // 3. Reverse keyword (number followed by keyword)
  const revRegex = /(\b[0-9](?:[\s\u00a0]*[0-9]){3,7}\b)[\s:：\-–—isareคือได้แก่]*(?:otp|code|verification|passcode|รหัส|ยืนยัน)/i;
  const revMatch = fullContent.match(revRegex);
  if (revMatch && revMatch[1]) {
    const code = revMatch[1].replace(/\s+/g, '');
    if (isValidOtp(code)) return code;
  }

  // 4. Standalone 4-8 digits in Subject (e.g. "Your Netflix code is 123456")
  const subjectMatch = cleanSubject.match(/\b([0-9]{4,8})\b/);
  if (subjectMatch && subjectMatch[1]) {
    const code = subjectMatch[1];
    if (isValidOtp(code)) return code;
  }

  // 5. HTML prominent tag extraction
  if (html) {
    const cleanHtmlForTags = html
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ');

    const tagRegex = /<(?:strong|b|h1|h2|h3|h4|span|div|td|p)[^>]*?>\s*([0-9](?:[\s\u00a0]*[0-9]){3,7})\s*<\/(?:strong|b|h1|h2|h3|h4|span|div|td|p)>/gi;
    let tagMatch;
    while ((tagMatch = tagRegex.exec(cleanHtmlForTags)) !== null) {
      if (tagMatch[1]) {
        const code = tagMatch[1].replace(/\s+/g, '');
        if (isValidOtp(code)) return code;
      }
    }
  }

  // 6. 6 space-separated digits (e.g. "4 2 9 8 1 0")
  const spacedSixDigit = fullContent.match(/(?<![\d#])([0-9]\s+[0-9]\s+[0-9]\s+[0-9]\s+[0-9]\s+[0-9])(?!\d)/);
  if (spacedSixDigit && spacedSixDigit[1]) {
    const code = spacedSixDigit[1].replace(/\s+/g, '');
    if (isValidOtp(code)) return code;
  }

  // 7. 6 contiguous digits (not part of hex hash # or word or larger number)
  const sixDigitMatches = fullContent.match(/(?<![a-zA-Z0-9#])([0-9]{6})(?![a-zA-Z0-9])/g);
  if (sixDigitMatches) {
    for (const num of sixDigitMatches) {
      if (isValidOtp(num)) return num;
    }
  }

  // 8. Any 4-8 digit standalone number
  const anyDigitMatches = fullContent.match(/(?<![a-zA-Z0-9#])([0-9]{4,8})(?![a-zA-Z0-9])/g);
  if (anyDigitMatches) {
    for (const num of anyDigitMatches) {
      if (isValidOtp(num)) return num;
    }
  }

  return null;
}

/**
 * Clean markdown and URLs from email text for readable display
 */
function cleanEmailText(text) {
  if (!text) return '';
  return text
    // Remove standalone or truncated bracketed image/link markdown like [https://... or [https://...]
    .replace(/\[https?:\/\/[^\]\r\n]*(?:\]|$)/gi, '')
    // Normalize bracketed redundant emails e.g. [user@domain.com]
    .replace(/\s*\[[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\]/g, '')
    // Remove hex color bracket markdown like [#000000] and raw hex colors
    .replace(/\[#[0-9a-fA-F]{3,8}\]/gi, '')
    .replace(/#[0-9a-fA-F]{3,8}\b/gi, '')
    // Remove unformatted raw URLs
    .replace(/https?:\/\/[^\s<>'"]+/gi, '')
    // Clean broken URL prefixes
    .replace(/\bhttps?$/gi, '')
    .replace(/\bht$/gi, '')
    // Normalize excessive newlines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export default function OtpMailboxPage({ initialEmail = '', onSwitchTab, onShowToast }) {
  const [emailInput, setEmailInput] = useState(initialEmail || '');
  const [activeEmail, setActiveEmail] = useState(initialEmail || '');
  const [mails, setMails] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [warningMessage, setWarningMessage] = useState('');
  const [copiedOtpId, setCopiedOtpId] = useState(null);
  const [expandedMailId, setExpandedMailId] = useState(null);
  const [loadingDetailId, setLoadingDetailId] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [lastUpdated, setLastUpdated] = useState(null);

  // PIN Protection State
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [activePin, setActivePin] = useState('');
  const pinRef = useRef('');
  const [pinErrorMessage, setPinErrorMessage] = useState('');
  const [isSubmittingPin, setIsSubmittingPin] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [isMailboxLocked, setIsMailboxLocked] = useState(false);
  const pinInputRef = useRef(null);

  const [recentEmails, setRecentEmails] = useState(() => {
    try {
      const saved = localStorage.getItem('BA_STORE_RECENT_OTP_EMAILS');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const timerRef = useRef(null);

  // Auto-focus PIN input when modal opens
  useEffect(() => {
    if (isPinModalOpen) {
      const timer = setTimeout(() => {
        pinInputRef.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isPinModalOpen]);

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

  // Fetch Mails: Dual Strategy (Direct Client Browser -> Serverless Proxy Fallback)
  const fetchMails = async (targetEmail, isSilent = false, pin = undefined) => {
    const clean = (targetEmail || emailInput).trim().toLowerCase();

    // Resolve PIN with fallback chain: parameter -> pinRef -> activePin -> sessionStorage
    let savedPin = '';
    try {
      savedPin = sessionStorage.getItem('BA_OTP_PIN_' + clean) || '';
    } catch (e) {}

    const pinToUse = pin !== undefined ? pin : (pinRef.current || activePin || savedPin || '');

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

    // Tier 1: Direct Browser Call to Maily Space Public Mailbox API
    // Exact endpoint used by maily.space web application.
    // Properly enforces PIN locks (returns HTTP 403 'กรุณาใส่ PIN') and bypasses datacenter IP blocks.
    try {
      const [accountName, domainPart] = clean.split('@');
      if (accountName && domainPart) {
        const domainId = domainPart.replace(/\./g, '');
        const pubUrl = `https://api.maily.space/mail/public/mails?accountName=${encodeURIComponent(accountName)}&domainId=${encodeURIComponent(domainId)}&size=40`;
        const pubHeaders = {};
        if (pinToUse) {
          pubHeaders['X-Mailbox-Pin'] = String(pinToUse).trim();
        }

        const pubRes = await fetch(pubUrl, { headers: pubHeaders });
        const pubData = await pubRes.json().catch(() => null);

        // Detect PIN Lock Challenge from Maily Space
        if (
          pubRes.status === 403 ||
          pubData?.statusCode === 403 ||
          pubData?.message === 'กรุณาใส่ PIN' ||
          pubData?.message === 'PIN ไม่ถูกต้อง'
        ) {
          pinRef.current = '';
          setActivePin('');
          try {
            sessionStorage.removeItem('BA_OTP_PIN_' + clean);
          } catch (e) {}
          setIsLoading(false);
          setIsSubmittingPin(false);
          setActiveEmail(clean);
          setPendingEmail(clean);
          setIsMailboxLocked(true);
          setIsPinModalOpen(true);
          if (pubData?.message === 'PIN ไม่ถูกต้อง' || (pinToUse && pubRes.status === 403)) {
            setPinErrorMessage('รหัส PIN ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
          } else {
            setPinErrorMessage('');
            setPinInput('');
            setWarningMessage('กล่องข้อความนี้ถูกล็อคด้วย PIN กรุณาใส่รหัสเพื่อดูข้อความ');
          }
          return; // STOP! Never bypass PIN lock
        }

        if (pubRes.ok && pubData) {
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
          } else if (pubRes.status === 200) {
            fetchedMails = [];
          }
        }
      }
    } catch (pubErr) {
      console.warn('Tier 1 public mailbox fetch error:', pubErr);
    }

    // Tier 2: Developer REST API (Fallback only if Tier 1 was not a 403 PIN challenge)
    if (!fetchedMails || fetchedMails.length === 0) {
      try {
        const tier2Headers = {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/plain, */*'
        };
        if (pinToUse) {
          tier2Headers['X-Mailbox-Pin'] = String(pinToUse).trim();
        }

        const tier2Body = {
          apiKey: 'sk_v1_phbofy2tb4gvtmsq4g7nw1ywmmwv6c9p',
          email: clean,
          size: 40,
          page: 1
        };
        if (pinToUse) {
          tier2Body.pin = String(pinToUse).trim();
        }

        const directRes = await fetch('https://api.maily.space/v1/mails', {
          method: 'POST',
          headers: tier2Headers,
          body: JSON.stringify(tier2Body)
        });

        const directData = await directRes.json().catch(() => null);

        if (
          directRes.status === 403 ||
          directData?.statusCode === 403 ||
          directData?.message === 'กรุณาใส่ PIN' ||
          directData?.message === 'PIN ไม่ถูกต้อง'
        ) {
          pinRef.current = '';
          setActivePin('');
          try {
            sessionStorage.removeItem('BA_OTP_PIN_' + clean);
          } catch (e) {}
          setIsLoading(false);
          setIsSubmittingPin(false);
          setPendingEmail(clean);
          setIsMailboxLocked(true);
          setIsPinModalOpen(true);
          if (directData?.message === 'PIN ไม่ถูกต้อง' || (pinToUse && directRes.status === 403)) {
            setPinErrorMessage('รหัส PIN ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
          } else {
            setPinErrorMessage('');
            setPinInput('');
            setWarningMessage('กล่องข้อความนี้ถูกล็อคด้วย PIN กรุณาใส่รหัสเพื่อดูข้อความ');
          }
          return;
        }

        if (directRes.ok && directData) {
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
        console.warn('Tier 2 direct fetch error:', directErr);
      }
    }

    // Tier 3: Serverless Proxy /api/get-otp (fallback)
    if (!fetchedMails || fetchedMails.length === 0) {
      try {
        const proxyHeaders = {
          'Content-Type': 'application/json'
        };
        if (pinToUse) {
          proxyHeaders['X-Mailbox-Pin'] = String(pinToUse).trim();
        }

        const res = await fetch('/api/get-otp', {
          method: 'POST',
          headers: proxyHeaders,
          body: JSON.stringify({
            email: clean,
            pin: String(pinToUse).trim(),
            size: 40,
            page: 1
          })
        });

        const proxyData = await res.json().catch(() => null);

        // Detect PIN challenge from proxy
        if (res.status === 403 || proxyData?.requirePin) {
          pinRef.current = '';
          setActivePin('');
          try {
            sessionStorage.removeItem('BA_OTP_PIN_' + clean);
          } catch (e) {}
          setIsLoading(false);
          setIsSubmittingPin(false);
          setPendingEmail(clean);
          setIsMailboxLocked(true);
          setIsPinModalOpen(true);
          if (proxyData?.isPinInvalid) {
            setPinErrorMessage('รหัส PIN ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
          } else {
            setPinErrorMessage('');
            setPinInput('');
            setWarningMessage('กล่องข้อความนี้ถูกล็อคด้วย PIN กรุณาใส่รหัสเพื่อดูข้อความ');
          }
          return;
        }

        if (res.ok && proxyData?.success && Array.isArray(proxyData.mails) && proxyData.mails.length > 0) {
          fetchedMails = proxyData.mails;
        }
      } catch (proxyErr) {
        console.warn('Tier 3 proxy fallback error:', proxyErr);
      }
    }

    // If fetch succeeded (either with valid PIN or unpinned email)
    if (pinToUse) {
      pinRef.current = String(pinToUse).trim();
      setActivePin(String(pinToUse).trim());
      try {
        sessionStorage.setItem('BA_OTP_PIN_' + clean, String(pinToUse).trim());
      } catch (e) {}
      setIsMailboxLocked(false);
      setIsPinModalOpen(false);
      setPinErrorMessage('');
      setPinInput('');
    }
    setIsSubmittingPin(false);

    if (fetchedMails && fetchedMails.length > 0) {
      // Pre-fetch details for the top 3 emails immediately in parallel so OTP and full body are ready
      const topCount = Math.min(fetchedMails.length, 3);
      await Promise.all(
        fetchedMails.slice(0, topCount).map(async (m, idx) => {
          if (m?.id && (!m.html || !m.text || m.text.length <= 150 || !extractOtpFromMail(m))) {
            try {
              const detail = await fetchMailDetailDirect(m.id, clean, pinToUse);
              if (detail) {
                fetchedMails[idx] = {
                  ...fetchedMails[idx],
                  html: detail.html || fetchedMails[idx].html,
                  text: detail.text || fetchedMails[idx].text,
                  snippet: detail.snippet || fetchedMails[idx].snippet
                };
                const newOtp = extractOtpFromMail(fetchedMails[idx]);
                if (newOtp && isValidOtp(newOtp)) {
                  fetchedMails[idx].otpCode = newOtp;
                }
              }
            } catch (detailErr) {
              console.warn('Initial detail fetch error for mail', idx, detailErr);
            }
          }
        })
      );

      setMails([...fetchedMails]);
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
    const clean = emailInput.trim().toLowerCase();
    let savedPin = '';
    try {
      savedPin = sessionStorage.getItem('BA_OTP_PIN_' + clean) || '';
    } catch (err) {}
    pinRef.current = savedPin;
    setActivePin(savedPin);
    setIsMailboxLocked(false);
    fetchMails(clean, false, savedPin);
  };

  // Handle PIN Unlock Submit
  const handlePinSubmit = (e) => {
    if (e) e.preventDefault();
    const sanitized = pinInput.replace(/\D/g, '').slice(0, 6);
    if (!sanitized || sanitized.length !== 6) {
      setPinErrorMessage('กรุณากรอกรหัส PIN ให้ครบ 6 หลัก');
      return;
    }
    setPinErrorMessage('');
    setIsSubmittingPin(true);
    pinRef.current = sanitized;
    const target = (pendingEmail || activeEmail || emailInput).trim().toLowerCase();
    try {
      sessionStorage.setItem('BA_OTP_PIN_' + target, sanitized);
    } catch (err) {}
    fetchMails(target, false, sanitized);
  };

  // If initialEmail changes, auto-search
  useEffect(() => {
    if (initialEmail && initialEmail.trim()) {
      const clean = initialEmail.trim().toLowerCase();
      setEmailInput(clean);
      let savedPin = '';
      try {
        savedPin = sessionStorage.getItem('BA_OTP_PIN_' + clean) || '';
      } catch (err) {}
      pinRef.current = savedPin;
      setActivePin(savedPin);
      setIsMailboxLocked(false);
      fetchMails(clean, false, savedPin);
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
          fetchMails(activeEmail, true, pinRef.current || activePin);
          return 5;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [autoRefresh, activeEmail, activePin]);

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

  // Fetch full email detail (HTML and full text body)
  const fetchMailDetail = async (mailId, targetEmail = activeEmail, pin = undefined) => {
    try {
      const clean = (targetEmail || '').trim().toLowerCase();
      // If the email already has full body loaded (e.g. from Supabase), skip remote fetch
      const existingMail = mails.find((m) => m.id === mailId);
      if (existingMail && existingMail.html && existingMail.html.length > 50) return;

      let savedPin = '';
      try {
        savedPin = sessionStorage.getItem('BA_OTP_PIN_' + clean) || '';
      } catch (e) {}
      const pinToUse = pin !== undefined ? pin : (pinRef.current || activePin || savedPin || '');

      setLoadingDetailId(mailId);
      const detail = await fetchMailDetailDirect(mailId, clean, pinToUse);
      if (detail) {
        setMails((prevMails) =>
          prevMails.map((m) => {
            if (m.id === mailId) {
              const updated = {
                ...m,
                html: detail.html || m.html,
                text: detail.text || m.text,
                snippet: detail.snippet || m.snippet
              };
              const newOtp = extractOtpFromMail(updated);
              if (newOtp && isValidOtp(newOtp)) {
                updated.otpCode = newOtp;
              }
              return updated;
            }
            return m;
          })
        );
      }
    } catch (e) {
      console.warn('Failed to fetch mail detail:', e);
    } finally {
      setLoadingDetailId(null);
    }
  };

  // Toggle full email preview with auto-fetch
  const toggleExpand = async (id) => {
    if (expandedMailId === id) {
      setExpandedMailId(null);
    } else {
      setExpandedMailId(id);
      const mail = mails.find((m) => m.id === id);
      if (mail && (!mail.html || !mail.text || mail.text.length <= 150)) {
        await fetchMailDetail(id);
      }
    }
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
                  const clean = item.trim().toLowerCase();
                  setEmailInput(clean);
                  let savedPin = '';
                  try {
                    savedPin = sessionStorage.getItem('BA_OTP_PIN_' + clean) || '';
                  } catch (err) {}
                  pinRef.current = savedPin;
                  setActivePin(savedPin);
                  setIsMailboxLocked(false);
                  fetchMails(clean, false, savedPin);
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
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-gray-800 text-sm sm:text-base">
                    กล่องจดหมายของ:
                  </span>
                  <span className="font-mono text-rose-600 font-bold text-xs sm:text-sm bg-rose-50 px-2.5 py-1 rounded-xl border border-rose-200">
                    {activeEmail}
                  </span>
                  {activePin ? (
                    <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-50 text-emerald-700 font-bold px-2.5 py-0.5 rounded-full border border-emerald-200 shadow-2xs">
                      <Unlock className="w-3 h-3 text-emerald-600" />
                      <span>ปลดล็อคด้วย PIN แล้ว</span>
                    </span>
                  ) : isMailboxLocked ? (
                    <button
                      type="button"
                      onClick={() => {
                        setPendingEmail(activeEmail);
                        setIsPinModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1 text-[11px] bg-rose-50 text-rose-600 hover:bg-rose-100 font-bold px-2.5 py-0.5 rounded-full border border-rose-200 shadow-2xs cursor-pointer transition-all"
                    >
                      <Lock className="w-3 h-3 text-rose-500" />
                      <span>ล็อคด้วย PIN (คลิกเพื่อปลดล็อค)</span>
                    </button>
                  ) : null}
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
                onClick={() => fetchMails(activeEmail, false, activePin)}
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
            isMailboxLocked ? (
              <div className="bg-white rounded-3xl p-8 sm:p-12 text-center border border-pink-100 shadow-2xs space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-rose-50 text-rose-500 border border-rose-200 flex items-center justify-center text-3xl mx-auto shadow-xs">
                  <Lock className="w-8 h-8 text-rose-500" />
                </div>
                <div className="space-y-1.5 max-w-md mx-auto">
                  <h3 className="text-base sm:text-lg font-bold text-gray-800 font-['Prompt']">
                    กล่องจดหมายนี้ถูกล็อคด้วยรหัส PIN
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-500">
                    อีเมล <span className="font-mono font-bold text-rose-600">{activeEmail || pendingEmail}</span> มีการตั้งรหัสผ่านป้องกันไว้ กรุณากรอกรหัส PIN (ตัวเลข 6 หลัก) เพื่อเข้าถึงข้อความและดูรหัส OTP
                  </p>
                </div>

                <div className="pt-2 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPendingEmail(activeEmail);
                      setPinErrorMessage('');
                      setIsPinModalOpen(true);
                    }}
                    className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-rose-500 via-pink-600 to-purple-600 hover:opacity-95 active:scale-98 text-white text-xs sm:text-sm font-bold shadow-md shadow-pink-500/20 transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <Unlock className="w-4 h-4" />
                    <span>กรอกรหัส PIN เพื่อปลดล็อค</span>
                  </button>
                </div>
              </div>
            ) : (
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
                    onClick={() => fetchMails(activeEmail, false, activePin)}
                    disabled={isLoading}
                    className="px-5 py-2.5 rounded-2xl bg-rose-500 text-white text-xs font-bold shadow-xs hover:bg-rose-600 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                    <span>ตรวจหาข้อความใหม่อีกครั้ง</span>
                  </button>
                </div>
              </div>
            )
          ) : (
            <div className="space-y-4">
              {mails.map((mail, index) => {
                const candidateOtp = (mail.otpCode && isValidOtp(mail.otpCode)) ? mail.otpCode : extractOtpFromMail(mail);
                const otpCode = isValidOtp(candidateOtp) ? candidateOtp : null;
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
                          className="text-xs font-semibold text-gray-500 hover:text-indigo-600 flex items-center gap-1.5 transition-colors cursor-pointer"
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
                          onClick={() => handleCopyOtp(mail.id, mail.text || mail.subject)}
                          className="text-[11px] text-gray-400 hover:text-gray-600 flex items-center gap-1"
                          title="คัดลอกข้อความในอีเมลทั้งหมด"
                        >
                          <Copy className="w-3 h-3" />
                          <span>คัดลอกข้อความทั้งหมด</span>
                        </button>
                      </div>

                      {/* Expanded View: HTML or Text preview */}
                      {isExpanded && (
                        <div className="mt-3 p-4 rounded-2xl bg-gray-50 border border-gray-200 text-xs text-gray-700 space-y-3 animate-in fade-in">
                          {loadingDetailId === mail.id && !mail.html && (!mail.text || mail.text.length <= 150) ? (
                            <div className="py-6 flex flex-col items-center justify-center gap-2 text-gray-400">
                              <RefreshCw className="w-5 h-5 animate-spin text-rose-500" />
                              <span className="text-xs font-medium">กำลังโหลดเนื้อหาอีเมลฉบับเต็ม...</span>
                            </div>
                          ) : mail.html ? (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-[11px] text-gray-400 pb-1 border-b border-gray-200">
                                <span>เนื้อหาอีเมลฉบับเต็ม (HTML Preview)</span>
                                <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded font-medium">ฉบับเต็ม</span>
                              </div>
                              <div className="w-full overflow-x-auto bg-white p-4 rounded-xl border border-gray-200 max-h-[500px] overflow-y-auto">
                                <div
                                  dangerouslySetInnerHTML={{ __html: mail.html }}
                                  className="prose prose-xs max-w-none text-gray-800"
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <pre className="whitespace-pre-wrap font-sans text-xs bg-white p-4 rounded-xl border border-gray-200 max-h-[500px] overflow-y-auto leading-relaxed text-gray-800">
                                {cleanEmailText(mail.text || mail.snippet) || '(ไม่มีเนื้อหาข้อความ)'}
                              </pre>
                            </div>
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
          <li>บริการนี้สร้างขึ้นเพื่อให้คุณรับรหัสยืนยัน OTP ได้โดยตรงบนเว็บ BA STORE โดยไม่ต้องเปิดไปเว็บอื่น</li>
          <li>เมื่อคุณสั่งซื้อสินค้าประเภท OTP หรือได้รับอีเมลจากระบบ ให้นำอีเมลนั้นมากรอกในช่องค้นหาด้านบน</li>
          <li>ระบบจะดึงข้อความที่ส่งมายังอีเมลดังกล่าวและแสดงเฉพาะรหัส OTP ให้คุณคัดลอกได้อย่างรวดเร็ว</li>
          <li>หากมีปัญหาในการรับรหัส สามารถติดต่อแอดมินผ่าน LINE ร้านค้าได้ตลอดเวลาทำการครับ</li>
        </ul>
      </div>

      {/* PIN Unlock Modal */}
      {isPinModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 pb-20 sm:pb-28 animate-in fade-in duration-200"
          onClick={() => {
            setIsPinModalOpen(false);
            setIsSubmittingPin(false);
          }}
        >
          <div 
            className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full border border-pink-100 shadow-2xl space-y-5 relative overflow-hidden -translate-y-8 sm:-translate-y-12"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Decorative gradient corner */}
            <div className="absolute -top-12 -right-12 w-28 h-28 bg-pink-200/50 rounded-full blur-xl pointer-events-none" />
            <div className="absolute -bottom-12 -left-12 w-28 h-28 bg-rose-200/40 rounded-full blur-xl pointer-events-none" />

            {/* Close button */}
            <button
              type="button"
              onClick={() => {
                setIsPinModalOpen(false);
                setIsSubmittingPin(false);
              }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
              title="ปิด"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="text-center space-y-2 pt-1">
              <div className="w-13 h-13 rounded-2xl bg-gradient-to-tr from-pink-500 to-rose-500 text-white flex items-center justify-center mx-auto shadow-md shadow-pink-500/20">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 font-['Prompt']">
                ใส่รหัส PIN กล่องข้อความ
              </h3>
              <p className="text-xs text-gray-500 max-w-xs mx-auto">
                กล่องจดหมายนี้มีการตั้งรหัส PIN ป้องกันไว้ กรุณากรอกรหัส PIN เพื่อเปิดดูข้อความ
              </p>
              <div className="pt-1">
                <span className="inline-block font-mono text-xs font-semibold text-rose-600 bg-pink-50 px-3 py-1 rounded-full border border-pink-100">
                  {pendingEmail || activeEmail || emailInput}
                </span>
              </div>
            </div>

            {/* PIN Input Form */}
            <form onSubmit={handlePinSubmit} className="space-y-4 pt-1">
              <div className="space-y-2">
                <label className="block text-xs sm:text-sm font-semibold text-gray-700 text-center">
                  รหัส PIN (ตัวเลข 6 หลัก)
                </label>
                <div className="relative max-w-[220px] mx-auto">
                  <input
                    ref={pinInputRef}
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    autoComplete="one-time-code"
                    value={pinInput}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setPinInput(val);
                      if (pinErrorMessage) setPinErrorMessage('');
                    }}
                    placeholder="••••••"
                    className="w-full text-center tracking-[0.4em] font-mono text-2xl font-bold py-2.5 px-4 rounded-2xl border-2 border-pink-200 focus:border-pink-500 focus:ring-4 focus:ring-pink-100 outline-none bg-pink-50/20 text-gray-800 transition-all placeholder:tracking-normal placeholder:font-normal placeholder:text-gray-300"
                  />
                </div>
              </div>

              {/* Error message inside modal */}
              {pinErrorMessage && (
                <div className="bg-rose-50 border border-rose-200 text-rose-600 text-xs rounded-xl p-2.5 flex items-center justify-center gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{pinErrorMessage}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsPinModalOpen(false);
                    setIsSubmittingPin(false);
                  }}
                  className="w-1/3 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600 text-xs sm:text-sm font-semibold transition-all cursor-pointer"
                >
                  ยกเลิก
                </button>

                <button
                  type="submit"
                  disabled={isSubmittingPin || !pinInput || pinInput.length !== 6}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 via-pink-600 to-purple-600 hover:opacity-95 active:scale-98 text-white text-xs sm:text-sm font-bold shadow-md shadow-pink-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmittingPin ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>กำลังตรวจสอบ...</span>
                    </>
                  ) : (
                    <>
                      <Unlock className="w-4 h-4" />
                      <span>ยืนยัน / ปลดล็อค</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

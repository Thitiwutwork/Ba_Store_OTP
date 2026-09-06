import React, { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Users,
  Inbox,
  Globe,
  Settings,
  LogOut,
  Search,
  Eye,
  Trash2,
  Plus,
  RefreshCw,
  KeyRound,
  Lock,
  Unlock,
  Check,
  Copy,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  X,
  Mail
} from "lucide-react";
import {
  fetchAdminStats,
  fetchAllEmails,
  deleteEmail,
  fetchAllMailboxes,
  createMailbox,
  updateMailboxPin,
  deleteMailbox,
  fetchDomains,
  adminLogout,
  updateAdminPassword
} from "../services/adminService";

export default function AdminDashboard({ onExitToClient }) {
  const [activeTab, setActiveTab] = useState("inbox"); // "overview" | "inbox" | "mailboxes" | "domains" | "settings"
  const [stats, setStats] = useState({
    totalEmails: 0,
    totalMailboxes: 0,
    totalDomains: 1,
    totalOtps: 0,
    emailsToday: 0,
    recentEmails: []
  });

  // Data states
  const [emails, setEmails] = useState([]);
  const [mailboxes, setMailboxes] = useState([]);
  const [domains, setDomains] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Pagination for Inbox
  const [inboxPage, setInboxPage] = useState(1);
  const pageSize = 15;

  // View Mail Modal
  const [viewingMail, setViewingMail] = useState(null);
  const [copiedOtp, setCopiedOtp] = useState(false);

  // Create Mailbox Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newPrefix, setNewPrefix] = useState("");
  const [newPin, setNewPin] = useState("");
  const [newNote, setNewNote] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Edit PIN Modal
  const [editingMailbox, setEditingMailbox] = useState(null);
  const [pinEditVal, setPinEditVal] = useState("");

  // Settings Password State
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [pwdMessage, setPwdMessage] = useState("");

  // Load Data
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [sRes, eRes, mRes, dRes] = await Promise.all([
        fetchAdminStats(),
        fetchAllEmails(searchQuery),
        fetchAllMailboxes(searchQuery),
        fetchDomains()
      ]);

      if (sRes.success) setStats(sRes);
      if (eRes.success) setEmails(eRes.emails);
      if (mRes.success) setMailboxes(mRes.mailboxes);
      if (dRes.success) setDomains(dRes.domains);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [searchQuery]);

  // Handle Delete Email
  const handleDeleteEmail = async (id) => {
    if (!window.confirm("คุณต้องการลบอีเมลฉบับนี้ใช่หรือไม่?")) return;
    const res = await deleteEmail(id);
    if (res.success) {
      setEmails((prev) => prev.filter((e) => e.id !== id));
      if (viewingMail && viewingMail.id === id) setViewingMail(null);
      fetchAdminStats().then((s) => s.success && setStats(s));
    } else {
      alert("ไม่สามารถลบอีเมลได้");
    }
  };

  // Handle Delete Mailbox
  const handleDeleteMailbox = async (id, address) => {
    if (!window.confirm(`คุณต้องการลบกล่องข้อความ ${address} ใช่หรือไม่? (อีเมลที่ผูกไว้ทั้งหมดจะถูกลบด้วย)`)) return;
    const res = await deleteMailbox(id);
    if (res.success) {
      setMailboxes((prev) => prev.filter((m) => m.id !== id));
      loadData();
    } else {
      alert("ไม่สามารถลบกล่องข้อความได้");
    }
  };

  // Handle Create Mailbox
  const handleCreateMailboxSubmit = async (e) => {
    e.preventDefault();
    if (!newPrefix.trim()) return;

    let addr = newPrefix.trim().toLowerCase();
    if (!addr.includes("@")) {
      addr = `${addr}@namenoname.store`;
    }

    setIsCreating(true);
    const res = await createMailbox(addr, newPin.trim() || null, newNote.trim());
    setIsCreating(false);

    if (res.success) {
      setIsCreateModalOpen(false);
      setNewPrefix("");
      setNewPin("");
      setNewNote("");
      loadData();
    } else {
      alert("เกิดข้อผิดพลาด: " + (res.error || "สร้างบัญชีไม่สำเร็จ"));
    }
  };

  // Generate random prefix e.g. cinex-xxxxxx
  const handleGenerateRandom = () => {
    const rand = Math.random().toString(36).substring(2, 8);
    setNewPrefix(`cinex-${rand}`);
  };

  // Handle Save PIN
  const handleSavePin = async () => {
    if (!editingMailbox) return;
    const res = await updateMailboxPin(editingMailbox.id, pinEditVal);
    if (res.success) {
      setEditingMailbox(null);
      setPinEditVal("");
      loadData();
    } else {
      alert("ไม่สามารถอัปเดตรหัส PIN ได้");
    }
  };

  // Copy OTP
  const handleCopyOtp = (otp) => {
    if (!otp) return;
    navigator.clipboard.writeText(otp);
    setCopiedOtp(true);
    setTimeout(() => setCopiedOtp(false), 2000);
  };

  // Date formatter
  const formatDate = (isoStr) => {
    if (!isoStr) return "-";
    const d = new Date(isoStr);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const hours = String(d.getHours()).padStart(2, "0");
    const mins = String(d.getMinutes()).padStart(2, "0");
    return `${day}/${month} ${hours}:${mins}`;
  };

  // Filtered / Paged Emails
  const paginatedEmails = emails.slice((inboxPage - 1) * pageSize, inboxPage * pageSize);
  const totalPages = Math.ceil(emails.length / pageSize) || 1;

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex font-['Prompt'] text-slate-800">
      
      {/* ===================== SIDEBAR (Maily Space Style) ===================== */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 shadow-xs">
        <div>
          {/* Brand Logo */}
          <div className="h-18 flex items-center gap-3 px-6 border-b border-slate-100">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-500 via-pink-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-pink-500/20">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-lg text-slate-900 tracking-tight block leading-tight">
                BA STORE
              </span>
              <span className="text-[10px] text-indigo-600 font-bold tracking-wider uppercase">
                Admin Console
              </span>
            </div>
          </div>

          {/* Nav Categories */}
          <div className="p-4 space-y-6">
            
            {/* อีเมล Category */}
            <div>
              <span className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                อีเมล
              </span>
              <nav className="space-y-1">
                <button
                  onClick={() => setActiveTab("overview")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                    activeTab === "overview"
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>หน้าหลัก</span>
                </button>

                <button
                  onClick={() => setActiveTab("mailboxes")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                    activeTab === "mailboxes"
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>บัญชีเมล</span>
                  <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                    {stats.totalMailboxes}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab("inbox")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                    activeTab === "inbox"
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <Inbox className="w-4 h-4" />
                  <span>กล่องจดหมาย</span>
                  <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-bold">
                    {stats.totalEmails}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab("domains")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                    activeTab === "domains"
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <Globe className="w-4 h-4" />
                  <span>โดเมน</span>
                </button>
              </nav>
            </div>

            {/* ผู้ใช้ Category */}
            <div>
              <span className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                ผู้ใช้
              </span>
              <nav className="space-y-1">
                <button
                  onClick={() => setActiveTab("settings")}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                    activeTab === "settings"
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <Settings className="w-4 h-4" />
                  <span>ตั้งค่าผู้ใช้</span>
                </button>
              </nav>
            </div>

          </div>
        </div>

        {/* Bottom Actions */}
        <div className="p-4 border-t border-slate-100 space-y-2">
          <button
            onClick={onExitToClient}
            className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>ไปหน้าเว็บลูกค้า</span>
          </button>

          <button
            onClick={() => {
              adminLogout();
              window.location.reload();
            }}
            className="w-full py-2.5 px-3 bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>ออกจากระบบ</span>
          </button>
        </div>
      </aside>

      {/* ===================== MAIN CONTENT AREA ===================== */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        
        {/* Top bar with search & refresh */}
        <header className="h-18 bg-white border-b border-slate-200 px-8 flex items-center justify-between gap-4 sticky top-0 z-20">
          <div className="relative w-80 max-w-full">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหา (ผู้ส่ง, ผู้รับ, หัวข้อ)..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              disabled={isLoading}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium flex items-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-indigo-600" : ""}`} />
              <span>รีเฟรชข้อมูล</span>
            </button>

            {activeTab === "mailboxes" && (
              <button
                onClick={() => {
                  handleGenerateRandom();
                  setIsCreateModalOpen(true);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>สร้างเมลใหม่</span>
              </button>
            )}
          </div>
        </header>

        <div className="p-8 max-w-7xl w-full mx-auto flex-1">

          {/* ================= VIEW 1: OVERVIEW ================= */}
          {activeTab === "overview" && (
            <div className="space-y-8">
              
              {/* Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                  <span className="text-xs font-medium text-slate-400 block mb-1">อีเมลทั้งหมดในระบบ</span>
                  <span className="text-2xl font-bold text-slate-900">{stats.totalEmails}</span>
                  <span className="text-[11px] text-emerald-600 font-medium block mt-1">วันนี้เข้า {stats.emailsToday} ฉบับ</span>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                  <span className="text-xs font-medium text-slate-400 block mb-1">กล่องข้อความ (Mailboxes)</span>
                  <span className="text-2xl font-bold text-slate-900">{stats.totalMailboxes}</span>
                  <span className="text-[11px] text-indigo-600 font-medium block mt-1">พร้อมใช้งาน 100%</span>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                  <span className="text-xs font-medium text-slate-400 block mb-1">รหัส OTP ที่สกัดได้</span>
                  <span className="text-2xl font-bold text-indigo-600">{stats.totalOtps}</span>
                  <span className="text-[11px] text-slate-400 block mt-1">ตรวจจับตัวเลขอัตโนมัติ</span>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                  <span className="text-xs font-medium text-slate-400 block mb-1">โดเมนที่เชื่อมต่อ</span>
                  <span className="text-2xl font-bold text-slate-900">{domains.length || 1}</span>
                  <span className="text-[11px] text-emerald-600 font-medium block mt-1">Cloudflare Active</span>
                </div>
              </div>

              {/* Usage Wave Chart */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-base font-bold text-slate-900">จำนวนการใช้งาน</h3>
                  <span className="text-xs text-slate-400">สถิติการรับอีเมล</span>
                </div>

                {/* Smooth Curve SVG */}
                <div className="w-full h-56 relative">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 700 200" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4F46E5" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#4F46E5" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M0,180 C100,160 200,140 300,130 C400,120 450,20 520,30 C590,40 650,140 700,160 L700,200 L0,200 Z"
                      fill="url(#chartGrad)"
                    />
                    <path
                      d="M0,180 C100,160 200,140 300,130 C400,120 450,20 520,30 C590,40 650,140 700,160"
                      fill="none"
                      stroke="#4F46E5"
                      strokeWidth="3"
                    />
                  </svg>
                  <div className="flex justify-between text-[11px] text-slate-400 mt-2 border-t border-slate-100 pt-2">
                    <span>31/08</span>
                    <span>01/09</span>
                    <span>02/09</span>
                    <span>03/09</span>
                    <span>04/09</span>
                    <span>05/09</span>
                    <span>06/09</span>
                    <span>วันนี้</span>
                  </div>
                </div>
              </div>

              {/* Recent Emails Table */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-base font-bold text-slate-900">อีเมลล่าสุด</h3>
                  <button onClick={() => setActiveTab("inbox")} className="text-xs text-indigo-600 font-semibold hover:underline cursor-pointer">
                    ดูกล่องจดหมายทั้งหมด →
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-[#2E3192] text-white font-semibold">
                      <tr>
                        <th className="py-3 px-4">จาก</th>
                        <th className="py-3 px-4">ไปยัง</th>
                        <th className="py-3 px-4">หัวข้อ</th>
                        <th className="py-3 px-4">รหัส OTP</th>
                        <th className="py-3 px-4">วันที่ได้รับ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {emails.slice(0, 5).map((e) => (
                        <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-4 font-medium text-slate-900 truncate max-w-[180px]">{e.sender}</td>
                          <td className="py-3 px-4 text-indigo-700 font-mono font-medium">{e.recipient}</td>
                          <td className="py-3 px-4 truncate max-w-[240px]">{e.subject}</td>
                          <td className="py-3 px-4">
                            {e.otp_code ? (
                              <span className="bg-emerald-100 text-emerald-700 font-mono font-bold px-2 py-0.5 rounded-md">
                                {e.otp_code}
                              </span>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-400 whitespace-nowrap">{formatDate(e.received_at)}</td>
                        </tr>
                      ))}
                      {emails.length === 0 && (
                        <tr>
                          <td colSpan="5" className="py-8 text-center text-slate-400">ยังไม่มีอีเมลในระบบ</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* ================= VIEW 2: GLOBAL INBOX (Maily Space Style) ================= */}
          {activeTab === "inbox" && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              
              {/* Header Info */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">กล่องจดหมายรวม</h3>
                  <p className="text-xs text-slate-400 mt-0.5">รวมอีเมลขาเข้าทั้งหมดที่ระบบ Cloudflare ดักจับได้ ({emails.length} ฉบับ)</p>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#2E3192] text-white font-semibold">
                    <tr>
                      <th className="py-3.5 px-5">จาก</th>
                      <th className="py-3.5 px-5">ไปยัง</th>
                      <th className="py-3.5 px-5">หัวข้อ</th>
                      <th className="py-3.5 px-5">วันที่ได้รับ</th>
                      <th className="py-3.5 px-5 text-center">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedEmails.map((item) => (
                      <tr key={item.id} className="hover:bg-indigo-50/40 transition-colors">
                        
                        {/* จาก */}
                        <td className="py-4 px-5 font-medium text-slate-800 truncate max-w-[200px]">
                          {item.sender}
                        </td>

                        {/* ไปยัง */}
                        <td className="py-4 px-5">
                          <span className="font-mono text-indigo-700 font-semibold bg-indigo-50 px-2 py-1 rounded-md">
                            {item.recipient}
                          </span>
                        </td>

                        {/* หัวข้อ + OTP Badge */}
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-2">
                            {item.otp_code && (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-mono font-bold text-[11px] shrink-0">
                                OTP: {item.otp_code}
                              </span>
                            )}
                            <span className="font-medium text-slate-900 truncate max-w-[280px]">
                              {item.subject || "(ไม่มีหัวข้อ)"}
                            </span>
                          </div>
                          {item.body_text && (
                            <p className="text-[11px] text-slate-400 truncate max-w-[340px] mt-0.5">
                              {item.body_text}
                            </p>
                          )}
                        </td>

                        {/* วันที่ได้รับ */}
                        <td className="py-4 px-5 text-slate-500 whitespace-nowrap">
                          {formatDate(item.received_at)}
                        </td>

                        {/* ปุ่มจัดการ (เหมือนในรูป Maily Space: ส้มดู / แดงลบ) */}
                        <td className="py-4 px-5 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-2">
                            {/* ปุ่มดู (สีส้ม) */}
                            <button
                              onClick={() => setViewingMail(item)}
                              className="w-8 h-8 rounded-lg bg-[#F59E0B] hover:bg-[#D97706] text-white flex items-center justify-center transition-colors shadow-xs cursor-pointer"
                              title="ดูรายละเอียดอีเมล"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {/* ปุ่มลบ (สีแดง) */}
                            <button
                              onClick={() => handleDeleteEmail(item.id)}
                              className="w-8 h-8 rounded-lg bg-[#EF4444] hover:bg-[#DC2626] text-white flex items-center justify-center transition-colors shadow-xs cursor-pointer"
                              title="ลบอีเมล"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>

                      </tr>
                    ))}

                    {paginatedEmails.length === 0 && (
                      <tr>
                        <td colSpan="5" className="py-12 text-center text-slate-400">
                          {searchQuery ? "ไม่พบอีเมลที่ค้นหา" : "ยังไม่มีอีเมลส่งเข้ามาในระบบ"}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>หน้า {inboxPage} จากทั้งหมด {totalPages} หน้า</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setInboxPage((p) => Math.max(1, p - 1))}
                      disabled={inboxPage <= 1}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors cursor-pointer"
                    >
                      ก่อนหน้า
                    </button>
                    <button
                      onClick={() => setInboxPage((p) => Math.min(totalPages, p + 1))}
                      disabled={inboxPage >= totalPages}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 transition-colors cursor-pointer"
                    >
                      ถัดไป
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* ================= VIEW 3: MAILBOXES ================= */}
          {activeTab === "mailboxes" && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">จัดการบัญชีเมล (Mailboxes)</h3>
                  <p className="text-xs text-slate-400 mt-0.5">รายชื่อกล่องอีเมลที่รองรับ และตั้งค่าความปลอดภัยรหัส PIN</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#2E3192] text-white font-semibold">
                    <tr>
                      <th className="py-3.5 px-5">ที่อยู่อีเมล</th>
                      <th className="py-3.5 px-5">ระบบล็อค PIN</th>
                      <th className="py-3.5 px-5">บันทึกช่วยจำ</th>
                      <th className="py-3.5 px-5">วันที่สร้าง</th>
                      <th className="py-3.5 px-5 text-center">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {mailboxes.map((mb) => (
                      <tr key={mb.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-4 px-5 font-mono text-indigo-700 font-bold text-sm">
                          {mb.address}
                        </td>
                        <td className="py-4 px-5">
                          {mb.pin_code ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 text-amber-800 font-medium text-[11px] border border-amber-200">
                              <Lock className="w-3 h-3 text-amber-600" />
                              <span>PIN: {mb.pin_code}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-500 font-normal text-[11px]">
                              <Unlock className="w-3 h-3 text-slate-400" />
                              <span>ไม่ได้ตั้งรหัส</span>
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-5 text-slate-600">
                          {mb.note || "-"}
                        </td>
                        <td className="py-4 px-5 text-slate-400 whitespace-nowrap">
                          {formatDate(mb.created_at)}
                        </td>
                        <td className="py-4 px-5 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => {
                                setEditingMailbox(mb);
                                setPinEditVal(mb.pin_code || "");
                              }}
                              className="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <KeyRound className="w-3 h-3" />
                              <span>ตั้ง PIN</span>
                            </button>
                            <button
                              onClick={() => handleDeleteMailbox(mb.id, mb.address)}
                              className="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center transition-colors cursor-pointer"
                              title="ลบบัญชี"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {mailboxes.length === 0 && (
                      <tr>
                        <td colSpan="5" className="py-12 text-center text-slate-400">
                          ยังไม่มีกล่องข้อความ (สามารถกดปุ่ม "สร้างเมลใหม่" ด้านบนได้ทันที)
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ================= VIEW 4: DOMAINS ================= */}
          {activeTab === "domains" && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
              <h3 className="text-base font-bold text-slate-900">โดเมนที่เชื่อมต่อในระบบ</h3>
              <div className="divide-y divide-slate-100">
                {domains.map((d) => (
                  <div key={d.id} className="py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
                        <Globe className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="font-bold text-sm text-slate-900 block">{d.name}</span>
                        <span className="text-xs text-slate-400">เชื่อมต่อกับ Cloudflare Email Routing แล้ว</span>
                      </div>
                    </div>
                    <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full font-bold text-xs flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      Active
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ================= VIEW 5: SETTINGS ================= */}
          {activeTab === "settings" && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 max-w-lg">
              <h3 className="text-base font-bold text-slate-900 mb-4">ตั้งค่ารหัสผ่านแอดมิน</h3>
              {pwdMessage && (
                <div className="mb-4 p-3 bg-emerald-50 text-emerald-700 text-xs rounded-xl">
                  {pwdMessage}
                </div>
              )}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">รหัสผ่านใหม่</label>
                  <input
                    type="password"
                    value={newPwd}
                    onChange={(e) => setNewPwd(e.target.value)}
                    placeholder="กรอกรหัสผ่านใหม่ที่ต้องการ"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                  />
                </div>
                <button
                  onClick={() => {
                    if (!newPwd.trim()) return;
                    updateAdminPassword(newPwd.trim());
                    setPwdMessage("เปลี่ยนรหัสผ่านสำเร็จเรียบร้อยแล้ว!");
                    setNewPwd("");
                  }}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
                >
                  บันทึกรหัสผ่านใหม่
                </button>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* ================= VIEW EMAIL MODAL ================= */}
      {viewingMail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-base text-slate-900">รายละเอียดอีเมล</h4>
                  <span className="text-xs text-slate-400">{formatDate(viewingMail.received_at)}</span>
                </div>
              </div>
              <button
                onClick={() => setViewingMail(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              
              {/* Highlighted OTP Card */}
              {viewingMail.otp_code && (
                <div className="p-5 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl text-white shadow-lg shadow-emerald-500/20 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-medium text-emerald-100 block">รหัสยืนยัน OTP</span>
                    <span className="text-3xl font-mono font-black tracking-widest block mt-0.5">
                      {viewingMail.otp_code}
                    </span>
                  </div>
                  <button
                    onClick={() => handleCopyOtp(viewingMail.otp_code)}
                    className="px-4 py-2 rounded-xl bg-white text-emerald-800 hover:bg-emerald-50 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                  >
                    {copiedOtp ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedOtp ? "คัดลอกแล้ว!" : "คัดลอก OTP"}</span>
                  </button>
                </div>
              )}

              {/* Meta details */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50 p-3 rounded-xl">
                  <span className="text-slate-400 block mb-0.5">ส่งจาก (From):</span>
                  <span className="font-medium text-slate-900 break-all">{viewingMail.sender}</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl">
                  <span className="text-slate-400 block mb-0.5">ผู้รับ (To):</span>
                  <span className="font-mono font-bold text-indigo-700 break-all">{viewingMail.recipient}</span>
                </div>
              </div>

              {/* Subject */}
              <div className="bg-slate-50 p-3 rounded-xl text-xs">
                <span className="text-slate-400 block mb-0.5">หัวข้อ (Subject):</span>
                <span className="font-bold text-slate-900">{viewingMail.subject}</span>
              </div>

              {/* Body Content */}
              <div>
                <span className="text-xs font-semibold text-slate-700 block mb-2">เนื้อหาอีเมล:</span>
                {viewingMail.body_html ? (
                  <div
                    className="p-4 bg-white border border-slate-200 rounded-xl text-xs overflow-x-auto leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: viewingMail.body_html }}
                  />
                ) : (
                  <pre className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs whitespace-pre-wrap font-sans text-slate-800">
                    {viewingMail.body_text || "(ไม่มีข้อความ)"}
                  </pre>
                )}
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setViewingMail(null)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium transition-colors cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ================= CREATE MAILBOX MODAL ================= */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl p-6 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-5">
              <h4 className="font-bold text-base text-slate-900">สร้างบัญชีกล่องเมลใหม่</h4>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateMailboxSubmit} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">ชื่ออีเมล</label>
                  <button
                    type="button"
                    onClick={handleGenerateRandom}
                    className="text-[11px] text-indigo-600 hover:underline flex items-center gap-1 font-medium cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>สุ่มชื่อให้อัตโนมัติ</span>
                  </button>
                </div>
                <div className="flex items-center">
                  <input
                    type="text"
                    value={newPrefix}
                    onChange={(e) => setNewPrefix(e.target.value)}
                    placeholder="เช่น cinex-12345"
                    className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-l-xl text-xs text-slate-800"
                    required
                  />
                  <span className="px-3 py-2.5 bg-slate-100 border border-l-0 border-slate-200 rounded-r-xl text-xs font-mono text-slate-600">
                    @namenoname.store
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  รหัส PIN ล็อคเมล (ตัวเลข 6 หลัก - ถ้าไม่ต้องการล็อคให้เว้นว่าง)
                </label>
                <input
                  type="text"
                  maxLength="6"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="เช่น 123456"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-mono tracking-widest"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">บันทึกช่วยจำ (Note)</label>
                <input
                  type="text"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="เช่น ลูกค้า Netflix จอ 1"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold disabled:opacity-50 cursor-pointer"
                >
                  {isCreating ? "กำลังสร้าง..." : "สร้างบัญชีทันที"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= EDIT PIN MODAL ================= */}
      {editingMailbox && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl p-6">
            <h4 className="font-bold text-base text-slate-900 mb-1">ตั้งค่ารหัส PIN</h4>
            <p className="text-xs text-slate-400 font-mono mb-4">{editingMailbox.address}</p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  รหัส PIN 6 หลัก (ลบให้ว่างเพื่อปลดล็อค)
                </label>
                <input
                  type="text"
                  maxLength="6"
                  value={pinEditVal}
                  onChange={(e) => setPinEditVal(e.target.value.replace(/\D/g, ""))}
                  placeholder="เช่น 123456"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-center text-sm font-mono tracking-widest"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setEditingMailbox(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleSavePin}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
                >
                  บันทึก
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

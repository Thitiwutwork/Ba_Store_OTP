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
  Mail,
  Filter,
  CheckSquare,
  Square,
  ChevronLeft,
  ChevronRight,
  ArrowLeft
} from "lucide-react";
import {
  fetchAdminStats,
  fetchAllEmails,
  deleteEmail,
  deleteBatchEmails,
  clearAllEmails,
  fetchAllMailboxes,
  createMailbox,
  createBatchMailboxes,
  updateMailboxPin,
  deleteMailbox,
  fetchDomains,
  adminLogout,
  updateAdminPassword
} from "../services/adminService";

export default function AdminDashboard({ onExitToClient }) {
  // Tabs: "overview" | "mailboxes" | "inbox" | "filters" | "settings"
  const [activeTab, setActiveTab] = useState("inbox");
  const [selectedDomainDrillDown, setSelectedDomainDrillDown] = useState(null);

  const [stats, setStats] = useState({
    totalEmails: 0,
    totalMailboxes: 0,
    totalDomains: 5,
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

  // Batch email selection
  const [selectedEmailIds, setSelectedEmailIds] = useState([]);

  // Pagination for Inbox
  const [inboxPage, setInboxPage] = useState(1);
  const pageSize = 15;

  // View Mail Modal
  const [viewingMail, setViewingMail] = useState(null);
  const [copiedOtp, setCopiedOtp] = useState(false);

  // Create Mailbox Modal (Image 1 replica)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [targetCreateDomain, setTargetCreateDomain] = useState("namenoname.store");
  const [pinMode, setPinMode] = useState("none"); // "none" | "random" | "custom"
  const [customPinVal, setCustomPinVal] = useState("");
  const [useFilterCheckbox, setUseFilterCheckbox] = useState(false);
  const [singlePrefix, setSinglePrefix] = useState("");
  const [batchCount, setBatchCount] = useState(10);
  const [isCreatingSingle, setIsCreatingSingle] = useState(false);
  const [isCreatingBatch, setIsCreatingBatch] = useState(false);

  // Edit PIN Modal
  const [editingMailbox, setEditingMailbox] = useState(null);
  const [pinEditVal, setPinEditVal] = useState("");

  // Settings Password State
  const [newPwd, setNewPwd] = useState("");
  const [pwdMessage, setPwdMessage] = useState("");

  // Copied filter template toast
  const [copiedFilterId, setCopiedFilterId] = useState(null);

  // Filter templates (Image 3 replica)
  const systemFilterTemplates = [
    {
      id: "alibaba",
      title: "Alibaba Login OTP",
      desc: "แสดงเฉพาะรหัสยืนยันเข้าสู่ระบบ Alibaba",
      badge: "หัวข้อ • ใช้งาน 48 บัญชี"
    },
    {
      id: "chatgpt",
      title: "ChatGPT Login OTP",
      desc: "แสดงเฉพาะรหัสยืนยัน / login code ของ ChatGPT",
      badge: "หัวข้อ • ใช้งาน 198 บัญชี"
    },
    {
      id: "disney",
      title: "Disney+ Login OTP",
      desc: "แสดงเฉพาะรหัสยืนยันอีเมล / One-Time Passcode ของ Disney+ (ไม่รวม Hotstar)",
      badge: "หัวข้อ + เนื้อหา • ใช้งาน 3825 บัญชี"
    },
    {
      id: "google",
      title: "Google Login OTP",
      desc: "แสดงเฉพาะรหัสยืนยันเข้าสู่ระบบ Google (ไม่รวมคำเชิญ Family Group)",
      badge: "เนื้อหา • ใช้งาน 20 บัญชี"
    },
    {
      id: "monomax",
      title: "Monomax Login OTP",
      desc: "แสดงเฉพาะรหัสยืนยันลงทะเบียน / เข้าสู่ระบบ Monomax",
      badge: "หัวข้อ • ใช้งาน 34 บัญชี"
    },
    {
      id: "netflix",
      title: "Netflix Login OTP",
      desc: "แสดงเฉพาะรหัสเข้าสู่ระบบ Netflix (ไม่รวมอีเมลโปรโมชั่นหรือรีเซ็ตรหัสผ่าน)",
      badge: "หัวข้อ + เนื้อหา • ใช้งาน 258 บัญชี"
    },
    {
      id: "netflix-travel",
      title: "Netflix OTP (Login + Travel)",
      desc: "แสดงรหัสเข้าสู่ระบบ Netflix และรหัสเข้าใช้งานชั่วคราว (ไม่รวมโปรโมชั่น)",
      badge: "หัวข้อ • ใช้งาน 272 บัญชี"
    },
    {
      id: "netflix-temp",
      title: "Netflix Temporary Access OTP",
      desc: "แสดงเฉพาะอีเมลขอรหัสเข้าใช้งาน Netflix ชั่วคราว (นอกครัวเรือน / เดินทาง)",
      badge: "หัวข้อ + เนื้อหา • ใช้งาน 115 บัญชี"
    },
    {
      id: "roblox",
      title: "Roblox Login OTP",
      desc: "แสดงเฉพาะอีเมลยืนยัน / login request ของ Roblox (ไม่รวม reset password)",
      badge: "หัวข้อ • ใช้งาน 12 บัญชี"
    },
    {
      id: "spotify",
      title: "Spotify Login OTP",
      desc: "แสดงเฉพาะรหัสเข้าสู่ระบบ Spotify",
      badge: "หัวข้อ • ใช้งาน 88 บัญชี"
    }
  ];

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

  // Handle Delete Single Email
  const handleDeleteEmail = async (id) => {
    if (!window.confirm("คุณต้องการลบอีเมลฉบับนี้ใช่หรือไม่?")) return;
    const res = await deleteEmail(id);
    if (res.success) {
      setEmails((prev) => prev.filter((e) => e.id !== id));
      setSelectedEmailIds((prev) => prev.filter((i) => i !== id));
      if (viewingMail && viewingMail.id === id) setViewingMail(null);
      fetchAdminStats().then((s) => s.success && setStats(s));
    } else {
      alert("ไม่สามารถลบอีเมลได้");
    }
  };

  // Handle Bulk Delete Emails
  const handleBulkDeleteEmails = async () => {
    if (selectedEmailIds.length === 0) return;
    if (!window.confirm(`คุณต้องการลบอีเมลที่เลือกทั้งหมดจำนวน ${selectedEmailIds.length} ฉบับใช่หรือไม่?`)) return;

    setIsLoading(true);
    const res = await deleteBatchEmails(selectedEmailIds);
    setIsLoading(false);

    if (res.success) {
      setEmails((prev) => prev.filter((e) => !selectedEmailIds.includes(e.id)));
      setSelectedEmailIds([]);
      fetchAdminStats().then((s) => s.success && setStats(s));
    } else {
      alert("ไม่สามารถลบอีเมลได้");
    }
  };

  // Handle Clear All Emails
  const handleClearAllEmails = async () => {
    if (emails.length === 0) return;
    if (!window.confirm(`คำเตือน: คุณต้องการล้างอีเมลทั้งหมด ${emails.length} ฉบับในกล่องจดหมายใช่หรือไม่?`)) return;

    setIsLoading(true);
    const res = await clearAllEmails();
    setIsLoading(false);

    if (res.success) {
      setEmails([]);
      setSelectedEmailIds([]);
      fetchAdminStats().then((s) => s.success && setStats(s));
    } else {
      alert("ไม่สามารถล้างอีเมลได้");
    }
  };

  // Toggle select email
  const toggleSelectEmail = (id) => {
    setSelectedEmailIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Toggle select all on current page
  const handleToggleSelectAll = () => {
    const pageIds = paginatedEmails.map((e) => e.id);
    const isAllSelected = pageIds.every((id) => selectedEmailIds.includes(id));
    if (isAllSelected) {
      setSelectedEmailIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedEmailIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  // Generate PIN based on mode
  const getPinForCreation = () => {
    if (pinMode === "none") return null;
    if (pinMode === "random") {
      return String(Math.floor(100000 + Math.random() * 900000));
    }
    if (pinMode === "custom") {
      return customPinVal.trim() || null;
    }
    return null;
  };

  // Handle Create Single Mailbox
  const handleCreateSingle = async (e) => {
    e.preventDefault();
    if (!singlePrefix.trim()) return;

    const domain = targetCreateDomain || "namenoname.store";
    const address = `${singlePrefix.trim().toLowerCase()}@${domain}`;
    const pin = getPinForCreation();

    setIsCreatingSingle(true);
    const res = await createMailbox(address, pin, useFilterCheckbox ? "ใช้ตัวกรอง OTP" : "");
    setIsCreatingSingle(false);

    if (res.success) {
      setIsCreateModalOpen(false);
      setSinglePrefix("");
      setCustomPinVal("");
      loadData();
    } else {
      alert("เกิดข้อผิดพลาด: " + (res.error || "สร้างบัญชีไม่สำเร็จ"));
    }
  };

  // Handle Create Batch Mailboxes
  const handleCreateBatch = async () => {
    const count = Math.min(Math.max(Number(batchCount) || 1, 1), 100);
    const domain = targetCreateDomain || "namenoname.store";
    const addresses = [];

    for (let i = 0; i < count; i++) {
      const rand = Math.random().toString(36).substring(2, 8);
      addresses.push(`cinex-${rand}@${domain}`);
    }

    const pin = getPinForCreation();

    setIsCreatingBatch(true);
    const res = await createBatchMailboxes(addresses, pin, useFilterCheckbox ? "ใช้ตัวกรอง OTP" : "");
    setIsCreatingBatch(false);

    if (res.success) {
      setIsCreateModalOpen(false);
      setSinglePrefix("");
      setCustomPinVal("");
      loadData();
    } else {
      alert("เกิดข้อผิดพลาดในการสร้างหลายบัญชี");
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

  // Copy Filter Template
  const handleCopyFilter = (id) => {
    setCopiedFilterId(id);
    setTimeout(() => setCopiedFilterId(null), 2000);
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

  // Master domains list matching user's Image 2
  const masterDomains = [
    { name: "baxsv.store", source: "ผู้ใช้", status: "เปิดใช้งาน", count: 4107 },
    { name: "xbasv.store", source: "ผู้ใช้", status: "เปิดใช้งาน", count: 0 },
    { name: "xbasv.com", source: "ผู้ใช้", status: "เปิดใช้งาน", count: 3169 },
    {
      name: "namenoname.store",
      source: "ผู้ใช้",
      status: "เปิดใช้งาน",
      count: mailboxes.filter((m) => m.address.endsWith("@namenoname.store")).length || mailboxes.length
    },
    { name: "lico.moe", source: "ระบบ", status: "เปิดใช้งาน", count: 1 },
    { name: "rdcw.plus", source: "ระบบ", status: "เปิดใช้งาน", count: 0 }
  ];

  // Filtered / Paged Emails
  const paginatedEmails = emails.slice((inboxPage - 1) * pageSize, inboxPage * pageSize);
  const totalPages = Math.ceil(emails.length / pageSize) || 1;

  // Filter mailboxes for drill-down view
  const drillDownMailboxes = selectedDomainDrillDown
    ? mailboxes.filter((m) => m.address.endsWith(`@${selectedDomainDrillDown}`))
    : mailboxes;

  return (
    <div className="min-h-screen bg-[#FDF5F8] flex font-['Prompt'] text-slate-800 selection:bg-pink-200 selection:text-pink-900">
      
      {/* ===================== SIDEBAR ===================== */}
      <aside className="w-64 bg-white border-r border-pink-100 flex flex-col justify-between shrink-0 shadow-xs">
        <div>
          {/* Brand Logo */}
          <div className="h-18 flex items-center gap-3 px-6 border-b border-pink-100">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-500 via-pink-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-pink-500/20">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-lg bg-gradient-to-r from-rose-500 via-pink-600 to-purple-600 bg-clip-text text-transparent tracking-tight block leading-tight">
                BA STORE
              </span>
              <span className="text-[10px] text-pink-600 font-bold tracking-wider uppercase">
                Admin Console
              </span>
            </div>
          </div>

          {/* Nav Categories */}
          <div className="p-4 space-y-6">
            
            {/* หมวด: อีเมล */}
            <div>
              <span className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                อีเมล
              </span>
              <nav className="space-y-1">
                <button
                  onClick={() => {
                    setActiveTab("overview");
                    setSelectedDomainDrillDown(null);
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                    activeTab === "overview"
                      ? "bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-md shadow-rose-500/25"
                      : "text-slate-600 hover:bg-pink-50 hover:text-pink-700"
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>หน้าหลัก</span>
                </button>

                <button
                  onClick={() => {
                    setActiveTab("mailboxes");
                    setSelectedDomainDrillDown(null);
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                    activeTab === "mailboxes"
                      ? "bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-md shadow-rose-500/25"
                      : "text-slate-600 hover:bg-pink-50 hover:text-pink-700"
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>บัญชีเมล</span>
                </button>

                <button
                  onClick={() => {
                    setActiveTab("inbox");
                    setSelectedDomainDrillDown(null);
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                    activeTab === "inbox"
                      ? "bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-md shadow-rose-500/25"
                      : "text-slate-600 hover:bg-pink-50 hover:text-pink-700"
                  }`}
                >
                  <Inbox className="w-4 h-4" />
                  <span>กล่องจดหมาย</span>
                  <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    activeTab === "inbox" ? "bg-white/25 text-white" : "bg-pink-100 text-pink-700"
                  }`}>
                    {stats.totalEmails}
                  </span>
                </button>

                <button
                  onClick={() => {
                    setActiveTab("filters");
                    setSelectedDomainDrillDown(null);
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                    activeTab === "filters"
                      ? "bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-md shadow-rose-500/25"
                      : "text-slate-600 hover:bg-pink-50 hover:text-pink-700"
                  }`}
                >
                  <Filter className="w-4 h-4" />
                  <span>ตัวกรองอีเมล</span>
                </button>
              </nav>
            </div>

            {/* หมวด: ผู้ใช้ */}
            <div>
              <span className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                ผู้ใช้
              </span>
              <nav className="space-y-1">
                <button
                  onClick={() => {
                    setActiveTab("settings");
                    setSelectedDomainDrillDown(null);
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                    activeTab === "settings"
                      ? "bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-md shadow-rose-500/25"
                      : "text-slate-600 hover:bg-pink-50 hover:text-pink-700"
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
        <div className="p-4 border-t border-pink-100 space-y-2">
          <button
            onClick={onExitToClient}
            className="w-full py-2 px-3 bg-pink-50 hover:bg-pink-100 text-pink-800 rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>ไปหน้าเว็บลูกค้า</span>
          </button>

          <button
            onClick={() => {
              adminLogout();
              window.location.reload();
            }}
            className="w-full py-2.5 px-3 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>ออกจากระบบ</span>
          </button>
        </div>
      </aside>

      {/* ===================== MAIN CONTENT AREA ===================== */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        
        {/* Top bar with search & refresh */}
        <header className="h-18 bg-white border-b border-pink-100 px-8 flex items-center justify-between gap-4 sticky top-0 z-20 shadow-xs">
          <div className="relative w-80 max-w-full">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหา (ผู้ส่ง, ผู้รับ, หัวข้อ)..."
              className="w-full pl-10 pr-4 py-2 bg-[#FDF5F8] border border-pink-100 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500 focus:bg-white transition-all"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              disabled={isLoading}
              className="px-3.5 py-2 bg-pink-50 hover:bg-pink-100 text-pink-700 rounded-xl text-xs font-medium flex items-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-rose-600" : ""}`} />
              <span>รีเฟรช</span>
            </button>

            {activeTab === "mailboxes" && selectedDomainDrillDown && (
              <button
                onClick={() => {
                  setTargetCreateDomain(selectedDomainDrillDown);
                  setIsCreateModalOpen(true);
                }}
                className="px-4 py-2 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
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
                <div className="bg-white p-5 rounded-2xl border border-pink-100 shadow-xs">
                  <span className="text-xs font-medium text-slate-400 block mb-1">อีเมลทั้งหมดในระบบ</span>
                  <span className="text-2xl font-bold text-slate-900">{stats.totalEmails}</span>
                  <span className="text-[11px] text-emerald-600 font-medium block mt-1">วันนี้เข้า {stats.emailsToday} ฉบับ</span>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-pink-100 shadow-xs">
                  <span className="text-xs font-medium text-slate-400 block mb-1">กล่องข้อความทั้งหมด</span>
                  <span className="text-2xl font-bold text-slate-900">{stats.totalMailboxes}</span>
                  <span className="text-[11px] text-pink-600 font-medium block mt-1">พร้อมใช้งาน 100%</span>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-pink-100 shadow-xs">
                  <span className="text-xs font-medium text-slate-400 block mb-1">รหัส OTP ที่สกัดได้</span>
                  <span className="text-2xl font-bold text-rose-600">{stats.totalOtps}</span>
                  <span className="text-[11px] text-slate-400 block mt-1">ตรวจจับตัวเลขอัตโนมัติ</span>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-pink-100 shadow-xs">
                  <span className="text-xs font-medium text-slate-400 block mb-1">โดเมนที่เชื่อมต่อ</span>
                  <span className="text-2xl font-bold text-slate-900">{masterDomains.length}</span>
                  <span className="text-[11px] text-emerald-600 font-medium block mt-1">เปิดใช้งานแล้ว</span>
                </div>
              </div>

              {/* Usage Wave Chart */}
              <div className="bg-white p-6 rounded-2xl border border-pink-100 shadow-xs">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-base font-bold text-slate-900">จำนวนการใช้งาน</h3>
                  <span className="text-xs text-slate-400">สถิติการรับอีเมล</span>
                </div>

                {/* Smooth Curve SVG */}
                <div className="w-full h-56 relative">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 700 200" preserveAspectRatio="none">
                    <defs>
                      <linearGradient id="chartGradPink" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#E11D48" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#E11D48" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M0,180 C100,160 200,140 300,130 C400,120 450,20 520,30 C590,40 650,140 700,160 L700,200 L0,200 Z"
                      fill="url(#chartGradPink)"
                    />
                    <path
                      d="M0,180 C100,160 200,140 300,130 C400,120 450,20 520,30 C590,40 650,140 700,160"
                      fill="none"
                      stroke="#E11D48"
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

            </div>
          )}

          {/* ================= VIEW 2: GLOBAL INBOX (Bulk Delete & Theme) ================= */}
          {activeTab === "inbox" && (
            <div className="bg-white rounded-2xl border border-pink-100 shadow-xs overflow-hidden">
              
              {/* Header Info & Bulk Actions */}
              <div className="px-6 py-4 border-b border-pink-100 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">กล่องจดหมายรวม</h3>
                  <p className="text-xs text-slate-400 mt-0.5">รวมอีเมลขาเข้าทั้งหมด ({emails.length} ฉบับ)</p>
                </div>

                {/* Bulk delete controls */}
                <div className="flex items-center gap-2">
                  {selectedEmailIds.length > 0 && (
                    <button
                      onClick={handleBulkDeleteEmails}
                      className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs animate-in fade-in cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>ลบที่เลือก ({selectedEmailIds.length} ฉบับ)</span>
                    </button>
                  )}

                  {emails.length > 0 && (
                    <button
                      onClick={handleClearAllEmails}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 rounded-xl text-xs font-medium transition-colors cursor-pointer"
                    >
                      ล้างกล่องทั้งหมด
                    </button>
                  )}
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#2E3192] text-white font-semibold">
                    <tr>
                      <th className="py-3.5 px-4 w-10 text-center">
                        <button
                          onClick={handleToggleSelectAll}
                          className="text-white/80 hover:text-white flex items-center justify-center cursor-pointer"
                        >
                          {paginatedEmails.length > 0 &&
                          paginatedEmails.every((e) => selectedEmailIds.includes(e.id)) ? (
                            <CheckSquare className="w-4 h-4 text-pink-300" />
                          ) : (
                            <Square className="w-4 h-4 text-white/50" />
                          )}
                        </button>
                      </th>
                      <th className="py-3.5 px-4">จาก</th>
                      <th className="py-3.5 px-4">ไปยัง</th>
                      <th className="py-3.5 px-4">หัวข้อ</th>
                      <th className="py-3.5 px-4">วันที่ได้รับ</th>
                      <th className="py-3.5 px-4 text-center">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedEmails.map((item) => {
                      const isSelected = selectedEmailIds.includes(item.id);
                      return (
                        <tr
                          key={item.id}
                          className={`transition-colors ${
                            isSelected ? "bg-pink-50/60" : "hover:bg-slate-50"
                          }`}
                        >
                          {/* Checkbox */}
                          <td className="py-4 px-4 text-center">
                            <button
                              onClick={() => toggleSelectEmail(item.id)}
                              className="text-slate-400 hover:text-rose-600 flex items-center justify-center cursor-pointer"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-rose-600" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </button>
                          </td>

                          {/* จาก */}
                          <td className="py-4 px-4 font-medium text-slate-800 truncate max-w-[180px]">
                            {item.sender}
                          </td>

                          {/* ไปยัง */}
                          <td className="py-4 px-4">
                            <span className="font-mono text-rose-700 font-semibold bg-pink-50 px-2 py-0.5 rounded-md">
                              {item.recipient}
                            </span>
                          </td>

                          {/* หัวข้อ + OTP Badge */}
                          <td className="py-4 px-4">
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
                          <td className="py-4 px-4 text-slate-500 whitespace-nowrap">
                            {formatDate(item.received_at)}
                          </td>

                          {/* ปุ่มจัดการ (สีส้มดู / สีแดงลบ) */}
                          <td className="py-4 px-4 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => setViewingMail(item)}
                                className="w-8 h-8 rounded-lg bg-[#F59E0B] hover:bg-[#D97706] text-white flex items-center justify-center transition-colors shadow-xs cursor-pointer"
                                title="ดูรายละเอียดอีเมล"
                              >
                                <Eye className="w-4 h-4" />
                              </button>

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
                      );
                    })}

                    {paginatedEmails.length === 0 && (
                      <tr>
                        <td colSpan="6" className="py-12 text-center text-slate-400">
                          {searchQuery ? "ไม่พบอีเมลที่ค้นหา" : "ยังไม่มีอีเมลส่งเข้ามาในระบบ"}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-pink-100 flex items-center justify-between text-xs text-slate-500">
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

          {/* ================= VIEW 3: MAILBOXES (Exact Image 2 Replica + Drill-down) ================= */}
          {activeTab === "mailboxes" && (
            <div className="space-y-6">
              
              {/* If NOT drilled down: Show Domain Overview Table (Image 2) */}
              {!selectedDomainDrillDown ? (
                <div className="bg-white rounded-2xl border border-pink-100 shadow-xs overflow-hidden">
                  
                  {/* Table (Image 2) */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#2E3192] text-white font-semibold">
                        <tr>
                          <th className="py-3.5 px-6">โดเมน</th>
                          <th className="py-3.5 px-6">ที่มา</th>
                          <th className="py-3.5 px-6 text-center">สถานะ</th>
                          <th className="py-3.5 px-6 text-center">จำนวน</th>
                          <th className="py-3.5 px-6 text-center">จัดการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {masterDomains.map((dom) => (
                          <tr key={dom.name} className="hover:bg-slate-50 transition-colors">
                            
                            {/* โดเมน */}
                            <td className="py-4 px-6 font-bold text-slate-900 text-sm">
                              {dom.name}
                            </td>

                            {/* ที่มา */}
                            <td className="py-4 px-6 text-slate-600 font-medium">
                              {dom.source}
                            </td>

                            {/* สถานะ */}
                            <td className="py-4 px-6 text-center">
                              <span className="px-2.5 py-0.5 rounded-md bg-emerald-600 text-white font-bold text-[11px]">
                                {dom.status}
                              </span>
                            </td>

                            {/* จำนวน */}
                            <td className="py-4 px-6 text-center font-bold text-slate-800 text-sm">
                              {dom.count}
                            </td>

                            {/* จัดการ (ส้ม บัญชีเมล / เขียวมิ้นท์ อีเมล) */}
                            <td className="py-4 px-6 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-2">
                                
                                {/* ปุ่ม บัญชีเมล (สีส้ม) */}
                                <button
                                  onClick={() => setSelectedDomainDrillDown(dom.name)}
                                  className="px-3 py-1.5 rounded-lg bg-[#F59E0B] hover:bg-[#D97706] text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>บัญชีเมล</span>
                                </button>

                                {/* ปุ่ม อีเมล (สีเขียวอมฟ้า) */}
                                <button
                                  onClick={() => {
                                    setSearchQuery(dom.name);
                                    setActiveTab("inbox");
                                  }}
                                  className="px-3 py-1.5 rounded-lg bg-[#10B981] hover:bg-[#059669] text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                                >
                                  <Mail className="w-3.5 h-3.5" />
                                  <span>อีเมล</span>
                                </button>

                              </div>
                            </td>

                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Footer link */}
                  <div className="p-6 text-center border-t border-slate-100">
                    <p className="text-xs text-slate-700 font-bold">
                      ต้องการโดเมนของตัวเอง? - <a href="#support" className="text-indigo-600 underline">ติดต่อเราเลย!</a>
                    </p>
                  </div>

                </div>
              ) : (
                /* Drill-down: Show mailboxes under the selected domain */
                <div className="bg-white rounded-2xl border border-pink-100 shadow-xs overflow-hidden">
                  
                  {/* Header */}
                  <div className="px-6 py-4 border-b border-pink-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setSelectedDomainDrillDown(null)}
                        className="p-1.5 rounded-xl bg-pink-50 hover:bg-pink-100 text-pink-700 transition-colors cursor-pointer"
                        title="กลับหน้ารวมโดเมน"
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                      <div>
                        <h3 className="text-base font-bold text-slate-900">
                          บัญชีเมลของ: <span className="text-rose-600 font-mono font-bold">@{selectedDomainDrillDown}</span>
                        </h3>
                        <p className="text-xs text-slate-400 mt-0.5">
                          พบทั้งหมด {drillDownMailboxes.length} บัญชี
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setTargetCreateDomain(selectedDomainDrillDown);
                        setIsCreateModalOpen(true);
                      }}
                      className="px-4 py-2 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>สร้างเมลใหม่</span>
                    </button>
                  </div>

                  {/* Table of mailboxes */}
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
                        {drillDownMailboxes.map((mb) => (
                          <tr key={mb.id} className="hover:bg-slate-50 transition-colors">
                            <td className="py-4 px-5 font-mono text-rose-700 font-bold text-sm">
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
                                  className="px-2.5 py-1.5 rounded-lg bg-pink-50 hover:bg-pink-100 text-pink-700 font-medium text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
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

                        {drillDownMailboxes.length === 0 && (
                          <tr>
                            <td colSpan="5" className="py-12 text-center text-slate-400">
                              ยังไม่มีกล่องข้อความในโดเมนนี้ (กดปุ่ม "สร้างเมลใหม่" ด้านบนได้เลยครับ)
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                </div>
              )}

            </div>
          )}

          {/* ================= VIEW 4: EMAIL FILTERS (Exact Image 3 Replica) ================= */}
          {activeTab === "filters" && (
            <div className="space-y-6">
              
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">ตัวกรองอีเมล</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    จัดการตัวกรองที่ใช้ควบคุมว่าผู้ใช้ภายนอกเห็นอีเมลใดในบัญชีสาธารณะ
                  </p>
                </div>

                <button
                  onClick={() => alert("ระบบรองรับเทมเพลตตัวกรองมาตรฐานอัตโนมัติแล้วครับ!")}
                  className="px-4 py-2 bg-[#2E3192] hover:bg-indigo-900 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>สร้างตัวกรองใหม่</span>
                </button>
              </div>

              {/* Sub-header */}
              <div>
                <h4 className="text-base font-bold text-slate-900">เทมเพลตระบบ</h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  เทมเพลตระบบสามารถเลือกใช้กับบัญชีได้โดยตรง หรือคัดลอกเป็นตัวกรองของคุณเพื่อปรับแต่ง
                </p>
              </div>

              {/* Filter Cards Grid (Image 3) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {systemFilterTemplates.map((t) => (
                  <div
                    key={t.id}
                    className="bg-white p-5 rounded-2xl border border-pink-100 hover:border-pink-300 transition-all shadow-xs flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h5 className="font-bold text-sm text-slate-900">{t.title}</h5>
                        <button
                          onClick={() => handleCopyFilter(t.id)}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[11px] flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                        >
                          {copiedFilterId === t.id ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                          <span>{copiedFilterId === t.id ? "คัดลอกแล้ว" : "คัดลอก"}</span>
                        </button>
                      </div>

                      <p className="text-xs text-slate-500 leading-relaxed mb-3">
                        {t.desc}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-50 flex items-center justify-between text-[11px] text-slate-400">
                      <span>{t.badge}</span>
                      <span className="text-emerald-600 font-bold">พร้อมใช้งาน</span>
                    </div>
                  </div>
                ))}
              </div>

            </div>
          )}

          {/* ================= VIEW 5: SETTINGS ================= */}
          {activeTab === "settings" && (
            <div className="bg-white rounded-2xl border border-pink-100 shadow-xs p-6 max-w-lg">
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
                  className="px-4 py-2 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
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

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {viewingMail.otp_code && (
                <div className="p-5 bg-gradient-to-r from-rose-500 to-pink-600 rounded-2xl text-white shadow-lg shadow-rose-500/20 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-medium text-pink-100 block">รหัสยืนยัน OTP</span>
                    <span className="text-3xl font-mono font-black tracking-widest block mt-0.5">
                      {viewingMail.otp_code}
                    </span>
                  </div>
                  <button
                    onClick={() => handleCopyOtp(viewingMail.otp_code)}
                    className="px-4 py-2 rounded-xl bg-white text-rose-800 hover:bg-rose-50 text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                  >
                    {copiedOtp ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedOtp ? "คัดลอกแล้ว!" : "คัดลอก OTP"}</span>
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50 p-3 rounded-xl">
                  <span className="text-slate-400 block mb-0.5">ส่งจาก (From):</span>
                  <span className="font-medium text-slate-900 break-all">{viewingMail.sender}</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl">
                  <span className="text-slate-400 block mb-0.5">ผู้รับ (To):</span>
                  <span className="font-mono font-bold text-rose-700 break-all">{viewingMail.recipient}</span>
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl text-xs">
                <span className="text-slate-400 block mb-0.5">หัวข้อ (Subject):</span>
                <span className="font-bold text-slate-900">{viewingMail.subject}</span>
              </div>

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

      {/* ================= CREATE MAILBOX MODAL (Image 1 Exact Replica) ================= */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl p-6 sm:p-7 animate-in fade-in zoom-in-95 relative max-h-[90vh] overflow-y-auto">
            
            {/* Close button */}
            <button
              onClick={() => setIsCreateModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Title: PIN */}
            <div className="mb-5">
              <h4 className="font-bold text-base text-slate-900 mb-3">PIN</h4>
              <div className="space-y-2.5 text-xs text-slate-700">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="radio"
                    name="pinMode"
                    value="none"
                    checked={pinMode === "none"}
                    onChange={() => setPinMode("none")}
                    className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>ไม่ใช้ PIN</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="radio"
                    name="pinMode"
                    value="random"
                    checked={pinMode === "random"}
                    onChange={() => setPinMode("random")}
                    className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>สุ่ม PIN</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="radio"
                    name="pinMode"
                    value="custom"
                    checked={pinMode === "custom"}
                    onChange={() => setPinMode("custom")}
                    className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>ตั้ง PIN เดียวกัน</span>
                </label>
              </div>

              {pinMode === "custom" && (
                <div className="mt-3">
                  <input
                    type="text"
                    maxLength="6"
                    value={customPinVal}
                    onChange={(e) => setCustomPinVal(e.target.value.replace(/\D/g, ""))}
                    placeholder="กรอก PIN 6 หลัก"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono tracking-widest text-center"
                  />
                </div>
              )}
            </div>

            {/* Title: ใช้ตัวกรองอีเมล */}
            <div className="mb-6">
              <h4 className="font-bold text-base text-slate-900 mb-2.5">ใช้ตัวกรองอีเมล</h4>
              <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useFilterCheckbox}
                  onChange={(e) => setUseFilterCheckbox(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span>ใช้ตัวกรองกับบัญชีที่สร้าง</span>
              </label>
            </div>

            {/* Section: สร้างบัญชีเดี่ยว (Image 1) */}
            <div className="mb-6">
              <h4 className="font-bold text-base text-slate-900 mb-2">สร้างบัญชีเดี่ยว</h4>
              
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="text"
                  value={singlePrefix}
                  onChange={(e) => setSinglePrefix(e.target.value)}
                  placeholder="เช่น cinex-12345"
                  className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                />
                <span className="text-xs font-bold text-slate-700 whitespace-nowrap">
                  @{targetCreateDomain}
                </span>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
                ชื่อบัญชีอีเมลต้องเป็นตัวอักษรภาษาอังกฤษพิมพ์เล็กหรือตัวเลข และใช้ . _ - คั่นกลางได้ (ห้ามขึ้นต้น ลงท้าย หรือติดกัน)
              </p>

              <button
                type="button"
                onClick={handleCreateSingle}
                disabled={isCreatingSingle || !singlePrefix.trim()}
                className="w-full py-2.5 px-4 bg-[#F59E0B] hover:bg-[#D97706] text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {isCreatingSingle ? "กำลังสร้าง..." : "สร้าง"}
              </button>
            </div>

            <hr className="border-slate-100 my-6" />

            {/* Section: สร้างหลายบัญชี (Image 1) */}
            <div>
              <h4 className="font-bold text-base text-slate-900 mb-2">สร้างหลายบัญชี</h4>
              
              <div className="flex items-center gap-2 mb-4">
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={batchCount}
                  onChange={(e) => setBatchCount(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-center font-bold text-slate-800"
                />
                <button
                  type="button"
                  onClick={() => setBatchCount((c) => Math.max(1, (Number(c) || 1) - 1))}
                  className="w-10 h-10 rounded-xl bg-[#2E3192] text-white flex items-center justify-center font-bold text-lg hover:bg-indigo-900 transition-colors cursor-pointer"
                >
                  -
                </button>
                <button
                  type="button"
                  onClick={() => setBatchCount((c) => Math.min(100, (Number(c) || 1) + 1))}
                  className="w-10 h-10 rounded-xl bg-[#2E3192] text-white flex items-center justify-center font-bold text-lg hover:bg-indigo-900 transition-colors cursor-pointer"
                >
                  +
                </button>
              </div>

              <button
                type="button"
                onClick={handleCreateBatch}
                disabled={isCreatingBatch}
                className="w-full py-3 px-4 bg-[#2E3192] hover:bg-indigo-900 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
              >
                {isCreatingBatch ? "กำลังสร้างชุดบัญชี..." : "ยืนยัน"}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ================= EDIT PIN MODAL ================= */}
      {editingMailbox && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl p-6">
            <h4 className="font-bold text-base text-slate-900 mb-1">ตั้งค่ารหัส PIN</h4>
            <p className="text-xs text-rose-600 font-mono mb-4">{editingMailbox.address}</p>

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
                  className="px-4 py-2 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
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

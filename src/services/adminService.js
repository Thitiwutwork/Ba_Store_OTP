import { supabase } from "./supabaseClient";

// Default admin credentials (can be customized)
const ADMIN_CREDENTIALS = {
  username: "admin",
  password: "password1234"
};

const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpiYnphbXB1a3lxZGpqYmJjanpsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTIyMTc3NSwiZXhwIjoyMTAwNzk3Nzc1fQ.msBN4xaTejeYLrCvyjK_4Zz2jehkCxn7taaO0HW2Dq0";
const BASE_URL = "https://zbbzampukyqdjjbbcjzl.supabase.co";

const adminHeaders = {
  "apikey": SERVICE_KEY,
  "Authorization": `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
  "Prefer": "return=representation"
};

/**
 * ตรวจสอบการล็อกอินแอดมิน
 */
export function verifyAdminLogin(username, password) {
  const savedCreds = localStorage.getItem("BA_STORE_ADMIN_CUSTOM_CREDS");
  const creds = savedCreds ? JSON.parse(savedCreds) : ADMIN_CREDENTIALS;

  if (username === creds.username && password === creds.password) {
    const token = "admin_token_" + Date.now();
    localStorage.setItem("BA_STORE_ADMIN_SESSION", token);
    return { success: true, token };
  }
  return { success: false, error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" };
}

export function checkAdminSession() {
  return Boolean(localStorage.getItem("BA_STORE_ADMIN_SESSION"));
}

export function adminLogout() {
  localStorage.removeItem("BA_STORE_ADMIN_SESSION");
}

export function updateAdminPassword(newPassword) {
  const savedCreds = localStorage.getItem("BA_STORE_ADMIN_CUSTOM_CREDS");
  const creds = savedCreds ? JSON.parse(savedCreds) : { ...ADMIN_CREDENTIALS };
  creds.password = newPassword;
  localStorage.setItem("BA_STORE_ADMIN_CUSTOM_CREDS", JSON.stringify(creds));
  return true;
}

/**
 * ดึงสถิติภาพรวมสำหรับหน้าหลัก
 */
export async function fetchAdminStats() {
  try {
    const [resEmails, resMailboxes, resDomains] = await Promise.all([
      fetch(`${BASE_URL}/rest/v1/emails?select=id,otp_code,received_at&order=received_at.desc`, { headers: adminHeaders }),
      fetch(`${BASE_URL}/rest/v1/mailboxes?select=id`, { headers: adminHeaders }),
      fetch(`${BASE_URL}/rest/v1/domains?select=id,name`, { headers: adminHeaders })
    ]);

    const emails = await resEmails.json();
    const mailboxes = await resMailboxes.json();
    const domains = await resDomains.json();

    const totalEmails = Array.isArray(emails) ? emails.length : 0;
    const totalMailboxes = Array.isArray(mailboxes) ? mailboxes.length : 0;
    const totalDomains = Array.isArray(domains) ? domains.length : 0;
    const totalOtps = Array.isArray(emails) ? emails.filter(e => e.otp_code).length : 0;

    // คำนวณเมลวันนี้
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const emailsToday = Array.isArray(emails)
      ? emails.filter(e => new Date(e.received_at).getTime() >= startOfDay).length
      : 0;

    return {
      success: true,
      totalEmails,
      totalMailboxes,
      totalDomains,
      totalOtps,
      emailsToday,
      recentEmails: Array.isArray(emails) ? emails.slice(0, 10) : []
    };
  } catch (err) {
    console.error("fetchAdminStats error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * ดึงรายการอีเมลทั้งหมด (Global Inbox)
 */
export async function fetchAllEmails(query = "") {
  try {
    let url = `${BASE_URL}/rest/v1/emails?select=id,recipient,sender,subject,body_text,body_html,otp_code,received_at&order=received_at.desc`;
    if (query && query.trim()) {
      const q = encodeURIComponent(`*${query.trim()}*`);
      url += `&or=(recipient.ilike.${q},sender.ilike.${q},subject.ilike.${q},otp_code.ilike.${q})`;
    }

    const res = await fetch(url, { headers: adminHeaders });
    const data = await res.json();
    return { success: true, emails: Array.isArray(data) ? data : [] };
  } catch (err) {
    console.error("fetchAllEmails error:", err);
    return { success: false, emails: [], error: err.message };
  }
}

/**
 * ลบอีเมลเดี่ยว
 */
export async function deleteEmail(emailId) {
  try {
    const res = await fetch(`${BASE_URL}/rest/v1/emails?id=eq.${emailId}`, {
      method: "DELETE",
      headers: adminHeaders
    });
    return { success: res.ok };
  } catch (err) {
    console.error("deleteEmail error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * ลบอีเมลหลายฉบับพร้อมกัน (Batch Delete)
 */
export async function deleteBatchEmails(emailIds) {
  if (!emailIds || emailIds.length === 0) return { success: true };
  try {
    const idList = emailIds.map((id) => `"${id}"`).join(",");
    const res = await fetch(`${BASE_URL}/rest/v1/emails?id=in.(${idList})`, {
      method: "DELETE",
      headers: adminHeaders
    });
    return { success: res.ok };
  } catch (err) {
    console.error("deleteBatchEmails error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * ล้างอีเมลทั้งหมดในกล่องจดหมาย (Clear All)
 */
export async function clearAllEmails() {
  try {
    const res = await fetch(`${BASE_URL}/rest/v1/emails?id=neq.00000000-0000-0000-0000-000000000000`, {
      method: "DELETE",
      headers: adminHeaders
    });
    return { success: res.ok };
  } catch (err) {
    console.error("clearAllEmails error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * สร้างกล่องข้อความหลายบัญชีพร้อมกัน (Batch Create)
 */
export async function createBatchMailboxes(addresses, pinCode = null, note = "") {
  try {
    const rows = addresses.map((addr) => ({
      address: addr.toLowerCase().trim(),
      pin_code: pinCode ? String(pinCode).trim() : null,
      note: note || null,
      is_active: true
    }));

    const res = await fetch(`${BASE_URL}/rest/v1/mailboxes`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify(rows)
    });
    return { success: res.ok };
  } catch (err) {
    console.error("createBatchMailboxes error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * ดึงรายการบัญชีเมลทั้งหมด (Mailboxes)
 */
export async function fetchAllMailboxes(query = "") {
  try {
    let url = `${BASE_URL}/rest/v1/mailboxes?select=id,address,pin_code,note,is_active,created_at&order=created_at.desc`;
    if (query && query.trim()) {
      const q = encodeURIComponent(`*${query.trim()}*`);
      url += `&or=(address.ilike.${q},note.ilike.${q})`;
    }

    const res = await fetch(url, { headers: adminHeaders });
    const data = await res.json();
    return { success: true, mailboxes: Array.isArray(data) ? data : [] };
  } catch (err) {
    console.error("fetchAllMailboxes error:", err);
    return { success: false, mailboxes: [], error: err.message };
  }
}

/**
 * สร้างกล่องข้อความใหม่
 */
export async function createMailbox(address, pinCode = null, note = "") {
  try {
    const cleanAddress = address.trim().toLowerCase();
    const res = await fetch(`${BASE_URL}/rest/v1/mailboxes`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({
        address: cleanAddress,
        pin_code: pinCode ? String(pinCode).trim() : null,
        note: note || null,
        is_active: true
      })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || "ไม่สามารถสร้างกล่องข้อความได้");
    }
    return { success: true, mailbox: data[0] };
  } catch (err) {
    console.error("createMailbox error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * แก้ไข PIN ของกล่องข้อความ
 */
export async function updateMailboxPin(mailboxId, newPin) {
  try {
    const pinVal = newPin && newPin.trim() ? newPin.trim() : null;
    const res = await fetch(`${BASE_URL}/rest/v1/mailboxes?id=eq.${mailboxId}`, {
      method: "PATCH",
      headers: adminHeaders,
      body: JSON.stringify({
        pin_code: pinVal,
        updated_at: new Date().toISOString()
      })
    });
    return { success: res.ok };
  } catch (err) {
    console.error("updateMailboxPin error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * ลบกล่องข้อความ
 */
export async function deleteMailbox(mailboxId) {
  try {
    const res = await fetch(`${BASE_URL}/rest/v1/mailboxes?id=eq.${mailboxId}`, {
      method: "DELETE",
      headers: adminHeaders
    });
    return { success: res.ok };
  } catch (err) {
    console.error("deleteMailbox error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * ดึงรายชื่อโดเมนทั้งหมด
 */
export async function fetchDomains() {
  try {
    const res = await fetch(`${BASE_URL}/rest/v1/domains?select=*&order=created_at.desc`, {
      headers: adminHeaders
    });
    const data = await res.json();
    return { success: true, domains: Array.isArray(data) ? data : [] };
  } catch (err) {
    console.error("fetchDomains error:", err);
    return { success: false, domains: [], error: err.message };
  }
}

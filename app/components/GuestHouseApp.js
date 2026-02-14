"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { DayPicker } from "react-day-picker";
import { uk } from "react-day-picker/locale";
import { useFirestoreData } from "@/app/lib/hooks/useFirestoreData";

const HOUSES = [
  { id: "house1", name: "Аромат хвої", color: "#4A6741", accent: "#6B8F3C", weekday: 13000, weekend: 16000 },
  { id: "house2", name: "Сонячна оселя", color: "#8B7D3C", accent: "#BFA84F", weekday: 7000, weekend: 8000 },
  { id: "house3", name: "Лісова тиша", color: "#4A7B8B", accent: "#5A9DB0", weekday: 5500, weekend: 6500 },
];

const MONTHS = ["Січень","Лютий","Березень","Квітень","Травень","Червень","Липень","Серпень","Вересень","Жовтень","Листопад","Грудень"];
const MONTHS_GEN = ["січня","лютого","березня","квітня","травня","червня","липня","серпня","вересня","жовтня","листопада","грудня"];
const DAYS_SHORT = ["Пн","Вт","Ср","Чт","Пт","Сб","Нд"];

const STATUS_COLORS = {
  booked: { bg: "#E8F0E4", border: "#4A6741", text: "#2D3D28", label: "Заброньовано" },
  unavailable: { bg: "#F5E6E0", border: "#9E4A3A", text: "#7A2E22", label: "Недоступно" },
  pending: { bg: "#F5F0DC", border: "#8B7D3C", text: "#6B5D1C", label: "Очікується" },
};

function generateId() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 5); }
function formatDate(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function parseDate(s) { const [y,m,d] = s.split("-").map(Number); return new Date(y, m-1, d); }
function daysBetween(a, b) { return Math.round((b - a) / 86400000); }
function displayDate(s) { const d = parseDate(s); return `${d.getDate()} ${MONTHS[d.getMonth()].substring(0,3).toLowerCase()}`; }
function nightsLabel(n) { return n === 1 ? "ніч" : (n >= 2 && n <= 4) ? "ночі" : "ночей"; }
function commentsLabel(n) { return n === 1 ? "коментар" : (n >= 2 && n <= 4) ? "коментарі" : "коментарів"; }
function shortName(name, max = 10) { if (!name) return "?"; const first = name.split(/\s+/)[0]; return first.length > max ? first.slice(0, max - 1) + "…" : first; }
function formatMoney(n) { return n.toLocaleString("uk-UA") + " ₴"; }
function formatTimestamp(ts) {
  if (!ts) return null;
  const d = ts?.toDate ? ts.toDate() : (ts instanceof Date ? ts : new Date(ts));
  if (isNaN(d.getTime())) return null;
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]} ${d.getFullYear()}, ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

function isWeekend(dateStr) {
  const d = parseDate(dateStr);
  const day = d.getDay();
  return day === 5 || day === 6 || day === 0;
}

function eachNight(checkIn, checkOut) {
  const nights = [];
  let d = new Date(parseDate(checkIn));
  const end = parseDate(checkOut);
  while (d < end) {
    nights.push(formatDate(d));
    d = new Date(d.getTime() + 86400000);
  }
  return nights;
}

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function getDefaultHousePrices() {
  const p = {};
  HOUSES.forEach(h => {
    p[h.id] = {};
    DAY_KEYS.forEach(k => {
      p[h.id][k] = (k === "fri" || k === "sat" || k === "sun") ? h.weekend : h.weekday;
    });
  });
  return p;
}

function getNightRate(houseId, dateStr, housePrices) {
  const d = parseDate(dateStr);
  const key = DAY_KEYS[d.getDay()];
  if (housePrices && housePrices[houseId]) {
    const val = housePrices[houseId][key];
    if (val != null && typeof val === "number") return val;
  }
  const defaults = getDefaultHousePrices();
  return defaults[houseId]?.[key] ?? 0;
}

function calcDefaultPrice(houseId, checkIn, checkOut, housePrices) {
  const house = HOUSES.find(h => h.id === houseId);
  if (!house || !checkIn || !checkOut) return 0;
  const nights = eachNight(checkIn, checkOut);
  return nights.reduce((sum, n) => sum + getNightRate(houseId, n, housePrices), 0);
}

function getOccupiedDates(bookings, houseId, excludeId) {
  const dates = new Set();
  bookings.forEach(b => {
    if (b.houseId !== houseId || b.id === excludeId) return;
    const nights = eachNight(b.checkIn, b.checkOut);
    nights.forEach(d => dates.add(d));
  });
  return dates;
}

// ── SVG Pine Tree ──
function PineTree({ size = 24, color = "#3D5A2E" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 28" fill="none">
      <path d="M12 1L5 10h3L4 16h3L3 23h18l-4-7h3l-4-6h3L12 1z" fill={color} opacity="0.85"/>
      <rect x="10.5" y="23" width="3" height="4" rx="0.5" fill={color} opacity="0.6"/>
    </svg>
  );
}

/* House 1: Аромат хвої — A-frame з прибудовою справа */
function IconHouse1({ size = 20, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 28" fill="none">
      <polygon points="2,22 11,4 20,22" stroke={color} strokeWidth="1.8" strokeLinejoin="round" fill="none"/>
      <rect x="7" y="14" width="8" height="8" rx="0.5" stroke={color} strokeWidth="1.2" fill="none"/>
      <line x1="11" y1="14" x2="11" y2="22" stroke={color} strokeWidth="1"/>
      <polygon points="7,14 11,10 15,14" stroke={color} strokeWidth="1" fill="none"/>
      <rect x="18" y="12" width="12" height="10" rx="1" stroke={color} strokeWidth="1.5" fill="none"/>
      <rect x="22" y="15" width="4" height="4" rx="0.5" stroke={color} strokeWidth="1" fill="none"/>
      <line x1="18" y1="12" x2="30" y2="12" stroke={color} strokeWidth="1.5"/>
      <rect x="1" y="22" width="30" height="2" rx="0.5" fill={color} opacity="0.3"/>
    </svg>
  );
}

/* House 2: Сонячна оселя — компактний A-frame з чаном */
function IconHouse2({ size = 20, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <polygon points="4,24 14,4 24,24" stroke={color} strokeWidth="1.8" strokeLinejoin="round" fill="none"/>
      <polygon points="9,16 14,10 19,16" stroke={color} strokeWidth="1" fill="none"/>
      <rect x="10" y="16" width="8" height="8" rx="0.5" stroke={color} strokeWidth="1.2" fill="none"/>
      <line x1="14" y1="16" x2="14" y2="24" stroke={color} strokeWidth="1"/>
      <line x1="10" y1="20" x2="18" y2="20" stroke={color} strokeWidth="0.8"/>
      <ellipse cx="6" cy="23" rx="3.5" ry="2" stroke={color} strokeWidth="1.2" fill="none"/>
      <rect x="3" y="24" width="22" height="1.5" rx="0.5" fill={color} opacity="0.3"/>
    </svg>
  );
}

/* House 3: Лісова тиша — плоский модерн будинок */
function IconHouse3({ size = 20, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 24" fill="none">
      <rect x="2" y="6" width="28" height="14" rx="1.5" stroke={color} strokeWidth="1.8" fill="none"/>
      <rect x="1" y="4" width="30" height="3" rx="1" stroke={color} strokeWidth="1.5" fill="none"/>
      <rect x="6" y="10" width="5" height="7" rx="0.5" stroke={color} strokeWidth="1.2" fill="none"/>
      <rect x="14" y="10" width="5" height="7" rx="0.5" stroke={color} strokeWidth="1.2" fill="none"/>
      <rect x="22" y="10" width="5" height="4" rx="0.5" stroke={color} strokeWidth="1" fill="none"/>
      <ellipse cx="6" cy="19" rx="3" ry="1.8" stroke={color} strokeWidth="1.2" fill="none"/>
      <rect x="1" y="20" width="30" height="1.5" rx="0.5" fill={color} opacity="0.3"/>
    </svg>
  );
}

function HouseIcon({ houseId, size = 16, color = "currentColor" }) {
  if (houseId === "house1") return <IconHouse1 size={size} color={color} />;
  if (houseId === "house2") return <IconHouse2 size={size} color={color} />;
  if (houseId === "house3") return <IconHouse3 size={size} color={color} />;
  return <PineTree size={size} color={color} />;
}

function IconSettings({ size = 17, color = "currentColor", filled = false }) {
  if (filled) return (<svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke={color} strokeWidth="1"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3" fill="rgba(0,0,0,0.2)"/></svg>);
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>);
}
function IconUser({ size = 17, color = "currentColor" }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>);
}
function IconCalendar({ size = 17, color = "currentColor", filled = false }) {
  if (filled) return (<svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke={color} strokeWidth="0.5"><rect x="3" y="4" width="18" height="18" rx="2" fill={color}/><rect x="3" y="4" width="18" height="6" rx="2" fill={color}/><line x1="16" y1="2" x2="16" y2="6" stroke={color} strokeWidth="2" strokeLinecap="round"/><line x1="8" y1="2" x2="8" y2="6" stroke={color} strokeWidth="2" strokeLinecap="round"/><rect x="3" y="10" width="18" height="12" rx="0 0 2 2" fill={color}/><rect x="5" y="12" width="14" height="8" rx="1" fill="rgba(0,0,0,0.15)"/></svg>);
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>);
}
function IconChart({ size = 17, color = "currentColor", filled = false }) {
  if (filled) return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="none"><rect x="15" y="10" width="6" height="10" rx="2" fill={color}/><rect x="9" y="4" width="6" height="16" rx="2" fill={color}/><rect x="3" y="14" width="6" height="6" rx="2" fill={color}/></svg>);
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>);
}
function IconClipboard({ size = 17, color = "currentColor", filled = false }) {
  if (filled) return (<svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" fill={color}/><rect x="6" y="9" width="12" height="2" rx="1" fill="rgba(0,0,0,0.15)"/><rect x="6" y="13" width="9" height="2" rx="1" fill="rgba(0,0,0,0.15)"/><rect x="6" y="17" width="6" height="2" rx="1" fill="rgba(0,0,0,0.15)"/></svg>);
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>);
}
function IconMoney({ size = 17, color = "currentColor" }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>);
}
function IconMoon({ size = 14, color = "currentColor" }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>);
}
function IconComment({ size = 13, color = "currentColor" }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>);
}

// ── MODAL ──
function Modal({ children, onClose, title }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #DDD8C8", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "#FAFAF5", zIndex: 2, borderRadius: "inherit" }}>
          <div className="modal-handle" style={{ width: 36, height: 4, borderRadius: 2, background: "#C5BFAA", position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)" }} />
          <h2 style={{ margin: 0, fontSize: 17, fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", color: "#2D3A2E", marginTop: 4 }}>{title}</h2>
          <button onClick={onClose} style={{ background: "#EDE8DA", border: "none", fontSize: 18, cursor: "pointer", color: "#6B6347", width: 32, height: 32, borderRadius: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
        </div>
        <div style={{ padding: "16px 20px 24px" }}>{children}</div>
      </div>
    </div>
  );
}

// ── INPUTS ──
function Input({ label, value, onChange, type, placeholder, required, rows, min, max, disabled, error }) {
  const base = {
    width: "100%", padding: "12px 14px", border: `1.5px solid ${error ? "#9E4A3A" : "#C5BFAA"}`, borderRadius: 12,
    fontSize: 18, fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", background: disabled ? "#F0EDE2" : "#fff",
    outline: "none", transition: "border-color 0.2s", boxSizing: "border-box", color: "#2D3A2E",
    opacity: disabled ? 0.6 : 1
  };
  return (
    <div style={{ marginBottom: 12 }}>
      {label && <label style={{ display: "block", marginBottom: 5, fontSize: 13, fontWeight: 700, color: error ? "#9E4A3A" : "#5A6B4A", letterSpacing: 0.6, textTransform: "uppercase", fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>
        {label} {required && <span style={{ color: "#9E4A3A" }}>*</span>}
      </label>}
      {rows ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows} style={{ ...base, resize: "vertical" }} disabled={disabled} />
      ) : (
        <input type={type || "text"} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={base} min={min} max={max} disabled={disabled}
          onFocus={e => { if (!disabled) e.target.style.borderColor="#6B8F3C"; }} onBlur={e => e.target.style.borderColor=error?"#9E4A3A":"#C5BFAA"} />
      )}
      {error && <div style={{ fontSize: 13, color: "#9E4A3A", marginTop: 4, fontWeight: 600 }}>{error}</div>}
    </div>
  );
}

function Select({ label, value, onChange, options, required }) {
  return (
    <div style={{ marginBottom: 12 }}>
      {label && <label style={{ display: "block", marginBottom: 5, fontSize: 13, fontWeight: 700, color: "#5A6B4A", letterSpacing: 0.6, textTransform: "uppercase", fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>{label} {required && <span style={{ color: "#9E4A3A" }}>*</span>}</label>}
      <select value={value} onChange={e => onChange(e.target.value)} style={{
        width: "100%", padding: "12px 14px", border: "1.5px solid #C5BFAA", borderRadius: 12, fontSize: 18,
        fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", background: "#fff", outline: "none", color: "#2D3A2E",
        cursor: "pointer", boxSizing: "border-box", WebkitAppearance: "none", appearance: "none",
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%235A6B4A' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
        backgroundRepeat: "no-repeat", backgroundPosition: "right 14px center"
      }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function Button({ children, onClick, variant, style: sx, disabled, full }) {
  const styles = {
    primary: { background: "#3D5A2E", color: "#FAFAF5", border: "none" },
    secondary: { background: "transparent", color: "#3D5A2E", border: "1.5px solid #C5BFAA" },
    danger: { background: "#9E4A3A", color: "#fff", border: "none" },
    ghost: { background: "transparent", color: "#7A8B6A", border: "none" },
  };
  const s = styles[variant || "primary"];
  return (
    <button onClick={onClick} disabled={disabled} style={{
      ...s, padding: "12px 20px", borderRadius: 12, fontSize: 17, fontWeight: 700,
      cursor: disabled ? "not-allowed" : "pointer", fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
      letterSpacing: 0.3, transition: "all 0.2s", opacity: disabled ? 0.5 : 1,
      width: full ? "100%" : "auto", ...sx
    }}>{children}</button>
  );
}

function Badge({ status, small }) {
  const c = STATUS_COLORS[status];
  return (
    <span style={{
      display: "inline-block", padding: small ? "2px 8px" : "4px 10px", borderRadius: 20,
      fontSize: small ? 12 : 13, fontWeight: 700, letterSpacing: 0.4,
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
      fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", whiteSpace: "nowrap"
    }}>{c.label}</span>
  );
}

// ── DATE RANGE PICKER ──
function DateRangePicker({ checkIn, checkOut, onChange, occupiedDates }) {
  // Convert occupiedDates Set<string> to Date[] for react-day-picker disabled prop
  const disabledDates = useMemo(() => {
    const dates = [];
    occupiedDates.forEach(ds => dates.push(parseDate(ds)));
    return dates;
  }, [occupiedDates]);

  // Convert string dates to DayPicker range: from = checkIn, to = last night (checkOut - 1 day)
  const selected = useMemo(() => {
    if (!checkIn) return undefined;
    const from = parseDate(checkIn);
    if (!checkOut || checkOut <= checkIn) return { from, to: undefined };
    const to = new Date(parseDate(checkOut).getTime() - 86400000); // last night
    return { from, to };
  }, [checkIn, checkOut]);

  const defaultMonth = checkIn ? parseDate(checkIn) : new Date();

  const handleSelect = (range) => {
    if (!range) {
      onChange("", "");
      return;
    }
    const ci = range.from ? formatDate(range.from) : "";
    if (!range.to) {
      onChange(ci, "");
      return;
    }
    // checkOut = day after last selected night
    const co = formatDate(new Date(range.to.getTime() + 86400000));
    onChange(ci, co);
  };

  const nightsCount = checkIn && checkOut && checkIn < checkOut
    ? daysBetween(parseDate(checkIn), parseDate(checkOut))
    : 0;

  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 700, color: "#5A6B4A", letterSpacing: 0.6, textTransform: "uppercase", fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>
        Дати перебування <span style={{ color: "#9E4A3A" }}>*</span>
      </label>
      <div style={{ background: "#FAFAF5", borderRadius: 14, border: "1.5px solid #C5BFAA", overflow: "hidden", padding: "4px 0 0" }}>
        <DayPicker
          mode="range"
          locale={uk}
          weekStartsOn={1}
          selected={selected}
          onSelect={handleSelect}
          disabled={disabledDates}
          excludeDisabled
          defaultMonth={defaultMonth}
          modifiers={{ weekend: { dayOfWeek: [0, 5, 6] } }}
          modifiersClassNames={{ weekend: "rdp-weekend" }}
        />
        {/* Selection summary */}
        <div style={{ padding: "8px 12px", borderTop: "1px solid #E0DBC8", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 15, color: "#2D3A2E", fontWeight: 600, fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>
            {checkIn && checkOut && checkIn < checkOut ? (
              <>{displayDate(checkIn)} — {displayDate(checkOut)} · {nightsCount} {nightsLabel(nightsCount)}</>
            ) : checkIn ? (
              <span style={{ color: "#7A8B6A" }}>{displayDate(checkIn)} — <span style={{ fontStyle: "italic" }}>оберіть виїзд</span></span>
            ) : (
              <span style={{ color: "#9A9580", fontStyle: "italic" }}>Оберіть дату заїзду</span>
            )}
          </div>
          {checkIn && (
            <button onClick={() => onChange("", "")} style={{ background: "none", border: "1px solid #C5BFAA", borderRadius: 6, padding: "4px 10px", fontSize: 13, color: "#7A8B6A", cursor: "pointer", fontWeight: 600, fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>
              Скинути
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function GuestCounter({ value, onChange }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", marginBottom: 5, fontSize: 13, fontWeight: 700, color: "#5A6B4A", letterSpacing: 0.6, textTransform: "uppercase", fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>Кількість гостей</label>
      <div style={{ display: "flex", alignItems: "center" }}>
        <button onClick={() => onChange(Math.max(1, value - 1))} style={{
          width: 48, height: 48, borderRadius: "12px 0 0 12px", border: "1.5px solid #C5BFAA", borderRight: "none",
          background: "#F5F2EA", fontSize: 20, fontWeight: 700, color: value <= 1 ? "#C5BFAA" : "#3D5A2E",
          cursor: value <= 1 ? "default" : "pointer", fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
          display: "flex", alignItems: "center", justifyContent: "center"
        }}>−</button>
        <div style={{
          width: 56, height: 48, border: "1.5px solid #C5BFAA", display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: 17, fontWeight: 700, color: "#2D3A2E", background: "#fff",
          fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif"
        }}>{value}</div>
        <button onClick={() => onChange(Math.min(30, value + 1))} style={{
          width: 48, height: 48, borderRadius: "0 12px 12px 0", border: "1.5px solid #C5BFAA", borderLeft: "none",
          background: "#F5F2EA", fontSize: 20, fontWeight: 700, color: "#3D5A2E", cursor: "pointer",
          fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center"
        }}>+</button>
      </div>
    </div>
  );
}

// ── BOOKING FORM ──
function BookingForm({ booking, contacts, houses, allBookings, onSave, onClose, onDelete, onSaveContact, housePrices }) {
  const isEdit = !!booking?.id;
  const existingContact = isEdit ? contacts.find(c => c.id === booking?.contactId) : null;

  const [form, setForm] = useState({
    houseId: booking?.houseId || houses[0].id,
    contactId: booking?.contactId || "",
    checkIn: booking?.checkIn || formatDate(new Date()),
    checkOut: booking?.checkOut || formatDate(new Date(Date.now() + 86400000)),
    status: booking?.status || "booked",
    guests: booking?.guests || 1,
    notes: booking?.notes || "",
    comments: booking?.comments || [],
    price: booking?.price ?? null,
    priceManual: booking?.priceManual || false,
  });
  const [contactForm, setContactForm] = useState({
    name: existingContact?.name || "",
    phone: existingContact?.phone || "",
    notes: existingContact?.notes || "",
  });
  const [newComment, setNewComment] = useState("");

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const setC = (k, v) => setContactForm(p => ({ ...p, [k]: v }));

  const isUnavailable = form.status === "unavailable";

  const occupied = useMemo(() => getOccupiedDates(allBookings, form.houseId, booking?.id), [allBookings, form.houseId, booking?.id]);

  const defaultPrice = useMemo(() => calcDefaultPrice(form.houseId, form.checkIn, form.checkOut, housePrices), [form.houseId, form.checkIn, form.checkOut, housePrices]);
  const displayPrice = form.priceManual ? (form.price ?? defaultPrice) : defaultPrice;

  const addComment = () => {
    if (!newComment.trim()) return;
    set("comments", [...form.comments, { id: generateId(), text: newComment.trim(), date: new Date().toISOString() }]);
    setNewComment("");
  };

  const valid = form.checkIn && form.checkOut && form.checkIn < form.checkOut &&
    (isUnavailable || contactForm.name.trim());

  const handleSave = () => {
    let contactId = form.contactId;
    if (!isUnavailable && contactForm.name.trim()) {
      if (existingContact && form.contactId) {
        const updated = { ...existingContact, name: contactForm.name, phone: contactForm.phone, notes: contactForm.notes };
        onSaveContact(updated);
        contactId = updated.id;
      } else {
        const newC = { id: generateId(), name: contactForm.name, phone: contactForm.phone, notes: contactForm.notes };
        onSaveContact(newC);
        contactId = newC.id;
      }
    }
    if (isUnavailable) contactId = "";
    onSave({
      ...form, contactId, id: booking?.id || generateId(),
      price: displayPrice,
      priceManual: form.priceManual,
    });
  };

  const nights = useMemo(() => {
    if (!form.checkIn || !form.checkOut || form.checkIn >= form.checkOut) return [];
    return eachNight(form.checkIn, form.checkOut);
  }, [form.checkIn, form.checkOut]);

  const house = HOUSES.find(h => h.id === form.houseId);

  return (
    <div>
      {isEdit && (booking?.createdAt || booking?.updatedAt) && (
        <div style={{ fontSize: 11, color: "#B0A890", marginBottom: 10, lineHeight: 1.5 }}>
          {formatTimestamp(booking.createdAt) && <div>Створено: {formatTimestamp(booking.createdAt)}</div>}
          {formatTimestamp(booking.updatedAt) && formatTimestamp(booking.updatedAt) !== formatTimestamp(booking.createdAt) && <div>Змінено: {formatTimestamp(booking.updatedAt)}</div>}
        </div>
      )}
      <div style={{ marginBottom: 14 }}>
        <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 700, color: "#5A6B4A", letterSpacing: 0.6, textTransform: "uppercase", fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>Будинок <span style={{ color: "#9E4A3A" }}>*</span></label>
        <div style={{ display: "flex", gap: 6 }}>
          {houses.map(h => {
            const active = form.houseId === h.id;
            return (
              <button key={h.id} onClick={() => { set("houseId", h.id); set("priceManual", false); }} style={{
                flex: 1, padding: "8px 6px 10px", borderRadius: 10, fontSize: 13, fontWeight: 700,
                border: active ? `2px solid ${h.color}` : "1.5px solid #DDD8C8",
                background: active ? `${h.color}18` : "#fff",
                color: active ? h.color : "#7A8B6A",
                cursor: "pointer", fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", transition: "all 0.15s",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              }}><HouseIcon houseId={h.id} size={22} color={active ? h.color : "#7A8B6A"} />{h.name}</button>
            );
          })}
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 700, color: "#5A6B4A", letterSpacing: 0.6, textTransform: "uppercase", fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>Статус <span style={{ color: "#9E4A3A" }}>*</span></label>
        <div style={{ display: "flex", gap: 6 }}>
          {[
            { value: "booked", label: "Заброньовано", icon: "✓" },
            { value: "pending", label: "Очікується", icon: "◷" },
            { value: "unavailable", label: "Недоступно", icon: "✕" },
          ].map(s => {
            const sc = STATUS_COLORS[s.value];
            const active = form.status === s.value;
            return (
              <button key={s.value} onClick={() => set("status", s.value)} style={{
                flex: 1, padding: "10px 6px", borderRadius: 10, fontSize: 13, fontWeight: 700,
                border: active ? `2px solid ${sc.border}` : "1.5px solid #DDD8C8",
                background: active ? sc.bg : "#fff", color: active ? sc.text : "#7A8B6A",
                cursor: "pointer", fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", transition: "all 0.15s",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              }}><span style={{ fontSize: 23 }}>{s.icon}</span> {s.label}</button>
            );
          })}
        </div>
      </div>

      <DateRangePicker
        checkIn={form.checkIn}
        checkOut={form.checkOut}
        onChange={(ci, co) => { set("checkIn", ci); set("checkOut", co); if (!form.priceManual) set("price", null); }}
        occupiedDates={occupied}
      />

      {!isUnavailable && (
        <div style={{ background: "#F0EDE2", borderRadius: 14, padding: 14, marginBottom: 12, border: "1px solid #DDD8C8" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#5A6B4A", marginBottom: 10, fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", display: "flex", alignItems: "center", gap: 6 }}>
            <IconUser size={17} color="#5A6B4A" /> Контактна особа
          </div>
          <Input label="Ім'я" value={contactForm.name} onChange={v => setC("name", v)} required placeholder="Іван Петренко" />
          <Input label="Телефон" value={contactForm.phone} onChange={v => setC("phone", v)} placeholder="+380..." />
          <Input label="Примітки до контакту" value={contactForm.notes} onChange={v => setC("notes", v)} rows={2} placeholder="Нотатки..." />
        </div>
      )}

      {!isUnavailable && <GuestCounter value={form.guests} onChange={v => set("guests", v)} />}

      {!isUnavailable && nights.length > 0 && (
        <div style={{ background: "#F0EDE2", borderRadius: 14, padding: 14, marginBottom: 12, border: "1px solid #DDD8C8" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#5A6B4A", marginBottom: 10, fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", display: "flex", alignItems: "center", gap: 6 }}>
            <IconMoney size={17} color="#5A6B4A" /> Вартість проживання
          </div>
          <div style={{ marginBottom: 10 }}>
            {nights.map((n, i) => {
              const d = parseDate(n);
              const dayName = ["Нд","Пн","Вт","Ср","Чт","Пт","Сб"][d.getDay()];
              const we = isWeekend(n);
              const rate = getNightRate(form.houseId, n, housePrices);
              return (
                <div key={n} style={{
                  display: "flex", justifyContent: "space-between", padding: "4px 0",
                  fontSize: 14, color: "#5A6B4A", borderBottom: i < nights.length - 1 ? "1px solid #E0DBC8" : "none"
                }}>
                  <span>{d.getDate()} {MONTHS_GEN[d.getMonth()]} ({dayName}) {we ? <IconMoney size={12} color="#8B7D3C" /> : ""}</span>
                  <span style={{ fontWeight: 600 }}>{formatMoney(rate)}</span>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTop: "2px solid #C5BFAA" }}>
            <span style={{ fontSize: 17, fontWeight: 700, color: "#2D3A2E" }}>Загалом ({nights.length} {nightsLabel(nights.length)}):</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: "#3D5A2E" }}>{formatMoney(displayPrice)}</span>
          </div>
          <div style={{ marginTop: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="number"
                value={form.priceManual ? (form.price ?? "") : ""}
                onChange={e => {
                  const v = e.target.value;
                  if (v === "") {
                    set("priceManual", false);
                    set("price", null);
                  } else {
                    set("priceManual", true);
                    set("price", parseInt(v) || 0);
                  }
                }}
                placeholder={`Авто: ${formatMoney(defaultPrice)}`}
                style={{
                  flex: 1, padding: "10px 12px", border: "1.5px solid #C5BFAA", borderRadius: 10,
                  fontSize: 17, fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", outline: "none", color: "#2D3A2E",
                  background: form.priceManual ? "#fff" : "#F5F2EA"
                }}
              />
              {form.priceManual && (
                <button onClick={() => { set("priceManual", false); set("price", null); }} style={{
                  background: "none", border: "1px solid #C5BFAA", borderRadius: 8, padding: "8px 12px",
                  fontSize: 13, color: "#7A8B6A", cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap",
                  fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif"
                }}>Скинути</button>
              )}
            </div>
            <div style={{ fontSize: 12, color: "#9A9580", marginTop: 4 }}>
              {form.priceManual ? "Власна вартість" : "Автоматичний розрахунок"}
            </div>
          </div>
        </div>
      )}

      <Input label="Примітки" value={form.notes} onChange={v => set("notes", v)} rows={2} placeholder={isUnavailable ? "Причина недоступності..." : "Особливі побажання..."} />

      <div style={{ marginBottom: 14 }}>
        <label style={{ display: "block", marginBottom: 5, fontSize: 13, fontWeight: 700, color: "#5A6B4A", letterSpacing: 0.6, textTransform: "uppercase", fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>Коментарі</label>
        {form.comments.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            {form.comments.map(c => (
              <div key={c.id} style={{ padding: "10px 12px", background: "#F0EDE2", borderRadius: 10, marginBottom: 6, fontSize: 15, color: "#3D4A35", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ wordBreak: "break-word" }}>{c.text}</div>
                  <div style={{ fontSize: 13, color: "#7A8B6A", marginTop: 3 }}>{new Date(c.date).toLocaleString("uk-UA")}</div>
                </div>
                <button onClick={() => set("comments", form.comments.filter(x => x.id !== c.id))} style={{ background: "none", border: "none", color: "#9E4A3A", cursor: "pointer", fontSize: 18, padding: "0 4px", flexShrink: 0 }}>×</button>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <input value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Додати коментар..."
            onKeyDown={e => e.key === "Enter" && addComment()}
            style={{ flex: 1, padding: "10px 12px", border: "1.5px solid #C5BFAA", borderRadius: 12, fontSize: 17, fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", outline: "none", color: "#2D3A2E" }} />
          <Button variant="secondary" onClick={addComment} style={{ padding: "10px 14px", flexShrink: 0 }}>+</Button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
        <Button disabled={!valid} full onClick={handleSave}>
          {isEdit ? "Зберегти зміни" : isUnavailable ? "Позначити недоступним" : "Створити бронювання"}
        </Button>
        {isEdit && <Button variant="danger" full onClick={() => onDelete(booking.id)}>Видалити</Button>}
        <Button variant="secondary" full onClick={onClose}>Скасувати</Button>
      </div>
    </div>
  );
}

// Generate a stable muted color from contact name
function getNameColor(name) {
  if (!name) return "#7A8B6A";
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 45%, 38%)`;
}

// ── CALENDAR GRID ──
function CalendarGrid({ year, month, bookings, house, onDayClick, contacts }) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const totalDays = lastDay.getDate();
  const today = formatDate(new Date());

  const getBookingsForDay = (dayStr) => bookings.filter(b => b.houseId === house.id && dayStr >= b.checkIn && dayStr < b.checkOut);

  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(<div key={`e${i}`} />);

  for (let d = 1; d <= totalDays; d++) {
    const dayStr = `${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    const dayBookings = getBookingsForDay(dayStr);
    const isToday = dayStr === today;
    const hasBooking = dayBookings.length > 0;
    const topBooking = dayBookings[0];
    const sc = topBooking ? STATUS_COLORS[topBooking.status] : null;
    const isCheckIn = hasBooking && dayBookings.some(b => b.checkIn === dayStr);

    cells.push(
      <div key={d} onClick={() => onDayClick(dayStr, house.id, dayBookings)} style={{
        padding: "4px 2px", minHeight: 48, borderRadius: 8, cursor: "pointer",
        background: hasBooking ? sc.bg : "#FAFAF5",
        border: hasBooking ? `1.5px solid ${sc.border}44` : "1px solid #E0DBC8",
        transition: "all 0.1s", WebkitTapHighlightColor: "transparent",
        position: "relative",
      }}>
        {isCheckIn && (
          <div style={{ position: "absolute", top: 3, right: 3, width: 5, height: 5, borderRadius: "50%", background: sc.border }} />
        )}
        <div style={{ fontSize: 15, fontWeight: isToday ? 800 : 500, textAlign: "center", color: isToday ? "#6B5D1C" : hasBooking ? sc.text : "#5A6B4A", fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", marginTop: 4, marginBottom: 6 }}>{d}</div>
        {hasBooking && (
          <div style={{ marginTop: 2, padding: "0 3px", display: "flex", flexDirection: "column", gap: 2 }}>
            {dayBookings.map(b => {
              const contact = contacts.find(c => c.id === b.contactId);
              const color = b.status === "unavailable" ? "#9E4A3A" : getNameColor(contact?.name);
              const label = b.status === "unavailable" ? "✕" : shortName(contact?.name, 6);
              const isStart = b.checkIn === dayStr;
              return (
                <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <div style={{
                    fontSize: 8, fontWeight: 800, color: color, lineHeight: 1,
                    fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%", textAlign: "center",
                  }}>{label}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1, marginBottom: 3 }}>
        {DAYS_SHORT.map(d => (<div key={d} style={{ textAlign: "center", fontSize: 12, fontWeight: 700, color: "#9A9580", padding: "4px 0", fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>{d}</div>))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>{cells}</div>
    </div>
  );
}

// ── ANALYTICS VIEW ──
function Analytics({ bookings, contacts, year: initYear, month: initMonth }) {
  const [aYear, setAYear] = useState(initYear);
  const [aMonth, setAMonth] = useState(initMonth);
  const [aMode, setAMode] = useState("month"); // "month" | "year"

  const prevMonth = () => { if (aMonth === 0) { setAMonth(11); setAYear(y=>y-1); } else setAMonth(m=>m-1); };
  const nextMonth = () => { if (aMonth === 11) { setAMonth(0); setAYear(y=>y+1); } else setAMonth(m=>m+1); };
  const prevYear = () => setAYear(y => y - 1);
  const nextYear = () => setAYear(y => y + 1);

  const daysInMonth = new Date(aYear, aMonth + 1, 0).getDate();
  const monthStart = `${aYear}-${String(aMonth+1).padStart(2,"0")}-01`;
  const monthEnd = `${aYear}-${String(aMonth+1).padStart(2,"0")}-${String(daysInMonth).padStart(2,"0")}`;

  // Get detailed stats for a house in a given month
  const getHouseMonthStats = (houseId, y, m) => {
    const dim = new Date(y, m + 1, 0).getDate();
    const mStart = `${y}-${String(m+1).padStart(2,"0")}-01`;
    const mEnd = `${y}-${String(m+1).padStart(2,"0")}-${String(dim).padStart(2,"0")}`;
    const nextFirst = formatDate(new Date(y, m + 1, 1));
    const houseBookings = bookings.filter(b =>
      b.houseId === houseId && b.checkIn < nextFirst && b.checkOut > mStart
    );

    let bookedNights = 0, pendingNights = 0, unavailableNights = 0, revenue = 0;
    let weekendNights = 0, weekdayNights = 0;
    const guestIds = new Set();

    const bookingDetails = houseBookings.map(b => {
      const allNights = eachNight(b.checkIn, b.checkOut);
      const monthNights = allNights.filter(n => n >= mStart && n <= mEnd);
      const nightsInMonth = monthNights.length;
      const weNights = monthNights.filter(n => isWeekend(n)).length;
      const wdNights = nightsInMonth - weNights;

      let bookingRevenue = 0;
      if (b.price != null && allNights.length > 0 && b.status !== "unavailable") {
        bookingRevenue = Math.round((b.price / allNights.length) * nightsInMonth);
      }

      if (b.status === "booked") { bookedNights += nightsInMonth; revenue += bookingRevenue; }
      else if (b.status === "pending") { pendingNights += nightsInMonth; revenue += bookingRevenue; }
      else if (b.status === "unavailable") { unavailableNights += nightsInMonth; }

      if (b.status !== "unavailable") {
        weekendNights += weNights;
        weekdayNights += wdNights;
        if (b.contactId) guestIds.add(b.contactId);
      }

      const contact = contacts.find(c => c.id === b.contactId);
      return {
        ...b, nightsInMonth, weNights, wdNights, bookingRevenue,
        contactName: b.status === "unavailable" ? "Недоступно" : shortName(contact?.name),
        totalNights: allNights.length,
      };
    }).sort((a, b) => a.checkIn > b.checkIn ? 1 : -1);

    const totalOccupied = bookedNights + pendingNights + unavailableNights;
    const freeNights = dim - totalOccupied;
    const occupancy = dim > 0 ? Math.round((totalOccupied / dim) * 100) : 0;
    const avgPerNight = (bookedNights + pendingNights) > 0 ? Math.round(revenue / (bookedNights + pendingNights)) : 0;
    const checkIns = houseBookings.filter(b => b.checkIn >= mStart && b.checkIn <= mEnd && b.status !== "unavailable").length;

    return {
      bookingDetails, bookedNights, pendingNights, unavailableNights, freeNights,
      totalOccupied, occupancy, revenue, avgPerNight,
      weekendNights, weekdayNights, guests: guestIds.size, checkIns, daysInMonth: dim,
    };
  };

  // Current month stats
  const allStats = HOUSES.map(h => ({ house: h, stats: getHouseMonthStats(h.id, aYear, aMonth) }));

  const summary = {
    totalRevenue: allStats.reduce((s, h) => s + h.stats.revenue, 0),
    totalBookedNights: allStats.reduce((s, h) => s + h.stats.bookedNights, 0),
    totalPendingNights: allStats.reduce((s, h) => s + h.stats.pendingNights, 0),
    totalUnavailableNights: allStats.reduce((s, h) => s + h.stats.unavailableNights, 0),
    totalFreeNights: allStats.reduce((s, h) => s + h.stats.freeNights, 0),
    totalCheckIns: allStats.reduce((s, h) => s + h.stats.checkIns, 0),
    avgOccupancy: allStats.length > 0 ? Math.round(allStats.reduce((s, h) => s + h.stats.occupancy, 0) / allStats.length) : 0,
  };

  // Yearly data for charts
  const yearlyData = useMemo(() => {
    return Array.from({ length: 12 }, (_, m) => {
      const row = { month: MONTHS[m].substring(0, 3), monthIdx: m };
      let totalRev = 0, totalOcc = 0;
      HOUSES.forEach(h => {
        const s = getHouseMonthStats(h.id, aYear, m);
        row[`rev_${h.id}`] = s.revenue;
        row[`occ_${h.id}`] = s.occupancy;
        row[`nights_${h.id}`] = s.bookedNights + s.pendingNights;
        totalRev += s.revenue;
        totalOcc += s.occupancy;
      });
      row.totalRev = totalRev;
      row.avgOcc = HOUSES.length > 0 ? Math.round(totalOcc / HOUSES.length) : 0;
      return row;
    });
  }, [bookings, aYear]);

  // Yearly totals
  const yearTotals = useMemo(() => {
    let rev = 0, nights = 0, guests = new Set(), checkIns = 0;
    HOUSES.forEach(h => {
      for (let m = 0; m < 12; m++) {
        const s = getHouseMonthStats(h.id, aYear, m);
        rev += s.revenue;
        nights += s.bookedNights + s.pendingNights;
        checkIns += s.checkIns;
      }
    });
    // Count unique guests for the year
    bookings.forEach(b => {
      if (b.checkIn.startsWith(String(aYear)) && b.contactId && b.status !== "unavailable") {
        guests.add(b.contactId);
      }
    });
    const avgOcc = yearlyData.reduce((s, d) => s + d.avgOcc, 0) / 12;
    return { rev, nights, guests: guests.size, checkIns, avgOcc: Math.round(avgOcc) };
  }, [bookings, aYear, yearlyData]);

  const StatRow = ({ label, value, color, bold }) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #E0DBC8" }}>
      <span style={{ fontSize: 14, color: "#5A6B4A", fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: bold ? 800 : 600, color: color || "#2D3A2E", fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>{value}</span>
    </div>
  );

  const OccupancyBar = ({ occupancy, color, accent }) => (
    <div style={{ height: 24, background: "#E0DBC8", borderRadius: 8, overflow: "hidden", position: "relative" }}>
      <div style={{ width: `${occupancy}%`, height: "100%", borderRadius: 8, background: `linear-gradient(90deg, ${color}, ${accent})`, transition: "width 0.3s" }} />
      <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 13, fontWeight: 700, color: occupancy > 50 ? "#fff" : "#5A6B4A" }}>{occupancy}%</span>
    </div>
  );

  // Revenue chart - simple bars
  const maxMonthRev = Math.max(...yearlyData.map(d => d.totalRev), 1);

  // Yearly per-house stats (for year mode cards)
  const yearlyHouseStats = useMemo(() => {
    return HOUSES.map(house => {
      let rev = 0, bookedN = 0, pendingN = 0, unavailN = 0, freeN = 0;
      let weN = 0, wdN = 0, checkIns = 0;
      const guestIds = new Set();
      const allBookingDetails = [];
      for (let m = 0; m < 12; m++) {
        const s = getHouseMonthStats(house.id, aYear, m);
        rev += s.revenue;
        bookedN += s.bookedNights;
        pendingN += s.pendingNights;
        unavailN += s.unavailableNights;
        freeN += s.freeNights;
        weN += s.weekendNights;
        wdN += s.weekdayNights;
        checkIns += s.checkIns;
      }
      // Unique guests for the year per house
      bookings.forEach(b => {
        if (b.houseId === house.id && b.checkIn.startsWith(String(aYear)) && b.contactId && b.status !== "unavailable") {
          guestIds.add(b.contactId);
        }
      });
      const totalDays = yearlyData.reduce((s, d) => s, 0) || 365;
      const daysInYear = (aYear % 4 === 0 && (aYear % 100 !== 0 || aYear % 400 === 0)) ? 366 : 365;
      const totalOccupied = bookedN + pendingN + unavailN;
      const occupancy = daysInYear > 0 ? Math.round((totalOccupied / daysInYear) * 100) : 0;
      const avgPerNight = (bookedN + pendingN) > 0 ? Math.round(rev / (bookedN + pendingN)) : 0;
      return {
        house, revenue: rev, bookedNights: bookedN, pendingNights: pendingN, unavailableNights: unavailN,
        freeNights: freeN, weekendNights: weN, weekdayNights: wdN, checkIns, guests: guestIds.size,
        occupancy, avgPerNight, daysInYear,
      };
    });
  }, [bookings, aYear, yearlyData]);

  return (
    <div>
      {/* Mode toggle */}
      <div style={{ display: "flex", background: "#E0DBC8", borderRadius: 12, padding: 3, marginBottom: 14 }}>
        {[{ id: "month", label: "За місяць" }, { id: "year", label: "За рік" }].map(t => (
          <button key={t.id} onClick={() => setAMode(t.id)} style={{
            flex: 1, padding: "9px 0", borderRadius: 10, border: "none", fontSize: 15, fontWeight: 700,
            fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", cursor: "pointer", transition: "all 0.15s",
            background: aMode === t.id ? "#FAFAF5" : "transparent",
            color: aMode === t.id ? "#2D3A2E" : "#7A8B6A",
            boxShadow: aMode === t.id ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
          }}>{t.label}</button>
        ))}
      </div>

      {/* Navigation */}
      {aMode === "month" ? (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <button onClick={prevMonth} style={{ background: "#FAFAF5", border: "1px solid #DDD8C8", borderRadius: 10, width: 42, height: 42, fontSize: 18, cursor: "pointer", color: "#5A6B4A" }}>‹</button>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 20, color: "#2D3A2E" }}>{MONTHS[aMonth]}</div>
            <div style={{ fontSize: 14, color: "#7A8B6A" }}>{aYear} · {daysInMonth} днів</div>
          </div>
          <button onClick={nextMonth} style={{ background: "#FAFAF5", border: "1px solid #DDD8C8", borderRadius: 10, width: 42, height: 42, fontSize: 18, cursor: "pointer", color: "#5A6B4A" }}>›</button>
        </div>
      ) : (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <button onClick={prevYear} style={{ background: "#FAFAF5", border: "1px solid #DDD8C8", borderRadius: 10, width: 42, height: 42, fontSize: 18, cursor: "pointer", color: "#5A6B4A" }}>‹</button>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 24, color: "#2D3A2E" }}>{aYear}</div>
            <div style={{ fontSize: 14, color: "#7A8B6A" }}>Річна аналітика</div>
          </div>
          <button onClick={nextYear} style={{ background: "#FAFAF5", border: "1px solid #DDD8C8", borderRadius: 10, width: 42, height: 42, fontSize: 18, cursor: "pointer", color: "#5A6B4A" }}>›</button>
        </div>
      )}

      {/* ══════ MONTHLY VIEW ══════ */}
      {aMode === "month" && <>

      {/* ── Summary across all houses ── */}
      <div style={{ background: "#FAFAF5", borderRadius: 20, padding: "20px", marginBottom: 16, border: "1px solid #E8E2CC", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
        {/* Hero: Donut chart + legend */}
        {(() => {
          const pieData = [
            { n: summary.totalBookedNights, label: "Заброньовано", color: "#4A6741" },
            { n: summary.totalPendingNights, label: "Очікується", color: "#BFA84F" },
            { n: summary.totalFreeNights, label: "Вільно", color: "#C5BFAA" },
            { n: summary.totalUnavailableNights, label: "Недоступно", color: "#C4816C" },
          ].sort((a, b) => b.n - a.n);
          const total = pieData.reduce((s, d) => s + d.n, 0) || 1;
          const cx = 50, cy = 50, r = 38, stroke = 18;
          const circumference = 2 * Math.PI * r;
          let offset = circumference * 0.25;
          const segments = pieData.filter(d => d.n > 0).map(d => {
            const frac = d.n / total;
            const dash = frac * circumference;
            const gap = circumference - dash;
            const seg = { ...d, dasharray: `${dash} ${gap}`, dashoffset: offset };
            offset -= dash;
            return seg;
          });
          return (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: "#9A9580", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4, fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>Загальний дохід</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#2D3A2E", fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", lineHeight: 1.1, marginBottom: 16 }}>{summary.totalRevenue > 0 ? formatMoney(summary.totalRevenue) : "—"}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                <div style={{ width: 150, height: 150, flexShrink: 0 }}>
                  <svg viewBox="0 0 100 100" style={{ width: 150, height: 150, transform: "rotate(-90deg)" }}>
                    <circle cx={cx} cy={cy} r={r} fill="none" stroke="#E8E2CC" strokeWidth={stroke} />
                    {segments.map(s => (
                      <circle key={s.label} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth={stroke}
                        strokeDasharray={s.dasharray} strokeDashoffset={s.dashoffset}
                        style={{ transition: "stroke-dasharray 0.5s, stroke-dashoffset 0.5s" }} />
                    ))}
                  </svg>
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                  {pieData.map((s, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 5, background: s.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#2D3A2E", fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", minWidth: 20 }}>{s.n}</span>
                      <span style={{ fontSize: 13, color: "#9A9580", fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>{s.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Key metrics row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
          {[
            { n: summary.totalCheckIns, label: "Заїздів", icon: <IconCalendar size={17} color="#5A6B4A" /> },
            { n: `${summary.avgOccupancy}%`, label: "Заповненість", icon: <IconChart size={17} color="#5A6B4A" /> },
          ].map((s, i) => (
            <div key={i} style={{ background: "#F0EDE2", borderRadius: 12, padding: "12px 8px", textAlign: "center" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                {s.icon}
                <div style={{ fontSize: 20, fontWeight: 800, color: "#2D3A2E", fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", lineHeight: 1 }}>{s.n}</div>
              </div>
              <div style={{ fontSize: 11, color: "#9A9580", fontWeight: 600, marginTop: 4, textTransform: "uppercase", letterSpacing: 0.3 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Revenue per house */}
        <div>
          <div style={{ fontSize: 12, color: "#9A9580", fontWeight: 700, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>Дохід по будинках</div>
          {allStats.map(({ house, stats }) => {
            const pct = summary.totalRevenue > 0 ? (stats.revenue / summary.totalRevenue) * 100 : 0;
            return (
              <div key={house.id} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 5, background: house.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#2D3A2E", fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>{house.name}</span>
                  </div>
                  <span style={{ fontSize: 15, fontWeight: 800, color: "#2D3A2E", fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>
                    {stats.revenue > 0 ? formatMoney(stats.revenue) : "—"}
                  </span>
                </div>
                <div style={{ height: 12, background: "#E8E2CC", borderRadius: 6, overflow: "hidden" }}>
                  <div style={{
                    width: `${pct}%`, height: "100%", borderRadius: 6,
                    background: `linear-gradient(90deg, ${house.color}, ${house.accent})`,
                    transition: "width 0.4s ease"
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Per-house details ── */}
      <div className="analytics-view">
      {allStats.map(({ house, stats }) => (
        <div key={house.id} style={{ background: "#FAFAF5", borderRadius: 14, overflow: "hidden", border: "1px solid #DDD8C8", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", marginBottom: 14 }}>
          <div style={{ padding: "10px 14px", background: house.color, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <HouseIcon houseId={house.id} size={20} color="rgba(255,255,255,0.8)" />
              <span style={{ color: "#fff", fontWeight: 700, fontSize: 17, fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>{house.name}</span>
            </div>
            <span style={{ background: "rgba(255,255,255,0.2)", padding: "2px 10px", borderRadius: 12, fontSize: 13, color: "#fff", fontWeight: 700 }}>
              {stats.occupancy}%
            </span>
          </div>
          <div style={{ padding: 16 }}>
            <OccupancyBar occupancy={stats.occupancy} color={house.color} accent={house.accent} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, margin: "14px 0" }}>
              <div style={{ background: "#F0EDE2", borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#3D5A2E" }}>{stats.revenue > 0 ? formatMoney(stats.revenue) : "—"}</div>
                <div style={{ fontSize: 12, color: "#7A8B6A", fontWeight: 600 }}>Дохід</div>
              </div>
              <div style={{ background: "#F0EDE2", borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#3D5A2E" }}>{stats.avgPerNight > 0 ? formatMoney(stats.avgPerNight) : "—"}</div>
                <div style={{ fontSize: 12, color: "#7A8B6A", fontWeight: 600 }}>Сер. за ніч</div>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <StatRow label="Заброньовано ночей" value={stats.bookedNights} color="#4A6741" />
              <StatRow label="Очікується ночей" value={stats.pendingNights} color="#8B7D3C" />
              <StatRow label="Недоступно ночей" value={stats.unavailableNights} color="#9E4A3A" />
              <StatRow label="Вільно ночей" value={stats.freeNights} color="#7A8B6A" />
              <StatRow label="Будні / Вихідні" value={`${stats.weekdayNights} / ${stats.weekendNights}`} />
              <StatRow label="Кількість заїздів" value={stats.checkIns} bold />
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <div style={{ flex: 1, background: "#F0EDE2", borderRadius: 8, padding: "6px 10px", textAlign: "center" }}>
                <div style={{ fontSize: 12, color: "#7A8B6A", fontWeight: 600 }}>Пн–Чт</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#3D5A2E" }}>{formatMoney(house.weekday)}</div>
              </div>
              <div style={{ flex: 1, background: "#F0EDE2", borderRadius: 8, padding: "6px 10px", textAlign: "center" }}>
                <div style={{ fontSize: 12, color: "#7A8B6A", fontWeight: 600 }}>Пт–Нд</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#3D5A2E" }}>{formatMoney(house.weekend)}</div>
              </div>
            </div>

            {stats.bookingDetails.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#5A6B4A", letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 10, fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>Бронювання</div>
                {stats.bookingDetails.map(b => {
                  const sc = STATUS_COLORS[b.status];
                  return (
                    <div key={b.id} style={{
                      padding: "8px 10px", background: sc.bg, borderRadius: 8, marginBottom: 6,
                      borderLeft: `3px solid ${sc.border}`, fontSize: 14, fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: 700, color: sc.text }}>{b.contactName}</span>
                        {b.status !== "unavailable" && b.bookingRevenue > 0 && (
                          <span style={{ fontWeight: 700, color: "#3D5A2E", fontSize: 14 }}>{formatMoney(b.bookingRevenue)}</span>
                        )}
                      </div>
                      <div style={{ color: "#7A8B6A", fontSize: 13, marginTop: 2 }}>
                        {displayDate(b.checkIn)} — {displayDate(b.checkOut)} · {b.nightsInMonth === b.totalNights ? `${b.totalNights} ${nightsLabel(b.totalNights)}` : `${b.nightsInMonth} з ${b.totalNights} ${nightsLabel(b.totalNights)}`}
                        {b.guests > 1 ? ` · ${b.guests} гостей` : ""}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {stats.bookingDetails.length === 0 && (
              <div style={{ textAlign: "center", padding: "16px 0", color: "#9A9580", fontSize: 14 }}>
                Немає бронювань
              </div>
            )}
          </div>
        </div>
      ))}
      </div>

      </>}

      {/* ══════ YEARLY VIEW ══════ */}
      {aMode === "year" && <>

      {/* ── Yearly summary card ── */}
      <div style={{ background: "#FAFAF5", borderRadius: 20, padding: "20px 18px", marginBottom: 16, border: "1px solid #E8E2CC", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 13, color: "#7A8B6A", fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>Зведення за рік</div>
            <div style={{ fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 22, color: "#2D3A2E", fontWeight: 800, marginTop: 2 }}>{aYear}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#4A6741", fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>{yearTotals.rev > 0 ? formatMoney(yearTotals.rev) : "—"}</div>
            <div style={{ fontSize: 12, color: "#7A8B6A", fontWeight: 600 }}>Загальний дохід</div>
          </div>
        </div>

        {/* Key year metrics */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 18 }}>
          {[
            { n: yearTotals.nights, label: "Ночей" },
            { n: yearTotals.checkIns, label: "Заїздів" },
            { n: yearTotals.guests, label: "Гостей" },
            { n: `${yearTotals.avgOcc}%`, label: "Заповн." },
          ].map((s, i) => (
            <div key={i} style={{ background: "#F0EDE2", borderRadius: 10, padding: "10px 6px", textAlign: "center" }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: "#2D3A2E", fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>{s.n}</div>
              <div style={{ fontSize: 11, color: "#7A8B6A", fontWeight: 600, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Revenue bar chart */}
        <div style={{ marginBottom: 24, paddingTop: 6 }}>
          <div style={{ fontSize: 12, color: "#7A8B6A", fontWeight: 600, marginBottom: 14, textTransform: "uppercase", letterSpacing: 0.4 }}>Дохід по місяцях</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 100, padding: "0 4px" }}>
            {yearlyData.map((d, i) => {
              const h = maxMonthRev > 0 ? Math.max((d.totalRev / maxMonthRev) * 88, d.totalRev > 0 ? 4 : 0) : 0;
              return (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, cursor: "pointer" }} onClick={() => { setAMonth(i); setAMode("month"); }}>
                  <div style={{
                    width: "70%", height: h, borderRadius: 4,
                    background: "#6B8F3C",
                    opacity: 0.7,
                    transition: "all 0.2s",
                    minWidth: 0,
                  }} />
                  <div style={{ fontSize: 10, color: "#7A8B6A", fontWeight: 500, fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>{d.month}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Occupancy bar chart */}
        <div style={{ marginBottom: 24, paddingTop: 6 }}>
          <div style={{ fontSize: 12, color: "#7A8B6A", fontWeight: 600, marginBottom: 14, textTransform: "uppercase", letterSpacing: 0.4 }}>Заповненість по місяцях</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 80, padding: "0 4px" }}>
            {yearlyData.map((d, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, cursor: "pointer" }} onClick={() => { setAMonth(i); setAMode("month"); }}>
                <div style={{ fontSize: 10, color: d.avgOcc > 0 ? "#5A6B4A" : "transparent", fontWeight: 700 }}>{d.avgOcc}%</div>
                <div style={{
                  width: "70%", height: Math.max(d.avgOcc * 0.6, d.avgOcc > 0 ? 3 : 0), borderRadius: 4,
                  background: "#BFA84F",
                  opacity: 0.6,
                  transition: "all 0.2s",
                }} />
                <div style={{ fontSize: 10, color: "#7A8B6A", fontWeight: 500 }}>{d.month}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Revenue per house mini-chart */}
        <div style={{ borderTop: "1px solid #E0DBC8", paddingTop: 20 }}>
          <div style={{ fontSize: 12, color: "#7A8B6A", fontWeight: 600, marginBottom: 14, textTransform: "uppercase", letterSpacing: 0.4 }}>Дохід по будинках</div>
          {yearlyHouseStats.map(({ house, revenue }) => (
            <div key={house.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 70, fontSize: 13, color: "#5A6B4A", fontWeight: 600, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{house.name.split(" ")[0]}</div>
              <div style={{ flex: 1, height: 26, background: "#F0EDE2", borderRadius: 8, overflow: "hidden" }}>
                <div style={{
                  width: yearTotals.rev > 0 ? `${(revenue / yearTotals.rev) * 100}%` : "0%",
                  height: "100%", borderRadius: 8,
                  background: `linear-gradient(90deg, ${house.color}, ${house.accent})`,
                  transition: "width 0.3s"
                }} />
              </div>
              <div style={{ width: 80, textAlign: "right", fontSize: 14, fontWeight: 700, color: "#2D3A2E", flexShrink: 0 }}>
                {revenue > 0 ? formatMoney(revenue) : "—"}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Per-house yearly details ── */}
      <div className="analytics-view">
      {yearlyHouseStats.map(({ house, revenue, bookedNights, pendingNights, unavailableNights, freeNights, weekendNights, weekdayNights, checkIns, guests, occupancy, avgPerNight, daysInYear }) => (
        <div key={house.id} style={{ background: "#FAFAF5", borderRadius: 14, overflow: "hidden", border: "1px solid #DDD8C8", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", marginBottom: 14 }}>
          <div style={{ padding: "10px 14px", background: house.color, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <HouseIcon houseId={house.id} size={20} color="rgba(255,255,255,0.8)" />
              <span style={{ color: "#fff", fontWeight: 700, fontSize: 17, fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>{house.name}</span>
            </div>
            <span style={{ background: "rgba(255,255,255,0.2)", padding: "2px 10px", borderRadius: 12, fontSize: 13, color: "#fff", fontWeight: 700 }}>
              {occupancy}%
            </span>
          </div>
          <div style={{ padding: 16 }}>
            <OccupancyBar occupancy={occupancy} color={house.color} accent={house.accent} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, margin: "14px 0" }}>
              <div style={{ background: "#F0EDE2", borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#3D5A2E" }}>{revenue > 0 ? formatMoney(revenue) : "—"}</div>
                <div style={{ fontSize: 12, color: "#7A8B6A", fontWeight: 600 }}>Дохід</div>
              </div>
              <div style={{ background: "#F0EDE2", borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#3D5A2E" }}>{avgPerNight > 0 ? formatMoney(avgPerNight) : "—"}</div>
                <div style={{ fontSize: 12, color: "#7A8B6A", fontWeight: 600 }}>Сер. за ніч</div>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <StatRow label="Заброньовано ночей" value={bookedNights} color="#4A6741" />
              <StatRow label="Очікується ночей" value={pendingNights} color="#8B7D3C" />
              <StatRow label="Недоступно ночей" value={unavailableNights} color="#9E4A3A" />
              <StatRow label="Вільно ночей" value={freeNights} color="#7A8B6A" />
              <StatRow label="Будні / Вихідні" value={`${weekdayNights} / ${weekendNights}`} />
              <StatRow label="Кількість заїздів" value={checkIns} bold />
            </div>

            {/* Per-month revenue mini-chart for this house */}
            <div style={{ marginBottom: 8, marginTop: 4 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#5A6B4A", letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 12, fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>Дохід по місяцях</div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 70 }}>
                {yearlyData.map((d, i) => {
                  const hRev = d[`rev_${house.id}`] || 0;
                  const maxHRev = Math.max(...yearlyData.map(dd => dd[`rev_${house.id}`] || 0), 1);
                  const barH = maxHRev > 0 ? Math.max((hRev / maxHRev) * 58, hRev > 0 ? 3 : 0) : 0;
                  return (
                    <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer" }} onClick={() => { setAMonth(i); setAMode("month"); }}>
                      <div style={{ width: "100%", height: barH, borderRadius: 4, background: house.color, opacity: 0.6, transition: "all 0.2s" }} />
                      <div style={{ fontSize: 9, color: "#9A9580", fontWeight: 500 }}>{d.month}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ))}
      </div>

      </>}
    </div>
  );
}

// ── SETTINGS ──
const DAY_LABELS_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];
const DAY_KEYS_ORDERED = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

function PriceEditor({ housePrices, onSave, onBack }) {
  const defaults = getDefaultHousePrices();
  const [prices, setPrices] = useState(() => {
    const p = {};
    HOUSES.forEach(h => {
      p[h.id] = {};
      DAY_KEYS_ORDERED.forEach(k => {
        p[h.id][k] = housePrices?.[h.id]?.[k] ?? defaults[h.id][k];
      });
    });
    return p;
  });
  const [saved, setSaved] = useState(false);

  const setPrice = (houseId, dayKey, val) => {
    setPrices(prev => ({ ...prev, [houseId]: { ...prev[houseId], [dayKey]: val === "" ? "" : Number(val) } }));
    setSaved(false);
  };

  const handleSave = async () => {
    const clean = {};
    HOUSES.forEach(h => {
      clean[h.id] = {};
      DAY_KEYS_ORDERED.forEach(k => {
        clean[h.id][k] = prices[h.id][k] === "" ? 0 : Number(prices[h.id][k]);
      });
    });
    await onSave(clean);
    setSaved(true);
    setTimeout(() => { setSaved(false); onBack(); }, 1000);
  };

  return (
    <div>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "#5A6B4A", fontSize: 14, fontWeight: 700, cursor: "pointer", marginBottom: 12, padding: 0, fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>← Назад</button>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#5A6B4A", marginBottom: 14, letterSpacing: 0.5, textTransform: "uppercase", fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>
        Вартість за ніч (₴)
      </div>
      {HOUSES.map(house => (
        <div key={house.id} style={{ background: "#FAFAF5", borderRadius: 14, overflow: "hidden", border: "1px solid #DDD8C8", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", marginBottom: 12 }}>
          <div style={{ padding: "10px 14px", background: house.color, display: "flex", alignItems: "center", gap: 8 }}>
            <HouseIcon houseId={house.id} size={20} color="rgba(255,255,255,0.8)" />
            <span style={{ color: "#fff", fontWeight: 700, fontSize: 17, fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>{house.name}</span>
          </div>
          <div style={{ padding: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
              {DAY_KEYS_ORDERED.map((k, i) => (
                <div key={k} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: i >= 4 ? "#8B7D3C" : "#7A8B6A", marginBottom: 4, fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>{DAY_LABELS_SHORT[i]}</div>
                  <input
                    type="text" inputMode="numeric"
                    value={prices[house.id][k]}
                    onChange={e => setPrice(house.id, k, e.target.value.replace(/\D/g, ""))}
                    style={{
                      width: "100%", padding: "8px 2px", fontSize: 13, fontWeight: 700, textAlign: "center",
                      border: "1.5px solid #DDD8C8", borderRadius: 8, background: i >= 4 ? "#FBF8EE" : "#fff",
                      color: "#2D3A2E", outline: "none", fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
      <button onClick={handleSave} style={{
        width: "100%", padding: 14, borderRadius: 14, border: "none",
        background: saved ? "#4A6741" : "#4A5A3C", color: "#E8E2CC", fontSize: 16, fontWeight: 700,
        cursor: "pointer", fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
        transition: "all 0.2s",
      }}>{saved ? "✓ Збережено" : "Зберегти"}</button>
    </div>
  );
}

function IconEdit({ size = 16, color = "currentColor" }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>);
}

function Settings({ housePrices, onSave }) {
  const [editing, setEditing] = useState(false);
  const defaults = getDefaultHousePrices();

  if (editing) return <PriceEditor housePrices={housePrices} onSave={onSave} onBack={() => setEditing(false)} />;

  const hp = housePrices || defaults;

  return (
    <div>
      {/* Prices section */}
      <div style={{ background: "#FAFAF5", borderRadius: 14, border: "1px solid #DDD8C8", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", marginBottom: 12, overflow: "hidden" }}>
        <div style={{ padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #DDD8C8" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#5A6B4A", letterSpacing: 0.5, textTransform: "uppercase", fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>
            Вартість за ніч
          </div>
          <button onClick={() => setEditing(true)} style={{ background: "none", border: "1.5px solid #C5BFAA", borderRadius: 8, padding: "5px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: "#5A6B4A", fontSize: 13, fontWeight: 600, fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>
            <IconEdit size={14} color="#5A6B4A" /> Змінити
          </button>
        </div>
        {HOUSES.map((house, hi) => (
          <div key={house.id} style={{ padding: "10px 14px", borderBottom: hi < HOUSES.length - 1 ? "1px solid #E0DBC8" : "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <HouseIcon houseId={house.id} size={18} color={house.color} />
              <span style={{ fontWeight: 700, fontSize: 15, color: "#2D3A2E", fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>{house.name}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
              {DAY_KEYS_ORDERED.map((k, i) => {
                const val = hp[house.id]?.[k] ?? defaults[house.id][k];
                return (
                  <div key={k} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: i >= 4 ? "#8B7D3C" : "#9A9580", marginBottom: 2, fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>{DAY_LABELS_SHORT[i]}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#2D3A2E", fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>{(val / 1000).toFixed(1)}к</div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── MAIN APP ──
export default function GuestHouseApp() {
  const [authChecked, setAuthChecked] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);

  const {
    bookings, contacts, cancellations, housePrices, loading,
    saveBooking: fbSaveBooking,
    deleteBooking: fbDeleteBooking,
    saveContact: fbSaveContact,
    saveHousePrices: fbSaveHousePrices,
  } = useFirestoreData();

  const [view, setView] = useState("calendar");
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [modal, setModal] = useState(null);
  const [activeHouse, setActiveHouse] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [listMode, setListMode] = useState("all"); // "all" | "month" | "year"
  const [listSubView, setListSubView] = useState("bookings");

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("dusha_auth") === "1") setAuthed(true);
    setAuthChecked(true);
  }, []);

  const handleLogin = () => {
    if (pin === "9094") {
      localStorage.setItem("dusha_auth", "1");
      setAuthed(true);
      setPinError(false);
    } else {
      setPinError(true);
      setPin("");
    }
  };

  if (!authChecked) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#4A5A3C", fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>
      <div style={{ textAlign: "center" }}>
        <PineTree size={48} color="#6B8F3C" />
        <div style={{ fontSize: 20, color: "#D4CCAA", marginTop: 10, letterSpacing: 0.5 }}>Душа лісу</div>
      </div>
    </div>
  );

  if (!authed) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#4A5A3C", fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>
      <div style={{ textAlign: "center", width: 260 }}>
        <PineTree size={48} color="#6B8F3C" />
        <div style={{ fontSize: 20, color: "#D4CCAA", marginTop: 10, marginBottom: 24, letterSpacing: 0.5 }}>Душа лісу</div>
        <input
          type="password" inputMode="numeric" pattern="[0-9]*" maxLength={4}
          value={pin} onChange={e => { setPin(e.target.value.replace(/\D/g, "")); setPinError(false); }}
          onKeyDown={e => e.key === "Enter" && handleLogin()}
          placeholder="Пароль"
          autoFocus
          style={{
            width: "100%", padding: "14px 16px", fontSize: 20, textAlign: "center", letterSpacing: 8,
            background: "#5A6A4C", border: pinError ? "2px solid #9E4A3A" : "2px solid #5A6B4A", borderRadius: 14,
            color: "#E8E2CC", outline: "none", fontFamily: "inherit", boxSizing: "border-box",
          }}
        />
        {pinError && <div style={{ color: "#E07A6A", fontSize: 14, marginTop: 8 }}>Невірний пароль</div>}
        <button onClick={handleLogin} style={{
          width: "100%", padding: "14px", marginTop: 14, borderRadius: 14, border: "none",
          background: "#6B8F3C", color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer",
          fontFamily: "inherit",
        }}>Увійти</button>
      </div>
    </div>
  );

  const saveContact = (c) => { fbSaveContact(c); };
  const saveBooking = (b) => { fbSaveBooking(b); setModal(null); };
  const deleteBooking = (id) => { fbDeleteBooking(id); setModal(null); };

  const handleDayClick = (dayStr, houseId, dayBookings) => {
    if (dayBookings.length === 1) setModal({ type: "editBooking", data: dayBookings[0] });
    else if (dayBookings.length > 1) setModal({ type: "dayList", data: { date: dayStr, bookings: dayBookings } });
    else setModal({ type: "newBooking", data: { houseId, checkIn: dayStr, checkOut: formatDate(new Date(parseDate(dayStr).getTime() + 86400000)) } });
  };

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y=>y-1); } else setMonth(m=>m-1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y=>y+1); } else setMonth(m=>m+1); };

  const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`;

  const listBookings = bookings.filter(b => {
    if (!b.checkIn) return false;
    if (listMode === "month" && b.checkIn.substring(0, 7) !== monthStr) return false;
    if (activeHouse && b.houseId !== activeHouse) return false;
    if (searchTerm) {
      const c = contacts.find(c => c.id === b.contactId);
      return c?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || b.notes?.toLowerCase().includes(searchTerm.toLowerCase());
    }
    return true;
  }).sort((a, b) => {
    if (listMode === "all") {
      // Sort by createdAt descending (newest first)
      const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      return bTime - aTime;
    }
    return a.checkIn > b.checkIn ? -1 : 1;
  });

  const listCancellations = cancellations.filter(c => {
    if (listMode === "month" && c.cancelMonth !== monthStr) return false;
    if (activeHouse && c.houseId !== activeHouse) return false;
    if (searchTerm) {
      const ct = contacts.find(ct => ct.id === c.contactId);
      return ct?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || c.notes?.toLowerCase().includes(searchTerm.toLowerCase());
    }
    return true;
  }).sort((a, b) => (b.cancelledAtISO || "") > (a.cancelledAtISO || "") ? 1 : -1);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#4A5A3C", fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", color: "#D4CCAA" }}>
      <div style={{ textAlign: "center" }}><PineTree size={48} color="#6B8F3C" /><div style={{ fontSize: 18, marginTop: 10 }}>Душа лісу</div></div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#F8F7F2", fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", paddingBottom: 80 }}>
      {/* HEADER */}
      <div style={{ background: "#4A5A3C", color: "#E8E2CC", padding: "14px 16px", borderBottom: "3px solid #6B8F3C", position: "sticky", top: 0, zIndex: 100 }}>
        <div className="header-inner" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <PineTree size={26} color="#6B8F3C" />
            <span style={{ fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 18, letterSpacing: 0.5 }}>Душа лісу</span>
          </div>
          <button onClick={() => setModal({ type: "newBooking", data: {} })} style={{
            background: "#6B8F3C", color: "#FAFAF5", border: "none", borderRadius: 50,
            width: 36, height: 36, fontSize: 22, fontWeight: 700, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center"
          }}>+</button>
        </div>
      </div>

      <div className="app-container">
        <div style={{ padding: "12px 16px 0" }}>
          {/* ── CALENDAR ── */}
          {view === "calendar" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <button onClick={prevMonth} style={{ background: "#FAFAF5", border: "1px solid #DDD8C8", borderRadius: 10, width: 42, height: 42, fontSize: 18, cursor: "pointer", color: "#5A6B4A" }}>‹</button>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 20, color: "#2D3A2E" }}>{MONTHS[month]}</div>
                  <div style={{ fontSize: 14, color: "#7A8B6A" }}>{year}</div>
                </div>
                <button onClick={nextMonth} style={{ background: "#FAFAF5", border: "1px solid #DDD8C8", borderRadius: 10, width: 42, height: 42, fontSize: 18, cursor: "pointer", color: "#5A6B4A" }}>›</button>
              </div>
              <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 10, scrollbarWidth: "none" }}>
                <button onClick={() => setActiveHouse(null)} style={{ padding: "7px 16px", borderRadius: 20, fontSize: 14, fontWeight: 700, border: !activeHouse ? "2px solid #4A5A3C" : "1.5px solid #C5BFAA", background: !activeHouse ? "#4A5A3C" : "#FAFAF5", color: !activeHouse ? "#E8E2CC" : "#5A6B4A", cursor: "pointer", fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", whiteSpace: "nowrap", flexShrink: 0 }}>Всі</button>
                {HOUSES.map(h => (
                  <button key={h.id} onClick={() => setActiveHouse(activeHouse === h.id ? null : h.id)} style={{ padding: "7px 16px", borderRadius: 20, fontSize: 14, fontWeight: 700, border: activeHouse === h.id ? `2px solid ${h.color}` : "1.5px solid #C5BFAA", background: activeHouse === h.id ? h.color : "#FAFAF5", color: activeHouse === h.id ? "#fff" : "#5A6B4A", cursor: "pointer", fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", whiteSpace: "nowrap", flexShrink: 0 }}>{h.name}</button>
                ))}
              </div>
              <div className="calendar-houses">
                {(activeHouse ? HOUSES.filter(h => h.id === activeHouse) : HOUSES).map(house => (
                  <div key={house.id} style={{ background: "#FAFAF5", borderRadius: 14, overflow: "hidden", border: "1px solid #DDD8C8", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                    <div style={{ padding: "10px 14px", background: house.color, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <HouseIcon houseId={house.id} size={20} color="rgba(255,255,255,0.8)" />
                        <span style={{ color: "#fff", fontWeight: 700, fontSize: 17, fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>{house.name}</span>
                      </div>
                      <span style={{ background: "rgba(255,255,255,0.2)", padding: "2px 10px", borderRadius: 12, fontSize: 13, color: "#fff", fontWeight: 600 }}>
                        {(() => { const n = bookings.filter(b => b.houseId === house.id && b.status === "booked" && b.checkOut >= formatDate(new Date())).reduce((sum, b) => sum + daysBetween(parseDate(b.checkIn), parseDate(b.checkOut)), 0); return `${n} ${nightsLabel(n)}`; })()}
                      </span>
                    </div>
                    <div style={{ padding: 10 }}>
                      <CalendarGrid year={year} month={month} bookings={bookings} house={house} onDayClick={handleDayClick} contacts={contacts} />
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 14, marginTop: 14, justifyContent: "center" }}>
                {Object.entries(STATUS_COLORS).map(([k, v]) => (
                  <div key={k} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: v.bg, border: `1.5px solid ${v.border}` }} />
                    <span style={{ fontSize: 12, color: "#5A6B4A", fontWeight: 600 }}>{v.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── LIST ── */}
          {view === "list" && (
            <div className="list-view">
              {/* Mode toggle: All / Month / Year */}
              <div style={{ display: "flex", background: "#E0DBC8", borderRadius: 12, padding: 3, marginBottom: 12 }}>
                {[{ id: "all", label: "По даті створення" }, { id: "month", label: "Помісячно" }].map(t => (
                  <button key={t.id} onClick={() => setListMode(t.id)} style={{
                    flex: 1, padding: "9px 0", borderRadius: 10, border: "none", fontSize: 15, fontWeight: 700,
                    fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", cursor: "pointer", transition: "all 0.15s",
                    background: listMode === t.id ? "#FAFAF5" : "transparent",
                    color: listMode === t.id ? "#2D3A2E" : "#7A8B6A",
                    boxShadow: listMode === t.id ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
                  }}>{t.label}</button>
                ))}
              </div>

              {/* Navigation: month or year */}
              {listMode === "month" && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <button onClick={prevMonth} style={{ background: "#FAFAF5", border: "1px solid #DDD8C8", borderRadius: 10, width: 42, height: 42, fontSize: 18, cursor: "pointer", color: "#5A6B4A" }}>‹</button>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", fontSize: 20, color: "#2D3A2E" }}>{MONTHS[month]}</div>
                    <div style={{ fontSize: 14, color: "#7A8B6A" }}>{year}</div>
                  </div>
                  <button onClick={nextMonth} style={{ background: "#FAFAF5", border: "1px solid #DDD8C8", borderRadius: 10, width: 42, height: 42, fontSize: 18, cursor: "pointer", color: "#5A6B4A" }}>›</button>
                </div>
              )}

              <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Пошук бронювань..."
                style={{ width: "100%", padding: "12px 16px", border: "1.5px solid #C5BFAA", borderRadius: 14, fontSize: 18, fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", outline: "none", color: "#2D3A2E", background: "#FAFAF5", marginBottom: 10, boxSizing: "border-box" }} />

              <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 10, scrollbarWidth: "none" }}>
                {HOUSES.map(h => (
                  <button key={h.id} onClick={() => setActiveHouse(activeHouse === h.id ? null : h.id)} style={{ padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 700, border: activeHouse === h.id ? `2px solid ${h.color}` : "1.5px solid #C5BFAA", background: activeHouse === h.id ? h.color : "#FAFAF5", color: activeHouse === h.id ? "#fff" : "#5A6B4A", cursor: "pointer", fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif", whiteSpace: "nowrap", flexShrink: 0 }}>{h.name}</button>
                ))}
              </div>

              {/* Sub-tab toggle: Bookings vs Cancellations */}
              <div style={{ display: "flex", gap: 0, marginBottom: 12, background: "#E8E2CC", borderRadius: 12, padding: 3 }}>
                {[
                  { id: "bookings", label: "Бронювання", count: listBookings.length },
                  { id: "cancellations", label: "Скасування", count: listCancellations.length },
                ].map(tab => (
                  <button key={tab.id} onClick={() => setListSubView(tab.id)} style={{
                    flex: 1, padding: "8px 12px", borderRadius: 10, fontSize: 15, fontWeight: 700,
                    border: "none", cursor: "pointer", fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif",
                    background: listSubView === tab.id ? "#FAFAF5" : "transparent",
                    color: listSubView === tab.id ? "#2D3A2E" : "#7A8B6A",
                    boxShadow: listSubView === tab.id ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                    transition: "all 0.15s",
                  }}>{tab.label} ({tab.count})</button>
                ))}
              </div>

              {/* Bookings list */}
              {listSubView === "bookings" && (
                <>
                  {listBookings.length === 0 ? (
                    <div style={{ textAlign: "center", padding: 48, color: "#7A8B6A" }}><PineTree size={40} color="#C5BFAA" /><div style={{ fontSize: 17, marginTop: 10 }}>Бронювань не знайдено</div></div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {listBookings.map(b => {
                        const house = HOUSES.find(h => h.id === b.houseId);
                        const contact = contacts.find(c => c.id === b.contactId);
                        const nights = daysBetween(parseDate(b.checkIn), parseDate(b.checkOut));
                        return (
                          <div key={b.id} onClick={() => setModal({ type: "editBooking", data: b })} style={{ background: "#FAFAF5", borderRadius: 14, padding: "14px 16px", border: "1px solid #DDD8C8", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", cursor: "pointer", borderLeft: `4px solid ${house?.color || "#ccc"}` }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                              <div style={{ fontWeight: 700, fontSize: 18, color: "#2D3A2E" }}>{b.status === "unavailable" ? "Недоступно" : (contact?.name || "?")}</div>
                              <Badge status={b.status} small />
                            </div>
                            <div style={{ fontSize: 14, color: "#5A6B4A" }}>
                              {house?.name} · {displayDate(b.checkIn)} — {displayDate(b.checkOut)} · {nights} {nightsLabel(nights)}
                            </div>
                            {b.status !== "unavailable" && b.price != null && (
                              <div style={{ fontSize: 15, fontWeight: 700, color: "#3D5A2E", marginTop: 3 }}>{formatMoney(b.price)}</div>
                            )}
                            {b.notes && <div style={{ fontSize: 13, color: "#9A9580", marginTop: 2 }}>{b.notes}</div>}
                            {b.comments?.length > 0 && <div style={{ fontSize: 13, color: "#7A8B6A", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}><IconComment size={13} color="#7A8B6A" /> {b.comments.length} {commentsLabel(b.comments.length)}</div>}
                            {(b.createdAt || b.updatedAt) && (
                              <div style={{ fontSize: 11, color: "#B0A890", marginTop: 4, lineHeight: 1.5 }}>
                                {formatTimestamp(b.createdAt) && <div>Створено: {formatTimestamp(b.createdAt)}</div>}
                                {formatTimestamp(b.updatedAt) && formatTimestamp(b.updatedAt) !== formatTimestamp(b.createdAt) && <div>Змінено: {formatTimestamp(b.updatedAt)}</div>}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}

              {/* Cancellations list */}
              {listSubView === "cancellations" && (
                <>
                  {listCancellations.length === 0 ? (
                    <div style={{ textAlign: "center", padding: 48, color: "#7A8B6A" }}><PineTree size={40} color="#C5BFAA" /><div style={{ fontSize: 17, marginTop: 10 }}>Скасувань не знайдено</div></div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {listCancellations.map(c => {
                        const house = HOUSES.find(h => h.id === c.houseId);
                        const contact = contacts.find(ct => ct.id === c.contactId);
                        const nights = c.checkIn && c.checkOut ? daysBetween(parseDate(c.checkIn), parseDate(c.checkOut)) : 0;
                        const cancelDate = c.cancelledAtISO ? new Date(c.cancelledAtISO) : (c.cancelledAt?.toDate ? c.cancelledAt.toDate() : null);
                        const cancelStr = cancelDate
                          ? `${cancelDate.getDate()} ${MONTHS_GEN[cancelDate.getMonth()]} ${cancelDate.getFullYear()}, ${String(cancelDate.getHours()).padStart(2,"0")}:${String(cancelDate.getMinutes()).padStart(2,"0")}`
                          : "—";
                        return (
                          <div key={c.id} style={{ background: "#FAFAF5", borderRadius: 14, padding: "14px 16px", border: "1px solid #DDD8C8", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", borderLeft: "4px solid #9E4A3A", opacity: 0.85 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                              <div style={{ fontWeight: 700, fontSize: 18, color: "#2D3A2E" }}>{c.status === "unavailable" ? "Недоступно" : (contact?.name || "?")}</div>
                              <span style={{ padding: "2px 8px", borderRadius: 8, fontSize: 12, fontWeight: 700, background: "#F5E6E0", color: "#9E4A3A", border: "1px solid #9E4A3A" }}>Скасовано</span>
                            </div>
                            <div style={{ fontSize: 14, color: "#5A6B4A" }}>
                              {house?.name} · {displayDate(c.checkIn)} — {displayDate(c.checkOut)} · {nights} {nightsLabel(nights)}
                            </div>
                            {c.price != null && c.status !== "unavailable" && (
                              <div style={{ fontSize: 15, fontWeight: 700, color: "#9E4A3A", marginTop: 3, textDecoration: "line-through" }}>{formatMoney(c.price)}</div>
                            )}
                            <div style={{ fontSize: 13, color: "#9A9580", marginTop: 4 }}>Скасовано: {cancelStr}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── ANALYTICS ── */}
          {view === "analytics" && <Analytics bookings={bookings} contacts={contacts} year={year} month={month} />}

          {/* ── SETTINGS ── */}
          {view === "settings" && <Settings housePrices={housePrices} onSave={fbSaveHousePrices} />}
        </div>
      </div>

      {/* BOTTOM NAV */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#FAFAF5", borderTop: "1px solid #DDD8C8", padding: "6px 0 env(safe-area-inset-bottom, 10px)", zIndex: 100 }}>
        <div className="nav-inner" style={{ display: "flex", justifyContent: "space-around" }}>
          {[
            { id: "calendar", label: "Календар" },
            { id: "list", label: "Бронювання" },
            { id: "analytics", label: "Аналітика" },
            { id: "settings", label: "Налаштування" },
          ].map(v => {
            const active = view === v.id;
            const clr = active ? "#6B8F3C" : "#5A6B4A";
            const icon = v.id === "calendar" ? <IconCalendar size={22} color={clr} filled={active} />
              : v.id === "list" ? <IconClipboard size={22} color={clr} filled={active} />
              : v.id === "analytics" ? <IconChart size={22} color={clr} filled={active} />
              : <IconSettings size={22} color={clr} filled={active} />;
            return (
              <button key={v.id} onClick={() => setView(v.id)} style={{ background: "none", border: "none", padding: "6px 16px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, transition: "all 0.15s" }}>
                {icon}
                <span style={{ fontSize: 12, fontWeight: 700, color: clr, fontFamily: "-apple-system, 'SF Pro Display', 'SF Pro Text', system-ui, sans-serif" }}>{v.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* MODALS */}
      {modal?.type === "newBooking" && (
        <Modal title="Нове бронювання" onClose={() => setModal(null)}>
          <BookingForm booking={modal.data} contacts={contacts} houses={HOUSES} allBookings={bookings}
            onSave={saveBooking} onClose={() => setModal(null)} onDelete={deleteBooking} onSaveContact={saveContact} housePrices={housePrices} />
        </Modal>
      )}
      {modal?.type === "editBooking" && (
        <Modal title="Редагувати бронювання" onClose={() => setModal(null)}>
          <BookingForm booking={modal.data} contacts={contacts} houses={HOUSES} allBookings={bookings}
            onSave={saveBooking} onClose={() => setModal(null)} onDelete={deleteBooking} onSaveContact={saveContact} housePrices={housePrices} />
        </Modal>
      )}
      {modal?.type === "dayList" && (
        <Modal title={`Бронювання на ${displayDate(modal.data.date)}`} onClose={() => setModal(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {modal.data.bookings.map(b => {
              const contact = contacts.find(c => c.id === b.contactId);
              const house = HOUSES.find(h => h.id === b.houseId);
              return (
                <div key={b.id} onClick={() => setModal({ type: "editBooking", data: b })} style={{ padding: "14px 16px", background: "#F0EDE2", borderRadius: 12, cursor: "pointer", borderLeft: `3px solid ${house?.color || "#ccc"}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 700, fontSize: 17, color: "#2D3A2E" }}>{b.status === "unavailable" ? "Недоступно" : (contact?.name || "?")}</span>
                    <Badge status={b.status} small />
                  </div>
                  <div style={{ fontSize: 14, color: "#5A6B4A", marginTop: 4 }}>{displayDate(b.checkIn)} — {displayDate(b.checkOut)}</div>
                </div>
              );
            })}
          </div>
          <Button full variant="secondary" onClick={() => setModal({ type: "newBooking", data: { checkIn: modal.data.date, checkOut: formatDate(new Date(parseDate(modal.data.date).getTime() + 86400000)) } })} style={{ marginTop: 12 }}>+ Додати бронювання</Button>
        </Modal>
      )}
    </div>
  );
}

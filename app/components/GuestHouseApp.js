"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { DayPicker } from "react-day-picker";
import { uk } from "react-day-picker/locale";
import { useFirestoreData } from "@/app/lib/hooks/useFirestoreData";

const HOUSES = [
  { id: "house1", name: "Аромат хвої", color: "#4A6741", accent: "#6B8F3C", weekday: 13000, weekend: 16000 },
  { id: "house2", name: "Сонячна оселя", color: "#8B7D3C", accent: "#BFA84F", weekday: 7000, weekend: 8000 },
  { id: "house3", name: "Лісова тиша", color: "#3D5A4C", accent: "#5A8A6A", weekday: 5500, weekend: 6500 },
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
function formatMoney(n) { return n.toLocaleString("uk-UA") + " ₴"; }

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

function calcDefaultPrice(houseId, checkIn, checkOut) {
  const house = HOUSES.find(h => h.id === houseId);
  if (!house || !checkIn || !checkOut) return 0;
  const nights = eachNight(checkIn, checkOut);
  return nights.reduce((sum, n) => sum + (isWeekend(n) ? house.weekend : house.weekday), 0);
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

// ── MODAL ──
function Modal({ children, onClose, title }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #DDD8C8", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: "#FAFAF5", zIndex: 2, borderRadius: "inherit" }}>
          <div className="modal-handle" style={{ width: 36, height: 4, borderRadius: 2, background: "#C5BFAA", position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)" }} />
          <h2 style={{ margin: 0, fontSize: 17, fontFamily: "'Playfair Display', serif", color: "#2D3A2E", marginTop: 4 }}>{title}</h2>
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
    fontSize: 15, fontFamily: "'DM Sans', sans-serif", background: disabled ? "#F0EDE2" : "#fff",
    outline: "none", transition: "border-color 0.2s", boxSizing: "border-box", color: "#2D3A2E",
    opacity: disabled ? 0.6 : 1
  };
  return (
    <div style={{ marginBottom: 12 }}>
      {label && <label style={{ display: "block", marginBottom: 5, fontSize: 11, fontWeight: 700, color: error ? "#9E4A3A" : "#5A6B4A", letterSpacing: 0.6, textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif" }}>
        {label} {required && <span style={{ color: "#9E4A3A" }}>*</span>}
      </label>}
      {rows ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows} style={{ ...base, resize: "vertical" }} disabled={disabled} />
      ) : (
        <input type={type || "text"} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={base} min={min} max={max} disabled={disabled}
          onFocus={e => { if (!disabled) e.target.style.borderColor="#6B8F3C"; }} onBlur={e => e.target.style.borderColor=error?"#9E4A3A":"#C5BFAA"} />
      )}
      {error && <div style={{ fontSize: 11, color: "#9E4A3A", marginTop: 4, fontWeight: 600 }}>{error}</div>}
    </div>
  );
}

function Select({ label, value, onChange, options, required }) {
  return (
    <div style={{ marginBottom: 12 }}>
      {label && <label style={{ display: "block", marginBottom: 5, fontSize: 11, fontWeight: 700, color: "#5A6B4A", letterSpacing: 0.6, textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif" }}>{label} {required && <span style={{ color: "#9E4A3A" }}>*</span>}</label>}
      <select value={value} onChange={e => onChange(e.target.value)} style={{
        width: "100%", padding: "12px 14px", border: "1.5px solid #C5BFAA", borderRadius: 12, fontSize: 15,
        fontFamily: "'DM Sans', sans-serif", background: "#fff", outline: "none", color: "#2D3A2E",
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
      ...s, padding: "12px 20px", borderRadius: 12, fontSize: 14, fontWeight: 700,
      cursor: disabled ? "not-allowed" : "pointer", fontFamily: "'DM Sans', sans-serif",
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
      fontSize: small ? 10 : 11, fontWeight: 700, letterSpacing: 0.4,
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
      fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap"
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
      <label style={{ display: "block", marginBottom: 6, fontSize: 11, fontWeight: 700, color: "#5A6B4A", letterSpacing: 0.6, textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif" }}>
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
          <div style={{ fontSize: 13, color: "#2D3A2E", fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>
            {checkIn && checkOut && checkIn < checkOut ? (
              <>{displayDate(checkIn)} — {displayDate(checkOut)} · {nightsCount} {nightsLabel(nightsCount)}</>
            ) : checkIn ? (
              <span style={{ color: "#7A8B6A" }}>{displayDate(checkIn)} — <span style={{ fontStyle: "italic" }}>оберіть виїзд</span></span>
            ) : (
              <span style={{ color: "#9A9580", fontStyle: "italic" }}>Оберіть дату заїзду</span>
            )}
          </div>
          {checkIn && (
            <button onClick={() => onChange("", "")} style={{ background: "none", border: "1px solid #C5BFAA", borderRadius: 6, padding: "4px 10px", fontSize: 11, color: "#7A8B6A", cursor: "pointer", fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>
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
      <label style={{ display: "block", marginBottom: 5, fontSize: 11, fontWeight: 700, color: "#5A6B4A", letterSpacing: 0.6, textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif" }}>Кількість гостей</label>
      <div style={{ display: "flex", alignItems: "center" }}>
        <button onClick={() => onChange(Math.max(1, value - 1))} style={{
          width: 48, height: 48, borderRadius: "12px 0 0 12px", border: "1.5px solid #C5BFAA", borderRight: "none",
          background: "#F5F2EA", fontSize: 20, fontWeight: 700, color: value <= 1 ? "#C5BFAA" : "#3D5A2E",
          cursor: value <= 1 ? "default" : "pointer", fontFamily: "'DM Sans', sans-serif",
          display: "flex", alignItems: "center", justifyContent: "center"
        }}>−</button>
        <div style={{
          width: 56, height: 48, border: "1.5px solid #C5BFAA", display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: 17, fontWeight: 700, color: "#2D3A2E", background: "#fff",
          fontFamily: "'DM Sans', sans-serif"
        }}>{value}</div>
        <button onClick={() => onChange(Math.min(30, value + 1))} style={{
          width: 48, height: 48, borderRadius: "0 12px 12px 0", border: "1.5px solid #C5BFAA", borderLeft: "none",
          background: "#F5F2EA", fontSize: 20, fontWeight: 700, color: "#3D5A2E", cursor: "pointer",
          fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", justifyContent: "center"
        }}>+</button>
      </div>
    </div>
  );
}

// ── BOOKING FORM ──
function BookingForm({ booking, contacts, houses, allBookings, onSave, onClose, onDelete, onSaveContact }) {
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

  const defaultPrice = useMemo(() => calcDefaultPrice(form.houseId, form.checkIn, form.checkOut), [form.houseId, form.checkIn, form.checkOut]);
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
      <Select label="Будинок" value={form.houseId} onChange={v => { set("houseId", v); set("priceManual", false); }} required
        options={houses.map(h => ({ value: h.id, label: h.name }))} />

      <div style={{ marginBottom: 14 }}>
        <label style={{ display: "block", marginBottom: 6, fontSize: 11, fontWeight: 700, color: "#5A6B4A", letterSpacing: 0.6, textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif" }}>Статус <span style={{ color: "#9E4A3A" }}>*</span></label>
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
                flex: 1, padding: "10px 6px", borderRadius: 10, fontSize: 12, fontWeight: 700,
                border: active ? `2px solid ${sc.border}` : "1.5px solid #DDD8C8",
                background: active ? sc.bg : "#fff", color: active ? sc.text : "#7A8B6A",
                cursor: "pointer", fontFamily: "'DM Sans', sans-serif", transition: "all 0.15s"
              }}>{s.icon} {s.label}</button>
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
          <div style={{ fontSize: 12, fontWeight: 700, color: "#5A6B4A", marginBottom: 10, fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 14 }}>👤</span> Контактна особа
          </div>
          <Input label="Ім'я" value={contactForm.name} onChange={v => setC("name", v)} required placeholder="Іван Петренко" />
          <Input label="Телефон" value={contactForm.phone} onChange={v => setC("phone", v)} placeholder="+380..." />
          <Input label="Примітки до контакту" value={contactForm.notes} onChange={v => setC("notes", v)} rows={1} placeholder="Нотатки..." />
        </div>
      )}

      {!isUnavailable && <GuestCounter value={form.guests} onChange={v => set("guests", v)} />}

      {!isUnavailable && nights.length > 0 && (
        <div style={{ background: "#F0EDE2", borderRadius: 14, padding: 14, marginBottom: 12, border: "1px solid #DDD8C8" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#5A6B4A", marginBottom: 10, fontFamily: "'DM Sans', sans-serif", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 14 }}>💰</span> Вартість проживання
          </div>
          <div style={{ marginBottom: 10 }}>
            {nights.map((n, i) => {
              const d = parseDate(n);
              const dayName = ["Нд","Пн","Вт","Ср","Чт","Пт","Сб"][d.getDay()];
              const we = isWeekend(n);
              const rate = we ? house.weekend : house.weekday;
              return (
                <div key={n} style={{
                  display: "flex", justifyContent: "space-between", padding: "4px 0",
                  fontSize: 12, color: "#5A6B4A", borderBottom: i < nights.length - 1 ? "1px solid #E0DBC8" : "none"
                }}>
                  <span>{d.getDate()} {MONTHS_GEN[d.getMonth()]} ({dayName}) {we ? "🌙" : ""}</span>
                  <span style={{ fontWeight: 600 }}>{formatMoney(rate)}</span>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTop: "2px solid #C5BFAA" }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#2D3A2E" }}>Загалом ({nights.length} {nightsLabel(nights.length)}):</span>
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
                  fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none", color: "#2D3A2E",
                  background: form.priceManual ? "#fff" : "#F5F2EA"
                }}
              />
              {form.priceManual && (
                <button onClick={() => { set("priceManual", false); set("price", null); }} style={{
                  background: "none", border: "1px solid #C5BFAA", borderRadius: 8, padding: "8px 12px",
                  fontSize: 11, color: "#7A8B6A", cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap",
                  fontFamily: "'DM Sans', sans-serif"
                }}>Скинути</button>
              )}
            </div>
            <div style={{ fontSize: 10, color: "#9A9580", marginTop: 4 }}>
              {form.priceManual ? "Власна вартість" : "Автоматичний розрахунок"}
            </div>
          </div>
        </div>
      )}

      <Input label="Примітки" value={form.notes} onChange={v => set("notes", v)} rows={2} placeholder={isUnavailable ? "Причина недоступності..." : "Особливі побажання..."} />

      <div style={{ marginBottom: 14 }}>
        <label style={{ display: "block", marginBottom: 5, fontSize: 11, fontWeight: 700, color: "#5A6B4A", letterSpacing: 0.6, textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif" }}>Коментарі</label>
        {form.comments.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            {form.comments.map(c => (
              <div key={c.id} style={{ padding: "10px 12px", background: "#F0EDE2", borderRadius: 10, marginBottom: 6, fontSize: 13, color: "#3D4A35", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ wordBreak: "break-word" }}>{c.text}</div>
                  <div style={{ fontSize: 11, color: "#7A8B6A", marginTop: 3 }}>{new Date(c.date).toLocaleString("uk-UA")}</div>
                </div>
                <button onClick={() => set("comments", form.comments.filter(x => x.id !== c.id))} style={{ background: "none", border: "none", color: "#9E4A3A", cursor: "pointer", fontSize: 18, padding: "0 4px", flexShrink: 0 }}>×</button>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <input value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Додати коментар..."
            onKeyDown={e => e.key === "Enter" && addComment()}
            style={{ flex: 1, padding: "10px 12px", border: "1.5px solid #C5BFAA", borderRadius: 12, fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none", color: "#2D3A2E" }} />
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

// Stable color palette for distinguishing bookings on the calendar
const BOOKING_COLORS = [
  "#4A6741", "#8B7D3C", "#3D5A4C", "#7A5A8B", "#5A7A8B",
  "#8B5A4A", "#5A8B6A", "#6B6347", "#4A708B", "#8B6B4A",
];

function getBookingColor(bookingId) {
  let hash = 0;
  for (let i = 0; i < bookingId.length; i++) hash = ((hash << 5) - hash + bookingId.charCodeAt(i)) | 0;
  return BOOKING_COLORS[Math.abs(hash) % BOOKING_COLORS.length];
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
        <div style={{ fontSize: 13, fontWeight: isToday ? 800 : 500, textAlign: "center", color: isToday ? "#6B5D1C" : hasBooking ? sc.text : "#5A6B4A", fontFamily: "'DM Sans', sans-serif" }}>{d}</div>
        {hasBooking && (
          <div style={{ marginTop: 2, padding: "0 3px", display: "flex", flexDirection: "column", gap: 2 }}>
            {dayBookings.map(b => {
              const color = getBookingColor(b.id);
              const contact = contacts.find(c => c.id === b.contactId);
              const initial = b.status === "unavailable" ? "✕" : (contact?.name?.[0]?.toUpperCase() || "?");
              const isStart = b.checkIn === dayStr;
              return (
                <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <div style={{
                    flex: 1, height: 4, borderRadius: 2,
                    background: color, opacity: 0.6,
                    borderLeft: isStart ? `2px solid ${color}` : "none",
                  }} />
                  {isStart && (
                    <div style={{
                      fontSize: 7, fontWeight: 800, color: color, lineHeight: 1,
                      fontFamily: "'DM Sans', sans-serif", flexShrink: 0,
                    }}>{initial}</div>
                  )}
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
        {DAYS_SHORT.map(d => (<div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: "#9A9580", padding: "4px 0", fontFamily: "'DM Sans', sans-serif" }}>{d}</div>))}
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
        contactName: b.status === "unavailable" ? "Недоступно" : (contact?.name || "—"),
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
    totalGuests: allStats.reduce((s, h) => s + h.stats.guests, 0),
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
    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #E0DBC8" }}>
      <span style={{ fontSize: 12, color: "#5A6B4A", fontFamily: "'DM Sans', sans-serif" }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: bold ? 800 : 600, color: color || "#2D3A2E", fontFamily: "'DM Sans', sans-serif" }}>{value}</span>
    </div>
  );

  const OccupancyBar = ({ occupancy, color, accent }) => (
    <div style={{ height: 24, background: "#E0DBC8", borderRadius: 8, overflow: "hidden", position: "relative" }}>
      <div style={{ width: `${occupancy}%`, height: "100%", borderRadius: 8, background: `linear-gradient(90deg, ${color}, ${accent})`, transition: "width 0.3s" }} />
      <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 11, fontWeight: 700, color: occupancy > 50 ? "#fff" : "#5A6B4A" }}>{occupancy}%</span>
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
            flex: 1, padding: "9px 0", borderRadius: 10, border: "none", fontSize: 13, fontWeight: 700,
            fontFamily: "'DM Sans', sans-serif", cursor: "pointer", transition: "all 0.15s",
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
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: "#2D3A2E" }}>{MONTHS[aMonth]}</div>
            <div style={{ fontSize: 12, color: "#7A8B6A" }}>{aYear} · {daysInMonth} днів</div>
          </div>
          <button onClick={nextMonth} style={{ background: "#FAFAF5", border: "1px solid #DDD8C8", borderRadius: 10, width: 42, height: 42, fontSize: 18, cursor: "pointer", color: "#5A6B4A" }}>›</button>
        </div>
      ) : (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <button onClick={prevYear} style={{ background: "#FAFAF5", border: "1px solid #DDD8C8", borderRadius: 10, width: 42, height: 42, fontSize: 18, cursor: "pointer", color: "#5A6B4A" }}>‹</button>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, color: "#2D3A2E" }}>{aYear}</div>
            <div style={{ fontSize: 12, color: "#7A8B6A" }}>Річна аналітика</div>
          </div>
          <button onClick={nextYear} style={{ background: "#FAFAF5", border: "1px solid #DDD8C8", borderRadius: 10, width: 42, height: 42, fontSize: 18, cursor: "pointer", color: "#5A6B4A" }}>›</button>
        </div>
      )}

      {/* ══════ MONTHLY VIEW ══════ */}
      {aMode === "month" && <>

      {/* ── Summary across all houses ── */}
      <div style={{ background: "#FAFAF5", borderRadius: 20, padding: "20px", marginBottom: 16, border: "1px solid #E8E2CC" }}>
        {/* Hero: Revenue + Occupancy ring */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
          <div style={{ position: "relative", width: 72, height: 72, flexShrink: 0 }}>
            <svg viewBox="0 0 72 72" style={{ width: 72, height: 72, transform: "rotate(-90deg)" }}>
              <circle cx="36" cy="36" r="30" fill="none" stroke="#E8E2CC" strokeWidth="6" />
              <circle cx="36" cy="36" r="30" fill="none" stroke="#6B8F3C" strokeWidth="6"
                strokeDasharray={`${summary.avgOccupancy * 1.884} 188.4`}
                strokeLinecap="round" style={{ transition: "stroke-dasharray 0.5s ease" }} />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: "#2D3A2E", lineHeight: 1, fontFamily: "'DM Sans', sans-serif" }}>{summary.avgOccupancy}%</span>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: "#9A9580", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4, fontFamily: "'DM Sans', sans-serif" }}>Загальний дохід</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#2D3A2E", fontFamily: "'Playfair Display', serif", lineHeight: 1.1 }}>{summary.totalRevenue > 0 ? formatMoney(summary.totalRevenue) : "—"}</div>
          </div>
        </div>

        {/* Nights breakdown - horizontal stacked bar */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", height: 8, borderRadius: 6, overflow: "hidden", background: "#E8E2CC" }}>
            {summary.totalBookedNights > 0 && <div style={{ width: `${(summary.totalBookedNights / (daysInMonth * 3)) * 100}%`, background: "#4A6741", transition: "width 0.3s" }} />}
            {summary.totalPendingNights > 0 && <div style={{ width: `${(summary.totalPendingNights / (daysInMonth * 3)) * 100}%`, background: "#BFA84F", transition: "width 0.3s" }} />}
            {summary.totalUnavailableNights > 0 && <div style={{ width: `${(summary.totalUnavailableNights / (daysInMonth * 3)) * 100}%`, background: "#C4816C", transition: "width 0.3s" }} />}
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
            {[
              { n: summary.totalBookedNights, label: "Заброньовано", color: "#4A6741" },
              { n: summary.totalPendingNights, label: "Очікується", color: "#BFA84F" },
              { n: summary.totalFreeNights, label: "Вільно", color: "#C5BFAA" },
              { n: summary.totalUnavailableNights, label: "Недоступно", color: "#C4816C" },
            ].map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: 3, background: s.color, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: "#5A6B4A", fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>{s.n}</span>
                <span style={{ fontSize: 10, color: "#9A9580", fontFamily: "'DM Sans', sans-serif" }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Key metrics row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
          {[
            { n: summary.totalGuests, label: "Гостей", icon: "👤" },
            { n: summary.totalCheckIns, label: "Заїздів", icon: "📅" },
            { n: `${summary.avgOccupancy}%`, label: "Заповненість", icon: "📊" },
          ].map((s, i) => (
            <div key={i} style={{ background: "#F0EDE2", borderRadius: 12, padding: "12px 8px", textAlign: "center" }}>
              <div style={{ fontSize: 14, marginBottom: 4 }}>{s.icon}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#2D3A2E", fontFamily: "'DM Sans', sans-serif", lineHeight: 1 }}>{s.n}</div>
              <div style={{ fontSize: 9, color: "#9A9580", fontWeight: 600, marginTop: 4, textTransform: "uppercase", letterSpacing: 0.3 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Revenue per house */}
        <div>
          <div style={{ fontSize: 10, color: "#9A9580", fontWeight: 700, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "'DM Sans', sans-serif" }}>Дохід по будинках</div>
          {allStats.map(({ house, stats }) => {
            const pct = summary.totalRevenue > 0 ? (stats.revenue / summary.totalRevenue) * 100 : 0;
            return (
              <div key={house.id} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 5, background: house.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#2D3A2E", fontFamily: "'DM Sans', sans-serif" }}>{house.name}</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#2D3A2E", fontFamily: "'DM Sans', sans-serif" }}>
                    {stats.revenue > 0 ? formatMoney(stats.revenue) : "—"}
                  </span>
                </div>
                <div style={{ height: 6, background: "#E8E2CC", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{
                    width: `${pct}%`, height: "100%", borderRadius: 4,
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
        <div key={house.id} style={{ background: "#FAFAF5", borderRadius: 14, overflow: "hidden", border: "1px solid #DDD8C8", marginBottom: 14 }}>
          <div style={{ padding: "10px 14px", background: house.color, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <PineTree size={16} color="rgba(255,255,255,0.7)" />
              <span style={{ color: "#fff", fontWeight: 700, fontSize: 14, fontFamily: "'Playfair Display', serif" }}>{house.name}</span>
            </div>
            <span style={{ background: "rgba(255,255,255,0.2)", padding: "2px 10px", borderRadius: 12, fontSize: 11, color: "#fff", fontWeight: 700 }}>
              {stats.occupancy}%
            </span>
          </div>
          <div style={{ padding: 14 }}>
            <OccupancyBar occupancy={stats.occupancy} color={house.color} accent={house.accent} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, margin: "12px 0" }}>
              <div style={{ background: "#F0EDE2", borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#3D5A2E" }}>{stats.revenue > 0 ? formatMoney(stats.revenue) : "—"}</div>
                <div style={{ fontSize: 10, color: "#7A8B6A", fontWeight: 600 }}>Дохід</div>
              </div>
              <div style={{ background: "#F0EDE2", borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#3D5A2E" }}>{stats.avgPerNight > 0 ? formatMoney(stats.avgPerNight) : "—"}</div>
                <div style={{ fontSize: 10, color: "#7A8B6A", fontWeight: 600 }}>Сер. за ніч</div>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <StatRow label="Заброньовано ночей" value={stats.bookedNights} color="#4A6741" />
              <StatRow label="Очікується ночей" value={stats.pendingNights} color="#8B7D3C" />
              <StatRow label="Недоступно ночей" value={stats.unavailableNights} color="#9E4A3A" />
              <StatRow label="Вільно ночей" value={stats.freeNights} color="#7A8B6A" />
              <StatRow label="Будні / Вихідні" value={`${stats.weekdayNights} / ${stats.weekendNights}`} />
              <StatRow label="Кількість заїздів" value={stats.checkIns} bold />
              <StatRow label="Унікальних гостей" value={stats.guests} bold />
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <div style={{ flex: 1, background: "#F0EDE2", borderRadius: 8, padding: "6px 10px", textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "#7A8B6A", fontWeight: 600 }}>Пн–Чт</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#3D5A2E" }}>{formatMoney(house.weekday)}</div>
              </div>
              <div style={{ flex: 1, background: "#F0EDE2", borderRadius: 8, padding: "6px 10px", textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "#7A8B6A", fontWeight: 600 }}>Пт–Нд</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#3D5A2E" }}>{formatMoney(house.weekend)}</div>
              </div>
            </div>

            {stats.bookingDetails.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#5A6B4A", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6, fontFamily: "'DM Sans', sans-serif" }}>Бронювання</div>
                {stats.bookingDetails.map(b => {
                  const sc = STATUS_COLORS[b.status];
                  return (
                    <div key={b.id} style={{
                      padding: "8px 10px", background: sc.bg, borderRadius: 8, marginBottom: 4,
                      borderLeft: `3px solid ${sc.border}`, fontSize: 12, fontFamily: "'DM Sans', sans-serif"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: 700, color: sc.text }}>{b.contactName}</span>
                        {b.status !== "unavailable" && b.bookingRevenue > 0 && (
                          <span style={{ fontWeight: 700, color: "#3D5A2E", fontSize: 12 }}>{formatMoney(b.bookingRevenue)}</span>
                        )}
                      </div>
                      <div style={{ color: "#7A8B6A", fontSize: 11, marginTop: 2 }}>
                        {displayDate(b.checkIn)} — {displayDate(b.checkOut)} · {b.nightsInMonth} з {b.totalNights} {nightsLabel(b.totalNights)}
                        {b.guests > 1 ? ` · ${b.guests} гостей` : ""}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {stats.bookingDetails.length === 0 && (
              <div style={{ textAlign: "center", padding: "16px 0", color: "#9A9580", fontSize: 12 }}>
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
      <div style={{ background: "linear-gradient(135deg, #2D3A2E 0%, #1A251A 100%)", borderRadius: 16, padding: "20px 18px", marginBottom: 16, border: "1px solid #3D5A2E44" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: "#9A9580", fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif" }}>Зведення за рік</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: "#E8E2CC", marginTop: 2 }}>{aYear}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#6B8F3C", fontFamily: "'Playfair Display', serif" }}>{yearTotals.rev > 0 ? formatMoney(yearTotals.rev) : "—"}</div>
            <div style={{ fontSize: 10, color: "#9A9580", fontWeight: 600 }}>Загальний дохід</div>
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
            <div key={i} style={{ background: "rgba(107,143,60,0.12)", borderRadius: 10, padding: "10px 6px", textAlign: "center" }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: "#E8E2CC", fontFamily: "'Playfair Display', serif" }}>{s.n}</div>
              <div style={{ fontSize: 9, color: "#9A9580", fontWeight: 600, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Revenue bar chart */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 10, color: "#9A9580", fontWeight: 600, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.4 }}>Дохід по місяцях</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 100 }}>
            {yearlyData.map((d, i) => {
              const h = maxMonthRev > 0 ? Math.max((d.totalRev / maxMonthRev) * 88, d.totalRev > 0 ? 4 : 0) : 0;
              return (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, cursor: "pointer" }} onClick={() => { setAMonth(i); setAMode("month"); }}>
                  <div style={{
                    width: "100%", height: h, borderRadius: 4,
                    background: "rgba(107,143,60,0.35)",
                    transition: "all 0.2s",
                    minWidth: 0,
                  }} />
                  <div style={{ fontSize: 8, color: "#7A8B6A", fontWeight: 500, fontFamily: "'DM Sans', sans-serif" }}>{d.month}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Occupancy bar chart */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: "#9A9580", fontWeight: 600, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.4 }}>Заповненість по місяцях</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 80 }}>
            {yearlyData.map((d, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, cursor: "pointer" }} onClick={() => { setAMonth(i); setAMode("month"); }}>
                <div style={{ fontSize: 8, color: d.avgOcc > 0 ? "#E8E2CC" : "transparent", fontWeight: 700 }}>{d.avgOcc}%</div>
                <div style={{
                  width: "100%", height: Math.max(d.avgOcc * 0.6, d.avgOcc > 0 ? 3 : 0), borderRadius: 4,
                  background: "rgba(191,168,79,0.35)",
                  transition: "all 0.2s",
                }} />
                <div style={{ fontSize: 8, color: "#7A8B6A", fontWeight: 500 }}>{d.month}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Revenue per house mini-chart */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 14 }}>
          <div style={{ fontSize: 10, color: "#9A9580", fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.4 }}>Дохід по будинках</div>
          {yearlyHouseStats.map(({ house, revenue }) => (
            <div key={house.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <div style={{ width: 70, fontSize: 10, color: "#C5BFAA", fontWeight: 600, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{house.name.split(" ")[0]}</div>
              <div style={{ flex: 1, height: 18, background: "rgba(255,255,255,0.06)", borderRadius: 6, overflow: "hidden" }}>
                <div style={{
                  width: yearTotals.rev > 0 ? `${(revenue / yearTotals.rev) * 100}%` : "0%",
                  height: "100%", borderRadius: 6,
                  background: `linear-gradient(90deg, ${house.color}, ${house.accent})`,
                  transition: "width 0.3s"
                }} />
              </div>
              <div style={{ width: 75, textAlign: "right", fontSize: 11, fontWeight: 700, color: "#E8E2CC", flexShrink: 0 }}>
                {revenue > 0 ? formatMoney(revenue) : "—"}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Per-house yearly details ── */}
      <div className="analytics-view">
      {yearlyHouseStats.map(({ house, revenue, bookedNights, pendingNights, unavailableNights, freeNights, weekendNights, weekdayNights, checkIns, guests, occupancy, avgPerNight, daysInYear }) => (
        <div key={house.id} style={{ background: "#FAFAF5", borderRadius: 14, overflow: "hidden", border: "1px solid #DDD8C8", marginBottom: 14 }}>
          <div style={{ padding: "10px 14px", background: house.color, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <PineTree size={16} color="rgba(255,255,255,0.7)" />
              <span style={{ color: "#fff", fontWeight: 700, fontSize: 14, fontFamily: "'Playfair Display', serif" }}>{house.name}</span>
            </div>
            <span style={{ background: "rgba(255,255,255,0.2)", padding: "2px 10px", borderRadius: 12, fontSize: 11, color: "#fff", fontWeight: 700 }}>
              {occupancy}%
            </span>
          </div>
          <div style={{ padding: 14 }}>
            <OccupancyBar occupancy={occupancy} color={house.color} accent={house.accent} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, margin: "12px 0" }}>
              <div style={{ background: "#F0EDE2", borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#3D5A2E" }}>{revenue > 0 ? formatMoney(revenue) : "—"}</div>
                <div style={{ fontSize: 10, color: "#7A8B6A", fontWeight: 600 }}>Дохід</div>
              </div>
              <div style={{ background: "#F0EDE2", borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#3D5A2E" }}>{avgPerNight > 0 ? formatMoney(avgPerNight) : "—"}</div>
                <div style={{ fontSize: 10, color: "#7A8B6A", fontWeight: 600 }}>Сер. за ніч</div>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <StatRow label="Заброньовано ночей" value={bookedNights} color="#4A6741" />
              <StatRow label="Очікується ночей" value={pendingNights} color="#8B7D3C" />
              <StatRow label="Недоступно ночей" value={unavailableNights} color="#9E4A3A" />
              <StatRow label="Вільно ночей" value={freeNights} color="#7A8B6A" />
              <StatRow label="Будні / Вихідні" value={`${weekdayNights} / ${weekendNights}`} />
              <StatRow label="Кількість заїздів" value={checkIns} bold />
              <StatRow label="Унікальних гостей" value={guests} bold />
            </div>

            {/* Per-month revenue mini-chart for this house */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#5A6B4A", letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 6, fontFamily: "'DM Sans', sans-serif" }}>Дохід по місяцях</div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 48 }}>
                {yearlyData.map((d, i) => {
                  const hRev = d[`rev_${house.id}`] || 0;
                  const maxHRev = Math.max(...yearlyData.map(dd => dd[`rev_${house.id}`] || 0), 1);
                  const barH = maxHRev > 0 ? Math.max((hRev / maxHRev) * 40, hRev > 0 ? 3 : 0) : 0;
                  return (
                    <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, cursor: "pointer" }} onClick={() => { setAMonth(i); setAMode("month"); }}>
                      <div style={{ width: "100%", height: barH, borderRadius: 3, background: house.color, opacity: 0.5, transition: "all 0.2s" }} />
                      <div style={{ fontSize: 7, color: "#9A9580", fontWeight: 500 }}>{d.month}</div>
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

// ── MAIN APP ──
export default function GuestHouseApp() {
  const {
    bookings, contacts, loading,
    saveBooking: fbSaveBooking,
    deleteBooking: fbDeleteBooking,
    saveContact: fbSaveContact,
  } = useFirestoreData();

  const [view, setView] = useState("calendar");
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [modal, setModal] = useState(null);
  const [activeHouse, setActiveHouse] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

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

  const listBookings = bookings.filter(b => {
    if (activeHouse && b.houseId !== activeHouse) return false;
    if (searchTerm) {
      const c = contacts.find(c => c.id === b.contactId);
      return c?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || b.notes?.toLowerCase().includes(searchTerm.toLowerCase());
    }
    return true;
  }).sort((a, b) => a.checkIn > b.checkIn ? -1 : 1);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#2D3A2E", fontFamily: "'Playfair Display', serif", color: "#D4CCAA" }}>
      <div style={{ textAlign: "center" }}><PineTree size={48} color="#6B8F3C" /><div style={{ fontSize: 18, marginTop: 10 }}>Душа лісу</div></div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#F2EFDF", fontFamily: "'DM Sans', sans-serif", paddingBottom: 80 }}>
      {/* HEADER */}
      <div style={{ background: "#2D3A2E", color: "#E8E2CC", padding: "14px 16px", borderBottom: "3px solid #6B8F3C", position: "sticky", top: 0, zIndex: 100 }}>
        <div className="header-inner" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <PineTree size={26} color="#6B8F3C" />
            <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, letterSpacing: 0.5 }}>Душа лісу</span>
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
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: "#2D3A2E" }}>{MONTHS[month]}</div>
                  <div style={{ fontSize: 12, color: "#7A8B6A" }}>{year}</div>
                </div>
                <button onClick={nextMonth} style={{ background: "#FAFAF5", border: "1px solid #DDD8C8", borderRadius: 10, width: 42, height: 42, fontSize: 18, cursor: "pointer", color: "#5A6B4A" }}>›</button>
              </div>
              <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 10, scrollbarWidth: "none" }}>
                <button onClick={() => setActiveHouse(null)} style={{ padding: "7px 16px", borderRadius: 20, fontSize: 12, fontWeight: 700, border: !activeHouse ? "2px solid #2D3A2E" : "1.5px solid #C5BFAA", background: !activeHouse ? "#2D3A2E" : "#FAFAF5", color: !activeHouse ? "#E8E2CC" : "#5A6B4A", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap", flexShrink: 0 }}>Всі</button>
                {HOUSES.map(h => (
                  <button key={h.id} onClick={() => setActiveHouse(activeHouse === h.id ? null : h.id)} style={{ padding: "7px 16px", borderRadius: 20, fontSize: 12, fontWeight: 700, border: activeHouse === h.id ? `2px solid ${h.color}` : "1.5px solid #C5BFAA", background: activeHouse === h.id ? h.color : "#FAFAF5", color: activeHouse === h.id ? "#fff" : "#5A6B4A", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap", flexShrink: 0 }}>{h.name}</button>
                ))}
              </div>
              <div className="calendar-houses">
                {(activeHouse ? HOUSES.filter(h => h.id === activeHouse) : HOUSES).map(house => (
                  <div key={house.id} style={{ background: "#FAFAF5", borderRadius: 14, overflow: "hidden", border: "1px solid #DDD8C8" }}>
                    <div style={{ padding: "10px 14px", background: house.color, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <PineTree size={16} color="rgba(255,255,255,0.7)" />
                        <span style={{ color: "#fff", fontWeight: 700, fontSize: 14, fontFamily: "'Playfair Display', serif" }}>{house.name}</span>
                      </div>
                      <span style={{ background: "rgba(255,255,255,0.2)", padding: "2px 10px", borderRadius: 12, fontSize: 11, color: "#fff", fontWeight: 600 }}>
                        {bookings.filter(b => b.houseId === house.id && b.status === "booked" && b.checkOut >= formatDate(new Date())).length} акт.
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
                    <span style={{ fontSize: 10, color: "#5A6B4A", fontWeight: 600 }}>{v.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── LIST ── */}
          {view === "list" && (
            <div className="list-view">
              <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Пошук бронювань..."
                style={{ width: "100%", padding: "12px 16px", border: "1.5px solid #C5BFAA", borderRadius: 14, fontSize: 15, fontFamily: "'DM Sans', sans-serif", outline: "none", color: "#2D3A2E", background: "#FAFAF5", marginBottom: 10, boxSizing: "border-box" }} />
              <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 10, scrollbarWidth: "none" }}>
                {HOUSES.map(h => (
                  <button key={h.id} onClick={() => setActiveHouse(activeHouse === h.id ? null : h.id)} style={{ padding: "6px 14px", borderRadius: 20, fontSize: 11, fontWeight: 700, border: activeHouse === h.id ? `2px solid ${h.color}` : "1.5px solid #C5BFAA", background: activeHouse === h.id ? h.color : "#FAFAF5", color: activeHouse === h.id ? "#fff" : "#5A6B4A", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap", flexShrink: 0 }}>{h.name}</button>
                ))}
              </div>
              {listBookings.length === 0 ? (
                <div style={{ textAlign: "center", padding: 48, color: "#7A8B6A" }}><PineTree size={40} color="#C5BFAA" /><div style={{ fontSize: 14, marginTop: 10 }}>Бронювань не знайдено</div></div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {listBookings.map(b => {
                    const house = HOUSES.find(h => h.id === b.houseId);
                    const contact = contacts.find(c => c.id === b.contactId);
                    const nights = daysBetween(parseDate(b.checkIn), parseDate(b.checkOut));
                    return (
                      <div key={b.id} onClick={() => setModal({ type: "editBooking", data: b })} style={{ background: "#FAFAF5", borderRadius: 14, padding: "14px 16px", border: "1px solid #DDD8C8", cursor: "pointer", borderLeft: `4px solid ${house?.color || "#ccc"}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                          <div style={{ fontWeight: 700, fontSize: 15, color: "#2D3A2E" }}>{b.status === "unavailable" ? "Недоступно" : (contact?.name || "—")}</div>
                          <Badge status={b.status} small />
                        </div>
                        <div style={{ fontSize: 12, color: "#5A6B4A" }}>
                          {house?.name} · {displayDate(b.checkIn)} — {displayDate(b.checkOut)} · {nights} {nightsLabel(nights)}
                        </div>
                        {b.status !== "unavailable" && b.price != null && (
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#3D5A2E", marginTop: 3 }}>{formatMoney(b.price)}</div>
                        )}
                        {b.notes && <div style={{ fontSize: 11, color: "#9A9580", marginTop: 2 }}>{b.notes}</div>}
                        {b.comments?.length > 0 && <div style={{ fontSize: 11, color: "#7A8B6A", marginTop: 2 }}>💬 {b.comments.length} {commentsLabel(b.comments.length)}</div>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── ANALYTICS ── */}
          {view === "analytics" && <Analytics bookings={bookings} contacts={contacts} year={year} month={month} />}
        </div>
      </div>

      {/* BOTTOM NAV */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#FAFAF5", borderTop: "1px solid #DDD8C8", padding: "6px 0 env(safe-area-inset-bottom, 10px)", zIndex: 100 }}>
        <div className="nav-inner" style={{ display: "flex", justifyContent: "space-around" }}>
          {[
            { id: "calendar", label: "Календар", icon: "📅" },
            { id: "list", label: "Бронювання", icon: "📋" },
            { id: "analytics", label: "Аналітика", icon: "📊" },
          ].map(v => (
            <button key={v.id} onClick={() => setView(v.id)} style={{ background: "none", border: "none", padding: "6px 16px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, opacity: view === v.id ? 1 : 0.4, transition: "opacity 0.15s" }}>
              <span style={{ fontSize: 20 }}>{v.icon}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: view === v.id ? "#2D3A2E" : "#7A8B6A", fontFamily: "'DM Sans', sans-serif" }}>{v.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* MODALS */}
      {modal?.type === "newBooking" && (
        <Modal title="Нове бронювання" onClose={() => setModal(null)}>
          <BookingForm booking={modal.data} contacts={contacts} houses={HOUSES} allBookings={bookings}
            onSave={saveBooking} onClose={() => setModal(null)} onDelete={deleteBooking} onSaveContact={saveContact} />
        </Modal>
      )}
      {modal?.type === "editBooking" && (
        <Modal title="Редагувати бронювання" onClose={() => setModal(null)}>
          <BookingForm booking={modal.data} contacts={contacts} houses={HOUSES} allBookings={bookings}
            onSave={saveBooking} onClose={() => setModal(null)} onDelete={deleteBooking} onSaveContact={saveContact} />
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
                    <span style={{ fontWeight: 700, fontSize: 14, color: "#2D3A2E" }}>{b.status === "unavailable" ? "Недоступно" : (contact?.name || "—")}</span>
                    <Badge status={b.status} small />
                  </div>
                  <div style={{ fontSize: 12, color: "#5A6B4A", marginTop: 4 }}>{displayDate(b.checkIn)} — {displayDate(b.checkOut)}</div>
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

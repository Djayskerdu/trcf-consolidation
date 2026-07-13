import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Loader2, RefreshCw, AlertCircle, ClipboardList,
  Pencil, X, Phone, Filter, UserPlus2, Calendar, Users, Send,
  CheckCircle2, XCircle, Clock
} from "lucide-react";

// ── Consolidation (First Timer / VIP) backend — same ConsolidationBackend.gs
//    Web App URL used by the Pastors' Overview dashboard, so records logged
//    here immediately show up there too.
const CONSOLIDATION_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwxnFrOjZJ1bg4_BgkmY7QttrZKGT1GTojtcqqZ9REJGEtT8q3XwQRTqinGgyz9MrM/exec";

const FOLLOWUP_STATUSES = ["Not Yet Contacted","Contacted","Invited to Cell","Attending Cell","Inactive"];
const DECISIONS = ["Accepted Christ","Rededication","Just Visiting","Follow Up Needed"];

async function apiGetC() {
  const res  = await fetch(CONSOLIDATION_SCRIPT_URL, { method:"GET" });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Failed to load");
  return json.data;
}
async function apiPostC(body) {
  const res  = await fetch(CONSOLIDATION_SCRIPT_URL, {
    method:"POST",
    headers:{ "Content-Type":"text/plain;charset=utf-8" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Request failed");
  return json;
}

// ── Networks & leaders First Timers get assigned to for follow-up ──────
// Fill in each leader's mobile number (PH format e.g. "09171234567") to enable
// the "Send Notification" SMS button on the Network Leaders tab. Leave blank
// to leave that button disabled until a number is added.
const NETWORKS = [
  { id:"abraham",  label:"Abraham Network",     boys:"Deonie Abraham",     boysPhone:"",  girls:"Elva Abraham",   girlsPhone:"" },
  { id:"claudio",  label:"Claudio Network",     boys:"Sonny Claudio",      boysPhone:"",  girls:"",               girlsPhone:"" },
  { id:"flores",   label:"Flores Network",      boys:"Franklin Flores",    boysPhone:"",  girls:"",               girlsPhone:"" },
  { id:"imeepatal",label:"Patal Network (Imee)",boys:"",                   boysPhone:"",  girls:"Imee Patal",     girlsPhone:"" },
  { id:"jacaria",  label:"Jacaria Network",     boys:"Anthony Jacaria",    boysPhone:"",  girls:"",               girlsPhone:"" },
  { id:"jayabraham",label:"Jay Abraham Network",boys:"Jay Abraham",        boysPhone:"",  girls:"",               girlsPhone:"" },
  { id:"jotoy",    label:"Jotoy Network",       boys:"Emerson P. Patal",   boysPhone:"",  girls:"Joan Z. Patal",  girlsPhone:"" },
  { id:"laparan",  label:"Laparan Network",     boys:"",                   boysPhone:"",  girls:"Avril Lee Laparan", girlsPhone:"" },
  { id:"pendon",   label:"Pendon Network",      boys:"Richard Pendon",     boysPhone:"",  girls:"Joy Pendon",     girlsPhone:"" },
  { id:"rodemio",  label:"Rodemio Network",     boys:"Jaime Rodemio",      boysPhone:"",  girls:"Ledelyn Rodemio",girlsPhone:"" },
];

const ASSIGNABLE_LEADERS = NETWORKS.reduce((acc, n) => {
  if (n.boys)  acc.push({ id:`${n.id}-Boys`,  networkId:n.id, networkLabel:n.label, gender:"Boys",  name:n.boys,  phone:n.boysPhone  });
  if (n.girls) acc.push({ id:`${n.id}-Girls`, networkId:n.id, networkLabel:n.label, gender:"Girls", name:n.girls, phone:n.girlsPhone });
  return acc;
}, []);

function buildReminderMessage(leader, pendingCount) {
  const who = pendingCount === 1 ? "1 First Timer" : `${pendingCount} First Timers`;
  if (pendingCount > 0) {
    return `Hi ${leader.name}! Reminder from TRCF Consolidation TEAM: you have ${who} waiting for follow-up. Please reach out when you can. Check the Consolidation System or Pastors' Overview for details. Thank you! 🙏`;
  }
  return `Hi ${leader.name}! This is TRCF Consolidation TEAM checking in — just a reminder to keep following up with your assigned First Timers. Thank you! 🙏`;
}

// Leader phone numbers now live in the "Leaders" tab of the Consolidation
// Google Sheet (see ConsolidationBackend.gs), keyed by the same "<networkId>-
// <Gender>" id used in ASSIGNABLE_LEADERS — so a number saved from any device
// shows up for everyone. The dashboard fetches these via apiGetC() and writes
// changes with an "updateLeaderPhone" action (see handleSavePhone below).

function statusClass(status) {
  if (status === "Attending Cell") return "status-good";
  if (status === "Invited to Cell" || status === "Contacted") return "status-mid";
  if (status === "Inactive") return "status-bad";
  return "status-new";
}

// Dates come back from the sheet as UTC timestamps (e.g. "2026-07-11T16:00:00.000Z"
// for a date entered as July 12 in Manila). Always re-render them in the church's
// local timezone so the calendar day shown/edited matches what was actually entered.
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function toManilaISODate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(d); // YYYY-MM-DD
}
function formatDate(value) {
  const iso = toManilaISODate(value);
  if (!iso) return "";
  const [y, m, day] = iso.split("-");
  return `${MONTHS[parseInt(m, 10) - 1]} ${parseInt(day, 10)}, ${y}`;
}

function FirstTimerModal({ open, onClose, onSave, initial, saving }) {
  const blank = () => ({
    Name:"", ContactNumber:"", Address:"", Age:"", Gender:"", MaritalStatus:"",
    DateVisited:"", InvitedBy:"", Decision:"", AssignedLeaderKey:"",
    FollowUpStatus:"Not Yet Contacted", Notes:"", EncodedBy:"",
  });
  const [form, setForm] = useState(blank());

  useEffect(() => {
    if (!open) return;
    if (initial) {
      const match = ASSIGNABLE_LEADERS.find(l => l.networkId===initial.AssignedNetworkId && l.name===initial.AssignedLeaderName);
      setForm({ ...blank(), ...initial, DateVisited: toManilaISODate(initial.DateVisited), AssignedLeaderKey: match ? match.id : "" });
    } else {
      setForm(blank());
    }
  }, [open, initial]);

  if (!open) return null;
  const set = (k,v) => setForm(f => ({ ...f, [k]:v }));

  function submit(e) {
    e.preventDefault();
    if (!form.Name.trim() || !form.AssignedLeaderKey) return;
    const leader = ASSIGNABLE_LEADERS.find(l => l.id === form.AssignedLeaderKey);
    const { AssignedLeaderKey, ...rest } = form;
    onSave({
      ...rest,
      AssignedNetworkId: leader ? leader.networkId : "",
      AssignedLeaderName: leader ? leader.name : "",
    });
  }

  return (
    <div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget && !saving) onClose();}}>
      <form className="modal" onSubmit={submit}>
        <div className="modal-head">
          <h2>{initial ? "Edit First Timer" : "Add First Timer"}</h2>
          <button type="button" className="icon-btn" onClick={onClose}><X size={18}/></button>
        </div>
        <div className="modal-body">
          <label className="field"><span>Full Name *</span>
            <input type="text" value={form.Name} onChange={e=>set("Name",e.target.value)} required/>
          </label>
          <div className="field-row">
            <label className="field"><span>Contact Number</span>
              <input type="text" value={form.ContactNumber} onChange={e=>set("ContactNumber",e.target.value)}/>
            </label>
            <label className="field"><span>Age</span>
              <input type="text" value={form.Age} onChange={e=>set("Age",e.target.value)}/>
            </label>
          </div>
          <label className="field"><span>Address</span>
            <input type="text" value={form.Address} onChange={e=>set("Address",e.target.value)}/>
          </label>
          <div className="field-row">
            <label className="field"><span>Gender</span>
              <select value={form.Gender} onChange={e=>set("Gender",e.target.value)}>
                <option value="">—</option><option value="Male">Male</option><option value="Female">Female</option>
              </select>
            </label>
            <label className="field"><span>Marital Status</span>
              <select value={form.MaritalStatus} onChange={e=>set("MaritalStatus",e.target.value)}>
                <option value="">—</option><option>Single</option><option>Married</option><option>Widowed</option>
              </select>
            </label>
          </div>
          <div className="field-row">
            <label className="field"><span>Date Visited</span>
              <input type="date" value={form.DateVisited} onChange={e=>set("DateVisited",e.target.value)}/>
            </label>
            <label className="field"><span>Invited By</span>
              <input type="text" value={form.InvitedBy} onChange={e=>set("InvitedBy",e.target.value)}/>
            </label>
          </div>
          <label className="field"><span>Decision</span>
            <select value={form.Decision} onChange={e=>set("Decision",e.target.value)}>
              <option value="">—</option>
              {DECISIONS.map(d=><option key={d}>{d}</option>)}
            </select>
          </label>
          <label className="field"><span>Assign to Network Leader *</span>
            <select value={form.AssignedLeaderKey} onChange={e=>set("AssignedLeaderKey",e.target.value)} required>
              <option value="">— Select —</option>
              {ASSIGNABLE_LEADERS.map(l=>(
                <option key={l.id} value={l.id}>{l.name} — {l.networkLabel} ({l.gender})</option>
              ))}
            </select>
          </label>
          <label className="field"><span>Follow-up Status</span>
            <select value={form.FollowUpStatus} onChange={e=>set("FollowUpStatus",e.target.value)}>
              {FOLLOWUP_STATUSES.map(s=><option key={s}>{s}</option>)}
            </select>
          </label>
          <label className="field"><span>Notes / Prayer Request</span>
            <input type="text" value={form.Notes} onChange={e=>set("Notes",e.target.value)}/>
          </label>
          <label className="field"><span>Encoded By (your name) *</span>
            <input type="text" value={form.EncodedBy} onChange={e=>set("EncodedBy",e.target.value)} required/>
          </label>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving}>{saving?"Saving…":"Save"}</button>
        </div>
      </form>
    </div>
  );
}

function statusMeta(status) {
  const s = String(status || "").toLowerCase();
  if (s === "success" || s === "delivered" || s === "sent") return { icon: CheckCircle2, cls: "notif-ok", label: status };
  if (s === "failed" || s === "invalid" || s === "expired") return { icon: XCircle, cls: "notif-bad", label: status };
  return { icon: Clock, cls: "notif-pending", label: status || "Pending" };
}

function formatDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("en-PH", { month:"short", day:"numeric", hour:"numeric", minute:"2-digit" });
}

function NotifyModal({ open, onClose, leader, pending, phone, saving, error, onSavePhone, onSend }) {
  const [phoneDraft, setPhoneDraft] = useState("");
  const [messageDraft, setMessageDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [sendResult, setSendResult] = useState(null);

  useEffect(() => {
    if (!open || !leader) return;
    setPhoneDraft(phone || "");
    setMessageDraft(buildReminderMessage(leader, pending));
    setSendError(""); setSendResult(null);
  }, [open, leader, pending, phone]);

  if (!open || !leader) return null;
  const canSend = !!phoneDraft.trim() && !!messageDraft.trim() && !saving && !sending;

  async function handleSend() {
    if (!canSend) return;
    setSending(true); setSendError("");
    try {
      if (phoneDraft.trim() !== String(phone||"").trim()) {
        await onSavePhone(phoneDraft.trim());
      }
      const notif = await onSend(phoneDraft.trim(), messageDraft);
      setSendResult(notif);
    } catch (err) {
      setSendError(err.message || "Couldn't send this message — please try again.");
    } finally {
      setSending(false);
    }
  }

  const meta = sendResult ? statusMeta(sendResult.Status) : null;

  return (
    <div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget) onClose();}}>
      <div className="modal">
        <div className="modal-head">
          <h2>Send notification</h2>
          <button type="button" className="icon-btn" onClick={onClose}><X size={18}/></button>
        </div>
        <div className="modal-body">
          <div className="sub" style={{marginTop:-6}}>To {leader.name} · {leader.networkLabel}</div>

          {sendResult ? (
            <div className={`notif-result ${meta.cls}`}>
              <meta.icon size={18}/>
              <div>
                <div className="notif-result-status">Sent via Semaphore — status: {meta.label}</div>
                <div className="notif-result-sub">{sendResult.Network ? `${sendResult.Network} · ` : ""}{formatDateTime(sendResult.SentAt)}</div>
              </div>
            </div>
          ) : (
            <>
              {!phone && (
                <div className="error-box" style={{marginBottom:0}}>
                  <Phone size={14}/>No number on file yet — add one below before sending.
                </div>
              )}
              {(error || sendError) && (
                <div className="error-box" style={{marginBottom:0}}>
                  <AlertCircle size={14}/>{sendError || error}
                </div>
              )}
              <label className="field"><span>Mobile number</span>
                <input type="text" value={phoneDraft} onChange={e=>setPhoneDraft(e.target.value)} placeholder="09XXXXXXXXX"/>
              </label>
              <label className="field"><span>Message</span>
                <textarea rows={5} value={messageDraft} onChange={e=>setMessageDraft(e.target.value)}
                  style={{fontFamily:"inherit",fontSize:14,padding:"10px 12px",border:"1px solid var(--line)",borderRadius:8,background:"var(--paper)",color:"var(--ink)",resize:"vertical"}}/>
              </label>
            </>
          )}
        </div>
        <div className="modal-foot">
          {sendResult ? (
            <button type="button" className="btn-primary" onClick={onClose}>Done</button>
          ) : (
            <>
              <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
              <button type="button" className="btn-primary" disabled={!canSend} onClick={handleSend}>
                <Send size={14}/>{sending ? "Sending…" : saving ? "Saving number…" : "Send SMS now"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function NetworkLeadersScreen({ records, leaderPhoneMap, onSavePhone, notifications, onSendNotification, onRefreshStatus }) {
  const [sortBy, setSortBy] = useState("pending"); // "pending" | "name" | "network"
  const [notifyTarget, setNotifyTarget] = useState(null); // leader row currently in the modal
  const [phoneSaveError, setPhoneSaveError] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);
  const [refreshingId, setRefreshingId] = useState(null);

  function phoneFor(l) {
    return (leaderPhoneMap[l.id] || l.phone || "").trim();
  }

  async function handleSavePhone(leaderId, phone) {
    setSavingPhone(true);
    setPhoneSaveError("");
    try {
      await onSavePhone(leaderId, phone);
    } catch {
      setPhoneSaveError("Couldn't save this number to the sheet — please try again.");
    } finally {
      setSavingPhone(false);
    }
  }

  async function handleSend(phone, message) {
    return onSendNotification(notifyTarget.id, notifyTarget.name, phone, message);
  }

  async function handleRefresh(notifId) {
    setRefreshingId(notifId);
    try { await onRefreshStatus(notifId); } catch { /* surfaced via unchanged status */ }
    finally { setRefreshingId(null); }
  }

  const latestByLeader = useMemo(() => {
    const map = {};
    (notifications || []).forEach(n => {
      const prev = map[n.LeaderId];
      if (!prev || String(n.SentAt) > String(prev.SentAt)) map[n.LeaderId] = n;
    });
    return map;
  }, [notifications]);

  const leaderRows = useMemo(() => {
    return ASSIGNABLE_LEADERS.map(l => {
      const assigned = records.filter(r => r.AssignedNetworkId===l.networkId && r.AssignedLeaderName===l.name);
      const pending = assigned.filter(r => r.FollowUpStatus==="Not Yet Contacted" || r.FollowUpStatus==="Contacted").length;
      return { ...l, total: assigned.length, pending };
    }).sort((a,b) => {
      if (sortBy==="pending") return b.pending - a.pending || a.name.localeCompare(b.name);
      if (sortBy==="network") return a.networkLabel.localeCompare(b.networkLabel);
      return a.name.localeCompare(b.name);
    });
  }, [records, sortBy]);

  return (
    <div className="home-wrap">
      <div className="home-hero">
        <span className="eyebrow">Consolidation</span>
        <h1>Network Leaders</h1>
        <p className="lede">Every leader First Timers can be assigned to, with how many are still waiting on
          follow-up. Send Notification lets you review the message, then sends a real SMS through Semaphore —
          with delivery status reported back.</p>
      </div>

      <div className="screen-head">
        <div className="filter-row">
          <span className="filter-label"><Filter size={13}/>Sort by</span>
          <select value={sortBy} onChange={e=>setSortBy(e.target.value)}>
            <option value="pending">Most pending follow-up</option>
            <option value="network">Network</option>
            <option value="name">Name</option>
          </select>
        </div>
      </div>

      <div className="leader-list">
        {leaderRows.map(l => {
          const phone = phoneFor(l);
          const hasPhone = !!phone;
          const lastNotif = latestByLeader[l.id];
          const meta = lastNotif ? statusMeta(lastNotif.Status) : null;
          return (
            <div key={l.id} className="leader-card">
              <div className="leader-main">
                <div className="leader-name-line">
                  <span className="ft-name">{l.name}</span>
                  <span className="badge badge-close">{l.gender}</span>
                </div>
                <div className="ft-meta">
                  <span>{l.networkLabel}</span>
                  {hasPhone
                    ? <span><Phone size={11}/>{phone}</span>
                    : <span className="leader-nophone">No phone number on file</span>}
                </div>
                <div className="ft-assign">
                  <strong>{l.total}</strong> assigned total ·{" "}
                  <strong className={l.pending>0 ? "leader-pending" : ""}>{l.pending}</strong> waiting on follow-up
                </div>
                {lastNotif && (
                  <div className={`notif-line ${meta.cls}`}>
                    <meta.icon size={12}/>
                    <span>Last notified {formatDateTime(lastNotif.SentAt)} — {meta.label}</span>
                    <button type="button" className="notif-refresh" onClick={()=>handleRefresh(lastNotif.ID)} disabled={refreshingId===lastNotif.ID}>
                      {refreshingId===lastNotif.ID ? "Checking…" : "Check status"}
                    </button>
                  </div>
                )}
              </div>
              <div className="ft-actions">
                <button type="button" className="btn-primary" onClick={()=>setNotifyTarget(l)}>
                  <Send size={14}/>Send Notification
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <NotifyModal
        open={!!notifyTarget}
        leader={notifyTarget}
        pending={notifyTarget ? notifyTarget.pending : 0}
        phone={notifyTarget ? phoneFor(notifyTarget) : ""}
        saving={savingPhone}
        error={phoneSaveError}
        onClose={()=>{setNotifyTarget(null); setPhoneSaveError("");}}
        onSavePhone={(phone)=>handleSavePhone(notifyTarget.id, phone)}
        onSend={handleSend}
      />
    </div>
  );
}

function ConsolidationApp() {
  const [view, setView] = useState("firsttimers"); // "firsttimers" | "leaders"
  const [records, setRecords] = useState([]);
  const [leaderPhoneMap, setLeaderPhoneMap] = useState({}); // leaderId -> phone, from the Leaders sheet
  const [notifications, setNotifications] = useState([]); // log of sent SMS notifications, from the Notifications sheet
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterNetwork, setFilterNetwork] = useState("All");
  const [filterDate, setFilterDate] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const data = await apiGetC();
      setRecords(data.records || []);
      const map = {};
      (data.leaders || []).forEach(l => { if (l.Phone) map[l.ID] = String(l.Phone); });
      setLeaderPhoneMap(map);
      setNotifications(data.notifications || []);
    }
    catch { setError("Couldn't load First Timer records. Check the Consolidation script URL is set."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function handleSavePhone(leaderId, phone) {
    await apiPostC({ action:"updateLeaderPhone", id:leaderId, phone });
    setLeaderPhoneMap(prev => ({ ...prev, [leaderId]: phone }));
  }

  // Sends the SMS through Semaphore (via the backend) and logs it — throws if
  // the API key isn't configured yet or Semaphore rejects the request, so the
  // modal can show the real error instead of silently pretending it worked.
  async function handleSendNotification(leaderId, leaderName, phone, message) {
    const json = await apiPostC({ action:"sendNotification", leaderId, leaderName, phone, message });
    setNotifications(prev => [...prev, json.notification]);
    return json.notification;
  }

  async function handleRefreshStatus(notifId) {
    const json = await apiPostC({ action:"refreshNotificationStatus", notifId });
    setNotifications(prev => prev.map(n => String(n.ID)===String(notifId) ? { ...n, Status: json.status } : n));
    return json.status;
  }

  const notConfigured = CONSOLIDATION_SCRIPT_URL.indexOf("PASTE_YOUR") === 0;

  const dateScoped = filterDate
    ? records.filter(r => toManilaISODate(r.DateVisited) === filterDate)
    : records;

  const filtered = dateScoped.filter(r =>
    (filterStatus==="All" || r.FollowUpStatus===filterStatus) &&
    (filterNetwork==="All" || r.AssignedNetworkId===filterNetwork)
  ).sort((a,b)=> String(b.DateEncoded||"").localeCompare(String(a.DateEncoded||"")));

  const stats = useMemo(() => ({
    total: dateScoped.length,
    notYet: dateScoped.filter(r=>r.FollowUpStatus==="Not Yet Contacted").length,
    attending: dateScoped.filter(r=>r.FollowUpStatus==="Attending Cell").length,
  }), [dateScoped]);

  async function handleSave(form) {
    setSaving(true);
    try {
      if (editing) {
        await apiPostC({ action:"updateRecord", id:editing.ID, record:form });
      } else {
        await apiPostC({ action:"createRecord", record:form });
      }
      setModalOpen(false); setEditing(null);
      await load();
    } catch { setError("Couldn't save — please try again."); }
    finally { setSaving(false); }
  }

  async function handleStatusChange(record, status) {
    setRecords(prev => prev.map(r => r.ID===record.ID ? { ...r, FollowUpStatus:status } : r));
    try { await apiPostC({ action:"updateRecord", id:record.ID, record:{ FollowUpStatus:status } }); }
    catch { setError("Couldn't update status — please refresh and try again."); }
  }

  return (
    <div className="shell">
      <style>{CSS}</style>
      <div className="shell-body">
        <div className="content-area" style={{width:"100%"}}>
          <header className="topbar">
            <button className="brand" style={{cursor:"default"}}>
              <span className="brand-mark topbar-mark">SPQ</span>
              <span className="brand-name">Consolidation System</span>
            </button>
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              <button className={`tab-btn${view==="firsttimers"?" tab-btn-active":""}`} onClick={()=>setView("firsttimers")}>
                <ClipboardList size={14}/>First Timers
              </button>
              <button className={`tab-btn${view==="leaders"?" tab-btn-active":""}`} onClick={()=>setView("leaders")}>
                <Users size={14}/>Network Leaders
              </button>
              <button className="icon-btn" onClick={load} title="Refresh"><RefreshCw size={15} className={loading?"spin":""}/></button>
            </div>
          </header>

          <main className="main">
            {view==="leaders" ? (
              <NetworkLeadersScreen records={records} leaderPhoneMap={leaderPhoneMap} onSavePhone={handleSavePhone}
                notifications={notifications} onSendNotification={handleSendNotification} onRefreshStatus={handleRefreshStatus}/>
            ) : notConfigured ? (
              <div className="home-wrap">
                <div className="home-hero">
                  <span className="eyebrow">Consolidation</span>
                  <h1>First Timers &amp; VIPs</h1>
                </div>
                <div className="empty">
                  <ClipboardList size={28}/>
                  <p className="empty-title">Not connected yet</p>
                  <p className="empty-sub">Deploy <code>ConsolidationBackend.gs</code> as a Web App, then paste its URL into
                    <code> CONSOLIDATION_SCRIPT_URL</code> near the top of <code>src/App.jsx</code>.</p>
                </div>
              </div>
            ) : (
              <div className="home-wrap">
                <div className="home-hero">
                  <span className="eyebrow">Consolidation</span>
                  <h1>First Timers &amp; VIPs</h1>
                  <p className="lede">Log every First Timer or VIP at TRCF and assign them to a network leader for
                    follow-up — replacing the paper logbook. Records saved here appear instantly in the Pastors'
                    Overview dashboard.</p>
                </div>

                {error && <div className="error-box"><AlertCircle size={15}/>{error}</div>}

                <div className="stats">
                  {[
                    {n: stats.total,     l: filterDate ? `First Timers on ${formatDate(filterDate)}` : "Total First Timers"},
                    {n: stats.notYet,    l:"Not Yet Contacted"},
                    {n: stats.attending, l:"Now Attending a Cell"},
                  ].map(s=>(
                    <div key={s.l} className="stat">
                      <span className="stat-n">{loading?"—":s.n}</span>
                      <span className="stat-l">{s.l}</span>
                    </div>
                  ))}
                </div>

                <div className="screen-head">
                  <div className="filter-row">
                    <span className="filter-label"><Filter size={13}/>Filter</span>
                    <input type="date" value={filterDate} onChange={e=>setFilterDate(e.target.value)}/>
                    {filterDate && <button type="button" className="btn-ghost" onClick={()=>setFilterDate("")}>All dates</button>}
                    <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
                      <option value="All">All statuses</option>
                      {FOLLOWUP_STATUSES.map(s=><option key={s}>{s}</option>)}
                    </select>
                    <select value={filterNetwork} onChange={e=>setFilterNetwork(e.target.value)}>
                      <option value="All">All networks</option>
                      {NETWORKS.map(n=><option key={n.id} value={n.id}>{n.label}</option>)}
                    </select>
                  </div>
                  <button className="btn-primary" onClick={()=>{setEditing(null);setModalOpen(true);}}>
                    <UserPlus2 size={15}/>Add First Timer
                  </button>
                </div>

                {loading ? <div className="empty"><Loader2 size={22} className="spin"/></div>
                : filtered.length===0 ? (
                  <div className="empty">
                    <p className="empty-title">{filterDate ? `No First Timers logged on ${formatDate(filterDate)}` : "No First Timers logged yet"}</p>
                    <p className="empty-sub">{filterDate ? "Try a different date, or clear the date filter." : "Click \"Add First Timer\" to log the first record."}</p>
                  </div>
                ) : (
                  <div className="ft-list">
                    {filtered.map(r=>(
                      <div key={r.ID} className="ft-card">
                        <div className="ft-main">
                          <div className="ft-name-line">
                            <span className="ft-name">{r.Name}</span>
                            <span className={`ft-status ${statusClass(r.FollowUpStatus)}`}>{r.FollowUpStatus}</span>
                            {r.Decision && <span className="badge badge-notes">{r.Decision}</span>}
                          </div>
                          <div className="ft-meta">
                            {r.ContactNumber && <span><Phone size={11}/>{r.ContactNumber}</span>}
                            {r.DateVisited && <span><Calendar size={11}/>{formatDate(r.DateVisited)}</span>}
                            {r.InvitedBy && <span>Invited by {r.InvitedBy}</span>}
                          </div>
                          <div className="ft-assign">
                            Assigned to <strong>{r.AssignedLeaderName || "—"}</strong>
                            {r.AssignedNetworkId && <> · {(NETWORKS.find(n=>n.id===r.AssignedNetworkId)||{}).label}</>}
                            {r.EncodedBy && <span className="ft-encoder"> · logged by {r.EncodedBy}</span>}
                          </div>
                        </div>
                        <div className="ft-actions">
                          <select className="status-select" value={r.FollowUpStatus} onChange={e=>handleStatusChange(r, e.target.value)}>
                            {FOLLOWUP_STATUSES.map(s=><option key={s}>{s}</option>)}
                          </select>
                          <button className="icon-btn" onClick={()=>{setEditing(r);setModalOpen(true);}}><Pencil size={14}/></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <FirstTimerModal open={modalOpen} initial={editing} saving={saving}
                  onClose={()=>{if(!saving){setModalOpen(false);setEditing(null);}}} onSave={handleSave}/>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return <ConsolidationApp/>;
}

const CSS = `
:root {
  color-scheme: light;
  --paper:  #FAF6EE; --raised: #FFFFFF; --ink: #1F2A24;
  --faint:  #9C9485; --line:   #E4DDCC;
  --sage:   #5B7A63; --sage-d: #44604C;
  --gold:   #C99A4B;
  --rose:   #B8757A; --rose-d: #9C5B61;
  --blue:   #5C7C9C; --blue-d: #46647F;
  --danger: #B23B3B; --green:  #3A7D5C;
  --amber:  #8B6914;
  --lgl:    #6B4FA0; --lgl-d:  #52388A;
  --tim:    #B8850C; --tim-d:  #8A6208;
  --navy:   #1F2A44;
}
*{box-sizing:border-box;margin:0;padding:0;}
html{color-scheme:light;}
body{background:var(--paper);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color-scheme:light;}
.shell{color-scheme:light;overflow-x:hidden;}
.spin{animation:spin .9s linear infinite;}
@keyframes spin{to{transform:rotate(360deg);}}

.topbar{position:sticky;top:0;z-index:10;display:flex;align-items:center;justify-content:space-between;padding:16px 28px;border-bottom:1px solid var(--line);background:var(--paper);}
.brand{display:flex;align-items:center;gap:10px;background:none;border:none;cursor:pointer;}
.brand-mark{background:var(--navy);color:#fff;font-weight:700;font-size:13px;letter-spacing:.04em;padding:6px 9px;border-radius:6px;}
.brand-name{font-size:16px;font-weight:700;color:var(--ink);}
.main{max-width:880px;margin:0 auto;padding:40px 24px 80px;}

.bc{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--faint);margin-bottom:22px;flex-wrap:wrap;}
.bc-btn{background:none;border:none;font-size:13px;color:var(--faint);cursor:pointer;}
.bc-btn:hover{color:var(--ink);text-decoration:underline;}
.bc-cur{font-size:13px;color:var(--ink);font-weight:600;}

.screen-head{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:28px;gap:16px;flex-wrap:wrap;}
.screen-head h1{font-size:30px;font-weight:700;margin-bottom:4px;}
.eyebrow-sm{font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--faint);display:block;margin-bottom:4px;}
.sub{font-size:14px;color:var(--faint);}
.acc-boys  .screen-head h1{color:var(--blue-d);}
.acc-girls .screen-head h1{color:var(--rose-d);}

.error-box{display:flex;align-items:center;gap:8px;background:#F8E9E5;color:var(--danger);border:1px solid #E5BDB5;border-radius:10px;padding:12px 16px;font-size:14px;margin-bottom:28px;}
.link-btn{background:none;border:none;font-size:13px;color:var(--faint);cursor:pointer;}

.home-wrap{max-width:720px;}
.home-hero{margin-bottom:36px;}
.eyebrow{display:inline-block;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--navy);font-weight:700;margin-bottom:14px;}
.home-hero h1{font-size:42px;line-height:1.08;font-weight:700;letter-spacing:-.01em;margin-bottom:16px;}
.lede{font-size:16px;line-height:1.6;color:#5B5447;}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:0;margin-bottom:40px;padding-bottom:32px;border-bottom:1px solid var(--line);}
.stat{display:flex;flex-direction:column;padding:0 20px 0 0;border-right:1px solid var(--line);}
.stat:not(:first-child){padding:0 20px;}
.stat:last-child{border-right:none;}
.stat-n{font-size:34px;font-weight:700;color:var(--navy);}
.stat-l{font-size:13px;color:var(--faint);margin-top:2px;}

/* Networks grid (top-level pastor overview cards) */
.net-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;}
.net-card{text-align:left;background:var(--raised);border:1px solid var(--line);border-radius:16px;padding:22px;cursor:pointer;display:flex;flex-direction:column;gap:8px;transition:transform .15s,box-shadow .15s,border-color .15s;}
.net-card:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(31,42,36,.08);border-color:var(--navy);}
.net-card:disabled{cursor:default;opacity:.7;}
.net-card-error{border-color:#E5BDB5;}
.net-card-top{display:flex;align-items:center;gap:8px;color:var(--navy);}
.net-card-name{font-size:17px;font-weight:700;color:var(--ink);}
.net-card-leaders{display:flex;flex-direction:column;gap:2px;}
.net-leader-line{display:flex;align-items:center;gap:5px;font-size:12.5px;color:var(--faint);}
.net-card-status{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--faint);}
.net-card-status-err{color:var(--danger);}
.net-card-counts{display:flex;gap:6px;flex-wrap:wrap;}
.net-pill{font-size:11px;font-weight:700;border-radius:20px;padding:3px 10px;background:#EEF1F6;color:var(--navy);}

.doors{display:grid;grid-template-columns:1fr 1fr;gap:18px;}
.door{display:flex;flex-direction:column;align-items:flex-start;gap:4px;text-align:left;background:var(--raised);border:1px solid var(--line);border-radius:16px;padding:28px 24px;cursor:pointer;transition:transform .15s,box-shadow .15s,border-color .15s;}
.door:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(31,42,36,.08);}
.door-boys{color:var(--blue-d);} .door-boys:hover{border-color:var(--blue);}
.door-girls{color:var(--rose-d);} .door-girls:hover{border-color:var(--rose);}
.door-network-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--faint);margin-top:10px;}
.door-title{font-size:20px;font-weight:700;color:var(--ink);line-height:1.2;}
.door-count{font-size:13px;color:var(--faint);margin-top:2px;}
.door-go{margin-top:12px;font-size:13px;font-weight:700;display:flex;align-items:center;gap:2px;}

.card-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px;}
.leader-card{text-align:left;background:var(--raised);border:1px solid var(--line);border-radius:14px;padding:20px;cursor:pointer;display:flex;flex-direction:column;gap:8px;transition:transform .15s,box-shadow .15s;}
.leader-card:hover{transform:translateY(-2px);box-shadow:0 8px 22px rgba(31,42,36,.08);}
.lc-tag{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--faint);}
.lc-name{font-size:18px;font-weight:700;}
.lc-counts{display:flex;gap:6px;flex-wrap:wrap;}
.lc-pill{font-size:11px;font-weight:700;border-radius:20px;padding:3px 10px;}
.lc-open{background:#EAF4F0;color:var(--sage-d);}
.lc-close{background:#F0F4FA;color:var(--blue-d);}
.lc-days{display:flex;gap:4px;flex-wrap:wrap;}
.go-lnk{font-size:12px;font-weight:700;color:var(--navy);display:flex;align-items:center;gap:4px;margin-top:4px;}

.cell-split{display:grid;grid-template-columns:1fr 1fr;gap:18px;}
.cell-card{text-align:left;background:var(--raised);border:1px solid var(--line);border-radius:16px;padding:24px;cursor:pointer;display:flex;flex-direction:column;gap:12px;transition:transform .15s,box-shadow .15s;}
.cell-card:hover{transform:translateY(-2px);box-shadow:0 8px 22px rgba(31,42,36,.08);}
.cell-open:hover{border-color:var(--sage);}
.cell-close:hover{border-color:var(--blue);}
.cc-top{display:flex;align-items:baseline;gap:10px;}
.cc-count{font-size:36px;font-weight:700;}
.cell-open  .cc-count{color:var(--sage-d);}
.cell-close .cc-count{color:var(--blue-d);}
.cc-label{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--faint);}
.cc-days{display:flex;gap:4px;flex-wrap:wrap;}
.cc-desc{font-size:14px;color:#5B5447;line-height:1.5;}

.groups{display:flex;flex-direction:column;gap:24px;}
.day-group{display:flex;flex-direction:column;gap:10px;}
.day-group-head{display:flex;align-items:center;justify-content:space-between;padding:0 2px;gap:10px;flex-wrap:wrap;}
.day-group-label{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:700;color:var(--ink);}
.day-group-right{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
.day-group-count{font-size:12px;color:var(--faint);}

.day-badge{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;background:#EEF4FF;color:var(--blue-d);border-radius:20px;padding:3px 8px;}

.member-list{display:flex;flex-direction:column;gap:1px;background:var(--line);border:1px solid var(--line);border-radius:12px;overflow:hidden;}
.member-row{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;background:var(--raised);padding:14px 18px;}
.member-row-lgl{background:#FAF6FF;border-left:3px solid var(--lgl);}
.member-rank{flex-shrink:0;width:22px;height:22px;border-radius:50%;background:var(--paper);border:1px solid var(--line);font-size:11px;font-weight:700;color:var(--faint);display:flex;align-items:center;justify-content:center;margin-top:2px;}
.member-main{display:flex;flex-direction:column;gap:8px;flex:1;min-width:0;}
.member-name-line{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.member-name{font-weight:700;font-size:15px;}
.member-loc{display:flex;align-items:center;gap:3px;font-size:12px;color:var(--faint);}
.member-side{display:flex;align-items:center;gap:8px;flex-shrink:0;}

.lgl-action-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding-top:4px;}
.btn-view-cell{display:inline-flex;align-items:center;gap:5px;background:#F2EEF9;border:1px solid #C9B8E8;color:var(--lgl-d);border-radius:8px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;transition:background .15s;}
.btn-view-cell:hover{background:#E8E0F7;}

.lgl-notice{display:flex;align-items:flex-start;gap:10px;background:#F2EEF9;border:1px solid #C9B8E8;border-radius:10px;padding:12px 16px;font-size:13px;color:var(--lgl-d);line-height:1.5;margin-bottom:24px;}
.lgl-notice svg{flex-shrink:0;margin-top:1px;}

.track-pills{display:flex;flex-wrap:wrap;gap:5px;}
.track-pill{font-size:11px;font-weight:700;color:var(--ink);background:#FBF0DC;border:1px solid var(--gold);border-radius:6px;padding:3px 8px;line-height:1.2;}
.track-pill-lgl{background:#F2EEF9;border-color:#C9B8E8;color:var(--lgl-d);}
.track-list-empty{font-size:12px;color:var(--faint);font-weight:400;font-style:italic;}

.subldr-list{display:flex;flex-direction:column;gap:1px;background:var(--line);border:1px solid var(--line);border-radius:12px;overflow:hidden;}
.subldr-row{background:var(--raised);display:flex;flex-direction:column;}
.subldr-main{display:flex;align-items:center;justify-content:space-between;padding:14px 18px 8px;cursor:pointer;background:none;border:none;text-align:left;width:100%;gap:12px;}
.subldr-main:hover{background:#F8F5EF;}
.subldr-info{display:flex;flex-direction:column;gap:2px;}
.subldr-name{font-size:15px;font-weight:700;}
.subldr-loc{font-size:12px;color:var(--faint);display:flex;align-items:center;gap:3px;}
.subldr-meta{display:flex;align-items:center;gap:8px;flex-shrink:0;}
.subldr-count{font-size:12px;color:var(--faint);font-weight:700;}
.subldr-actions{display:flex;align-items:center;gap:10px;padding:4px 18px 12px;border-top:1px solid var(--line);flex-wrap:wrap;}
.subldr-actions .track-pills{flex:1;min-width:120px;}

.badge{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;border-radius:20px;padding:3px 8px;}
.badge-green{background:#E6F4ED;color:var(--green);}
.badge-red{background:#F8E9E5;color:var(--danger);}
.badge-close{background:#EEF4FF;color:var(--blue-d);}
.badge-notes{background:#FEF3C7;color:var(--amber);}
.badge-lgl{background:#F2EEF9;color:var(--lgl-d);}
.badge-timothy{background:#FCF3DE;color:var(--tim-d);}
.member-row-close{background:#F5F8FF;}

.icon-btn{display:inline-flex;align-items:center;justify-content:center;background:none;border:none;color:var(--faint);cursor:pointer;padding:6px;border-radius:6px;}
.icon-btn:hover{background:#F1ECDF;color:var(--ink);}

.resize-btn{width:auto;gap:5px;padding:6px 10px;border:1px solid var(--line);}
.resize-btn-label{font-size:11px;font-weight:700;}
.resize-btn-active{background:#EAF4F0;border-color:var(--sage);color:var(--sage-d);}
.resize-btn-active:hover{background:#DCEEE3;}

.empty{display:flex;flex-direction:column;align-items:center;gap:10px;padding:60px 20px;text-align:center;border:1px dashed var(--line);border-radius:14px;color:var(--faint);}
.empty-title{font-weight:700;color:var(--ink);}
.empty-sub{font-size:14px;margin-bottom:4px;}

/* Resize / text-size scaling */
.main{max-width:880px;}
.shell[data-textsize="large"] .main{zoom:1.12;}
.shell[data-textsize="large"] .topbar .brand-name,
.shell[data-textsize="large"] .topbar .resize-btn-label{font-size:115%;}
.shell[data-textsize="xlarge"] .main{zoom:1.25;}
.shell[data-textsize="xlarge"] .topbar .brand-name,
.shell[data-textsize="xlarge"] .topbar .resize-btn-label{font-size:128%;}

@media(max-width:480px){
  .shell[data-textsize="large"] .main{zoom:1.08;}
  .shell[data-textsize="xlarge"] .main{zoom:1.15;}
}

@media(max-width:560px){
  .doors,.cell-split{grid-template-columns:1fr;}
  .home-hero h1{font-size:32px;}
  .main{padding:28px 16px 60px;}
  .member-row{flex-wrap:wrap;}
  .stats{grid-template-columns:repeat(3,1fr);gap:10px;}
  .stat{padding:0 4px 0 0;border-right:none;}
  .stat:not(:first-child){padding:0 4px;}
  .stat-n{font-size:26px;}
  .stat-l{font-size:11px;line-height:1.3;}
  .net-grid{grid-template-columns:1fr;}
  .shell-body{flex-direction:column;}
  .sidebar{width:100%;flex-direction:row;padding:10px 14px;gap:8px;overflow-x:auto;}
  .sidebar-brand{display:none;}
  .sidebar-item{white-space:nowrap;}
}

/* ── Sidebar layout ─────────────────────────────────────────────────── */
.shell-body{display:flex;min-height:100vh;}
.sidebar{width:230px;flex-shrink:0;background:var(--raised);border-right:1px solid var(--line);
  display:flex;flex-direction:column;gap:4px;padding:20px 14px;position:sticky;top:0;height:100vh;overflow-y:auto;}
.sidebar-brand{display:flex;align-items:center;gap:8px;padding:6px 10px 18px;}
.sidebar-brand-name{font-size:13px;font-weight:700;color:var(--ink);line-height:1.3;}
.sidebar-item{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:9px;
  font-size:14px;font-weight:700;color:var(--faint);cursor:pointer;background:none;border:none;font-family:inherit;text-align:left;}
.sidebar-item:hover{background:#F1ECDF;color:var(--ink);}
.sidebar-item-active{background:#EEF1F6;color:var(--navy);}
.content-area{flex:1;min-width:0;}
.topbar-mark{display:none;}
@media(min-width:561px){ .topbar-mark{display:none;} }

/* ── Modal / form controls (Consolidation) ─────────────────────────── */
.overlay{position:fixed;inset:0;background:rgba(31,42,36,.45);display:flex;align-items:center;justify-content:center;padding:20px;z-index:50;overflow:auto;}
.modal{background:var(--raised);border-radius:16px;width:100%;max-width:460px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.25);}
.modal-head{display:flex;align-items:center;justify-content:space-between;padding:20px 22px 12px;}
.modal-head h2{font-size:19px;font-weight:700;}
.modal-body{padding:4px 22px 22px;display:flex;flex-direction:column;gap:14px;}
.modal-foot{display:flex;justify-content:flex-end;gap:10px;padding:0 22px 22px;}
.field{display:flex;flex-direction:column;gap:6px;}
.field>span{font-size:13px;font-weight:700;}
.field input,.field select{font-size:14px;padding:10px 12px;border:1px solid var(--line);border-radius:8px;background:var(--paper);color:var(--ink);font-family:inherit;}
.field input:focus,.field select:focus{outline:2px solid var(--navy);outline-offset:1px;}
.field-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.btn-primary{display:inline-flex;align-items:center;gap:6px;background:var(--navy);color:#fff;border:none;border-radius:9px;padding:10px 16px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;transition:background .15s;}
.btn-primary:hover{background:#141b30;}
.btn-primary:disabled{opacity:.6;cursor:default;}
.btn-ghost{background:none;border:1px solid var(--line);border-radius:9px;padding:10px 16px;font-size:14px;font-weight:700;color:var(--ink);cursor:pointer;font-family:inherit;}
.btn-ghost:hover{background:#F1ECDF;}

/* ── Consolidation list ─────────────────────────────────────────────── */
.filter-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.filter-label{display:flex;align-items:center;gap:5px;font-size:12px;font-weight:700;color:var(--faint);}
.filter-row select{font-size:13px;padding:7px 10px;border:1px solid var(--line);border-radius:8px;background:var(--raised);color:var(--ink);font-family:inherit;}
.filter-row input[type="date"]{font-size:13px;padding:6px 10px;border:1px solid var(--line);border-radius:8px;background:var(--raised);color:var(--ink);font-family:inherit;}
.ft-list{display:flex;flex-direction:column;gap:1px;background:var(--line);border:1px solid var(--line);border-radius:12px;overflow:hidden;}
.ft-card{background:var(--raised);padding:16px 18px;display:flex;align-items:flex-start;justify-content:space-between;gap:14px;flex-wrap:wrap;}
.ft-main{display:flex;flex-direction:column;gap:6px;flex:1;min-width:220px;}
.ft-name-line{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.ft-name{font-weight:700;font-size:15px;}
.ft-status{font-size:11px;font-weight:700;border-radius:20px;padding:3px 10px;}
.status-new{background:#EEF1F6;color:var(--navy);}
.status-mid{background:#FEF3C7;color:var(--amber);}
.status-good{background:#E6F4ED;color:var(--green);}
.status-bad{background:#F8E9E5;color:var(--danger);}
.ft-meta{display:flex;gap:14px;flex-wrap:wrap;font-size:12.5px;color:var(--faint);}
.ft-meta span{display:flex;align-items:center;gap:4px;}
.ft-assign{font-size:12.5px;color:var(--faint);}
.ft-encoder{font-style:italic;}
.ft-actions{display:flex;align-items:center;gap:8px;flex-shrink:0;}
.status-select{font-size:12px;font-weight:700;padding:6px 10px;border:1px solid var(--line);border-radius:20px;background:var(--paper);color:var(--ink);font-family:inherit;}

.tab-btn{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:700;padding:8px 14px;border-radius:9px;border:1px solid transparent;background:none;color:var(--faint);cursor:pointer;font-family:inherit;}
.tab-btn:hover{background:#F1ECDF;color:var(--ink);}
.tab-btn-active{background:var(--sage);color:#fff;}
.tab-btn-active:hover{background:var(--sage-d);color:#fff;}

.leader-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;align-items:stretch;}
.leader-card{display:flex;flex-direction:column;justify-content:space-between;gap:14px;background:var(--raised);border:1px solid var(--line);border-radius:14px;padding:18px 18px 16px;}
.leader-main{display:flex;flex-direction:column;gap:6px;min-width:0;}
.leader-card .ft-actions{justify-content:flex-start;}
.leader-name-line{display:flex;align-items:center;gap:8px;}
.leader-nophone{font-style:italic;}
.leader-pending{color:var(--amber);}
.btn-disabled{opacity:.45;pointer-events:none;cursor:not-allowed;}

.notif-line{display:flex;align-items:center;gap:6px;font-size:12px;margin-top:2px;}
.notif-line span{flex:1;}
.notif-ok{color:var(--green);}
.notif-bad{color:var(--danger);}
.notif-pending{color:var(--faint);}
.notif-refresh{background:none;border:none;font-size:11.5px;font-weight:700;color:var(--navy);cursor:pointer;padding:0;text-decoration:underline;font-family:inherit;flex:none;}
.notif-refresh:disabled{opacity:.5;cursor:default;}

.notif-result{display:flex;align-items:flex-start;gap:10px;border-radius:10px;padding:14px 16px;font-size:13px;}
.notif-result svg{flex-shrink:0;margin-top:1px;}
.notif-result-status{font-weight:700;margin-bottom:2px;}
.notif-result-sub{color:var(--faint);font-size:12.5px;}
.notif-result.notif-ok{background:#E6F4ED;color:var(--green);}
.notif-result.notif-bad{background:#F8E9E5;color:var(--danger);}
.notif-result.notif-pending{background:#F1ECDF;color:var(--faint);}
`;

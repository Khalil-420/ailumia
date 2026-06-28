import React, { useState, useEffect } from 'react';
import api, { getEmployeeLogs, getAdminEmail } from '../services/api';

const ACTION_META = {
  starred:             { label: 'Starred an email',             color: '#f59e0b', bg: '#fffbeb', border: '#fde68a' },
  unstarred:           { label: 'Removed star from an email',   color: '#94a3b8', bg: '#f8fafc', border: '#e2e8f0' },
  trashed:             { label: 'Moved an email to Trash',      color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' },
  spam:                { label: 'Marked an email as Spam',      color: '#ea580c', bg: '#fff7ed', border: '#fed7aa' },
  not_spam:            { label: 'Removed an email from Spam',   color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc' },
  restored:            { label: 'Restored an email from Trash', color: '#0e7c61', bg: '#f0fdf4', border: '#bbf7d0' },
  permanently_deleted: { label: 'Permanently deleted an email', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  read:                { label: 'Marked an email as read',      color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  unread:              { label: 'Marked an email as unread',    color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
  sent:                { label: 'Sent an email',                color: '#0e7c61', bg: '#f0fdf4', border: '#bbf7d0' },
};

const TABS = [
  { id: 'all',     label: 'All Activity', filter: null },
  { id: 'sent',    label: 'Sent',         filter: ['sent'] },
  { id: 'starred', label: 'Starred',      filter: ['starred'] },
  { id: 'trashed', label: 'Trashed',      filter: ['trashed', 'permanently_deleted'] },
  { id: 'spam',    label: 'Spam',         filter: ['spam'] },
];

function formatDate(val) {
  if (!val) return '';
  const d = new Date(val);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
    + ' at ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatEmailDate(ms) {
  if (!ms) return '';
  return new Date(ms).toLocaleString([], {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

// ── Email viewer overlay ─────────────────────────────────────────────────────
function EmailViewer({ userId, log, employee, onClose }) {
  const [email,   setEmail]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    if (log.action === 'sent') {
      setLoading(false);
      setEmail({ _sentOnly: true, to: log.email_id, subject: log.subject });
      return;
    }
    if (!log.email_id) {
      setLoading(false);
      setError('No email reference stored for this action.');
      return;
    }
    (async () => {
      try {
        const res = await getAdminEmail(userId, log.email_id, log.folder || 'INBOX');
        setEmail(res.data.email);
      } catch (err) {
        setError(err.response?.data?.detail || 'Could not load this email.');
      } finally { setLoading(false); }
    })();
  }, []);

  const meta = ACTION_META[log.action] || { label: log.action, color: '#64748b' };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300,
      display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}>
      {/* Backdrop */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(2px)' }}/>

      {/* Panel */}
      <div onClick={e => e.stopPropagation()}
        style={{ position: 'relative', width: '100%', maxWidth: 680,
          maxHeight: '85vh', display: 'flex', flexDirection: 'column',
          background: '#fff', borderRadius: 14,
          boxShadow: '0 24px 64px rgba(15,23,42,0.22)', overflow: 'hidden',
          margin: '0 16px' }}>

        {/* Panel header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12,
          padding: '16px 22px', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 6,
            background: meta.bg, color: meta.color, border: `1px solid ${meta.border}`,
            whiteSpace: 'nowrap' }}>
            {meta.label}
          </span>
          <span style={{ fontSize: 12.5, color: '#94a3b8' }}>
            by <strong style={{ color: '#475569' }}>{employee.username}</strong>
            {' '}· {formatDate(log.created_at)}
          </span>
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none',
            border: '1px solid #e2e8f0', borderRadius: 8, width: 30, height: 30,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#94a3b8', fontSize: 18, lineHeight: 1, transition: 'all .12s' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#475569'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#94a3b8'; }}>
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '22px 24px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8', fontSize: 14 }}>
              Loading email content...
            </div>
          ) : error ? (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10,
              padding: '14px 18px', fontSize: 13.5, color: '#dc2626' }}>{error}</div>
          ) : email?._sentOnly ? (
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#0f172a', marginBottom: 16 }}>
                {email.subject || '(no subject)'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8,
                padding: '14px 18px', background: '#f8fafc', borderRadius: 10,
                border: '1px solid #e2e8f0', fontSize: 13.5, color: '#475569' }}>
                <div><span style={{ color: '#94a3b8', minWidth: 50, display: 'inline-block' }}>To</span> {email.to}</div>
              </div>
              <div style={{ marginTop: 16, fontSize: 13, color: '#94a3b8', fontStyle: 'italic' }}>
                Full content of sent emails is not stored — only the recipient and subject are logged.
              </div>
            </div>
          ) : email ? (
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', marginBottom: 18, lineHeight: 1.4 }}>
                {email.subject || '(no subject)'}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 7,
                padding: '14px 18px', background: '#f8fafc', borderRadius: 10,
                border: '1px solid #e2e8f0', fontSize: 13.5, marginBottom: 20 }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <span style={{ color: '#94a3b8', minWidth: 48 }}>From</span>
                  <span style={{ color: '#0f172a', fontWeight: 500 }}>
                    {email.from_name && email.from_name !== email.from_addr
                      ? `${email.from_name} <${email.from_addr}>`
                      : (email.from_addr || email.from || 'Unknown')}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <span style={{ color: '#94a3b8', minWidth: 48 }}>To</span>
                  <span style={{ color: '#475569' }}>
                    {Array.isArray(email.to) ? email.to.join(', ') : (email.to || '—')}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <span style={{ color: '#94a3b8', minWidth: 48 }}>Date</span>
                  <span style={{ color: '#475569' }}>{formatEmailDate(email.date_ms)}</span>
                </div>
              </div>

              <div style={{ fontSize: 13.5, color: '#334155', lineHeight: 1.7,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                borderTop: '1px solid #f1f5f9', paddingTop: 20 }}>
                {email.body || '(no body)'}
              </div>
            </div>
          ) : null}
        </div>

        {/* Read-only notice */}
        <div style={{ padding: '10px 24px', borderTop: '1px solid #f1f5f9', flexShrink: 0,
          fontSize: 11.5, color: '#94a3b8', background: '#fafbfc' }}>
          Read-only audit view — no actions can be taken from here.
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AdminPanel() {
  const [employees,   setEmployees]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [selected,    setSelected]    = useState(null);  // { employee, logs }
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError,   setLogsError]   = useState('');
  const [activeTab,   setActiveTab]   = useState('all');
  const [viewingLog,  setViewingLog]  = useState(null); // log entry being previewed

  const fetchEmployees = async () => {
    setLoading(true); setError('');
    try {
      const res = await api.get('/admin/employees');
      setEmployees(res.data.employees || []);
    } catch {
      setError('Failed to load employees.');
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchEmployees(); }, []);

  const openLogs = async (emp) => {
    setSelected({ employee: emp, logs: [] });
    setActiveTab('all');
    setViewingLog(null);
    setLogsLoading(true);
    setLogsError('');
    try {
      const res = await getEmployeeLogs(emp.id);
      setSelected({ employee: emp, logs: res.data.logs || [] });
    } catch {
      setLogsError('Failed to load activity logs.');
    } finally { setLogsLoading(false); }
  };

const roleColor = (role) => role === 'admin'
  ? { background: 'transparent', color: '#7c3aed' }
  : { background: 'transparent', color: '#0e7c61' };

  // ── Employee list ──────────────────────────────────────────────────────────
  if (!selected) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f1f5f9', minHeight: '100vh' }}>
        <div style={{ background: '#fff', padding: '14px 28px', borderBottom: '1px solid #e2e8f0',
          display: 'flex', alignItems: 'center', gap: 12 }}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#7c3aed"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          <span style={{ fontSize: 17, fontWeight: 600, color: '#0f172a' }}>Employee Management</span>
          <span style={{ marginLeft: 'auto', fontSize: 13, color: '#94a3b8' }}>
            {employees.length} account{employees.length !== 1 ? 's' : ''} registered
          </span>
        </div>

        <div style={{ padding: 28, flex: 1 }}>
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10,
            padding: '12px 18px', fontSize: 13, color: '#92400e', marginBottom: 22,
            display: 'flex', gap: 10 }}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ flexShrink: 0, marginTop: 1 }}>
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>
              To <strong>create</strong> a new employee account, add the user in Zimbra first.
              They will appear here automatically after their first login to AILumia.
              Click any row to view their activity log.
            </span>
          </div>

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10,
              padding: '10px 16px', fontSize: 13, color: '#dc2626', marginBottom: 16 }}>
              {error}
            </div>
          )}

          {loading ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8', fontSize: 14 }}>Loading...</div>
          ) : employees.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8', fontSize: 14 }}>No employees yet.</div>
          ) : (
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    {['Username', 'Email', 'Role', 'Joined', ''].map(h => (
                      <th key={h} style={{ padding: '11px 18px', textAlign: 'left',
                        fontWeight: 600, color: '#475569', fontSize: 12.5 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp, i) => (
                    <tr key={emp.id} onClick={() => openLogs(emp)}
                      style={{ borderBottom: i < employees.length - 1 ? '1px solid #f1f5f9' : 'none',
                        cursor: 'pointer', transition: 'background .1s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '13px 18px', fontWeight: 600, color: '#0f172a' }}>{emp.username}</td>
                      <td style={{ padding: '13px 18px', color: '#475569' }}>{emp.email}</td>
                      <td style={{ padding: '13px 18px' }}>
                        <span style={{ ...roleColor(emp.role), borderRadius: 20,
                          padding: '3px 12px', fontSize: 12, fontWeight: 600 }}>
                          {emp.role}
                        </span>
                      </td>
                      <td style={{ padding: '13px 18px', color: '#94a3b8', fontSize: 12.5 }}>
                        {new Date(emp.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '13px 18px', textAlign: 'right' }}>
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#94a3b8"
                          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="9 18 15 12 9 6"/>
                        </svg>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Employee log detail ────────────────────────────────────────────────────
  const { employee, logs } = selected;
  const currentTabDef = TABS.find(t => t.id === activeTab);
  const filteredLogs  = currentTabDef?.filter
    ? logs.filter(l => currentTabDef.filter.includes(l.action))
    : logs;

  const tabCount = (tab) => {
    if (!tab.filter) return logs.length;
    return logs.filter(l => tab.filter.includes(l.action)).length;
  };

  const canOpenEmail = (log) =>
    log.email_id && log.action !== 'permanently_deleted';

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f1f5f9', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ background: '#fff', padding: '14px 28px', borderBottom: '1px solid #e2e8f0',
        display: 'flex', alignItems: 'center', gap: 14 }}>
        <button onClick={() => { setSelected(null); setViewingLog(null); }}
          style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'none',
            border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 14px',
            fontSize: 13, color: '#475569', cursor: 'pointer', fontFamily: 'inherit',
            transition: 'all .12s' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = '#e2e8f0'; }}>
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Employees
        </button>

        <div style={{ width: 1, height: 20, background: '#e2e8f0' }}/>

        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.3 }}>
          <span style={{ fontSize: 15, fontWeight: 600, color: '#0f172a' }}>{employee.username}</span>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>{employee.email}</span>
        </div>

        <span style={{ ...roleColor(employee.role), borderRadius: 20,
          padding: '3px 12px', fontSize: 12, fontWeight: 600 }}>
          {employee.role}
        </span>

        <span style={{ marginLeft: 'auto', fontSize: 13, color: '#94a3b8' }}>
          {logs.length} action{logs.length !== 1 ? 's' : ''} recorded
        </span>
      </div>

      {/* Tabs */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0',
        padding: '0 28px', display: 'flex', gap: 2 }}>
        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          const count    = tabCount(tab);
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 7,
                padding: '11px 16px', background: 'none', border: 'none',
                borderBottom: isActive ? '2px solid #2563eb' : '2px solid transparent',
                fontSize: 13, fontWeight: isActive ? 600 : 400,
                color: isActive ? '#2563eb' : '#64748b',
                cursor: 'pointer', fontFamily: 'inherit',
                marginBottom: -1, transition: 'color .12s' }}>
              {tab.label}
              {count > 0 && (
                <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 6px', borderRadius: 10,
                  background: isActive ? '#dbeafe' : '#f1f5f9',
                  color: isActive ? '#2563eb' : '#94a3b8', lineHeight: '17px' }}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Log entries */}
      <div style={{ padding: 28, flex: 1 }}>
        {logsLoading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8', fontSize: 14 }}>Loading activity...</div>
        ) : logsError ? (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10,
            padding: '10px 16px', fontSize: 13, color: '#dc2626' }}>{logsError}</div>
        ) : filteredLogs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8', fontSize: 14 }}>
            No activity recorded{currentTabDef?.filter ? ' in this category' : ''} yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filteredLogs.map(log => {
              const meta      = ACTION_META[log.action] || { label: log.action, color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' };
              const clickable = canOpenEmail(log);
              return (
                <div key={log.id}
                  onClick={() => clickable && setViewingLog(log)}
                  style={{ display: 'flex', alignItems: 'center', gap: 16,
                    background: '#fff', borderRadius: 10, padding: '13px 18px',
                    border: '1px solid #e2e8f0',
                    cursor: clickable ? 'pointer' : 'default',
                    transition: 'border-color .12s, box-shadow .12s' }}
                  onMouseEnter={e => { if (clickable) { e.currentTarget.style.borderColor = '#bfdbfe'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(37,99,235,0.08)'; } }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'none'; }}>

                  <div style={{ width: 8, height: 8, borderRadius: '50%',
                    background: meta.color, flexShrink: 0 }}/>

                  <span style={{ display: 'inline-flex', alignItems: 'center',
                    padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                    background: meta.bg, color: meta.color, border: `1px solid ${meta.border}`,
                    flexShrink: 0, whiteSpace: 'nowrap' }}>
                    {meta.label}
                  </span>

                  {log.subject && (
                    <span style={{ fontSize: 13, color: '#475569', fontStyle: 'italic',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {log.subject}
                    </span>
                  )}

                  {!log.subject && log.folder && (
                    <span style={{ fontSize: 12, color: '#94a3b8', flex: 1 }}>{log.folder}</span>
                  )}

                  {!log.subject && !log.folder && <span style={{ flex: 1 }}/>}

                  <span style={{ fontSize: 12, color: '#94a3b8', flexShrink: 0, marginLeft: 'auto' }}>
                    {formatDate(log.created_at)}
                  </span>

                  {clickable && (
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none"
                      stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      style={{ flexShrink: 0 }}>
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Email viewer overlay */}
      {viewingLog && (
        <EmailViewer
          userId={employee.id}
          log={viewingLog}
          employee={employee}
          onClose={() => setViewingLog(null)}
        />
      )}
    </div>
  );
}

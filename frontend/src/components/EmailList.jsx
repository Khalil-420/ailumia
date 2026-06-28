import React, { useState } from 'react';
import { parseFrom } from '../utils/emailUtils';
import { emailAction, invalidateEmailCache } from '../services/api';

const TAG_STYLES = {
  business:   { color: '#1a5fa8', border: '#bdd5f5', bg: '#e8f1fb', label: 'Business'   },
  security:   { color: '#6a1b9a', border: '#d7b8e8', bg: '#f3e5f5', label: 'Security'   },
  tech:       { color: '#00695c', border: '#a5d6cf', bg: '#e0f2f1', label: 'Tech'       },
  hr:         { color: '#b45309', border: '#fbbf75', bg: '#fff3e0', label: 'HR'         },
  red_team:   { color: '#b71c1c', border: '#f4b8b8', bg: '#fdecea', label: 'Red Team'   },
  offer:      { color: '#2e7d32', border: '#b6ddb8', bg: '#e8f5e9', label: 'Offer'      },
  finance:    { color: '#1565c0', border: '#b3c8f0', bg: '#e3eefa', label: 'Finance'    },
  legal:      { color: '#4a148c', border: '#ce9ef5', bg: '#f3e5f5', label: 'Legal'      },
  operations: { color: '#37474f', border: '#b0bec5', bg: '#eceff1', label: 'Operations' },
  spam:       { color: '#c62828', border: '#efb8b8', bg: '#ffebee', label: 'Spam'       },
  other:      { color: '#555',    border: '#ddd',    bg: '#f5f5f5', label: 'Other'      },
};

const AI_CATEGORY_MAP = {
  'Business':   'business',
  'Tech':       'tech',
  'Security':   'security',
  'HR':         'hr',
  'Finance':    'finance',
  'Legal':      'legal',
  'Operations': 'operations',
  'Spam':       'spam',
  'Other':      'other',
};

function formatTime(ms) {
  if (!ms) return '';
  const date = new Date(ms);
  const now  = new Date();
  if (date.toDateString() === now.toDateString())
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function EmailList({ emails, loading, onEmailClick, onEmailsChange, folder, notify }) {
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
      flex:1, fontSize:14, color:'#94a3b8', padding:40 }}>Loading emails...</div>
  );
  if (!emails?.length) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
      flex:1, fontSize:14, color:'#94a3b8', padding:40 }}>No emails found</div>
  );

  const allSelected = emails.length > 0 && selectedIds.size === emails.length;
  const someSelected = selectedIds.size > 0;

  const toggleSelect = (e, id) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (e) => {
    e.stopPropagation();
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(emails.map(em => em.id)));
    }
  };

  const handleStar = async (e, email) => {
    e.stopPropagation();
    const op = email.starred ? 'unstar' : 'star';
    const message = email.starred ? 'Removed star.' : 'Starred email.';
    if (onEmailsChange) {
      onEmailsChange(prev => prev.map(em =>
        em.id === email.id ? { ...em, starred: !em.starred } : em
      ));
    }
    try {
      await emailAction(email.id, op, folder || 'INBOX', email.message_id || '');
      invalidateEmailCache('STARRED');
      notify?.(message, 'success');
    } catch {
      if (onEmailsChange) {
        onEmailsChange(prev => prev.map(em =>
          em.id === email.id ? { ...em, starred: email.starred } : em
        ));
      }
      notify?.('Unable to update starred status.', 'error');
    }
  };

  const handleBulkAction = async (op) => {
    if (!someSelected || bulkLoading) return;
    setBulkLoading(true);
    // Build a map from id → email so we can pass message_id
    const idToEmail = Object.fromEntries(emails.map(em => [em.id, em]));
    try {
      await Promise.all([...selectedIds].map(id =>
        emailAction(id, op, folder || 'INBOX', idToEmail[id]?.message_id || '')
      ));
      invalidateEmailCache();
      if (onEmailsChange) {
        if (op === 'read') {
          onEmailsChange(prev => prev.map(em =>
            selectedIds.has(em.id) ? { ...em, read: true } : em
          ));
        } else if (op === 'unread') {
          onEmailsChange(prev => prev.map(em =>
            selectedIds.has(em.id) ? { ...em, read: false } : em
          ));
        } else {
          // trash / spam / permanent_delete: remove from list
          onEmailsChange(prev => prev.filter(em => !selectedIds.has(em.id)));
        }
      }
      const message = op === 'trash'
        ? 'Moved selected emails to trash.'
        : op === 'spam'
          ? 'Marked selected emails as spam.'
          : op === 'permanent_delete'
            ? 'Deleted selected emails permanently.'
            : op === 'read'
              ? 'Marked selected emails as read.'
              : op === 'unread'
                ? 'Marked selected emails as unread.'
                : 'Updated selected emails.';
      notify?.(message, 'success');
      setSelectedIds(new Set());
    } catch (err) {
      console.error('Bulk action error:', err);
      notify?.('Bulk action failed. Please try again.', 'error');
    } finally {
      setBulkLoading(false);
    }
  };

  const isTrash = folder === 'TRASH';

  return (
    <div className="email-list" style={{ flex:1, display:'flex', flexDirection:'column', background:'#fff', overflowY:'auto' }}>
      {/* Header row: select-all + bulk actions */}
      <div className="email-list-header" style={{ display:'flex', alignItems:'center', padding:'0 20px', height:40,
        borderBottom:'1px solid #e2e8f0', background:'#f8fafc', gap:10, flexShrink:0 }}>
        {/* Select All checkbox */}
        <div onClick={toggleSelectAll} style={{ cursor:'pointer', display:'flex', alignItems:'center',
          width:16, height:16, border:'1.5px solid #2563eb', borderRadius:3, flexShrink:0,
          background: allSelected ? '#2563eb' : someSelected ? '#dbeafe' : '#fff',
          justifyContent:'center' }}>
          {allSelected && (
            <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="#fff" strokeWidth="2">
              <polyline points="1.5 6 4.5 9 10.5 3"/>
            </svg>
          )}
          {!allSelected && someSelected && (
            <div style={{ width:8, height:2, background:'#2563eb', borderRadius:1 }}/>
          )}
        </div>

        {someSelected ? (
          <>
            <span style={{ fontSize:12.5, color:'#475569', marginRight:4 }}>
              {selectedIds.size} selected
            </span>
            <div style={{ display:'flex', gap:4, marginLeft:4 }}>
              {!isTrash && (
                <button onClick={() => handleBulkAction('trash')} disabled={bulkLoading}
                  title="Move to trash"
                  style={{ display:'flex', alignItems:'center', gap:5, background:'none',
                    border:'1px solid #e2e5ec', borderRadius:6, padding:'3px 10px',
                    fontSize:12, color:'#555', cursor:'pointer', fontFamily:'inherit' }}
                  onMouseEnter={e => e.currentTarget.style.background='#f0f0f0'}
                  onMouseLeave={e => e.currentTarget.style.background='none'}>
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>
                  </svg>
                  Trash
                </button>
              )}
              {isTrash && (
                <button onClick={() => handleBulkAction('permanent_delete')} disabled={bulkLoading}
                  title="Delete permanently"
                  style={{ display:'flex', alignItems:'center', gap:5, background:'none',
                    border:'1px solid #fbbfbf', borderRadius:6, padding:'3px 10px',
                    fontSize:12, color:'#c62828', cursor:'pointer', fontFamily:'inherit' }}
                  onMouseEnter={e => e.currentTarget.style.background='#fff3f3'}
                  onMouseLeave={e => e.currentTarget.style.background='none'}>
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>
                  </svg>
                  Delete permanently
                </button>
              )}
              {!isTrash && (
                <button onClick={() => handleBulkAction('spam')} disabled={bulkLoading}
                  title="Mark as spam"
                  style={{ display:'flex', alignItems:'center', gap:5, background:'none',
                    border:'1px solid #e2e5ec', borderRadius:6, padding:'3px 10px',
                    fontSize:12, color:'#555', cursor:'pointer', fontFamily:'inherit' }}
                  onMouseEnter={e => e.currentTarget.style.background='#f0f0f0'}
                  onMouseLeave={e => e.currentTarget.style.background='none'}>
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  Spam
                </button>
              )}
              <button onClick={() => handleBulkAction('read')} disabled={bulkLoading}
                title="Mark as read"
                style={{ display:'flex', alignItems:'center', gap:5, background:'none',
                  border:'1px solid #e2e5ec', borderRadius:6, padding:'3px 10px',
                  fontSize:12, color:'#555', cursor:'pointer', fontFamily:'inherit' }}
                onMouseEnter={e => e.currentTarget.style.background='#f0f0f0'}
                onMouseLeave={e => e.currentTarget.style.background='none'}>
                Mark read
              </button>
              <button onClick={() => handleBulkAction('unread')} disabled={bulkLoading}
                title="Mark as unread"
                style={{ display:'flex', alignItems:'center', gap:5, background:'none',
                  border:'1px solid #e2e5ec', borderRadius:6, padding:'3px 10px',
                  fontSize:12, color:'#555', cursor:'pointer', fontFamily:'inherit' }}
                onMouseEnter={e => e.currentTarget.style.background='#f0f0f0'}
                onMouseLeave={e => e.currentTarget.style.background='none'}>
                Mark unread
              </button>
            </div>
          </>
        ) : (
          <span style={{ fontSize:12, color:'#94a3b8' }}>Select emails to perform actions</span>
        )}
      </div>

      {/* Email rows */}
      <div style={{ flex:1, overflowY:'auto' }}>
        {emails.map((email, idx) => {
          const isUnread   = !email.read;
          const isChecked  = selectedIds.has(email.id);
          const aiCatKey   = email.ai_category ? AI_CATEGORY_MAP[email.ai_category] : null;
          const tag        = aiCatKey ? TAG_STYLES[aiCatKey] : (email.tag ? TAG_STYLES[email.tag] : null);
          const isSent     = folder === 'SENT';
          const toField   = Array.isArray(email.to) ? email.to[0] : (email.to || '');
          const sender    = isSent
            ? (toField ? 'To: ' + toField : 'To: Unknown')
            : (email.from_name || email.from_addr || parseFrom(email.from || '').name || 'Unknown');
          return (
            <div key={email.id || idx} className="email-row" onClick={() => { if (!someSelected) onEmailClick(email); }}
              style={{ display:'flex', alignItems:'center', padding:'0 20px', height:46,
                borderBottom:'1px solid #f1f5f9', cursor: someSelected ? 'default' : 'pointer',
                background: isChecked ? '#dbeafe' : isUnread ? '#fff' : '#f9fafb',
                boxShadow: isChecked ? 'inset 3px 0 0 #2563eb' : isUnread ? 'inset 3px 0 0 #2563eb' : 'none' }}
              onMouseEnter={e => {
                if (!isChecked) { e.currentTarget.style.background='#eff6ff'; e.currentTarget.style.boxShadow='inset 3px 0 0 #2563eb'; }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = isChecked ? '#dbeafe' : isUnread ? '#fff' : '#f9fafb';
                e.currentTarget.style.boxShadow = isChecked ? 'inset 3px 0 0 #2563eb' : isUnread ? 'inset 3px 0 0 #2563eb' : 'none';
              }}>

              {/* Checkbox */}
              <div onClick={e => toggleSelect(e, email.id)}
                style={{ cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
                  width:16, height:16, border:`1.5px solid ${isChecked ? '#2563eb' : '#d1d5db'}`,
                  borderRadius:3, flexShrink:0, marginRight:10,
                  background: isChecked ? '#2563eb' : '#fff' }}>
                {isChecked && (
                  <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="#fff" strokeWidth="2">
                    <polyline points="1.5 6 4.5 9 10.5 3"/>
                  </svg>
                )}
              </div>

              {/* Star */}
              <div onClick={e => handleStar(e, email)}
                style={{ width:17, height:17, flexShrink:0, marginRight:12,
                  display:'flex', alignItems:'center', cursor:'pointer' }}>
                <svg viewBox="0 0 24 24" width="17" height="17">
                  <polygon
                    points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                    fill={email.starred?'#f5a623':'none'}
                    stroke={email.starred?'#f5a623':'#c0c4cc'}
                    strokeWidth="1.6"/>
                </svg>
              </div>

              {/* Unread dot */}
              {isUnread
                ? <div style={{ width:8, height:8, borderRadius:'50%', background:'#2563eb', flexShrink:0, marginRight:10 }}/>
                : <div style={{ width:8, flexShrink:0, marginRight:10 }}/>}

              <div style={{ width:165, flexShrink:0, fontSize:13.5,
                fontWeight:isUnread?700:400, color:isUnread?'#0f172a':'#475569',
                whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{sender}</div>

              <div style={{ flex:1, minWidth:0, display:'flex', alignItems:'center',
                fontSize:13.5, whiteSpace:'nowrap', overflow:'hidden' }}>
                <span style={{ fontWeight:isUnread?700:500, color:isUnread?'#1e293b':'#64748b', flexShrink:0 }}>
                  {email.ai_title || email.subject || '(no subject)'}
                </span>
                {(email.ai_brief || email.preview) && (
                  <span style={{ color:'#94a3b8', fontWeight:400, overflow:'hidden',
                    textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    &nbsp;— {email.ai_brief || email.preview}
                  </span>
                )}
              </div>

              {tag && (
                <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center',
                  width:78, minWidth:78, height:22, fontSize:11.5, fontWeight:500,
                  borderRadius:4, border:`1px solid ${tag.border}`, background:tag.bg,
                  color:tag.color, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                  flexShrink:0, marginLeft:10, padding:'0 8px', boxSizing:'border-box' }}>
                  {tag.label}
                </span>
              )}

              <div style={{ fontSize:12, color: isUnread ? '#475569' : '#94a3b8', fontWeight: isUnread ? 500 : 400, flexShrink:0, marginLeft:14, minWidth:58, textAlign:'right' }}>
                {formatTime(email.date_ms)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

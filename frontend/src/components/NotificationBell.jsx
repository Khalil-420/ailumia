import React, { useState, useEffect, useRef } from 'react';

export default function NotificationBell({ count, emails = [] }) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  const formatDate = (dateStr) => {
    try {
      return new Date(dateStr).toLocaleString(undefined, {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <button onClick={() => setOpen(o => !o)} title="Important conversations"
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          padding: 6, display: 'flex', alignItems: 'center',
          position: 'relative'
        }}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none"
          stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {count > 0 && (
          <span style={{
            position: 'absolute', top: 0, right: 0,
            background: '#dc2626', color: '#fff',
            fontSize: 10, fontWeight: 700,
            minWidth: 16, height: 16, borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            lineHeight: 1, border: '2px solid #fff',
          }}>
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0,
          marginTop: 8, width: 320, maxHeight: 420,
          background: '#fff', border: '1px solid #e5e7eb',
          borderRadius: 10, boxShadow: '0 10px 35px rgba(0,0,0,0.18)',
          overflow: 'auto', zIndex: 1000,
          fontFamily: 'DM Sans, sans-serif'
        }}>
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid #e5e7eb',
            fontWeight: 600, color: '#111827', fontSize: 14,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            position: 'sticky', top: 0, background: '#fff', zIndex: 1
          }}>
            <span>Important Conversations</span>
            <span style={{ fontSize: 12, fontWeight: 400, color: '#6b7280' }}>
              {count} unread
            </span>
          </div>

          {emails.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>
              No important conversations yet
            </div>
          ) : (
            emails.map(e => (
              <div key={e.message_id || e.id} style={{
                padding: '12px 16px',
                borderBottom: '1px solid #f3f4f6',
                fontSize: 13,
                background: e.read ? 'transparent' : '#fefce8',
              }}>
                <div style={{
                  fontWeight: e.read ? 400 : 700, color: '#111827',
                  marginBottom: 2, fontSize: 13.5,
                  display: '-webkit-box', WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical', overflow: 'hidden'
                }}>
                  {e.subject || '(no subject)'}
                </div>
                <div style={{ color: '#6b7280', fontSize: 11.5 }}>
                  from {e.from_name || e.from_addr || e.from || ''}
                </div>
                <div style={{ color: '#9ca3af', fontSize: 11, marginTop: 2 }}>
                  {e.date ? formatDate(e.date) : ''}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

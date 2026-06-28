import React, { useState } from 'react';
import NotificationBell from './NotificationBell';

export default function EmailToolbar({ onSearch, onRefresh, searchQuery, categoryLabel, importantCount, importantEmails = [] }) {
  const [focused, setFocused] = useState(false);

  return (
    <div className="toolbar" style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 16px',
      background:'#fff', borderBottom:'1px solid #e2e5ec', flexShrink:0 }}>

      {categoryLabel && (
        <span style={{ fontSize:13, fontWeight:600, color:'#1a5fa8', background:'#e8f1fb',
          padding:'3px 12px', borderRadius:20, whiteSpace:'nowrap', flexShrink:0 }}>
          {categoryLabel}
        </span>
      )}

      {/* Search bar */}
      <div style={{ flex:1, display:'flex', alignItems:'center', gap:8,
        background:'#f4f6fb', borderRadius:24, padding:'7px 14px',
        border: focused ? '1.5px solid #2f6fd0' : '1.5px solid transparent',
        transition:'border-color .15s' }}>
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none"
          stroke={focused ? '#2f6fd0' : '#888'} strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink:0 }}>
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          type="text"
          placeholder="Search mail"
          value={searchQuery}
          onChange={e => onSearch(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{ flex:1, border:'none', background:'transparent', outline:'none',
            fontSize:13.5, color:'#111', fontFamily:'inherit' }}
        />
        {searchQuery && (
          <button onClick={() => onSearch('')}
            style={{ background:'none', border:'none', cursor:'pointer', padding:2,
              color:'#888', display:'flex', alignItems:'center', fontSize:16, lineHeight:1 }}>
            x
          </button>
        )}
      </div>

      {/* Refresh button */}
      <button onClick={onRefresh} title="Refresh"
        style={{ background:'none', border:'1px solid #e2e5ec', borderRadius:8,
          padding:'6px 10px', cursor:'pointer', display:'flex', alignItems:'center',
          color:'#555', transition:'all .12s' }}
        onMouseEnter={e => { e.currentTarget.style.background='#f4f7ff'; e.currentTarget.style.borderColor='#2f6fd0'; }}
        onMouseLeave={e => { e.currentTarget.style.background='none'; e.currentTarget.style.borderColor='#e2e5ec'; }}>
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="23 4 23 10 17 10"/>
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
        </svg>
      </button>

      {/* Important notifications bell */}
      <NotificationBell
        count={importantCount}
        emails={importantEmails}
      />
    </div>
  );
}

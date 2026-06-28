import React, { useState } from 'react';

const NAV = [
  { id:'inbox',   label:'Inbox',   color:'#60a5fa', activeBg:'rgba(96,165,250,0.13)'  },
  { id:'starred', label:'Starred', color:'#fbbf24', activeBg:'rgba(251,191,36,0.13)'  },
  { id:'sent',    label:'Sent',    color:'#34d399', activeBg:'rgba(52,211,153,0.13)'  },
  { id:'spam',    label:'Spam',    color:'#f87171', activeBg:'rgba(248,113,113,0.13)' },
  { id:'trash',   label:'Trash',   color:'#94a3b8', activeBg:'rgba(148,163,184,0.11)' },
];

const CATEGORIES = [
  { id:'HR',         label:'HR',         color:'#fb923c' },
  { id:'Business',   label:'Business',   color:'#60a5fa' },
  { id:'Tech',       label:'Tech',       color:'#34d399' },
  { id:'Security',   label:'Security',   color:'#c084fc' },
  { id:'Finance',    label:'Finance',    color:'#818cf8' },
  { id:'Legal',      label:'Legal',      color:'#e879f9' },
  { id:'Operations', label:'Operations', color:'#94a3b8' },
  { id:'Other',      label:'Other',      color:'#6b7280' },
];

const ICONS = {
  inbox:   <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>,
  starred: <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>,
  sent:    <><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></>,
  spam:    <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>,
  trash:   <><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></>,
  admin:   <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
};

export default function Sidebar({ active, activeCategory, onNavigate, onCategoryClick, onCompose, onLogout, unreadCount, spamCount, categoryCounts, user }) {
  const isAdmin = user?.role === 'admin';
  const [catsOpen, setCatsOpen] = useState(true);

  const navItem = (item, badge) => {
    const { id, label, color, activeBg } = item;
    const isActive = active === id && !activeCategory;
    return (
      <div key={id} onClick={() => onNavigate(id)}
        style={{
          display:'flex', alignItems:'center', gap:11,
          padding:'9px 16px 9px 15px', fontSize:13.5, cursor:'pointer',
          transition:'background .12s, color .12s',
          borderLeft:`3px solid ${isActive ? color : 'transparent'}`,
          background: isActive ? activeBg : 'transparent',
          color: isActive ? color : '#94a3b8',
          fontWeight: isActive ? 600 : 400,
        }}
        onMouseEnter={e => { if(!isActive) { e.currentTarget.style.background='rgba(255,255,255,0.05)'; e.currentTarget.style.color='#e2e8f0'; } }}
        onMouseLeave={e => { if(!isActive) { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='#94a3b8'; } }}>
        <svg viewBox="0 0 24 24" style={{ width:17, height:17, flexShrink:0, stroke:'currentColor',
          fill:'none', strokeWidth:1.8, strokeLinecap:'round', strokeLinejoin:'round' }}>
          {ICONS[id]}
        </svg>
        <span style={{ flex:1 }}>{label}</span>
        {badge}
      </div>
    );
  };

  return (
    <nav className="side-nav" style={{ background:'#111827', display:'flex',
      flexDirection:'column', padding:'18px 0 12px',
      borderRight:'1px solid #1f2937', overflowY:'auto' }}>

      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'0 18px 6px' }}>
        <img src="/elumia.png" alt="AILumia"
          style={{ width:40, height:40, objectFit:'contain', flexShrink:0 }}/>
        <div style={{ display:'flex', flexDirection:'column', lineHeight:1.1 }}>
          <span style={{ fontSize:12.5, fontWeight:700, color:'#f1f5f9', letterSpacing:2 }}>ELUMIA</span>
          <span style={{ fontSize:8, fontWeight:500, color:'#60a5fa', letterSpacing:3, marginTop:2 }}>AILumia</span>
        </div>
      </div>

      {user?.email && (
        <div style={{ padding:'0 12px 16px' }}>
          <div title={user.email} style={{
            display:'inline-flex', alignItems:'center', gap:6,
            background:'rgba(96,165,250,0.1)', border:'1px solid rgba(96,165,250,0.22)',
            borderRadius:6, padding:'5px 10px', maxWidth:'100%',
          }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:'#34d399', flexShrink:0 }}/>
            <span style={{ fontSize:11.5, color:'#93c5fd', fontWeight:500,
              overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {user.email}
            </span>
          </div>
        </div>
      )}

      <button onClick={onCompose} style={{
        display:'flex', alignItems:'center', justifyContent:'center',
        gap:8, margin:'0 14px 20px',
        background:'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
        color:'#fff', border:'none', borderRadius:8,
        padding:'10px 0', fontSize:14, fontWeight:600,
        cursor:'pointer', fontFamily:'inherit',
        boxShadow:'0 2px 12px rgba(37,99,235,0.4)',
        transition:'box-shadow .15s, transform .12s',
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow='0 4px 20px rgba(37,99,235,0.55)'; e.currentTarget.style.transform='translateY(-1px)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow='0 2px 12px rgba(37,99,235,0.4)'; e.currentTarget.style.transform='none'; }}>
        + Compose
      </button>

      <div style={{ height:'1px', background:'rgba(255,255,255,0.06)', margin:'0 0 6px' }}/>

      {NAV.map(item => navItem(
        item,
        item.id === 'inbox' && unreadCount > 0
          ? <span style={{ fontSize:11, fontWeight:700, padding:'1px 7px', borderRadius:10,
              background:'#2563eb', color:'#fff', lineHeight:'18px' }}>{unreadCount}</span>
          : item.id === 'spam' && spamCount > 0
          ? <span style={{ fontSize:11, fontWeight:700, padding:'1px 7px', borderRadius:10,
              background:'#dc2626', color:'#fff', lineHeight:'18px' }}>{spamCount}</span>
          : null
      ))}

      <div style={{ height:'1px', background:'rgba(255,255,255,0.06)', margin:'10px 0 4px' }}/>

      <div style={{ margin:'6px 18px 4px', display:'flex', alignItems:'center', cursor:'pointer' }}
        onClick={() => setCatsOpen(o => !o)}>
        <span style={{ fontSize:10, fontWeight:700, color:'#374151', letterSpacing:1.5,
          textTransform:'uppercase', flex:1 }}>Categories</span>
        <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#374151" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: catsOpen ? 'rotate(180deg)' : 'none', transition:'transform .2s' }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </div>

      {catsOpen && CATEGORIES.map(cat => {
        const count = categoryCounts?.[cat.id] || 0;
        const isActive = activeCategory === cat.id;
        return (
          <div key={cat.id} onClick={() => onCategoryClick(cat.id)}
            style={{
              display:'flex', alignItems:'center', gap:10,
              padding:'7px 16px 7px 15px', fontSize:13,
              cursor:'pointer', transition:'background .12s, color .12s',
              color: isActive ? cat.color : '#6b7280',
              background: isActive ? 'rgba(255,255,255,0.07)' : 'transparent',
              fontWeight: isActive ? 600 : 400,
              borderLeft:`3px solid ${isActive ? cat.color : 'transparent'}`,
            }}
            onMouseEnter={e => { if(!isActive) { e.currentTarget.style.background='rgba(255,255,255,0.05)'; e.currentTarget.style.color='#e2e8f0'; } }}
            onMouseLeave={e => { if(!isActive) { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='#6b7280'; } }}>
            <div style={{ width:7, height:7, borderRadius:'50%', background:cat.color, flexShrink:0 }}/>
            <span style={{ flex:1 }}>{cat.label}</span>
            {count > 0 && (
              <span style={{ fontSize:11, fontWeight:600, padding:'1px 6px', borderRadius:10,
                background:'rgba(255,255,255,0.08)', color:'#6b7280', lineHeight:'17px' }}>{count}</span>
            )}
          </div>
        );
      })}

      {isAdmin && (
        <>
          <div style={{ height:'1px', background:'rgba(255,255,255,0.06)', margin:'10px 0 4px' }}/>
          <div style={{ margin:'6px 18px 4px', fontSize:10, fontWeight:700,
            color:'#374151', letterSpacing:1.5, textTransform:'uppercase' }}>Admin</div>
          <div onClick={() => onNavigate('admin')}
            style={{
              display:'flex', alignItems:'center', gap:11,
              padding:'9px 16px 9px 15px', fontSize:13.5,
              cursor:'pointer', transition:'background .12s, color .12s',
              color: active==='admin' ? '#c084fc' : '#6b7280',
              background: active==='admin' ? 'rgba(192,132,252,0.12)' : 'transparent',
              fontWeight: active==='admin' ? 600 : 400,
              borderLeft: active==='admin' ? '3px solid #c084fc' : '3px solid transparent',
            }}
            onMouseEnter={e => { if(active!=='admin') { e.currentTarget.style.background='rgba(255,255,255,0.05)'; e.currentTarget.style.color='#e2e8f0'; } }}
            onMouseLeave={e => { if(active!=='admin') { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='#6b7280'; } }}>
            <svg viewBox="0 0 24 24" style={{ width:17, height:17, flexShrink:0, stroke:'currentColor',
              fill:'none', strokeWidth:1.8, strokeLinecap:'round', strokeLinejoin:'round' }}>
              {ICONS.admin}
            </svg>
            <span>Employees</span>
          </div>
        </>
      )}

      <div style={{ flex:1 }}/>
      <div style={{ height:'1px', background:'rgba(255,255,255,0.06)', margin:'0 0 12px' }}/>
      <div style={{ padding:'0 14px 4px' }}>
        <button onClick={onLogout}
          style={{ width:'100%', display:'flex', alignItems:'center', gap:9, padding:'9px 14px',
            background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)',
            borderRadius:8, fontSize:13.5, color:'#4b5563', cursor:'pointer',
            fontFamily:'inherit', transition:'all .12s' }}
          onMouseEnter={e => { e.currentTarget.style.background='rgba(220,38,38,0.14)'; e.currentTarget.style.borderColor='rgba(220,38,38,0.25)'; e.currentTarget.style.color='#f87171'; }}
          onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor='rgba(255,255,255,0.08)'; e.currentTarget.style.color='#4b5563'; }}>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Sign out
        </button>
      </div>
    </nav>
  );
}

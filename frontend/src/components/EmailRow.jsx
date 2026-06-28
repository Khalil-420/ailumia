import React from 'react';

const TAG_STYLE = {
  business: {color:'#1a5fa8',borderColor:'#bdd5f5',background:'#e8f1fb'},
  red_team: {color:'#b71c1c',borderColor:'#f4b8b8',background:'#fdecea'},
  offer:    {color:'#2e7d32',borderColor:'#b6ddb8',background:'#e8f5e9'},
  security: {color:'#6a1b9a',borderColor:'#d7b8e8',background:'#f3e5f5'},
  tech:     {color:'#00695c',borderColor:'#a5d6cf',background:'#e0f2f1'},
  hr:       {color:'#b45309',borderColor:'#fbbf75',background:'#fff3e0'},
};

function formatTime(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  const now = new Date();
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
  return d.toLocaleDateString([], {month:'short',day:'numeric'});
}

export default function EmailRow({ email, onClick, onStar }) {
  const unread = !email.read;
  const ts = TAG_STYLE[email.tag] || null;

  return (
    <div onClick={() => onClick(email)}
      style={{display:'flex',alignItems:'center',padding:'0 20px',height:46,
        borderBottom:'1px solid #eef0f4',cursor:'pointer',
        background: unread ? '#fff' : '#f8f9fc',
        transition:'background 0.1s'}}
      onMouseEnter={e => e.currentTarget.style.background='#f4f7ff'}
      onMouseLeave={e => e.currentTarget.style.background= unread ? '#fff' : '#f8f9fc'}>

      <div style={{width:16,height:16,border:'1.5px solid #c0c4cc',borderRadius:3,
        flexShrink:0,marginRight:10}}/>

      <div onClick={e => { e.stopPropagation(); onStar && onStar(email); }}
        style={{width:17,height:17,flexShrink:0,marginRight:12,cursor:'pointer'}}>
        <svg viewBox="0 0 24 24" width="17" height="17">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
            fill={email.starred ? '#f5a623' : 'none'}
            stroke={email.starred ? '#f5a623' : '#c0c4cc'}
            strokeWidth="1.6"/>
        </svg>
      </div>

      {unread
        ? <div style={{width:8,height:8,borderRadius:'50%',background:'#2f6fd0',flexShrink:0,marginRight:10}}/>
        : <div style={{width:8,flexShrink:0,marginRight:10}}/>
      }

      <div style={{width:165,flexShrink:0,fontSize:13.5,
        fontWeight: unread ? 600 : 400,
        color: unread ? '#111' : '#555',
        whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
        {email.from_name || email.from_addr || 'Unknown'}
      </div>

      <div style={{flex:1,minWidth:0,display:'flex',alignItems:'center',
        fontSize:13.5,whiteSpace:'nowrap',overflow:'hidden'}}>
        <span style={{fontWeight: unread ? 600 : 500,color: unread ? '#111' : '#333',flexShrink:0}}>
          {email.subject}
        </span>
        <span style={{color:'#aaa',margin:'0 5px',flexShrink:0}}>—</span>
        <span style={{color:'#777',overflow:'hidden',textOverflow:'ellipsis'}}>
          {email.preview}
        </span>
      </div>

      {ts && (
        <span style={{display:'inline-flex',alignItems:'center',justifyContent:'center',
          width:74,height:22,fontSize:11.5,fontWeight:500,borderRadius:4,
          border:'1px solid',marginLeft:10,flexShrink:0,...ts}}>
          {email.tag.replace('_',' ')}
        </span>
      )}

      <div style={{fontSize:12,color:'#888',flexShrink:0,marginLeft:14,minWidth:58,textAlign:'right'}}>
        {formatTime(email.date_ms)}
      </div>
    </div>
  );
}

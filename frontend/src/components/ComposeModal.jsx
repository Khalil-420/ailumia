import React, { useState, useEffect, useRef } from 'react';
import { sendEmail } from '../services/api';

const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.bat', '.sh', '.cmd', '.ps1', '.vbs', '.jar',
  '.msi', '.scr', '.pif', '.com', '.dll', '.reg', '.hta',
  '.wsf', '.php', '.py', '.rb', '.pl', '.cgi',
]);

const MAX_FILE_BYTES   = 10 * 1024 * 1024;  // 10 MB per file
const MAX_TOTAL_BYTES  = 25 * 1024 * 1024;  // 25 MB total

function formatSize(bytes) {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ComposeModal({ onClose, onSent, replyTo, forwardOf, notify }) {
  const [to,          setTo]          = useState('');
  const [subject,     setSubject]     = useState('');
  const [body,        setBody]        = useState('');
  const [sending,     setSending]     = useState(false);
  const [error,       setError]       = useState('');
  const [minimised,   setMinimised]   = useState(false);
  const [attachments, setAttachments] = useState([]);   // File[]
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (replyTo) {
      const addrMatch = (replyTo.from_addr || replyTo.from || '')
        .match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
      if (addrMatch) setTo(addrMatch[0]);
      const sub = replyTo.subject || '';
      setSubject(sub.startsWith('Re:') ? sub : `Re: ${sub}`);
      setBody(replyTo.smartReplyText || '');
    } else if (forwardOf) {
      setTo('');
      const sub = forwardOf.subject || '';
      setSubject(sub.startsWith('Fwd:') ? sub : `Fwd: ${sub}`);
      const bodyText = [
        '', '',
        '-------- Forwarded Message --------',
        `From: ${forwardOf.from_name || forwardOf.from_addr || forwardOf.from || ''}`,
        `Subject: ${forwardOf.subject || ''}`,
        `Date: ${forwardOf.date || ''}`,
        '',
        forwardOf.body || '',
      ].join('\n');
      setBody(bodyText);
    }
  }, [replyTo, forwardOf]);

  const handleFiles = (files) => {
    const incoming = Array.from(files);
    const errors = [];

    const valid = incoming.filter(file => {
      const ext = '.' + file.name.split('.').pop().toLowerCase();
      if (BLOCKED_EXTENSIONS.has(ext)) {
        errors.push(`"${file.name}" — file type not allowed.`);
        return false;
      }
      if (file.size > MAX_FILE_BYTES) {
        errors.push(`"${file.name}" exceeds 10 MB limit.`);
        return false;
      }
      return true;
    });

    const next = [...attachments, ...valid];
    const totalSize = next.reduce((s, f) => s + f.size, 0);
    if (totalSize > MAX_TOTAL_BYTES) {
      setError('Total attachments exceed 25 MB.');
      return;
    }

    if (errors.length) setError(errors.join(' '));
    else setError('');

    setAttachments(next);
    // Reset input so the same file can be re-selected after removal
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
    setError('');
  };

  const handleSend = async () => {
    setError('');
    if (!to.trim())      { setError('Recipient is required.');  notify?.('Recipient is required.', 'error'); return; }
    if (!subject.trim()) { setError('Subject is required.');    notify?.('Subject is required.', 'error'); return; }
    setSending(true);
    try {
      const originalId = replyTo?.id       || null;
      const inReplyTo  = replyTo?.message_id || null;
      await sendEmail(to.trim(), subject.trim(), body, originalId, inReplyTo, attachments);
      notify?.('Message sent successfully.', 'success');
      onSent();
      onClose();
    } catch (err) {
      const status = err.response?.status;
      const message = status === 401
        ? 'Session expired. Please log in again.'
        : status === 422
          ? err.response?.data?.detail || 'Invalid request.'
          : err.response?.data?.detail || 'Failed to send. Please try again.';
      setError(message);
      notify?.(message, 'error');
    } finally { setSending(false); }
  };

  const title = replyTo ? 'Reply' : forwardOf ? 'Forward' : 'New Message';

  return (
    <div className="compose-modal" style={{ position:'fixed', bottom:24, right:36, width:500, zIndex:100,
      display:'flex', flexDirection:'column', borderRadius:'10px 10px 8px 8px',
      boxShadow:'0 8px 32px rgba(0,0,0,.18)', overflow:'hidden',
      border:'1px solid #dde3f0', fontFamily:"'DM Sans', 'Segoe UI', sans-serif" }}>

      {/* Header */}
      <div style={{ background:'#2b2d42', color:'#fff', padding:'10px 14px',
        display:'flex', alignItems:'center', fontSize:14, fontWeight:600 }}>
        <span style={{ flex:1 }}>{title}</span>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <button onClick={() => setMinimised(!minimised)}
            style={{ background:'none', border:'none', cursor:'pointer', color:'#aaa',
              fontSize:16, lineHeight:1, padding:'2px 5px', borderRadius:4 }}>
            {minimised ? '+' : '\u2212'}
          </button>
          <button onClick={onClose}
            style={{ background:'none', border:'none', cursor:'pointer', color:'#aaa',
              display:'flex', alignItems:'center', padding:'4px', borderRadius:4 }}>
            <svg viewBox="0 0 14 14" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="1" y1="1" x2="13" y2="13"/><line x1="13" y1="1" x2="1" y2="13"/>
            </svg>
          </button>
        </div>
      </div>

      {!minimised && (
        <>
          {/* To */}
          <div style={{ padding:'9px 16px', borderBottom:'1px solid #eef0f4',
            display:'flex', alignItems:'center', background:'#fff', fontSize:13.5 }}>
            <span style={{ color:'#888', width:60, flexShrink:0 }}>To</span>
            <input value={to} onChange={e => setTo(e.target.value)}
              placeholder="recipient@elumia.com" autoFocus={!!replyTo}
              style={{ flex:1, border:'none', outline:'none', fontSize:13.5,
                color:'#111', fontFamily:'inherit', background:'transparent' }}/>
          </div>

          {/* Subject */}
          <div style={{ padding:'9px 16px', borderBottom:'1px solid #eef0f4',
            display:'flex', alignItems:'center', background:'#fff', fontSize:13.5 }}>
            <span style={{ color:'#888', width:60, flexShrink:0 }}>Subject</span>
            <input value={subject} onChange={e => setSubject(e.target.value)}
              placeholder="Email subject"
              style={{ flex:1, border:'none', outline:'none', fontSize:13.5,
                color:'#111', fontFamily:'inherit', background:'transparent' }}/>
          </div>

          {/* Error */}
          {error && (
            <div style={{ padding:'8px 16px', background:'#fff3f3',
              borderBottom:'1px solid #ffd0d0', fontSize:12.5, color:'#c62828',
              display:'flex', alignItems:'center', gap:6 }}>
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#c62828" strokeWidth="2" style={{ flexShrink:0 }}>
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {error}
            </div>
          )}

          {/* Body */}
          <textarea value={body} onChange={e => setBody(e.target.value)}
            placeholder="Write your message..."
            style={{ padding:'12px 16px', minHeight:140, fontSize:13.5, color:'#222',
              fontFamily:'inherit', lineHeight:1.62, outline:'none', border:'none',
              resize:'none', background:'#fff' }}/>

          {/* Attachment list */}
          {attachments.length > 0 && (
            <div style={{ padding:'6px 14px 4px', borderTop:'1px solid #eef0f4',
              background:'#fafbfd', display:'flex', flexWrap:'wrap', gap:6 }}>
              {attachments.map((file, i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:5,
                  background:'#eef2fb', borderRadius:6, padding:'4px 8px',
                  fontSize:12, color:'#2b2d42', maxWidth:'100%' }}>
                  {/* File icon */}
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none"
                    stroke="#5a6ea0" strokeWidth="2" style={{ flexShrink:0 }}>
                    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
                    <polyline points="13 2 13 9 20 9"/>
                  </svg>
                  <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                    maxWidth:200 }} title={file.name}>{file.name}</span>
                  <span style={{ color:'#888', flexShrink:0 }}>({formatSize(file.size)})</span>
                  <button onClick={() => removeAttachment(i)}
                    style={{ background:'none', border:'none', cursor:'pointer', padding:'0 2px',
                      color:'#888', display:'flex', alignItems:'center', flexShrink:0 }}>
                    <svg viewBox="0 0 14 14" width="11" height="11" fill="none"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <line x1="1" y1="1" x2="13" y2="13"/><line x1="13" y1="1" x2="1" y2="13"/>
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Toolbar */}
          <div style={{ padding:'10px 14px', borderTop:'1px solid #eef0f4', background:'#fff',
            display:'flex', alignItems:'center', gap:8 }}>

            {/* Send button */}
            <button onClick={handleSend} disabled={sending}
              style={{ display:'flex', alignItems:'center', background:sending?'#7aaed4':'#2f6fd0',
                color:'#fff', border:'none', borderRadius:22, fontSize:13.5, fontWeight:600,
                fontFamily:'inherit', cursor:sending?'not-allowed':'pointer', overflow:'hidden' }}>
              <span style={{ padding:'7px 18px' }}>{sending ? 'Sending...' : 'Send'}</span>
              <span style={{ padding:'7px 10px', borderLeft:'1px solid rgba(255,255,255,.3)',
                display:'flex', alignItems:'center' }}>
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#fff" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </span>
            </button>

            {/* Attach button */}
            <button onClick={() => fileInputRef.current?.click()}
              title="Attach files"
              style={{ background:'none', border:'1px solid #dde3f0', borderRadius:20,
                cursor:'pointer', padding:'6px 12px', display:'flex', alignItems:'center',
                gap:5, fontSize:12.5, color:'#555', fontFamily:'inherit' }}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
              </svg>
              Attach
            </button>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              style={{ display:'none' }}
              onChange={e => handleFiles(e.target.files)}
            />
          </div>
        </>
      )}
    </div>
  );
}

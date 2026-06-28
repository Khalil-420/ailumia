import React, { useState } from 'react';
import { parseFrom } from '../utils/emailUtils';
import api, { emailAction, invalidateEmailCache, getSmartReplies } from '../services/api';

function formatDate(ms) {
  if (!ms) return '';
  return new Date(ms).toLocaleString([], {
    year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'
  });
}

function formatFileSize(bytes) {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function EmailDetail({ email, onBack, onReply, onForward, onRefresh, onEmailsChange, folder, notify }) {
  if (!email) return null;

  const fromParsed = parseFrom(email.from || '');
  const fromName   = email.from_name || fromParsed.name || 'Unknown';
  const fromAddr   = email.from_addr || fromParsed.addr || '';
  const initial    = (fromName || '?')[0].toUpperCase();
  const toField    = Array.isArray(email.to) ? email.to.join(', ') : (email.to || '');
  const isSpam     = folder === 'SPAM';
  const isTrash    = folder === 'TRASH';

  const [starred, setStarred] = useState(email.starred);
  const [smartReplies, setSmartReplies] = useState([]);
  const [smartLoading, setSmartLoading] = useState(false);
  const [smartHint, setSmartHint] = useState('');
  const [resummarizing, setResummarizing] = useState(false);

  const downloadAttachment = async (filename) => {
    try {
      const response = await api.get(
        `/emails/${email.id}/attachment/${encodeURIComponent(filename)}`,
        { params: { folder: folder || 'INBOX' }, responseType: 'blob' }
      );
      const blob = response.data;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Attachment download error:', err);
      notify?.('Failed to download attachment.', 'error');
    }
  };

  const handleSmartReply = async () => {
    if (smartLoading) return;
    if (smartReplies.length > 0) { setSmartReplies([]); return; }
    setSmartLoading(true);
    try {
      const res = await getSmartReplies(email.id, folder || 'INBOX', smartHint.trim());
      setSmartReplies(res.data.replies || []);
    } catch (err) { console.error('Smart reply error:', err); }
    finally { setSmartLoading(false); }
  };

  const handleResummarize = async () => {
    if (resummarizing) return;
    setResummarizing(true);
    try {
      const res = await api.post(
        `/emails/${email.id}/summarize`,
        null,
        { params: { folder: folder || 'INBOX', force: true } }
      );
      const data = res.data;
      console.log('Resummarized:', data);
      // Update parent so summary shows new category
      if (onEmailsChange) {
        onEmailsChange(prev => prev.map(em =>
          em.id === email.id
            ? { ...em, ai_category: data.category, ai_title: data.title, ai_brief: data.brief }
            : em
        ));
      }
      notify?.('Email re-classified successfully!', 'success');
    } catch (err) {
      console.error('Resummarize error:', err);
      notify?.('Failed to re-classify email.', 'error');
    } finally {
      setResummarizing(false);
    }
  };

  const handleStar = async () => {
    const op = starred ? 'unstar' : 'star';
    const newStarred = !starred;
    setStarred(newStarred);
    // Also update the parent email list so the star icon stays correct when going back
    if (onEmailsChange) {
      onEmailsChange(prev => prev.map(em =>
        em.id === email.id ? { ...em, starred: newStarred } : em
      ));
    }
    try {
      await emailAction(email.id, op, folder || 'INBOX', email.message_id || '');
      invalidateEmailCache('STARRED');
      notify?.(newStarred ? 'Starred email.' : 'Removed star.', 'success');
    } catch {
      setStarred(starred);
      if (onEmailsChange) {
        onEmailsChange(prev => prev.map(em =>
          em.id === email.id ? { ...em, starred } : em
        ));
      }
      notify?.('Unable to update starred status.', 'error');
    }
  };

  const handleTrash = async () => {
    try {
      let op = 'trash';
      if (folder === 'SPAM')  op = 'trash_from_spam';
      if (folder === 'TRASH') return; // already in trash
      await emailAction(email.id, op, folder || 'INBOX', email.message_id || '');
      invalidateEmailCache();
      notify?.('Moved to trash.', 'success');
      onBack();
      if (onRefresh) onRefresh();
    } catch (err) { console.error('Trash error:', err); notify?.('Failed to move message to trash.', 'error'); }
  };

  const handleSpam = async () => {
    try {
      let op = 'spam';
      if (folder === 'TRASH') op = 'spam_from_trash';
      if (folder === 'SPAM')  return; // already in spam
      await emailAction(email.id, op, folder || 'INBOX', email.message_id || '');
      invalidateEmailCache();
      notify?.('Marked as spam.', 'success');
      onBack();
      if (onRefresh) onRefresh();
    } catch (err) { console.error('Spam error:', err); notify?.('Failed to mark message as spam.', 'error'); }
  };

  const handlePermanentDelete = async () => {
    if (!window.confirm('Permanently delete this message? This cannot be undone.')) return;
    try {
      await emailAction(email.id, 'permanent_delete', folder || 'TRASH', email.message_id || '');
      invalidateEmailCache();
      notify?.('Permanently deleted message.', 'success');
      onBack();
      if (onRefresh) onRefresh();
    } catch (err) { console.error('Permanent delete error:', err); notify?.('Failed to delete message permanently.', 'error'); }
  };

  const handleRestore = async () => {
    try {
      await emailAction(email.id, 'restore_from_trash', folder || 'TRASH', email.message_id || '');
      invalidateEmailCache();
      notify?.('Restored from trash.', 'success');
      onBack();
      if (onRefresh) onRefresh();
    } catch (err) { console.error('Restore error:', err); notify?.('Failed to restore message.', 'error'); }
  };

  const handleNotSpam = async () => {
    try {
      await emailAction(email.id, 'not_spam', folder || 'SPAM', email.message_id || '');
      invalidateEmailCache();
      notify?.('Marked as not spam.', 'success');
      onBack();
      if (onRefresh) onRefresh();
    } catch (err) { console.error('Not spam error:', err); notify?.('Failed to mark message as not spam.', 'error'); }
  };

  const toolbarBtn = (onClick, title, svgPath) => (
    <button onClick={onClick} title={title}
      style={{ background:'none', border:'none', cursor:'pointer', padding:'6px 8px',
        borderRadius:6, color:'#666', display:'flex', alignItems:'center' }}
      onMouseEnter={e => e.currentTarget.style.background='#f0f0f0'}
      onMouseLeave={e => e.currentTarget.style.background='none'}>
      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {svgPath}
      </svg>
    </button>
  );

  return (
    <div className="email-detail" style={{ flex:1, display:'flex', flexDirection:'column', background:'#eef0f5', overflow:'auto' }}>
      <div style={{ background:'#fff', padding:'8px 24px', borderBottom:'1px solid #e2e5ec',
        display:'flex', alignItems:'center', gap:8 }}>
        <button onClick={onBack} style={{ background:'none', border:'none', cursor:'pointer',
          padding:'6px 8px', borderRadius:6, color:'#555', display:'flex', alignItems:'center' }}
          onMouseEnter={e => e.currentTarget.style.background='#f0f0f0'}
          onMouseLeave={e => e.currentTarget.style.background='none'}>
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>

        <div style={{ display:'flex', gap:2, marginLeft:4 }}>
          {isTrash
            ? toolbarBtn(handlePermanentDelete, 'Delete permanently',
                <><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></>)
            : toolbarBtn(handleTrash, 'Move to trash',
                <><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></>)
          }
          {isTrash
            ? toolbarBtn(handleRestore, 'Move to Inbox',
                <><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></>)
            : isSpam
            ? toolbarBtn(handleNotSpam, 'Not spam',
                <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11"/></>)
            : toolbarBtn(handleSpam, 'Mark as spam',
                <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>)
          }
          <button onClick={handleStar} title={starred ? 'Unstar' : 'Star'}
            style={{ background:'none', border:'none', cursor:'pointer', padding:'6px 8px',
              borderRadius:6, display:'flex', alignItems:'center' }}
            onMouseEnter={e => e.currentTarget.style.background='#f0f0f0'}
            onMouseLeave={e => e.currentTarget.style.background='none'}>
            <svg viewBox="0 0 24 24" width="17" height="17">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                fill={starred?'#f5a623':'none'} stroke={starred?'#f5a623':'#c0c4cc'} strokeWidth="1.6"/>
            </svg>
          </button>
        </div>
      </div>

      <div style={{ padding:'28px 36px', flex:1, overflowY:'auto' }}>
        <h2 style={{ fontSize:22, fontWeight:600, color:'#111', marginBottom:20 }}>
          {email.subject || '(no subject)'}
        </h2>

        <div style={{ background:'#fff', borderRadius:10, border:'1px solid #e2e5ec',
          padding:'20px 24px', marginBottom:20 }}>
          <div style={{ display:'flex', alignItems:'flex-start', marginBottom:20 }}>
            <div style={{ width:38, height:38, borderRadius:'50%', background:'#2f6fd0',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:15, fontWeight:600, color:'#fff', flexShrink:0, marginRight:12 }}>
              {initial}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14, fontWeight:600, color:'#111' }}>
                {fromName}
                {fromAddr && fromAddr !== fromName && (
                  <span style={{ fontWeight:400, color:'#888', fontSize:13, marginLeft:6 }}>
                    &lt;{fromAddr}&gt;
                  </span>
                )}
              </div>
              {toField && (
                <div style={{ fontSize:12.5, color:'#888', marginTop:2 }}>
                  To: {toField}
                </div>
              )}
            </div>
            <div style={{ fontSize:12.5, color:'#888' }}>{formatDate(email.date_ms)}</div>
          </div>

          <div style={{ fontSize:14, color:'#222', lineHeight:1.75, whiteSpace:'pre-wrap' }}>
            {email.body || 'No content'}
          </div>

          {/* Attachments */}
          {email.attachments && email.attachments.length > 0 && (
            <div style={{ marginTop:20, paddingTop:20, borderTop:'1px solid #e2e5ec' }}>
              <div style={{ fontSize:12.5, color:'#666', fontWeight:600, marginBottom:10 }}>
                Attachments ({email.attachments.length})
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {email.attachments.map((att, i) => (
                  <button
                    key={i}
                    onClick={() => downloadAttachment(att.filename)}
                    style={{
                      display:'flex', alignItems:'center', gap:8, padding:'8px 12px',
                      background:'#f9fafb', borderRadius:8, border:'1px solid #e5e7eb',
                      textDecoration:'none', color:'#2f6fd0', cursor:'pointer',
                      fontFamily:'inherit', fontSize:13, transition:'background 0.2s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background='#f0f4f9'}
                    onMouseLeave={e => e.currentTarget.style.background='#f9fafb'}
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none"
                      stroke="currentColor" strokeWidth="2" style={{ flexShrink:0 }}>
                      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
                      <polyline points="13 2 13 9 20 9"/>
                    </svg>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:500, color:'#111',
                        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {att.filename}
                      </div>
                      <div style={{ fontSize:11.5, color:'#888' }}>
                        {formatFileSize(att.size)}
                      </div>
                    </div>
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none"
                      stroke="currentColor" strokeWidth="2.5" style={{ flexShrink:0 }}>
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
          <button onClick={() => onReply(email)}
            style={{ display:'flex', alignItems:'center', gap:7, border:'1px solid #e2e5ec',
              background:'#fff', borderRadius:22, padding:'8px 20px', fontSize:13.5,
              color:'#333', fontWeight:500, cursor:'pointer', fontFamily:'inherit' }}>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/>
            </svg>
            Reply
          </button>
          <button onClick={() => onForward(email)}
            style={{ display:'flex', alignItems:'center', gap:7, border:'1px solid #e2e5ec',
              background:'#fff', borderRadius:22, padding:'8px 20px', fontSize:13.5,
              color:'#333', fontWeight:500, cursor:'pointer', fontFamily:'inherit' }}>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 14 20 9 15 4"/><path d="M4 20v-7a4 4 0 0 1 4-4h12"/>
            </svg>
            Forward
          </button>
          <input
            type="text"
            value={smartHint}
            onChange={e => setSmartHint(e.target.value)}
            placeholder="e.g. friendly, be specific..."
            style={{ border:'1px solid #e2e5ec', borderRadius:22, padding:'8px 14px',
              fontSize:13, color:'#333', outline:'none', fontFamily:'inherit',
              width:180, background:'#fafafa' }}
            onFocus={e => e.target.style.borderColor='#2f6fd0'}
            onBlur={e => e.target.style.borderColor='#e2e5ec'}
          />
          <button onClick={handleSmartReply} disabled={smartLoading}
            style={{ display:'flex', alignItems:'center', gap:7, border:'1px solid #c3d8f8',
              background: smartReplies.length > 0 ? '#e8f1fb' : '#fff',
              borderRadius:22, padding:'8px 20px', fontSize:13.5,
              color:'#2f6fd0', fontWeight:500, cursor:'pointer', fontFamily:'inherit' }}>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a10 10 0 1 0 10 10"/><path d="M18 2l4 4-4 4"/><path d="M22 6H12"/>
            </svg>
            {smartLoading ? 'Generating...' : 'Smart Reply'}
          </button>
          <button onClick={handleResummarize} disabled={resummarizing}
            style={{ display:'flex', alignItems:'center', gap:7, border:'1px solid #d0d0d0',
              background: '#fff',
              borderRadius:22, padding:'8px 20px', fontSize:13.5,
              color:'#666', fontWeight:500, cursor:'pointer', fontFamily:'inherit' }}>
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
            </svg>
            {resummarizing ? 'Re-classifying...' : 'Re-classify'}
          </button>
        </div>

        {smartReplies.length > 0 && (
          <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:12 }}>
            {smartReplies.map((reply, i) => (
              <button key={i} onClick={() => onReply({ ...email, smartReplyText: reply })}
                style={{ border:'1px solid #c3d8f8', background:'#f0f6ff', borderRadius:12,
                  padding:'10px 16px', fontSize:13.5, color:'#1a5fa8', cursor:'pointer',
                  fontFamily:'inherit', textAlign:'left', whiteSpace:'normal', lineHeight:1.5 }}>
                {reply}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

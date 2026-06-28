import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import AdminPanel from './components/AdminPanel';
import EmailList from './components/EmailList';
import EmailDetail from './components/EmailDetail';
import ComposeModal from './components/ComposeModal';
import EmailToolbar from './components/EmailToolbar';
import NotificationBell from './components/NotificationBell';
import { useAuth } from './hooks/useAuth';
import { getEmails, clearEmailCache, invalidateEmailCache } from './services/api';
import api from './services/api';

const FOLDER_MAP = {
  inbox:'INBOX', starred:'STARRED', sent:'SENT', spam:'SPAM', trash:'TRASH'
};

function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim()) { setError('Please enter your username.'); return; }
    if (!password)        { setError('Please enter your password.');  return; }
    setLoading(true); setError('');
    try {
      await onLogin(username.trim(), password);
    } catch (err) {
      const s = err.response?.status;
      if (s === 401) setError('Incorrect username or password.');
      else if (s === 422) setError('Invalid credentials. Please try again.');
      else if (s >= 500) setError('Server error. Please try again later.');
      else setError('Sign in failed. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
      minHeight:'100vh', background:'#eef0f5' }}>
      <div style={{ background:'#fff', borderRadius:16, padding:'40px 44px', width:400,
        boxShadow:'0 4px 24px rgba(0,0,0,.08)', border:'1px solid #e2e5ec' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:32 }}>
          <img src="/elumia.png" alt="AILumia" style={{ width:44, height:44, objectFit:'contain' }}/>
          <div>
            <div style={{ fontSize:16, fontWeight:700, color:'#1a5fa8', letterSpacing:2 }}>ELUMIA</div>
            <div style={{ fontSize:9, color:'#5b8fc7', letterSpacing:3 }}>AILumia</div>
          </div>
        </div>
        <h2 style={{ fontSize:20, fontWeight:600, color:'#111', marginBottom:6 }}>Sign in</h2>
        <p style={{ fontSize:13.5, color:'#888', marginBottom:24 }}>Use your Elumia account credentials</p>
        {error && (
          <div style={{ display:'flex', alignItems:'center', gap:7, background:'#fff3f3',
            border:'1px solid #ffd0d0', borderRadius:8, padding:'10px 12px',
            marginBottom:16, fontSize:13, color:'#c62828' }}>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#c62828" strokeWidth="2" style={{ flexShrink:0 }}>
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <input type="text" placeholder="Username" value={username}
            onChange={e => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none"
            style={{ width:'100%', height:44, padding:'0 14px', border:'1.5px solid #dde5f2',
              borderRadius:10, fontSize:14, color:'#111', outline:'none', fontFamily:'inherit',
              background:'#fff', marginBottom:16, display:'block' }}
            onFocus={e => e.target.style.borderColor='#2f6fd0'}
            onBlur={e  => e.target.style.borderColor='#dde5f2'}/>
          <input type="password" placeholder="Password" value={password}
            onChange={e => setPassword(e.target.value)} autoComplete="current-password"
            style={{ width:'100%', height:44, padding:'0 14px', border:'1.5px solid #dde5f2',
              borderRadius:10, fontSize:14, color:'#111', outline:'none', fontFamily:'inherit',
              background:'#fff', marginBottom:24, display:'block' }}
            onFocus={e => e.target.style.borderColor='#2f6fd0'}
            onBlur={e  => e.target.style.borderColor='#dde5f2'}/>
          <button type="submit" disabled={loading}
            style={{ width:'100%', height:46, background:loading?'#7aaed4':'#2f6fd0', color:'#fff',
              border:'none', borderRadius:10, fontSize:15, fontWeight:600,
              cursor:loading?'not-allowed':'pointer', fontFamily:'inherit',
              display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
            {loading && <div style={{ width:17, height:17, border:'2.5px solid rgba(255,255,255,.3)',
              borderTopColor:'#fff', borderRadius:'50%', animation:'spin .7s linear infinite' }}/>}
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function App() {
  const { user, loading:authLoading, login, logout } = useAuth();
  const [activeScreen,   setActiveScreen]   = useState('inbox');
  const [activeCategory, setActiveCategory] = useState(null);  // 'HR', 'Business', etc.
  const [emails,         setEmails]         = useState([]);
  const [inboxEmails,    setInboxEmails]    = useState([]);     // always INBOX, used for category counts
  const [loading,        setLoading]        = useState(false);
  const [showCompose,    setShowCompose]    = useState(false);
  const [replyTo,        setReplyTo]        = useState(null);
  const [forwardOf,      setForwardOf]      = useState(null);
  const [selectedEmail,  setSelectedEmail]  = useState(null);
  const [detailLoading,  setDetailLoading]  = useState(false);
  const [spamCount,      setSpamCount]      = useState(0);
  const [searchQuery,    setSearchQuery]    = useState('');
  const [searchResults,  setSearchResults]  = useState(null);
  const [searchLoading,  setSearchLoading]  = useState(false);
  const [inboxUnread,    setInboxUnread]    = useState(0);
  const [toasts, setToasts] = useState([]);
  const searchTimer = useRef(null);

  const notify = useCallback((message, type = 'success') => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts(prev => [...prev, { id, message, type }]);
    window.setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 4000);
  }, []);

  const removeToast = (id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  // Count of unread inbox emails that are replies to something this user sent
  const importantCount = useMemo(
    () => inboxEmails.filter(e => e.is_important_reply && !e.read).length,
    [inboxEmails]
  );

  // Important emails list for the notification dropdown
  const importantEmails = useMemo(
    () => inboxEmails.filter(e => e.is_important_reply),
    [inboxEmails]
  );

  // Category counts from inbox emails (live)
  const categoryCounts = useMemo(() => {
    const counts = {};
    inboxEmails.forEach(e => {
      if (e.ai_category && e.ai_category !== 'Spam') {
        counts[e.ai_category] = (counts[e.ai_category] || 0) + 1;
      }
    });
    return counts;
  }, [inboxEmails]);

  // Keep inboxEmails in sync when in inbox view
  useEffect(() => {
    if (activeScreen === 'inbox') setInboxEmails(emails);
  }, [emails, activeScreen]);

  useEffect(() => {
    if (activeScreen === 'inbox') {
      setInboxUnread(emails.filter(e => !e.read).length);
    }
  }, [emails, activeScreen]);

  // Debounced search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!searchQuery.trim()) { setSearchResults(null); return; }
    searchTimer.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const folder = activeCategory ? 'INBOX' : (FOLDER_MAP[activeScreen] || 'INBOX');
        const res = await api.get('/emails/search', { params: { q: searchQuery.trim(), folder, limit: 50 } });
        setSearchResults(res.data.emails || []);
      } catch { setSearchResults([]); }
      finally { setSearchLoading(false); }
    }, 400);
    return () => clearTimeout(searchTimer.current);
   }, [searchQuery, activeScreen, activeCategory]);

   // When in category mode, filter inboxEmails; otherwise normal display
  const baseEmails = activeCategory
    ? inboxEmails.filter(e => e.ai_category === activeCategory)
    : emails;
  const displayEmails = searchResults !== null ? searchResults : baseEmails;

  const fetchEmails = useCallback(async (forceRefresh = false) => {
    if (!user || activeScreen === 'admin') return;
    setLoading(true);
    try {
      const folder = FOLDER_MAP[activeScreen] || 'INBOX';
      if (forceRefresh) invalidateEmailCache(folder);
      const res = await getEmails(folder, 50);
      const list = res.data.emails || [];
      setEmails(list);
      if (folder === 'SPAM') setSpamCount(list.length);
    } catch (err) {
      console.error('Failed to load emails:', err);
      setEmails([]);
    } finally { setLoading(false); }
  }, [user, activeScreen]);

  // Fetch inbox in background when we're in category view (for counts + filtering)
  const fetchInboxForCategories = useCallback(async () => {
    if (!user) return;
    try {
      const res = await getEmails('INBOX', 100);
      setInboxEmails(res.data.emails || []);
    } catch {}
  }, [user]);

  useEffect(() => {
    setSelectedEmail(null);
    if (activeCategory) {
      fetchInboxForCategories();
    } else {
      fetchEmails();
    }
  }, [fetchEmails, fetchInboxForCategories, activeCategory]);

  // Re-fetch after 5s to pick up AI summaries
  useEffect(() => {
    if (!user || activeScreen === 'admin') return;
    const timer = setTimeout(() => {
      if (activeCategory) {
        fetchInboxForCategories();
      } else {
        const folder = FOLDER_MAP[activeScreen] || 'INBOX';
        invalidateEmailCache(folder);
        fetchEmails();
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [activeScreen, activeCategory, user]);

  const handleEmailClick = async (email) => {
    const folder = activeCategory ? 'INBOX' : (FOLDER_MAP[activeScreen] || 'INBOX');
    setDetailLoading(true); setSelectedEmail(null);
    setEmails(prev => prev.map(e => e.id === email.id ? { ...e, read: true } : e));
    setInboxEmails(prev => prev.map(e => e.id === email.id ? { ...e, read: true } : e));
    try {
      const res = await api.get('/emails/' + email.id + '?folder=' + folder);
      setSelectedEmail(res.data);
    } catch { setSelectedEmail(email); }
    finally { setDetailLoading(false); }
  };

  const handleNavigate = (screen) => {
    setActiveScreen(screen);
    setActiveCategory(null);
    setSelectedEmail(null);
    setSearchQuery('');
    setSearchResults(null);
  };

  const handleCategoryClick = (catId) => {
    setActiveCategory(catId);
    setSelectedEmail(null);
    setSearchQuery('');
    setSearchResults(null);
  };

  const handleLogout = () => { clearEmailCache(); logout(); };

  if (authLoading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
      minHeight:'100vh', background:'#eef0f5', fontSize:14, color:'#888' }}>Loading...</div>
  );

  if (!user) return <LoginPage onLogin={login}/>;

  return (
    <>
       <div className="toast-container">
         {toasts.map(toast => (
           <div key={toast.id} className={`toast ${toast.type}`}>
             <div className="toast-content">
               <div className="toast-icon">
                 {toast.type === 'success' && '✓'}
                 {toast.type === 'error' && '✕'}
                 {toast.type === 'warning' && '⚠'}
                 {toast.type === 'info' && 'ℹ'}
               </div>
               <div className="toast-message">{toast.message}</div>
             </div>
             <button onClick={() => removeToast(toast.id)} aria-label="Dismiss notification">×</button>
             <div className="toast-progress"></div>
           </div>
         ))}
       </div>
      <div className="app-shell" style={{ fontFamily:"'DM Sans', 'Segoe UI', sans-serif" }}>
        <Sidebar active={activeScreen} activeCategory={activeCategory}
          onNavigate={handleNavigate} onCategoryClick={handleCategoryClick}
          onCompose={() => { setReplyTo(null); setShowCompose(true); }}
          onLogout={handleLogout} unreadCount={inboxUnread} spamCount={spamCount}
          categoryCounts={categoryCounts} user={user}/>

        {activeScreen === 'admin' ? <AdminPanel/> :
         selectedEmail || detailLoading ? (
           detailLoading
             ? <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center',
                 background:'#eef0f5', fontSize:14, color:'#888' }}>Loading...</div>
             : <EmailDetail
                 email={selectedEmail}
                 folder={FOLDER_MAP[activeScreen]}
                 onBack={() => setSelectedEmail(null)}
                 onReply={e => { setReplyTo(e); setForwardOf(null); setShowCompose(true); }}
                 onForward={e => { setForwardOf(e); setReplyTo(null); setShowCompose(true); }}
                 onRefresh={fetchEmails}
                 onEmailsChange={setEmails}
                 notify={notify}/>
          ) : (
            <div className="main-section">
              <EmailToolbar
                onSearch={setSearchQuery}
                onRefresh={() => {
                  if (activeCategory) fetchInboxForCategories();
                  else { invalidateEmailCache(FOLDER_MAP[activeScreen]); fetchEmails(true); }
                }}
                searchQuery={searchQuery}
                categoryLabel={activeCategory}
                importantCount={importantCount}
                importantEmails={importantEmails}
              />
             <EmailList emails={displayEmails} loading={loading || searchLoading}
               onEmailClick={handleEmailClick} onEmailsChange={activeCategory ? setInboxEmails : setEmails}
               folder={activeCategory ? 'INBOX' : FOLDER_MAP[activeScreen]}
               notify={notify}/>
           </div>
         )}

        {showCompose && <ComposeModal
          onClose={() => { setShowCompose(false); setReplyTo(null); setForwardOf(null); }}
          onSent={fetchEmails} replyTo={replyTo} forwardOf={forwardOf} notify={notify}/>}
      </div>
    </>
  );
}

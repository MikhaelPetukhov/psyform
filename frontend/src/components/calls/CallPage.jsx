import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useParams, useSearchParams } from 'react-router-dom';
import { getInviteCandidates, inviteCall, logCallEvent } from '../../api/calls';
import { useI18n } from '../../locale/i18n';

const loadScript = (src) => new Promise((resolve, reject) => {
  const done = () => resolve();
  // If Jitsi API already present, resolve immediately
  if (typeof window !== 'undefined' && window.JitsiMeetExternalAPI) return done();
  const existing = document.querySelector(`script[src="${src}"]`);
  if (existing) {
    // Wait for load if the tag exists but API not yet present
    existing.addEventListener('load', done, { once: true });
    return;
  }
  const s = document.createElement('script');
  s.src = src;
  s.async = true;
  s.onload = done;
  s.onerror = () => reject(new Error('failed to load external_api.js'));
  document.body.appendChild(s);
});

const pad = (n) => String(n).padStart(2, '0');

export default function CallPage() {
  const { roomId } = useParams();
  const [search] = useSearchParams();
  const containerRef = useRef(null);
  const apiRef = useRef(null);
  const [remaining, setRemaining] = useState(null);
  const [ended, setEnded] = useState(false);
  const { t } = useI18n();
  const sid = search.get('sid');
  const searchKey = search.toString();

  // Invite UI state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [candidates, setCandidates] = useState([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [candidatesLoaded, setCandidatesLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sentMap, setSentMap] = useState({}); // bookingId -> 'sent'
  // Permissions helper banner
  const [showPerms, setShowPerms] = useState(() => {
    try { return localStorage.getItem('pf_calls_perms_ok') === '1' ? false : true; } catch (_) { return true; }
  });
  const [inviteAllowed, setInviteAllowed] = useState(true);

  useEffect(() => {
    const jwt = search.get('jwt');
    const domainParam = search.get('d');
    const expStr = search.get('exp');
    if (!jwt || !domainParam || !roomId) return;

  let scriptUrl = null;
  let apiDomain = null;
  let apiOrigin = null;
  let isHttps = true;
  try {
    const parsed = new URL(domainParam);
    apiOrigin = parsed.origin.replace(/\/$/, '');
    apiDomain = parsed.host;
    scriptUrl = `${apiOrigin}/external_api.js`;
    isHttps = parsed.protocol === 'https:';
  } catch (_) {
    // Fallback to https if d lacks protocol
    try {
      const fallback = new URL(`https://${domainParam}`);
      apiOrigin = fallback.origin.replace(/\/$/, '');
      apiDomain = fallback.host;
      scriptUrl = `${apiOrigin}/external_api.js`;
      isHttps = true;
    } catch (_) {
      scriptUrl = null;
    }
  }
  if (!scriptUrl || !apiDomain) return;

    let interval = null;

    (async () => {
      try {
        await loadScript(scriptUrl);
        // eslint-disable-next-line no-undef
        const api = new JitsiMeetExternalAPI(apiDomain, {
          roomName: roomId,
          parentNode: containerRef.current,
          width: '100%',
          height: '100%',
          jwt,
          noSSL: !isHttps,
          configOverwrite: {
            disableDeepLinking: true,
            prejoinConfig: { enabled: true, hideDisplayName: true },
            constraints: { video: { height: { ideal: 720, max: 720, min: 240 } } },
            toolbarButtons: ['microphone','camera','desktop','chat','tileview','hangup'],
          },
          interfaceConfigOverwrite: {
            DEFAULT_REMOTE_DISPLAY_NAME: t('calls.interface.defaultRemoteDisplayName'),
            SHOW_CHROME_EXTENSION_BANNER: false,
            TOOLBAR_BUTTONS: ['microphone','camera','desktop','chat','tileview','hangup'],
          },
        });
        apiRef.current = api;

        const safeLog = async (event, meta = null) => {
          if (!sid) return;
          try { await logCallEvent(sid, event, null, meta); } catch (_) {}
        };

        api.on('videoConferenceJoined', async () => { await safeLog('videoConferenceJoined'); });
        api.on('videoConferenceLeft', async () => { await safeLog('videoConferenceLeft'); });
        api.on('participantJoined', async (p) => { await safeLog('participantJoined', { id: p?.id }); });
        api.on('participantLeft', async (p) => { await safeLog('participantLeft', { id: p?.id }); });

        if (expStr) {
          const exp = new Date(expStr).getTime();
          interval = setInterval(() => {
            const now = Date.now();
            const diff = Math.max(0, Math.floor((exp - now) / 1000));
            setRemaining(diff);
            if (diff <= 0 && apiRef.current && !ended) {
              try { apiRef.current.executeCommand('hangup'); } catch (_) {}
              setEnded(true);
            }
          }, 1000);
        }
      } catch (_) {}
    })();

    return () => {
      if (interval) clearInterval(interval);
      try { apiRef.current && apiRef.current.dispose(); } catch (_) {}
    };
  }, [roomId, sid, searchKey, t]);

  // Load invite candidates once when panel opens; cache until manual refresh
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!inviteOpen || !sid || candidatesLoaded) return;
      try {
        setLoadingCandidates(true);
        const list = await getInviteCandidates(sid);
        if (!mounted) return;
        setInviteAllowed(true);
        setCandidates(Array.isArray(list) ? list : []);
        setCandidatesLoaded(true);
      } catch (e) {
        const status = e?.response?.status;
        if (status === 401 || status === 403) {
          setInviteAllowed(false);
          setInviteOpen(false);
          try { toast.error(t('errors.noPermission')); } catch (_) {}
        } else {
          setCandidates([]);
        }
      } finally {
        setLoadingCandidates(false);
      }
    })();
    return () => { mounted = false; };
  }, [inviteOpen, sid, candidatesLoaded]);

  const refreshCandidates = async () => {
    if (!sid) return;
    try {
      setRefreshing(true);
      const list = await getInviteCandidates(sid);
      setInviteAllowed(true);
      setCandidates(Array.isArray(list) ? list : []);
      setCandidatesLoaded(true);
    } catch (e) {
      const status = e?.response?.status;
      if (status === 401 || status === 403) {
        setInviteAllowed(false);
        setInviteOpen(false);
        try { toast.error(t('errors.noPermission')); } catch (_) {}
      }
    } finally {
      setRefreshing(false);
    }
  };

  const handleSendInvite = async (bookingId) => {
    if (!sid) return;
    const key = String(bookingId);
    try {
      await inviteCall(sid, { bookingId });
      setSentMap((m) => ({ ...m, [key]: 'sent' }));
      try { toast.success(t('calls.toasts.inviteOk')); } catch (_) {}
    } catch (_) {
      try { toast.error(t('calls.toasts.inviteFail')); } catch (_) {}
    }
  };

  const renderTimer = () => {
    if (remaining === null) return null;
    const h = Math.floor(remaining / 3600);
    const m = Math.floor((remaining % 3600) / 60);
    const s = remaining % 60;
    const warn = remaining <= 15 * 60;
    return (
      <div className={`fixed left-1/2 -translate-x-1/2 bottom-4 sm:top-4 sm:right-4 sm:left-auto sm:bottom-auto sm:translate-x-0 z-20 px-3 py-2 rounded-lg text-sm ${warn ? 'bg-amber-600 text-white' : 'bg-black/70 text-white'}`}>
        {ended ? t('calls.timer.expired') : t('calls.timer.timeLeft', { h: pad(h), m: pad(m), s: pad(s) })}
      </div>
    );
  };

  return (
    <div className="w-screen h-screen bg-black">
      {renderTimer()}
      {showPerms && (
        <div className="fixed z-30 left-1/2 -translate-x-1/2 top-16 sm:top-4 w-[92vw] max-w-xl">
          <div className="bg-white/95 backdrop-blur rounded-xl border shadow p-3 text-sm">
            <div className="font-semibold mb-1">{t('calls.perms.title')}</div>
            <div className="text-gray-700 mb-2">{t('calls.perms.text')}</div>
            <div className="text-right">
              <button
                onClick={() => { try { localStorage.setItem('pf_calls_perms_ok', '1'); } catch (_) {} setShowPerms(false); }}
                className="px-3 py-1 rounded bg-black text-white text-xs hover:bg-gray-800"
              >
                {t('calls.perms.gotIt')}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Invite button (hidden for guests) */}
      {inviteAllowed && (
        <div className="fixed top-4 left-4 z-20">
          <button
            onClick={() => setInviteOpen((v) => !v)}
            className="px-3 py-2 rounded-lg text-sm bg-white/90 hover:bg-white border shadow"
          >
            {inviteOpen ? t('calls.invite.close') : t('calls.invite.open')}
          </button>
        </div>
      )}
      {/* Invite panel */}
      {inviteOpen && (
        <div className="fixed top-16 left-4 z-20 w-[90vw] max-w-md max-h-[70vh] overflow-auto bg-white rounded-xl border shadow-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold">{t('calls.invite.title')}</div>
            <button
              onClick={refreshCandidates}
              disabled={refreshing}
              className="px-2 py-1 rounded border text-xs bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              {refreshing ? t('calls.invite.refreshing') : t('calls.invite.refresh')}
            </button>
          </div>
          {loadingCandidates ? (
            <div className="text-sm text-gray-500">{t('calls.invite.loading')}</div>
          ) : candidates.length === 0 ? (
            <div className="text-sm text-gray-500">{t('calls.invite.empty')}</div>
          ) : (
            <ul className="space-y-2">
              {candidates.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{c.clientName || t('common.notAvailable')}</div>
                    <div className="text-gray-500 truncate">
                      {c.slotTime ? new Date(c.slotTime).toLocaleString('ru-RU') : ''}
                    </div>
                  </div>
                  {sentMap[String(c.id)] === 'sent' ? (
                    <span className="px-2 py-1 rounded bg-green-100 text-green-700">{t('calls.invite.sentOk')}</span>
                  ) : (
                    <button
                      onClick={() => handleSendInvite(c.id)}
                      className="px-2 py-1 rounded border bg-white hover:bg-gray-50"
                    >
                      {t('calls.invite.send')}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}

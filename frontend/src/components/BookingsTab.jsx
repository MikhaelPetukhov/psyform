import React, { useState, useEffect, useRef, useMemo } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import { FiCalendar, FiPhone, FiUser, FiInfo, FiLoader, FiAlertTriangle, FiCheck, FiX, FiCopy, FiMessageSquare, FiVideo, FiExternalLink, FiLink, FiSend } from 'react-icons/fi';
import RescheduleModal from './RescheduleModal';
import { SiTelegram } from 'react-icons/si';
import { useI18n } from '../locale/i18n';
import { createCall, inviteCall } from '../api/calls';
import { linksFromCreateResponse } from '../utils/calls';

const StatusBadge = ({ status, clientConfirmation, onSendConfirmationRequest, bookingId }) => {
  const baseClasses = "px-3 py-1 text-xs font-semibold rounded-full inline-block";
  let specificClasses = "";
  let text = status;
  let isClickable = false;

  if (clientConfirmation === 'pending') {
    specificClasses = "bg-yellow-100 text-yellow-800 cursor-pointer hover:bg-yellow-200";
    text = 'pending';
    isClickable = true;
  } else if (clientConfirmation === 'confirmed') {
    specificClasses = "bg-green-100 text-green-800";
    text = 'confirmed';
  } else if (clientConfirmation === 'declined') {
    specificClasses = "bg-red-100 text-red-800";
    text = 'client_declined';
  }

  if (!clientConfirmation) {
    switch (status) {
      case 'confirmed':
        specificClasses = "bg-green-100 text-green-800";
        text = 'confirmed';
        break;
      case 'cancelled':
        specificClasses = "bg-red-100 text-red-800";
        text = 'cancelled';
        break;
      case 'completed':
        specificClasses = "bg-green-100 text-green-800";
        text = 'completed';
        break;
      default:
        specificClasses = "bg-yellow-100 text-yellow-800 cursor-pointer hover:bg-yellow-200";
        text = 'pending';
        isClickable = true;
        break;
    }
  }

  const handleClick = () => {
    if (isClickable && onSendConfirmationRequest) {
      onSendConfirmationRequest(bookingId);
    }
  };

  const { t } = useI18n();
  const mapText = (code) => {
    if (code === 'client_declined') return t('bookings.statusClientDeclined');
    if (code === 'pending') return t('bookings.filters.pending');
    if (code === 'confirmed') return t('bookings.filters.confirmed');
    if (code === 'cancelled') return t('bookings.filters.cancelled');
    if (code === 'completed') return t('bookings.filters.completed');
    return code;
  };

  return (
    <span 
      className={`${baseClasses} ${specificClasses} ${isClickable ? 'transition-colors' : ''}`}
      onClick={handleClick}
      title={isClickable ? t('bookings.actions.confirm') : ''}
    >
      {mapText(text)}
    </span>
  );
};

const BookingsTab = ({ practitionerTimezone = 'Europe/Moscow', focusId = null }) => {
  const { t } = useI18n();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [filters, setFilters] = useState({ status: 'all', q: '', from: '', to: '' });
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleBooking, setRescheduleBooking] = useState(null);
  const [highlightId, setHighlightId] = useState(null);
  const [callLinks, setCallLinks] = useState({}); // bookingId -> { sessionId, hostUrl, guestUrl, expiresAt }
  const rowRefs = useRef({});
  // Telegram lookup is persisted on the server at booking creation

  const parseBookingsResponse = (payload) => {
    const rows = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.rows)
          ? payload.rows
          : [];
    const meta = payload?.meta || null;
    return { rows, meta };
  };

  const computeHasMore = (meta, rowsLength, limit, pageNumber) => {
    if (meta && Number.isFinite(Number(meta.total))) {
      const limitVal = Number(meta.limit) || limit || rowsLength || 0;
      const offsetVal = Number.isFinite(Number(meta.offset))
        ? Number(meta.offset)
        : Math.max(0, (pageNumber - 1) * limitVal);
      return offsetVal + rowsLength < Number(meta.total);
    }
    if (Number.isFinite(limit)) {
      return rowsLength === limit;
    }
    return false;
  };

  useEffect(() => {
    const fetchBookings = async (nextPage = 1, append = false) => {
      try {
        if (!append) setLoading(true);
        const limit = 20;
        const params = {};
        if (filters.status && filters.status !== 'all') params.status = filters.status;
        if (filters.q) params.q = filters.q;
        if (filters.from) params.from = filters.from;
        if (filters.to) params.to = filters.to;
        params.page = nextPage;
        params.offset = (nextPage - 1) * limit;
        params.limit = limit;
        const response = await api.get('/bookings', { params });
        const { rows, meta } = parseBookingsResponse(response.data);
        if (append) {
          setBookings(prev => [...prev, ...rows]);
        } else {
          setBookings(rows);
        }
        setHasMore(computeHasMore(meta, rows.length, limit, nextPage));
        setPage(nextPage);
        setError(null);
      } catch (err) {
        setError(t('bookings.errors.load'));
      } finally {
        setLoading(false);
      }
    };

    // initial
    fetchBookings(1, false);
  }, []);

  // Refetch when filters change
  useEffect(() => {
    const fetchFiltered = async () => {
      setPage(1);
      try {
        setLoading(true);
        const limit = 20;
        const params = {};
        if (filters.status && filters.status !== 'all') params.status = filters.status;
        if (filters.q) params.q = filters.q;
        if (filters.from) params.from = filters.from;
        if (filters.to) params.to = filters.to;
        params.page = 1;
        params.offset = 0;
        params.limit = limit;
        const response = await api.get('/bookings', { params });
        const { rows, meta } = parseBookingsResponse(response.data);
        setBookings(rows);
        setHasMore(computeHasMore(meta, rows.length, limit, 1));
        setError(null);
      } catch (err) {
        setError(t('bookings.errors.load'));
      } finally {
        setLoading(false);
      }
    };
    // Debounce-like minimal delay
    const t = setTimeout(fetchFiltered, 150);
    return () => clearTimeout(t);
  }, [filters.status, filters.q, filters.from, filters.to]);

  // When bookings are loaded/updated and we have focusId -> scroll and highlight
  useEffect(() => {
    if (!focusId || !bookings || bookings.length === 0) return;
    const idStr = String(focusId);
    const found = bookings.find((b) => String(b.id) === idStr);
    if (!found) return;
    setHighlightId(found.id);
    // Scroll into view gently
    try {
      const el = rowRefs.current[found.id];
      if (el && el.scrollIntoView) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } catch (_) {}
    // Remove highlight after 2.5s
    const t = setTimeout(() => setHighlightId(null), 2500);
    return () => clearTimeout(t);
  }, [focusId, bookings]);

  // Removed hover-lookup and tooltip logic
  // Formatters respect practitioner's timezone
  const fmtTimeShort = useMemo(
    () => new Intl.DateTimeFormat('ru-RU', { timeZone: practitionerTimezone, hour: '2-digit', minute: '2-digit' }),
    [practitionerTimezone]
  );
  const fmtDayShort = useMemo(
    () => new Intl.DateTimeFormat('ru-RU', { timeZone: practitionerTimezone, day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
    [practitionerTimezone]
  );
  const fmtFull = useMemo(
    () => new Intl.DateTimeFormat('ru-RU', { timeZone: practitionerTimezone, day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    [practitionerTimezone]
  );

  const handleSendConfirmationRequest = async (bookingId) => {
    try {
      await api.post(`/bookings/${bookingId}/send-confirmation`);
      toast.success(t('bookings.toasts.confirmSent'));
    } catch (error) {
      console.error('Error sending confirmation request:', error);
      
      const errorMsg = error?.response?.data?.msg
        || (error?.response?.status === 400 ? t('bookings.toasts.confirmFail400') : null)
        || t('errors.generic');
      toast.error(errorMsg, { duration: 6000 });
    }
  };

  const handleDelete = async (booking) => {
    const name = booking.clientName || t('bookings.columns.client');
    const ok = window.confirm(t('bookings.confirmDelete', { name }));
    if (!ok) return;
    const id = toast.loading(t('bookings.toasts.deleting'));
    try {
      await api.delete(`/bookings/${booking.id}`);
      setBookings((prev) => prev.filter((b) => b.id !== booking.id));
      toast.success(t('bookings.toasts.deleted'), { id });
    } catch (e) {
      toast.error(e?.response?.data?.msg || t('bookings.toasts.deleteFailed'), { id });
    }
  };

  const openReschedule = (booking) => {
    setRescheduleBooking(booking);
    setRescheduleOpen(true);
  };

  const handleRescheduled = (updated) => {
    setBookings((prev) => prev.map((b) => (b.id === updated.id ? { ...b, ...updated } : b)));
  };

  const createCallFor = async (booking) => {
    const toastId = toast.loading(t('calls.toasts.creating'));
    try {
      const res = await createCall(booking.id, 90);
      const links = linksFromCreateResponse(res);
      setCallLinks((prev) => ({ ...prev, [booking.id]: links }));
      toast.success(t('calls.toasts.created'), { id: toastId });
    } catch (e) {
      toast.error(t('calls.toasts.createFailed'), { id: toastId });
    }
  };

  const openHost = (bookingId) => {
    const links = callLinks[bookingId];
    if (!links) return;
    window.open(links.hostUrl, '_blank', 'noopener');
  };

  const copyGuest = async (bookingId) => {
    const links = callLinks[bookingId];
    if (!links) return;
    try { await navigator.clipboard.writeText(links.guestUrl); toast.success(t('calls.toasts.copyGuestOk')); } catch (_) { toast.error(t('calls.toasts.copyGuestFail')); }
  };

  const sendInvite = async (bookingId) => {
    const links = callLinks[bookingId];
    if (!links) return;
    const id = toast.loading(t('calls.toasts.inviting'));
    try { await inviteCall(links.sessionId, { bookingId }); toast.success(t('calls.toasts.inviteOk'), { id }); } catch (_) { toast.error(t('calls.toasts.inviteFail'), { id }); }
  };

  const copyContacts = async (booking) => {
    const handle = (booking.telegramUsername || booking.clientTelegram || '').replace(/^@/, '');
    const txt = [
      booking.clientName ? `${t('bookings.columns.client')}: ${booking.clientName}` : null,
      booking.clientPhone ? `${t('bookings.columns.phone')}: ${booking.clientPhone}` : null,
      handle ? `${t('bookings.columns.telegram')}: @${handle}` : null,
    ].filter(Boolean).join('\n');
    try {
      await navigator.clipboard.writeText(txt || '');
      toast.success(t('bookings.toasts.copyOk'));
    } catch (_) {
      toast.error(t('bookings.toasts.copyFail'));
    }
  };

  const loadMore = async () => {
    const next = page + 1;
    try {
      const limit = 20;
      const params = {};
      if (filters.status && filters.status !== 'all') params.status = filters.status;
      if (filters.q) params.q = filters.q;
      if (filters.from) params.from = filters.from;
      if (filters.to) params.to = filters.to;
      params.page = next;
      params.offset = (next - 1) * limit;
      params.limit = limit;
      const response = await api.get('/bookings', { params });
      const { rows, meta } = parseBookingsResponse(response.data);
      setBookings(prev => [...prev, ...rows]);
      setHasMore(computeHasMore(meta, rows.length, limit, next));
      setPage(next);
    } catch (err) {
      toast.error(t('bookings.toasts.loadMoreFail'));
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="text-center py-16">
          <FiLoader className="mx-auto h-12 w-12 text-brand-accent animate-spin" />
          <h4 className="mt-4 text-lg font-medium text-brand-text">{t('bookings.loading')}</h4>
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center py-16 border-2 border-dashed border-red-200 rounded-xl bg-red-50">
          <FiAlertTriangle className="mx-auto h-12 w-12 text-red-400" />
          <h4 className="mt-4 text-lg font-medium text-red-700">{t('bookings.errorTitle')}</h4>
          <p className="mt-1 text-sm text-red-600">{error}</p>
        </div>
      );
    }

    if (bookings.length === 0) {
      return (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl">
          <FiCalendar className="mx-auto h-12 w-12 text-gray-300" />
          <h4 className="mt-4 text-lg font-medium text-brand-text">{t('bookings.noneTitle')}</h4>
          <p className="mt-1 text-sm text-brand-secondary">{t('bookings.noneText')}</p>
        </div>
      );
    }

    // Compute Today and Upcoming lists
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const inNextDays = (d, days) => {
      const target = new Date(d);
      const diffMs = target - endOfToday;
      return diffMs > 0 && diffMs <= days * 24 * 60 * 60 * 1000;
    };
    const todayList = bookings.filter(b => {
      const dt = new Date(b.slotTime);
      return dt >= startOfToday && dt <= endOfToday;
    });
    const upcomingList = bookings.filter(b => {
      const dt = new Date(b.slotTime);
      return dt > endOfToday && inNextDays(dt, 7);
    });

    const scrollToBooking = (id) => {
      try {
        const el = rowRefs.current[id];
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setHighlightId(id);
          setTimeout(() => setHighlightId(null), 2000);
        }
      } catch (_) {}
    };

    return (
      <div className="overflow-x-auto">
        {(todayList.length > 0 || upcomingList.length > 0) && (
          <div className="mb-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
            {todayList.length > 0 && (
              <div className="p-4 rounded-xl border bg-white">
                <div className="text-sm font-semibold text-brand-text mb-2">{t('bookings.today')}</div>
                <ul className="space-y-2 text-sm">
                  {todayList.slice(0, 5).map(b => (
                    <li key={`today-${b.id}`} className="flex items-center justify-between">
                      <span className="truncate mr-2">{b.clientName || t('bookings.columns.client')} • {fmtTimeShort.format(new Date(b.slotTime))}</span>
                      <button className="text-brand-accent hover:underline" onClick={() => scrollToBooking(b.id)}>{t('bookings.show')}</button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {upcomingList.length > 0 && (
              <div className="p-4 rounded-xl border bg-white">
                <div className="text-sm font-semibold text-brand-text mb-2">{t('bookings.upcoming7')}</div>
                <ul className="space-y-2 text-sm">
                  {upcomingList.slice(0, 5).map(b => (
                    <li key={`upcoming-${b.id}`} className="flex items-center justify-between">
                      <span className="truncate mr-2">{b.clientName || t('bookings.columns.client')} • {fmtDayShort.format(new Date(b.slotTime))}</span>
                      <button className="text-brand-accent hover:underline" onClick={() => scrollToBooking(b.id)}>{t('bookings.show')}</button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        <table className="min-w-full divide-y divide-gray-200/70">
          <thead className="bg-gray-50/50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-brand-secondary uppercase tracking-wider"><FiUser className="inline-block mr-2 -mt-0.5" />{t('bookings.columns.client')}</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-brand-secondary uppercase tracking-wider"><FiCalendar className="inline-block mr-2 -mt-0.5" />{t('bookings.columns.datetime')}</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-brand-secondary uppercase tracking-wider"><FiPhone className="inline-block mr-2 -mt-0.5" />{t('bookings.columns.phone')}</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-brand-secondary uppercase tracking-wider">{t('bookings.columns.telegram')}</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-brand-secondary uppercase tracking-wider"><FiInfo className="inline-block mr-2 -mt-0.5" />{t('bookings.columns.status')}</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200/70">
            {bookings.map((booking) => (
              <tr
                key={booking.id}
                ref={(el) => { rowRefs.current[booking.id] = el; }}
                className={`group transition-colors ${highlightId === booking.id ? 'ring-2 ring-brand-accent bg-brand-light-accent/20' : 'hover:bg-gray-50/70'}`}
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-brand-text">
                  <button
                    onClick={() => handleDelete(booking)}
                    title={t('bookings.actions.delete')}
                    className="inline-flex items-center justify-center mr-2 text-red-500 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <FiX className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => openReschedule(booking)}
                    title={t('bookings.actions.reschedule')}
                    className="inline-flex items-center justify-center mr-2 text-brand-accent hover:text-brand-accent/80 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <FiCalendar className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => copyContacts(booking)}
                    title={t('bookings.actions.copyContacts')}
                    className="inline-flex items-center justify-center mr-2 text-gray-500 hover:text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <FiCopy className="w-4 h-4" />
                  </button>
                  {/* Create call / actions */}
                  {callLinks[booking.id] ? (
                    <span className="inline-flex items-center space-x-2 mr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openHost(booking.id)}
                        title={t('calls.buttons.openHost')}
                        className="inline-flex items-center justify-center text-brand-accent hover:text-brand-accent/80"
                      >
                        <FiExternalLink className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => copyGuest(booking.id)}
                        title={t('calls.buttons.copyGuest')}
                        className="inline-flex items-center justify-center text-gray-600 hover:text-gray-800"
                      >
                        <FiLink className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => sendInvite(booking.id)}
                        title={t('calls.buttons.sendInvite')}
                        className="inline-flex items-center justify-center text-gray-600 hover:text-gray-800"
                      >
                        <FiSend className="w-4 h-4" />
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => createCallFor(booking)}
                      title={t('calls.buttons.createRoom')}
                      className="inline-flex items-center justify-center mr-2 text-brand-accent hover:text-brand-accent/80 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <FiVideo className="w-4 h-4" />
                    </button>
                  )}
                  {(() => { const handle = (booking.telegramUsername || booking.clientTelegram || '').replace(/^@/, '');
                    return handle ? (
                      <a
                        href={`https://t.me/${handle}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={t('bookings.actions.openTelegram')}
                        className="inline-flex items-center justify-center mr-2 text-[#0088cc] hover:text-[#0077b6] opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <FiMessageSquare className="w-4 h-4" />
                      </a>
                    ) : null; })()}
                  {booking.clientName}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-brand-secondary">
                  {fmtFull.format(new Date(booking.slotTime))}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-brand-secondary">
                  <div className="inline-flex items-center space-x-2">
                    <FiPhone className="w-4 h-4 text-gray-500" />
                    <span>{booking.clientPhone || '-'}</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-brand-secondary">
                  {(() => {
                    const handle = (booking.telegramUsername || booking.clientTelegram || '').replace(/^@/, '');
                    if (booking.telegramFound && handle) {
                      return (
                        <span className="inline-flex items-center space-x-2">
                          <SiTelegram className="w-4 h-4 text-blue-500" />
                          <a
                            href={`https://t.me/${handle}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand-accent hover:underline"
                          >
                            @{handle}
                          </a>
                          <FiCheck className="w-4 h-4 text-green-500" />
                        </span>
                      );
                    }
                    if (handle) {
                      return (
                        <span className="inline-flex items-center space-x-2">
                          <SiTelegram className="w-4 h-4 text-gray-400" />
                          <a
                            href={`https://t.me/${handle}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand-accent hover:underline"
                          >
                            @{handle}
                          </a>
                        </span>
                      );
                    }
                    return '-';
                  })()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <StatusBadge 
                    status={booking.status} 
                    clientConfirmation={booking.clientConfirmation}
                    onSendConfirmationRequest={handleSendConfirmationRequest}
                    bookingId={booking.id}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {hasMore && (
          <div className="mt-4 text-center">
            <button onClick={loadMore} className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50">{t('bookings.loadMore')}</button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200/60 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-brand-text">{t('bookings.title')}</h3>
      </div>
      <div className="mb-4 grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto_auto] gap-3 items-end">
        <div>
          <label className="block text-xs text-brand-secondary mb-1">{t('bookings.filters.search')}</label>
          <input
            type="text"
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            placeholder={t('bookings.filters.placeholderName')}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>
        <div>
          <label className="block text-xs text-brand-secondary mb-1">{t('bookings.filters.status')}</label>
          <select
            className="px-3 py-2 border rounded-lg"
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          >
            <option value="all">{t('bookings.filters.all')}</option>
            <option value="pending">{t('bookings.filters.pending')}</option>
            <option value="confirmed">{t('bookings.filters.confirmed')}</option>
            <option value="cancelled">{t('bookings.filters.cancelled')}</option>
            <option value="completed">{t('bookings.filters.completed')}</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-brand-secondary mb-1">{t('bookings.filters.dateFrom')}</label>
          <input type="date" className="px-3 py-2 border rounded-lg" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} />
        </div>
        <div>
          <label className="block text-xs text-brand-secondary mb-1">{t('bookings.filters.dateTo')}</label>
          <input type="date" className="px-3 py-2 border rounded-lg" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} />
        </div>
        <div className="flex gap-2">
          <button
            className="px-4 py-2 rounded-lg border bg-white hover:bg-gray-50"
            onClick={() => setPage(1)}
            title={t('bookings.filters.apply')}
          >{t('bookings.filters.apply')}</button>
          <button
            className="px-3 py-2 rounded-lg border bg-white hover:bg-gray-50"
            onClick={() => setFilters({ status: 'all', q: '', from: '', to: '' })}
          >{t('bookings.filters.reset')}</button>
        </div>
      </div>
      <div>
        {renderContent()}
      </div>
      <RescheduleModal
        isOpen={rescheduleOpen}
        booking={rescheduleBooking}
        onClose={() => setRescheduleOpen(false)}
        onRescheduled={handleRescheduled}
        practitionerTimezone={practitionerTimezone}
      />
    </div>
  );
};

export default BookingsTab;

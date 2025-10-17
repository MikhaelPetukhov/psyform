import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useI18n } from '../../locale/i18n';
import { FiVideo, FiExternalLink, FiLink, FiSend } from 'react-icons/fi';

import { TimeRangeDisplay } from '../TimezoneDisplay';
import { getClientsFocusUrl } from '../../utils/calendar';
import { deleteBooking } from '../../api/calendar';
import { createCall, inviteCall } from '../../api/calls';
import { linksFromCreateResponse } from '../../utils/calls';

const BookingDetailsModal = ({ booking, onClose, practitionerTimezone, onUpdated, onReschedule }) => {
  const [callLinks, setCallLinks] = useState(null); // { sessionId, hostUrl, guestUrl, expiresAt }
  const { t } = useI18n();
  if (!booking) return null;

  const handleCopyLink = async () => {
    try {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const url = baseUrl + getClientsFocusUrl(booking.id);
      await navigator.clipboard.writeText(url);
      toast.success(t('bookingDetailsModal.toasts.linkCopied'));
    } catch (error) {
      toast(t('bookingDetailsModal.toasts.copyFailed'));
    }
  };

  const createCallFor = async () => {
    const id = toast.loading(t('calls.toasts.creating'));
    try {
      const res = await createCall(booking.id, 90);
      const links = linksFromCreateResponse(res);
      setCallLinks(links);
      toast.success(t('calls.toasts.created'), { id });
    } catch (_) {
      toast.error(t('calls.toasts.createFailed'), { id });
    }
  };

  const openHost = () => {
    if (!callLinks) return;
    window.open(callLinks.hostUrl, '_blank', 'noopener');
  };

  const copyGuest = async () => {
    if (!callLinks) return;
    try { await navigator.clipboard.writeText(callLinks.guestUrl); toast.success(t('calls.toasts.copyGuestOk')); } catch (_) { toast.error(t('calls.toasts.copyGuestFail')); }
  };

  const sendInvite = async () => {
    if (!callLinks) return;
    const id = toast.loading(t('calls.toasts.inviting'));
    try { await inviteCall(callLinks.sessionId, { bookingId: booking.id }); toast.success(t('calls.toasts.inviteOk'), { id }); } catch (_) { toast.error(t('calls.toasts.inviteFail'), { id }); }
  };

  const handleCancel = async () => {
    if (!window.confirm(t('bookingDetailsModal.confirm.cancel'))) return;

    try {
      await deleteBooking(booking.id);
      toast.success(t('bookingDetailsModal.toasts.cancelled'));
      if (onUpdated) onUpdated();
      onClose();
    } catch (error) {
      toast.error(error?.response?.data?.msg || t('bookingDetailsModal.toasts.cancelFailed'));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-2xl w-full max-w-xl shadow-xl">
        <h4 className="text-lg font-semibold mb-4">{t('bookingDetailsModal.title')}</h4>
        <div className="space-y-2 text-sm">
          <div>
            <span className="font-medium">{t('bookingDetailsModal.client')}:</span> {booking.clientName}
            {booking.telegramHandle && (
              <a
                href={getClientsFocusUrl(booking.id)}
                onClick={(event) => {
                  event.preventDefault();
                  window.open(getClientsFocusUrl(booking.id), '_blank', 'noopener,noreferrer');
                }}
                className="ml-2 text-brand-accent hover:underline"
              >
                @{booking.telegramHandle}
              </a>
            )}
          </div>
          <div>
            <span className="font-medium">{t('bookingDetailsModal.phone')}:</span> {booking.clientPhone || t('common.notAvailable')}
          </div>
          <div>
            <span className="font-medium">{t('bookingDetailsModal.time')}:</span>
            <div className="mt-1">
              <TimeRangeDisplay
                startTime={booking.start}
                endTime={booking.end}
                practitionerTimezone={practitionerTimezone}
                isAdmin={true}
              />
            </div>
          </div>
          {booking.sourceTimezone && booking.sourceTimezone !== practitionerTimezone && (
            <div>
              <span className="font-medium">{t('bookingDetailsModal.clientTime')}{':'}</span>
              <div className="mt-1">
                <TimeRangeDisplay
                  startTime={booking.start}
                  endTime={booking.end}
                  isAdmin={false}
                  clientTimezoneOverride={booking.sourceTimezone}
                />
              </div>
            </div>
          )}
          {booking.preferredContact && (
            <div>
              <span className="font-medium">{t('bookingDetailsModal.channel')}:</span>{' '}
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700">
                {booking.preferredContact}
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4">
          <button
            onClick={() => {
              if (booking.telegramHandle) {
                const handle = booking.telegramHandle.replace(/^@/, '');
                try {
                  window.open(`https://t.me/${handle}`, '_blank', 'noopener,noreferrer');
                } catch (error) {
                  // ignore
                }
              } else {
                toast(t('errors.generic'));
              }
            }}
            className="px-3 py-2 rounded-lg border text-sm bg-white hover:bg-gray-50"
          >
            {t('bookingDetailsModal.buttons.telegramChat')}
          </button>
          <button
            onClick={() => onReschedule && onReschedule(booking)}
            className="px-3 py-2 rounded-lg border text-sm bg-white hover:bg-gray-50"
          >
            {t('bookingDetailsModal.buttons.reschedule')}
          </button>
          <button
            onClick={handleCancel}
            className="px-3 py-2 rounded-lg border border-red-200 bg-red-50 text-red-600 text-sm hover:bg-red-100"
          >
            {t('bookingDetailsModal.buttons.cancel')}
          </button>
          <button
            onClick={handleCopyLink}
            className="px-3 py-2 rounded-lg border text-sm bg-white hover:bg-gray-50"
          >
            {t('bookingDetailsModal.buttons.copyLink')}
          </button>
        </div>

        {/* Calls actions */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
          {!callLinks ? (
            <button
              onClick={createCallFor}
              className="px-3 py-2 rounded-lg border text-sm bg-white hover:bg-gray-50 inline-flex items-center gap-2"
              title={t('calls.buttons.createRoom')}
            >
              <FiVideo className="w-4 h-4" /> {t('calls.buttons.createRoom')}
            </button>
          ) : (
            <>
              <button
                onClick={openHost}
                className="px-3 py-2 rounded-lg border text-sm bg-white hover:bg-gray-50 inline-flex items-center gap-2"
                title={t('calls.buttons.openHost')}
              >
                <FiExternalLink className="w-4 h-4" /> {t('calls.buttons.openHost')}
              </button>
              <button
                onClick={copyGuest}
                className="px-3 py-2 rounded-lg border text-sm bg-white hover:bg-gray-50 inline-flex items-center gap-2"
                title={t('calls.buttons.copyGuest')}
              >
                <FiLink className="w-4 h-4" /> {t('calls.buttons.copyGuest')}
              </button>
              <button
                onClick={sendInvite}
                className="px-3 py-2 rounded-lg border text-sm bg-white hover:bg-gray-50 inline-flex items-center gap-2"
                title={t('calls.buttons.sendInvite')}
              >
                <FiSend className="w-4 h-4" /> {t('calls.buttons.sendInvite')}
              </button>
            </>
          )}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm border bg-white hover:bg-gray-50"
          >
            {t('bookingDetailsModal.buttons.close')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BookingDetailsModal;

export const getBookingStatusClass = (status, clientConfirmation) => {
  if (clientConfirmation === 'pending') return 'status-pending';
  if (clientConfirmation === 'confirmed') return 'status-confirmed';
  if (clientConfirmation === 'declined') return 'status-cancelled';

  switch (status) {
    case 'confirmed':
      return 'status-confirmed';
    case 'cancelled':
      return 'status-cancelled';
    case 'completed':
      return 'status-completed';
    default:
      return '';
  }
};

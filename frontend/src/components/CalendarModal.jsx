import React from 'react';
import CalendarTab from './CalendarTab';

const CalendarModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-full overflow-auto">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 text-2xl"
          aria-label="Закрыть"
        >
          &times;
        </button>
        <CalendarTab />
      </div>
    </div>
  );
};

export default CalendarModal;

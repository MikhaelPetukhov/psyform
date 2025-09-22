import React from 'react';

const CalendarHeader = ({ nowStr, zoneLabel, onTimezoneClick }) => (
  <div className="w-full bg-transparent">
    <div className="max-w-[1200px] mx-auto px-4 py-4 flex items-center justify-between">
      <h1 className="text-2xl font-semibold text-brand-text">Панель психолога</h1>
      <button
        type="button"
        onClick={onTimezoneClick}
        className="inline-flex items-center gap-2 rounded-full bg-gray-900 text-white px-3 py-1 text-sm hover:bg-black"
        title="Сменить часовой пояс"
      >
        <span>Сейчас: {nowStr}</span>
        <span className="opacity-60">·</span>
        <span>Моя зона: {zoneLabel}</span>
      </button>
    </div>
  </div>
);

export default CalendarHeader;

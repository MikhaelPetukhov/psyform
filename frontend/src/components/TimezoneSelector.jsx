import React from 'react';

// Popular timezones for psychologist selection matching the backend
const TIMEZONE_OPTIONS = [
  { value: 'Europe/Moscow', label: 'Москва (UTC+3)' },
  { value: 'Europe/Kaliningrad', label: 'Калининград (UTC+2)' }, 
  { value: 'Europe/Samara', label: 'Самара (UTC+4)' },
  { value: 'Asia/Yekaterinburg', label: 'Екатеринбург (UTC+5)' },
  { value: 'Asia/Omsk', label: 'Омск (UTC+6)' },
  { value: 'Asia/Krasnoyarsk', label: 'Красноярск (UTC+7)' },
  { value: 'Asia/Irkutsk', label: 'Иркутск (UTC+8)' },
  { value: 'Asia/Yakutsk', label: 'Якутск (UTC+9)' },
  { value: 'Asia/Vladivostok', label: 'Владивосток (UTC+10)' },
  { value: 'Asia/Magadan', label: 'Магадан (UTC+11)' },
  { value: 'Asia/Kamchatka', label: 'Камчатка (UTC+12)' },
  { value: 'Europe/Kiev', label: 'Киев (UTC+2)' },
  { value: 'Europe/Minsk', label: 'Минск (UTC+3)' },
  { value: 'Asia/Almaty', label: 'Алматы (UTC+6)' },
  { value: 'Asia/Tashkent', label: 'Ташкент (UTC+5)' },
  { value: 'Asia/Tbilisi', label: 'Тбилиси (UTC+4)' }
];

/**
 * Timezone selector component for psychologist onboarding
 */
const TimezoneSelector = ({ 
  value = 'Europe/Moscow', 
  onChange, 
  required = false,
  className = '',
  label = 'Ваш часовой пояс',
  error = null
}) => {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label className="text-sm font-medium text-brand-text">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        required={required}
        className={`
          px-3 py-2 border rounded-lg text-sm
          focus:outline-none focus:ring-2 focus:ring-brand-accent focus:border-brand-accent
          ${error 
            ? 'border-red-300 bg-red-50 text-red-900' 
            : 'border-gray-300 bg-white text-brand-text'
          }
        `}
      >
        <option value="">Выберите часовой пояс</option>
        {TIMEZONE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <span className="text-xs text-red-600">{error}</span>
      )}
      <p className="text-xs text-gray-500">
        Выберите город или регион, где вы работаете. 
        Это время будет использоваться для отображения расписания в админке.
      </p>
    </div>
  );
};

export default TimezoneSelector;

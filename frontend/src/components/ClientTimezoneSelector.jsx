import React, { useState, useEffect } from 'react';
import { FiMapPin, FiClock, FiCheck } from 'react-icons/fi';
import { TOP_CITIES, OTHER_CITIES, detectClosestRussianCity } from '../utils/russianCities';
import CityTimezonePicker from './CityTimezonePicker';

function getUtcOffsetDisplay(timezone) {
  if (!timezone) return '';
  try {
    const parts = new Intl.DateTimeFormat('ru-RU', { timeZone: timezone, timeZoneName: 'short' }).formatToParts(new Date());
    const name = parts.find(p => p.type === 'timeZoneName')?.value || '';
    return name.replace('GMT', 'UTC');
  } catch (_) {
    return '';
  }
}

const ClientTimezoneSelector = ({ 
  selectedTimezone, 
  onTimezoneChange, 
  showMoscowToggle = true,
  compact = false 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showMoscowTime, setShowMoscowTime] = useState(false);
  const [detectedCity, setDetectedCity] = useState(null);
  const [selectedCity, setSelectedCity] = useState(null);
  const [autoCardDismissed, setAutoCardDismissed] = useState(false);
  const [isCityModalOpen, setIsCityModalOpen] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    // Автоопределение города клиента
    const detected = detectClosestRussianCity();
    setDetectedCity(detected);

    // Если timezone не установлен, используем автоопределение
    if (!selectedTimezone) {
      setSelectedCity(detected);
      onTimezoneChange(detected.timezone);
      // Сразу не показываем синий блок, если автоопределение и так выбрано
      setAutoCardDismissed(true);
    } else {
      // Найти город по переданному timezone
      const city = [...TOP_CITIES, ...OTHER_CITIES].find(c => c.timezone === selectedTimezone);
      setSelectedCity(city || detected);
      // Если исходно выбранная таймзона совпадает с автоопределённой — не показываем синий блок
      try { if (selectedTimezone === detected.timezone) setAutoCardDismissed(true); } catch (_) {}
    }
  }, [selectedTimezone, onTimezoneChange]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setNow(new Date());
    }, 60000);

    return () => clearInterval(intervalId);
  }, []);

  const handleCitySelect = (city) => {
    setSelectedCity(city);
    onTimezoneChange(city.timezone);
    setIsOpen(false);
    setShowMoscowTime(false); // Сбрасываем тумблер МСК при выборе города
    // Если пользователь подтвердил автоопределённый город — скрываем информационную карточку
    try {
      if (detectedCity && city && detectedCity.timezone === city.timezone) {
        setAutoCardDismissed(true);
      }
    } catch (_) { /* ignore */ }
  };

  const handleTimezoneFromPicker = (timezone, meta) => {
    const picked = { name: meta?.name || timezone, timezone };
    handleCitySelect(picked);
    setIsCityModalOpen(false);
  };

  const toggleMoscowTime = () => {
    setShowMoscowTime(!showMoscowTime);
    if (!showMoscowTime) {
      // Включаем показ по МСК - передаем московский timezone
      onTimezoneChange('Europe/Moscow');
    } else {
      // Возвращаем к определенному/выбранному городу
      if (selectedCity) {
        onTimezoneChange(selectedCity.timezone);
      }
    }
  };

  const currentDisplayCity = showMoscowTime 
    ? TOP_CITIES.find(c => c.timezone === 'Europe/Moscow')
    : selectedCity;
  const isDetectedSelected = !!(detectedCity && selectedCity && !showMoscowTime && selectedCity.timezone === detectedCity.timezone);

  if (compact) {
    return (
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800 transition-colors"
        >
          <FiMapPin className="w-4 h-4" />
          <span>{currentDisplayCity?.name || 'Выбрать город'}</span>
          <span className="text-xs">UTC{currentDisplayCity?.utcOffset}</span>
        </button>
        
        {isOpen && (
          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 w-64 max-h-64 overflow-y-auto">
            <div className="p-3 border-b border-gray-100">
              <div className="text-sm font-medium text-gray-700">Выберите ваш город</div>
            </div>
            {TOP_CITIES.slice(0, 5).map((city) => (
              <button
                key={city.timezone}
                onClick={() => handleCitySelect(city)}
                className="w-full text-left p-2 hover:bg-gray-50 text-sm"
              >
                <div className="font-medium">{city.name}</div>
                <div className="text-xs text-gray-500">UTC{city.utcOffset}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Автоопределение */}
      {detectedCity && !autoCardDismissed && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start">
              <FiMapPin className="text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-medium text-blue-800">Ваше время определено автоматически</h4>
                <p className="text-sm text-blue-700 mt-1">
                  Город: <strong>{detectedCity.name}</strong> (UTC{detectedCity.utcOffset})
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  Текущее время: {now.toLocaleTimeString('ru-RU', { timeZone: detectedCity.timezone, hour12: false })}
                </p>
              </div>
            </div>
            <div className="flex-shrink-0">
              {isDetectedSelected ? (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-100 text-blue-800 text-xs font-medium border border-blue-200">
                  <FiCheck className="w-4 h-4" />
                  Выбрано
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => handleCitySelect(detectedCity)}
                  className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm"
                >
                  Выбрать
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Тумблер МСК */}
      {showMoscowToggle && selectedCity?.timezone !== 'Europe/Moscow' && (
        <div className="flex items-center gap-3">
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={showMoscowTime}
              onChange={toggleMoscowTime}
              className="sr-only"
            />
            <div className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${
              showMoscowTime ? 'bg-brand-accent' : 'bg-gray-300'
            }`}>
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-0.5 ${
                showMoscowTime ? 'translate-x-4' : 'translate-x-0.5'
              }`} />
            </div>
            <span className="ml-2 text-sm text-gray-700">
              Показать время по Москве
            </span>
          </label>
        </div>
      )}

      {/* Выбор города */}
      <div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between p-3 border border-gray-300 rounded-lg bg-white hover:border-gray-400 transition-colors"
        >
          <div className="flex items-center gap-2">
            <FiMapPin className="text-gray-500" />
            <div className="text-left">
              <div className="font-medium text-gray-900">
                {currentDisplayCity?.name || 'Выберите город'}
              </div>
              <div className="text-sm text-gray-500">
                {getUtcOffsetDisplay(showMoscowTime ? 'Europe/Moscow' : selectedCity?.timezone)} • {
                  now.toLocaleTimeString('ru-RU', {
                    timeZone: showMoscowTime ? 'Europe/Moscow' : selectedCity?.timezone,
                    hour12: false
                  })
                }
              </div>
            </div>
          </div>
          <div className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`}>
            ▼
          </div>
        </button>

        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setIsOpen(false)}
            />
            <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-100 p-3">
                <div className="text-sm font-medium text-gray-700 flex items-center justify-between">
                  <span>Выберите ваш город</span>
                  <button
                    type="button"
                    className="text-xs text-brand-accent hover:underline"
                    onClick={() => { setIsOpen(false); setIsCityModalOpen(true); }}
                  >
                    Найти другой город (весь мир)
                  </button>
                </div>
              </div>
              
              {/* Топ города */}
              <div className="p-2">
                <div className="text-xs text-gray-500 uppercase tracking-wide px-2 py-1">
                  Крупные города
                </div>
                {TOP_CITIES.map((city) => (
                  <button
                    key={city.timezone}
                    onClick={() => handleCitySelect(city)}
                    className={`w-full text-left p-2 rounded hover:bg-gray-50 transition-colors ${
                      selectedCity?.timezone === city.timezone ? 'bg-brand-accent/10 text-brand-accent' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{city.name}</div>
                        <div className="text-sm text-gray-500">UTC{city.utcOffset}</div>
                      </div>
                      {selectedCity?.timezone === city.timezone && (
                        <FiCheck className="text-brand-accent" />
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {/* Другие города */}
              <div className="p-2 border-t border-gray-100">
                <div className="text-xs text-gray-500 uppercase tracking-wide px-2 py-1">
                  Другие города
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {OTHER_CITIES.map((city) => (
                    <button
                      key={city.timezone}
                      onClick={() => handleCitySelect(city)}
                      className={`w-full text-left p-2 rounded hover:bg-gray-50 transition-colors ${
                        selectedCity?.timezone === city.timezone ? 'bg-brand-accent/10 text-brand-accent' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-sm">{city.name}</div>
                          <div className="text-xs text-gray-500">{city.region} • UTC{city.utcOffset}</div>
                        </div>
                        {selectedCity?.timezone === city.timezone && (
                          <FiCheck className="text-brand-accent w-4 h-4" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Модалка с глобальным поиском города (все страны) */}
      {isCityModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-2xl mx-4">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div className="text-sm font-medium text-gray-800">Поиск города по всему миру</div>
              <button className="text-sm text-gray-500 hover:text-gray-700" onClick={() => setIsCityModalOpen(false)}>Закрыть</button>
            </div>
            <div className="p-4">
              <CityTimezonePicker onSelect={handleTimezoneFromPicker} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientTimezoneSelector;

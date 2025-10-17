import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import api from '../api';
import { FiMapPin, FiSave, FiLoader } from 'react-icons/fi';
import { TOP_CITIES, OTHER_CITIES, getTimezoneLabel, detectClosestRussianCity } from '../utils/russianCities';
import { useI18n } from '../locale/i18n';

const TimezoneSettingsTab = () => {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [practitioner, setPractitioner] = useState(null);
  const [selectedCity, setSelectedCity] = useState(null);
  const [detectedCity, setDetectedCity] = useState(null);

  useEffect(() => {
    const fetchPractitioner = async () => {
      try {
        setLoading(true);
        const { data } = await api.get('/admin/practitioner/profile');
        setPractitioner(data);
        
        // Найти текущий город по timezone
        const currentCity = [...TOP_CITIES, ...OTHER_CITIES].find(
          city => city.timezone === data.timezone
        );
        setSelectedCity(currentCity || TOP_CITIES[0]);
        
        // Автоопределение для подсказки
        const detected = detectClosestRussianCity();
        setDetectedCity(detected);
      } catch (e) {
        toast.error(t('profile.errors.load'));
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchPractitioner();
  }, []);

  const handleSave = async () => {
    if (!selectedCity) {
      toast.error(t('cityPicker.title'));
      return;
    }

    setSaving(true);
    try {
      await api.put('/admin/practitioner/profile', {
        timezone: selectedCity.timezone
      });
      
      setPractitioner(prev => ({ ...prev, timezone: selectedCity.timezone }));
      toast.success(t('profile.saved'));
      
      // Обновляем localStorage если нужно
      localStorage.setItem('practitionerTimezone', selectedCity.timezone);
      
      // Перезагружаем страницу для применения изменений
      setTimeout(() => window.location.reload(), 1000);
    } catch (e) {
      toast.error(e.response?.data?.msg || t('errors.generic'));
    } finally {
      setSaving(false);
    }
  };

  const handleCityChange = (city) => {
    setSelectedCity(city);
  };

  if (loading) {
    return (
      <div className="text-center py-16">
        <FiLoader className="mx-auto h-12 w-12 text-brand-accent animate-spin" />
        <h4 className="mt-4 text-lg font-medium text-brand-text">{t('schedule.loading')}</h4>
      </div>
    );
  }

  return (
    <div className="bg-white p-8 rounded-xl shadow-lg space-y-8">
      <div>
        <h3 className="text-xl font-semibold text-brand-text flex items-center">
          <FiMapPin className="mr-3 text-brand-accent"/>
          {t('timezoneSelector.label')}
        </h3>
        <p className="text-sm text-gray-600 mt-2">
          {t('timezoneSelector.hint')}
        </p>
      </div>

      {detectedCity && detectedCity.timezone !== selectedCity?.timezone && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <FiMapPin className="text-blue-600 mt-0.5 mr-2 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-medium text-blue-800">{t('timezoneSelector.autoDetectTitle')}</h4>
              <p className="text-sm text-blue-700 mt-1">
                {t('timezoneSelector.autoDetected', { name: detectedCity.name })}
                <button
                  onClick={() => handleCityChange(detectedCity)}
                  className="ml-2 text-blue-600 hover:text-blue-800 underline"
                >
                  {t('timezoneSelector.use')}
                </button>
              </p>
            </div>
          </div>
        </div>
      )}

      <div>
        <h4 className="text-lg font-medium text-brand-text mb-4">{t('clientTz.topCities')}</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {TOP_CITIES.map((city) => (
            <button
              key={city.timezone}
              onClick={() => handleCityChange(city)}
              className={`text-left p-3 rounded-lg border-2 transition-colors ${
                selectedCity?.timezone === city.timezone
                  ? 'border-brand-accent bg-brand-accent/5 text-brand-accent'
                  : 'border-gray-200 hover:border-gray-300 text-gray-700'
              }`}
            >
              <div className="font-medium">{city.name}</div>
              <div className="text-sm text-gray-500">UTC{city.utcOffset}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <h4 className="text-lg font-medium text-brand-text mb-4">{t('clientTz.otherCities')}</h4>
        <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
          {OTHER_CITIES.map((city) => (
            <button
              key={city.timezone}
              onClick={() => handleCityChange(city)}
              className={`w-full text-left p-3 border-b border-gray-100 last:border-b-0 transition-colors ${
                selectedCity?.timezone === city.timezone
                  ? 'bg-brand-accent/5 text-brand-accent'
                  : 'hover:bg-gray-50 text-gray-700'
              }`}
            >
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-medium">{city.name}</div>
                  <div className="text-sm text-gray-500">{city.region}</div>
                </div>
                <div className="text-sm text-gray-500">UTC{city.utcOffset}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {selectedCity && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="font-medium text-gray-800">{t('profile.chosenTimezone')}</h4>
          <div className="mt-2">
            <div className="text-lg font-semibold text-brand-accent">{selectedCity.name}</div>
            <div className="text-sm text-gray-600">{selectedCity.region}</div>
            <div className="text-sm text-gray-600">UTC{selectedCity.utcOffset} ({selectedCity.timezone})</div>
            <div className="text-sm text-gray-600 mt-1">
              {t('profile.currentTime')} <span className="font-mono">{
                new Date().toLocaleTimeString('ru-RU', { 
                  timeZone: selectedCity.timezone,
                  hour12: false 
                })
              }</span>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end pt-4 border-t border-gray-200">
        <button
          onClick={handleSave}
          disabled={saving || !selectedCity}
          className="inline-flex items-center px-6 py-3 border border-transparent text-sm font-semibold rounded-lg shadow-sm text-white bg-brand-accent hover:bg-brand-accent/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-accent disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {saving ? <FiLoader className="animate-spin -ml-1 mr-3 h-5 w-5" /> : <FiSave className="-ml-1 mr-3 h-5 w-5"/>}
          {saving ? t('schedule.saving') : t('schedule.save')}
        </button>
      </div>
    </div>
  );
};

export default TimezoneSettingsTab;

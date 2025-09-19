import React, { useEffect, useState } from 'react';
import { FiSearch } from 'react-icons/fi';

// Top 5 popular cities in Russia
const TOP_POPULAR_CITIES = [
  { name: 'Москва', country: 'Россия', timezone: 'Europe/Moscow' },
  { name: 'Санкт-Петербург', country: 'Россия', timezone: 'Europe/Moscow' },
  { name: 'Новосибирск', country: 'Россия', timezone: 'Asia/Novosibirsk' },
  { name: 'Екатеринбург', country: 'Россия', timezone: 'Asia/Yekaterinburg' },
  { name: 'Казань', country: 'Россия', timezone: 'Europe/Moscow' },
];

function formatOffset(timezone) {
  try {
    const parts = new Intl.DateTimeFormat('ru-RU', { timeZone: timezone, timeZoneName: 'short' }).formatToParts(new Date());
    const name = parts.find(p => p.type === 'timeZoneName')?.value || '';
    // Convert like GMT+3 to UTC+3
    return name.replace('GMT', 'UTC');
  } catch (_) {
    return '';
  }
}

export default function CityTimezonePicker({ onSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const minQueryLen = 2;

  // Debounced search to Open-Meteo Geocoding API (no API key required)
  useEffect(() => {
    let cancelled = false;
    if (!query || query.trim().length < minQueryLen) { setResults([]); return; }
    const t = setTimeout(async () => {
      try {
        setLoading(true);
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query.trim())}&count=20&language=ru&format=json`;
        const res = await fetch(url);
        const data = await res.json();
        if (cancelled) return;
        const items = (data?.results || []).map(r => ({
          name: r.name,
          admin1: r.admin1 || '',
          country: r.country || '',
          timezone: r.timezone || '',
        })).filter(x => !!x.timezone);
        setResults(items);
      } catch (_) {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query]);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow border border-gray-200/60">
        <div className="p-4 border-b border-gray-100">
          <div className="text-sm font-medium text-gray-800">Выберите город</div>
          <p className="text-xs text-gray-500 mt-1">Сначала найдите ваш город через поиск, либо выберите один из популярных городов России</p>
        </div>
        <div className="p-4">
          {/* Поиск — сверху, с мягким акцентом и автофокусом */}
          <div>
            <label className="text-xs font-medium text-gray-700 mb-1 block">Поиск города</label>
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Начните вводить город (например, Казань)"
                className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-gray-300/70 shadow-sm ring-1 ring-brand-accent/10 focus:ring-2 focus:ring-brand-accent/30 focus:border-brand-accent/60 text-sm"
              />
            </div>
            <div className="mt-2 max-h-72 overflow-auto rounded-lg border border-gray-200/70">
              {loading ? (
                <div className="p-3 text-sm text-gray-500">Ищем…</div>
              ) : (query.trim().length < minQueryLen) ? (
                <div className="p-3 text-sm text-gray-500">Начните вводить название города (минимум {minQueryLen} символа)</div>
              ) : results.length === 0 ? (
                <div className="p-3 text-sm text-gray-500">Ничего не найдено</div>
              ) : (
                <ul>
                  {results.map((r, i) => (
                    <li key={`${r.timezone}-${r.name}-${i}`}>
                      <button
                        type="button"
                        onClick={() => onSelect?.(r.timezone, { name: r.name, country: r.country, admin1: r.admin1 })}
                        className="w-full text-left p-3 hover:bg-gray-50 flex items-center justify-between"
                      >
                        <div>
                          <div className="font-medium text-sm">{r.name}</div>
                          <div className="text-xs text-gray-500">{[r.admin1, r.country].filter(Boolean).join(', ')}</div>
                        </div>
                        <div className="text-xs text-gray-600">{formatOffset(r.timezone)}</div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Популярные в России — ниже */}
          <div className="mt-5">
            <div className="text-xs font-medium text-gray-700 mb-2">Популярные города (Россия)</div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {TOP_POPULAR_CITIES.map((c, idx) => (
                <button
                  key={`${c.timezone}-${idx}`}
                  type="button"
                  onClick={() => onSelect?.(c.timezone, { name: c.name, country: c.country })}
                  className="w-full text-left p-3 rounded-lg border bg-white hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-gray-500">{c.country}</div>
                    </div>
                    <div className="text-xs text-gray-600">{formatOffset(c.timezone)}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

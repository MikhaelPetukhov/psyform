import { useEffect, useState } from 'react';

export const useNowInTimezone = (timezone) => {
  const [nowStr, setNowStr] = useState('');
  const [zoneLabel, setZoneLabel] = useState(timezone);

  useEffect(() => {
    const update = () => {
      try {
        const formatted = new Intl.DateTimeFormat('ru-RU', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          timeZone: timezone,
        }).format(new Date());
        setNowStr(formatted);
      } catch (error) {
        setNowStr(
          new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())
        );
      }

      try {
        const parts = new Intl.DateTimeFormat('ru-RU', {
          timeZone: timezone,
          timeZoneName: 'short',
        }).formatToParts(new Date());
        const name = parts.find((part) => part.type === 'timeZoneName')?.value || timezone;
        setZoneLabel(name);
      } catch (error) {
        setZoneLabel(timezone);
      }
    };

    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [timezone]);

  return { nowStr, zoneLabel };
};

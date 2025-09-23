// Российские города с часовыми поясами
// Топ 15 крупнейших городов + остальные по алфавиту

export const RUSSIAN_CITIES = [
  // Топ 15 крупнейших городов России
  { name: 'Москва', timezone: 'Europe/Moscow', region: 'Московская область', utcOffset: '+3' },
  { name: 'Санкт-Петербург', timezone: 'Europe/Moscow', region: 'Ленинградская область', utcOffset: '+3' },
  { name: 'Новосибирск', timezone: 'Asia/Novosibirsk', region: 'Новосибирская область', utcOffset: '+7' },
  { name: 'Екатеринбург', timezone: 'Asia/Yekaterinburg', region: 'Свердловская область', utcOffset: '+5' },
  { name: 'Казань', timezone: 'Europe/Moscow', region: 'Республика Татарстан', utcOffset: '+3' },
  { name: 'Нижний Новгород', timezone: 'Europe/Moscow', region: 'Нижегородская область', utcOffset: '+3' },
  { name: 'Челябинск', timezone: 'Asia/Yekaterinburg', region: 'Челябинская область', utcOffset: '+5' },
  { name: 'Самара', timezone: 'Europe/Samara', region: 'Самарская область', utcOffset: '+4' },
  { name: 'Омск', timezone: 'Asia/Omsk', region: 'Омская область', utcOffset: '+6' },
  { name: 'Ростов-на-Дону', timezone: 'Europe/Moscow', region: 'Ростовская область', utcOffset: '+3' },
  { name: 'Уфа', timezone: 'Asia/Yekaterinburg', region: 'Республика Башкортостан', utcOffset: '+5' },
  { name: 'Красноярск', timezone: 'Asia/Krasnoyarsk', region: 'Красноярский край', utcOffset: '+7' },
  { name: 'Воронеж', timezone: 'Europe/Moscow', region: 'Воронежская область', utcOffset: '+3' },
  { name: 'Пермь', timezone: 'Asia/Yekaterinburg', region: 'Пермский край', utcOffset: '+5' },
  { name: 'Волгоград', timezone: 'Europe/Volgograd', region: 'Волгоградская область', utcOffset: '+3' },

  // Остальные города по алфавиту
  { name: 'Абакан', timezone: 'Asia/Krasnoyarsk', region: 'Республика Хакасия', utcOffset: '+7' },
  { name: 'Анадырь', timezone: 'Asia/Anadyr', region: 'Чукотский автономный округ', utcOffset: '+12' },
  { name: 'Архангельск', timezone: 'Europe/Moscow', region: 'Архангельская область', utcOffset: '+3' },
  { name: 'Астрахань', timezone: 'Europe/Astrakhan', region: 'Астраханская область', utcOffset: '+4' },
  { name: 'Барнаул', timezone: 'Asia/Barnaul', region: 'Алтайский край', utcOffset: '+7' },
  { name: 'Белгород', timezone: 'Europe/Moscow', region: 'Белгородская область', utcOffset: '+3' },
  { name: 'Биробиджан', timezone: 'Asia/Vladivostok', region: 'Еврейская автономная область', utcOffset: '+10' },
  { name: 'Благовещенск', timezone: 'Asia/Yakutsk', region: 'Амурская область', utcOffset: '+9' },
  { name: 'Брянск', timezone: 'Europe/Moscow', region: 'Брянская область', utcOffset: '+3' },
  { name: 'Великий Новгород', timezone: 'Europe/Moscow', region: 'Новгородская область', utcOffset: '+3' },
  { name: 'Владивосток', timezone: 'Asia/Vladivostok', region: 'Приморский край', utcOffset: '+10' },
  { name: 'Владикавказ', timezone: 'Europe/Moscow', region: 'Республика Северная Осетия', utcOffset: '+3' },
  { name: 'Владимир', timezone: 'Europe/Moscow', region: 'Владимирская область', utcOffset: '+3' },
  { name: 'Волжский', timezone: 'Europe/Volgograd', region: 'Волгоградская область', utcOffset: '+3' },
  { name: 'Вологда', timezone: 'Europe/Moscow', region: 'Вологодская область', utcOffset: '+3' },
  { name: 'Горно-Алтайск', timezone: 'Asia/Barnaul', region: 'Республика Алтай', utcOffset: '+7' },
  { name: 'Грозный', timezone: 'Europe/Moscow', region: 'Чеченская Республика', utcOffset: '+3' },
  { name: 'Дудинка', timezone: 'Asia/Krasnoyarsk', region: 'Красноярский край', utcOffset: '+7' },
  { name: 'Иваново', timezone: 'Europe/Moscow', region: 'Ивановская область', utcOffset: '+3' },
  { name: 'Ижевск', timezone: 'Europe/Samara', region: 'Удмуртская Республика', utcOffset: '+4' },
  { name: 'Иркутск', timezone: 'Asia/Irkutsk', region: 'Иркутская область', utcOffset: '+8' },
  { name: 'Йошкар-Ола', timezone: 'Europe/Moscow', region: 'Республика Марий Эл', utcOffset: '+3' },
  { name: 'Калининград', timezone: 'Europe/Kaliningrad', region: 'Калининградская область', utcOffset: '+2' },
  { name: 'Калуга', timezone: 'Europe/Moscow', region: 'Калужская область', utcOffset: '+3' },
  { name: 'Кемерово', timezone: 'Asia/Novokuznetsk', region: 'Кемеровская область', utcOffset: '+7' },
  { name: 'Киров', timezone: 'Europe/Kirov', region: 'Кировская область', utcOffset: '+3' },
  { name: 'Кострома', timezone: 'Europe/Moscow', region: 'Костромская область', utcOffset: '+3' },
  { name: 'Краснодар', timezone: 'Europe/Moscow', region: 'Краснодарский край', utcOffset: '+3' },
  { name: 'Курган', timezone: 'Asia/Yekaterinburg', region: 'Курганская область', utcOffset: '+5' },
  { name: 'Курск', timezone: 'Europe/Moscow', region: 'Курская область', utcOffset: '+3' },
  { name: 'Кызыл', timezone: 'Asia/Krasnoyarsk', region: 'Республика Тыва', utcOffset: '+7' },
  { name: 'Липецк', timezone: 'Europe/Moscow', region: 'Липецкая область', utcOffset: '+3' },
  { name: 'Магадан', timezone: 'Asia/Magadan', region: 'Магаданская область', utcOffset: '+11' },
  { name: 'Махачкала', timezone: 'Europe/Moscow', region: 'Республика Дагестан', utcOffset: '+3' },
  { name: 'Мурманск', timezone: 'Europe/Moscow', region: 'Мурманская область', utcOffset: '+3' },
  { name: 'Нальчик', timezone: 'Europe/Moscow', region: 'Кабардино-Балкарская Республика', utcOffset: '+3' },
  { name: 'Нарьян-Мар', timezone: 'Europe/Moscow', region: 'Ненецкий автономный округ', utcOffset: '+3' },
  { name: 'Новокузнецк', timezone: 'Asia/Novokuznetsk', region: 'Кемеровская область', utcOffset: '+7' },
  { name: 'Орёл', timezone: 'Europe/Moscow', region: 'Орловская область', utcOffset: '+3' },
  { name: 'Оренбург', timezone: 'Asia/Yekaterinburg', region: 'Оренбургская область', utcOffset: '+5' },
  { name: 'Пенза', timezone: 'Europe/Moscow', region: 'Пензенская область', utcOffset: '+3' },
  { name: 'Петрозаводск', timezone: 'Europe/Moscow', region: 'Республика Карелия', utcOffset: '+3' },
  { name: 'Петропавловск-Камчатский', timezone: 'Asia/Kamchatka', region: 'Камчатский край', utcOffset: '+12' },
  { name: 'Псков', timezone: 'Europe/Moscow', region: 'Псковская область', utcOffset: '+3' },
  { name: 'Рязань', timezone: 'Europe/Moscow', region: 'Рязанская область', utcOffset: '+3' },
  { name: 'Салехард', timezone: 'Asia/Yekaterinburg', region: 'Ямало-Ненецкий автономный округ', utcOffset: '+5' },
  { name: 'Саранск', timezone: 'Europe/Moscow', region: 'Республика Мордовия', utcOffset: '+3' },
  { name: 'Саратов', timezone: 'Europe/Saratov', region: 'Саратовская область', utcOffset: '+4' },
  { name: 'Смоленск', timezone: 'Europe/Moscow', region: 'Смоленская область', utcOffset: '+3' },
  { name: 'Сочи', timezone: 'Europe/Moscow', region: 'Краснодарский край', utcOffset: '+3' },
  { name: 'Ставрополь', timezone: 'Europe/Moscow', region: 'Ставропольский край', utcOffset: '+3' },
  { name: 'Сыктывкар', timezone: 'Europe/Moscow', region: 'Республика Коми', utcOffset: '+3' },
  { name: 'Тамбов', timezone: 'Europe/Moscow', region: 'Тамбовская область', utcOffset: '+3' },
  { name: 'Тверь', timezone: 'Europe/Moscow', region: 'Тверская область', utcOffset: '+3' },
  { name: 'Томск', timezone: 'Asia/Tomsk', region: 'Томская область', utcOffset: '+7' },
  { name: 'Тула', timezone: 'Europe/Moscow', region: 'Тульская область', utcOffset: '+3' },
  { name: 'Тюмень', timezone: 'Asia/Yekaterinburg', region: 'Тюменская область', utcOffset: '+5' },
  { name: 'Улан-Удэ', timezone: 'Asia/Irkutsk', region: 'Республика Бурятия', utcOffset: '+8' },
  { name: 'Ульяновск', timezone: 'Europe/Ulyanovsk', region: 'Ульяновская область', utcOffset: '+4' },
  { name: 'Ханты-Мансийск', timezone: 'Asia/Yekaterinburg', region: 'Ханты-Мансийский автономный округ', utcOffset: '+5' },
  { name: 'Чебоксары', timezone: 'Europe/Moscow', region: 'Чувашская Республика', utcOffset: '+3' },
  { name: 'Череповец', timezone: 'Europe/Moscow', region: 'Вологодская область', utcOffset: '+3' },
  { name: 'Чита', timezone: 'Asia/Chita', region: 'Забайкальский край', utcOffset: '+9' },
  { name: 'Элиста', timezone: 'Europe/Moscow', region: 'Республика Калмыкия', utcOffset: '+3' },
  { name: 'Южно-Сахалинск', timezone: 'Asia/Sakhalin', region: 'Сахалинская область', utcOffset: '+11' },
  { name: 'Якутск', timezone: 'Asia/Yakutsk', region: 'Республика Саха (Якутия)', utcOffset: '+9' },
  { name: 'Ярославль', timezone: 'Europe/Moscow', region: 'Ярославская область', utcOffset: '+3' }
];

// Группировка городов: топ 15 + остальные
export const TOP_CITIES = RUSSIAN_CITIES.slice(0, 15);
export const OTHER_CITIES = RUSSIAN_CITIES.slice(15).sort((a, b) => a.name.localeCompare(b.name, 'ru'));

// Получить город по timezone
export const getCityByTimezone = (timezone) => {
  return RUSSIAN_CITIES.find(city => city.timezone === timezone);
};

const MINUS_SIGN = '\u2212';

const parseOffsetFromTimeZoneName = (value) => {
  if (!value) return null;
  if (/^(GMT|UTC)$/.test(value)) {
    return 0;
  }

  const match = value.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!match) return null;

  const sign = match[1] === '-' ? -1 : 1;
  const hours = parseInt(match[2], 10);
  const minutes = match[3] ? parseInt(match[3], 10) : 0;
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }

  return sign * (hours * 60 + minutes);
};

const resolveOffsetMinutes = (timezone, option) => {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: option
    });
    const parts = formatter.formatToParts(new Date());
    const namePart = parts.find(part => part.type === 'timeZoneName');
    return parseOffsetFromTimeZoneName(namePart?.value);
  } catch (_) {
    return null;
  }
};

const computeOffsetMinutes = (timezone) => {
  if (!timezone) return null;

  const options = ['shortOffset', 'short'];
  for (const option of options) {
    const minutes = resolveOffsetMinutes(timezone, option);
    if (minutes !== null) {
      return minutes;
    }
  }

  try {
    const now = new Date();
    const localeString = now.toLocaleString('en-US', { timeZone: timezone });
    const tzDate = new Date(localeString);
    if (!Number.isNaN(tzDate.getTime())) {
      return Math.round((tzDate.getTime() - now.getTime()) / 60000);
    }
  } catch (_) {
    return null;
  }

  return null;
};

const formatOffsetMinutes = (offsetMinutes) => {
  if (typeof offsetMinutes !== 'number' || Number.isNaN(offsetMinutes)) {
    return '';
  }

  const sign = offsetMinutes < 0 ? MINUS_SIGN : '+';
  const absMinutes = Math.abs(offsetMinutes);
  const hours = String(Math.floor(absMinutes / 60)).padStart(2, '0');
  const minutes = String(absMinutes % 60).padStart(2, '0');

  return `UTC${sign}${hours}:${minutes}`;
};

export const getTimezoneOffsetInfo = (timezone) => {
  const offsetMinutes = computeOffsetMinutes(timezone);
  const formattedOffset = formatOffsetMinutes(offsetMinutes);

  return {
    offsetMinutes,
    formattedOffset
  };
};

const getFallbackName = (timezone, formattedOffset) => {
  if (!timezone) return '';
  return formattedOffset ? `${timezone} (${formattedOffset})` : timezone;
};

export const createTimezoneInfo = (timezone) => {
  if (!timezone) return null;

  const city = getCityByTimezone(timezone);
  const { offsetMinutes, formattedOffset } = getTimezoneOffsetInfo(timezone);

  if (city) {
    return {
      ...city,
      timezone,
      isFallback: false,
      formattedUtcOffset: formattedOffset,
      offsetMinutes
    };
  }

  const normalizedOffset = formattedOffset ? formattedOffset.replace('UTC', '').trim() : null;

  return {
    name: getFallbackName(timezone, formattedOffset),
    timezone,
    region: null,
    utcOffset: normalizedOffset,
    formattedUtcOffset: formattedOffset,
    offsetMinutes,
    isFallback: true,
    originalTimezone: timezone
  };
};

// Получить локализованное имя часового пояса
export const getTimezoneLabel = (timezone) => {
  const info = createTimezoneInfo(timezone);
  if (!info) {
    return timezone || '';
  }

  if (info.isFallback) {
    return info.name;
  }

  const offset = info.utcOffset
    || (info.formattedUtcOffset ? info.formattedUtcOffset.replace('UTC', '').trim() : '');

  return offset ? `${info.name} (UTC${offset})` : info.name;
};

// Автоопределение ближайшего российского города по timezone браузера
export const detectClosestRussianCity = () => {
  try {
    const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const timezone = browserTimezone || 'UTC';

    // Сначала точное совпадение
    const exactMatch = RUSSIAN_CITIES.find(city => city.timezone === timezone);
    if (exactMatch) return createTimezoneInfo(exactMatch.timezone);

    const { offsetMinutes: browserOffsetMinutes } = getTimezoneOffsetInfo(timezone);

    if (typeof browserOffsetMinutes === 'number') {
      const offsetMatches = RUSSIAN_CITIES.filter(city => {
        const { offsetMinutes } = getTimezoneOffsetInfo(city.timezone);
        return typeof offsetMinutes === 'number' && offsetMinutes === browserOffsetMinutes;
      });

      if (offsetMatches.length > 0) {
        const topCityMatch = offsetMatches.find(city => TOP_CITIES.includes(city));
        const chosenCity = topCityMatch || offsetMatches[0];
        return createTimezoneInfo(chosenCity.timezone);
      }
    }

    return createTimezoneInfo(timezone);
  } catch (e) {
    return createTimezoneInfo('UTC');
  }
};

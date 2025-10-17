// -*- coding: utf-8 -*-
// Simple Russian dictionary for UI strings
const ru = {
  admin: {
    header: {
      title: 'Кабинет психолога',
      subtitle: 'Управляйте расписанием и записями клиентов',
      cabinet: 'Кабинет',
      publicForm: 'Форма записи',
      logout: 'Выйти'
    },
    tabs: {
      calendar: 'Календарь',
      bookings: 'Записи клиентов',
      schedule: 'Настройки расписания',
      profile: 'Профиль'
    },
    profileBanner: {
      title: 'Профиль не заполнен',
      text: 'Заполните профиль, чтобы корректно отображать публичную страницу и сообщения клиентам.',
      cta: 'Перейти к профилю'
    }
  },
  bookings: {
    title: 'Записи клиентов',
    loading: 'Загрузка записей...',
    noneTitle: 'Записей пока нет',
    noneText: 'Когда клиенты начнут бронировать время, их записи появятся здесь.',
    errorTitle: 'Произошла ошибка',
    errors: {
      load: 'Ошибка загрузки записей'
    },
    columns: {
      client: 'Клиент',
      datetime: 'Дата и время',
      phone: 'Телефон',
      telegram: 'Telegram',
      status: 'Статус'
    },
    statusClientDeclined: 'Отменена клиентом',
    filters: {
      status: 'Статус',
      all: 'Все',
      confirmed: 'Подтверждена',
      pending: 'Ожидает подтверждения',
      cancelled: 'Отменена',
      completed: 'Завершена',
      search: 'Поиск по имени',
      dateFrom: 'От даты',
      dateTo: 'До даты',
      apply: 'Применить',
      reset: 'Сбросить',
      placeholderName: 'Например: Анна'
    },
    actions: {
      delete: 'Удалить запись',
      reschedule: 'Перезаписать клиента',
      confirm: 'Отправить запрос на подтверждение',
      copyContacts: 'Скопировать контакты',
      openTelegram: 'Открыть чат в Telegram'
    },
    today: 'Сегодня',
    upcoming: 'Ближайшие',
    upcoming7: 'Ближайшие 7 дней',
    loadMore: 'Показать ещё',
    show: 'Показать',
    confirmDelete: 'Действительно удалить запись для клиента "{name}"?',
    toasts: {
      confirmSent: 'Запрос на подтверждение отправлен клиенту',
      confirmFail400: 'Не удалось отправить: клиент не найден или не связан с Telegram',
      deleting: 'Удаляем запись...',
      deleted: 'Запись удалена',
      deleteFailed: 'Не удалось удалить запись',
      copyOk: 'Контакты скопированы',
      copyFail: 'Не удалось скопировать',
      loadMoreFail: 'Не удалось загрузить ещё'
    }
  },
  schedule: {
    loading: 'Загрузка настроек...',
    save: 'Сохранить изменения',
    saving: 'Сохранение...',
    saved: 'Настройки успешно сохранены!',
    errorLoad: 'Не удалось загрузить настройки. Попробуйте обновить страницу.',
    tzCurrent: 'Текущий часовой пояс:',
    tzHint: 'Часовой пояс используется для генерации и отображения слотов',
    savingSettings: 'Сохранение настроек...',
    headings: {
      workingDays: 'Рабочие дни',
      workingHours: 'Рабочие часы',
      sessionsAndBreaks: 'Сессии и перерывы',
      lunchBreak: 'Обеденный перерыв',
      generationPeriod: 'Период генерации',
      autoGeneration: 'Автоматическая генерация',
      quickGen: 'Быстрая генерация'
    },
    labels: {
      startOfDay: 'Начало дня',
      endOfDay: 'Конец дня',
      sessionDuration: 'Длительность сессии (мин)',
      breakBetweenSessions: 'Перерыв между сессиями (мин)',
      lunchEnabled: 'Включить обеденный перерыв',
      lunchStart: 'Начало обеда',
      lunchEnd: 'Конец обеда',
      periodDays: 'Создать слоты на (дней вперёд)',
      autoGenerateEnabled: 'Включить автогенерацию слотов'
    },
    quickGenText: 'Нажмите кнопку ниже, чтобы сразу создать слоты на основе сохранённых настроек.',
    generateNow: 'Сгенерировать слоты',
    generating: 'Генерация...',
    generatingStart: 'Начинаем генерацию слотов...',
    dowShort: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
  },
  profile: {
    title: 'Настройки профиля',
    previewPublic: 'Предпросмотр публичной страницы',
    tzBanner: 'Для начала работы укажите ваш город и часовой пояс. Это необходимо для корректного отображения времени.',
    fields: {
      displayName: 'ФИО / Отображаемое имя',
      specialization: 'Специализация',
      price: 'Цена приёма',
      timezone: 'Ваш часовой пояс',
      about: 'О себе',
      template: 'Шаблон сообщения клиенту'
    },
    chosenTimezone: 'Выбранный часовой пояс',
    change: 'Изменить',
    currentTime: 'Текущее время:',
    defaultPractitionerName: 'Ваш психолог',
    templateHint: 'Поддерживаются переменные: {{clientName}}, {{practitionerName}}, {{date}}, {{time}}.',
    loading: 'Загрузка профиля...',
    save: 'Сохранить',
    saving: 'Сохранение...',
    saved: 'Профиль сохранён',
    saveError: 'Ошибка сохранения',
    templateExampleTitle: 'Пример сообщения:',
    templateDefault: 'Здравствуйте, {{clientName}}! Вы записаны на {{date}}. Ссылка придёт перед началом сеанса.',
    placeholders: {
      displayName: 'Иван Иванов',
      specialization: 'Психотерапевт',
      price: '5000 руб.',
      about: 'Краткая информация о вас',
      template: 'Здравствуйте, {{clientName}}! Вы записаны на {{date}}.',
      clientName: 'Иван'
    },
    modal: {
      close: 'Закрыть',
      noPublicLink: 'Публичная ссылка ещё не настроена.'
    },
    errors: {
      load: 'Не удалось загрузить профиль',
      timezoneRequired: 'Для начала работы укажите город и часовой пояс'
    }
  },
  validatedBooking: {
    loading: 'Загружаем данные психолога...',
    notFoundTitle: 'Психолог не найден',
    notFoundText: 'Проверьте корректность ссылки или вернитесь на главную страницу.',
    home: 'На главную',
    errorTitle: 'Ошибка загрузки',
    retry: 'Повторить'
  },
  cityPicker: {
    title: 'Выберите город',
    subtitle: 'Сначала найдите ваш город через поиск, либо выберите один из популярных городов России',
    searchLabel: 'Поиск города',
    searchPlaceholder: 'Начните вводить город (например, Казань)',
    searching: 'Ищем...',
    minHint: 'Начните вводить название города (минимум {n} символа)',
    notFound: 'Ничего не найдено',
    popularTitle: 'Популярные города (Россия)'
  },
  bookingForm: {
    loadingSlots: 'Загружаем расписание...',
    errors: {
      loadSlots: 'Не удалось загрузить доступное время. Пожалуйста, попробуйте обновить страницу.',
      verifyPhoneFirst: 'Сначала подтвердите телефон через Telegram (рекомендуется) или WhatsApp',
      selectTime: 'Пожалуйста, выберите время консультации.',
      nameRequired: 'Имя обязательно для заполнения',
      noPublicSlug: 'Не удалось определить форму психолога. Откройте страницу бронирования по адресу /p/<slug>.',
      invalidRuPhone: 'Введите корректный российский номер',
      waNotConfigured: 'Канал WhatsApp пока не настроен (не указан номер бизнеса)',
      waNotFound: 'Номер не найден в WhatsApp',
      waCheckFailed: 'Не удалось выполнить проверку WhatsApp'
    },
    section: {
      choose: '1. Выберите удобную дату и время'
    },
    timeNotice: {
      title: 'Время указано для',
      change: 'Изменить'
    },
    autoPick: {
      title: 'Мы подобрали ближайший свободный сеанс автоматически',
      hint: 'Если время не подходит - выберите другой вариант в расписании.'
    },
    availableForDate: 'Доступное время на {date}:',
    noSlots: {
      title: 'Нет свободных слотов.',
      hint: 'Выберите другой день.'
    },
    nextAvailable: {
      title: 'Следующий доступный сеанс:',
      hint: 'Мы автоматически подставим ближайший сеанс - подтвердите или выберите другое время.'
    },
    noSessionsSoon: {
      title: 'Свободные сеансы скоро появятся',
      hint: 'Сейчас нет доступных записей - загляните позже.'
    },
    right: {
      title: 'Ваши данные',
      hint: '2. Сначала подтвердите телефон в Telegram, затем заполните форму'
    },
    fields: {
      phone: 'Телефон',
      name: 'Имя',
      comment: 'Комментарий'
    },
    phone: {
      lockedNote: 'Номер подтверждён через Telegram'
    },
    placeholders: {
      phone: '+7 977 288-14-99',
      name: 'Анастасия',
      comment: 'Ваш запрос или пожелания к консультации...'
    },
    submit: {
      processing: 'Создаём запись...',
      cta: 'Записаться на консультацию'
    },
    youAreBooking: 'Вы записываетесь на {date}',
    telegramUsername: {
      label: 'Telegram username',
      invalid: 'Укажите корректный Telegram username',
      invalidBasic: 'Некорректный Telegram username',
      checkFailed: 'Не удалось проверить username, попробуйте позже',
      userFound: 'Пользователь найден',
      userNotFound: 'Пользователь не найден'
    },
    telegramPreferred: 'Telegram будет предпочтительным способом связи',
    verify: {
      title: 'Подтвердите владение номером',
      tgCta: 'Подтвердить через Telegram',
      waCta: 'Подтвердить через WhatsApp',
      waChecking: 'Проверяем WhatsApp...',
      recommendTg: 'Рекомендуем Telegram - быстрый вход одной кнопкой через бота {bot}',
      enterValidPhone: 'Для WhatsApp сначала введите корректный номер выше'
    },
    whatsappMessage: 'Здравствуйте! Хочу подтвердить номер для записи на консультацию.',
    whatsappManual: 'Проверка WhatsApp недоступна, откроем чат для ручного подтверждения',
    toast: {
      create: {
        loading: 'Создаём вашу запись...',
        success: 'Вы успешно записаны! Подтверждение отправлено в Telegram (если вы вошли). Ссылка на видеосессию придёт ближе к началу.',
        phoneRequired401: 'Требуется подтверждение телефона: выберите Telegram или WhatsApp ниже',
        phoneRequired403: 'Для бронирования подтвердите номер через Telegram или WhatsApp. В Telegram нажмите "Поделиться номером", затем "Войти".',
        error: 'Не удалось создать запись. Возможно, это время уже занято. Пожалуйста, обновите страницу и попробуйте снова.'
      }
    }
  },
  calendarHeader: {
    title: 'Панель психолога',
    changeTimezoneTitle: 'Сменить часовой пояс',
    nowLabel: 'Сейчас',
    myZoneLabel: 'Моя зона'
  },
  calendarSidebar: {
    createSlot: 'Создать слот',
    manualBooking: 'Назначить сессию',
    noEventsToday: 'Нет записей на этот день',
    freeSlots: 'Свободные слоты',
    delete: 'Удалить'
  },
  addBookingModal: {
    title: 'Записать клиента',
    date: 'Дата',
    name: 'Имя',
    phone: 'Телефон',
    telegram: 'Telegram',
    comment: 'Комментарий',
    cancel: 'Отмена',
    submit: 'Записать',
    placeholders: {
      name: 'Имя',
      phone: '+7 977 288-14-99',
      telegram: 'Telegram',
      comment: 'Комментарий (необязательно)'
    },
    errors: {
      createFailed: 'Ошибка при создании записи'
    }
  },
  manualBookingModal: {
    title: 'Назначить сессию',
    date: 'Дата',
    start: 'Начало',
    end: 'Окончание',
    name: 'Имя',
    phone: 'Телефон',
    telegram: 'Telegram',
    comment: 'Комментарий (необязательно)',
    cancel: 'Отмена',
    create: 'Создать',
    saving: 'Сохранение...',
    placeholders: {
      phone: '+7 977 288-14-99',
      name: 'Имя',
      telegram: 'Telegram'
    },
    errors: {
      createFailed: 'Ошибка при создании записи'
    }
  },
  bookingDetailsModal: {
    title: 'Детали записи',
    client: 'Клиент',
    phone: 'Телефон',
    time: 'Время',
    clientTime: 'Время клиента',
    channel: 'Канал',
    buttons: {
      telegramChat: 'Переписка в Telegram',
      reschedule: 'Перенести',
      cancel: 'Отменить',
      copyLink: 'Скопировать ссылку',
      close: 'Закрыть'
    },
    toasts: {
      linkCopied: 'Ссылка на запись скопирована',
      copyFailed: 'Не удалось скопировать ссылку',
      cancelled: 'Запись отменена',
      cancelFailed: 'Не удалось отменить запись'
    },
    confirm: {
      cancel: 'Отменить (удалить) эту запись?'
    }
  },
  calendarTab: {
    settingsTitle: 'Настройки расписания',
    today: 'Сегодня',
    close: 'Закрыть',
    menu: {
      settings: 'Настройки',
      logout: 'Выйти из профиля'
    },
    toasts: {
      timezoneSoon: 'Выбор часового пояса появится скоро',
      slotDeleted: 'Слот удалён',
      slotDeleteFailed: 'Ошибка удаления слота'
    },
    confirm: {
      deleteSlot: 'Удалить этот слот?'
    }
  },
  telegramLogin: {
    overlayVerifying: 'Авторизуем через Telegram...',
    checkingAuth: 'Проверяем авторизацию...',
    youLoggedInAs: 'Вы вошли как',
    logout: 'Выйти',
    title: 'Авторизация через Telegram',
    stepsIntro: 'Для входа на сайт:',
    steps: {
      one: 'Нажмите кнопку "Войти через Telegram" ниже',
      two: 'Поделитесь своим контактом в боте',
      three: 'Нажмите кнопку "Войти на сайт" в боте',
      four: 'Вы автоматически вернётесь на сайт авторизованным'
    },
    loginViaTelegram: 'Войти через Telegram',
    enterCodeHere: 'Уже получили код? Введите его здесь',
    codePlaceholder: 'Введите код из Telegram',
    verifying: 'Проверяем...',
    login: 'Войти',
    cancel: 'Отмена',
    botOpenedText: 'Откроется ваш Telegram с ботом {handle}',
    errors: {
      cannotResolveSlug: 'Не удалось определить форму психолога. Откройте страницу бронирования по адресу /p/<slug>.',
      linkFailed: 'Не удалось получить ссылку на бота',
      serviceUnavailable: 'Сервис Telegram временно недоступен',
      loginFailed: 'Не удалось подтвердить вход'
    },
    toasts: {
      loginOk: 'Авторизация через Telegram выполнена',
      logoutOk: 'Вы вышли из аккаунта клиента'
    }
  },
  adminLanding: {
    title: 'Кабинет специалиста',
    subtitle: 'Вход через Telegram',
    steps: {
      one: 'Нажмите кнопку ниже - откроется ваш Telegram с ботом {handle}.',
      two: 'Поделитесь своим номером телефона.',
      three: 'Нажмите кнопку "Войти в кабинет" в боте - вы вернётесь на сайт уже авторизованным.'
    },
    buttons: {
      start: 'Войти как администратор через Telegram',
      opening: 'Открываем Telegram...'
    },
    errors: {
      linkFailed: 'Не удалось получить ссылку на бота',
      serviceUnavailable: 'Сервис Telegram временно недоступен'
    }
  },
  clientTz: {
    toggleMoscow: 'Показать время по Москве',
    autoTitle: 'Ваше время определено автоматически',
    autoCity: 'Город: <strong>{name}</strong> ({offset})',
    autoFallback: 'Часовой пояс: <strong>{name}</strong>',
    autoCurrentTime: 'Текущее время: {time}',
    chosen: 'Выбрано',
    choose: 'Выбрать',
    topCities: 'Крупные города',
    otherCities: 'Другие города',
    chooseYourCity: 'Выберите ваш город',
    searchWorldwide: 'Поиск города по всему миру',
    close: 'Закрыть',
    findAnother: 'Найти другой город (весь мир)'
  },
  timezoneDisplay: {
    moscowLabel: 'Все времена указаны по московскому времени (UTC+3)'
  },
  timeDisplay: {
    showInMyTz: 'Показать в моём часовом поясе',
    msk: 'МСК'
  },
  timezoneSelector: {
    label: 'Ваш часовой пояс',
    placeholder: 'Выберите часовой пояс',
    hint: 'Выберите город или регион, где вы работаете. Это время будет использоваться для отображения расписания в админке.',
    autoDetectTitle: 'Автоопределение',
    autoDetected: 'Мы определили ваш часовой пояс как {name}.',
    use: 'Использовать'
  },
  rescheduleModal: {
    titleLeft: 'Выберите новую дату',
    titleRight: 'Доступное время',
    pickDateFirst: 'Сначала выберите дату',
    noSlots: 'Нет свободных слотов',
    cancel: 'Отмена',
    submit: 'Перенести',
    toasts: {
      loading: 'Переносим запись...',
      success: 'Запись перенесена',
      error: 'Не удалось перенести запись',
      loadSlotsError: 'Не удалось загрузить слоты'
    },
    errors: {
      selectTime: 'Выберите новое время'
    }
  },
  calendarView: {
    prev: 'Предыдущий период',
    next: 'Следующий период',
    today: 'Сегодня',
    month: 'Месяц',
    week: 'Неделя',
    day: 'День',
    noEntries: 'Нет записей',
    noEntriesToday: 'На этот день записей нет',
    createSlotTitle: 'Создать слот'
  },
  landing: {
    title: 'Стартовая страница'
  },
  authCallback: {
    verifying: 'Подтверждаем вход через Telegram...',
    noToken: 'Не найден токен в ссылке. Попробуйте ещё раз из Telegram.',
    success: 'Вход выполнен',
    fail: 'Не удалось подтвердить вход'
  },
  errors: {
    generic: 'Произошла ошибка',
    tryAgain: 'Попробуйте ещё раз',
    noPermission: 'Нет прав для выполнения действия'
  }
};

ru.calls = {
  buttons: {
    createRoom: 'Создать комнату',
    openHost: 'Открыть комнату (хост)',
    copyGuest: 'Скопировать ссылку гостя',
    sendInvite: 'Отправить приглашение'
  },
  toasts: {
    creating: 'Создаю комнату...',
    created: 'Комната создана',
    createFailed: 'Не удалось создать комнату',
    copyGuestOk: 'Ссылка гостя скопирована',
    copyGuestFail: 'Не удалось скопировать',
    inviting: 'Отправляю приглашение...',
    inviteOk: 'Приглашение отправлено',
    inviteFail: 'Ошибка отправки'
  },
  timer: {
    timeLeft: 'Оставшееся время: {h}:{m}:{s}',
    expired: 'Время истекло'
  },
  invite: {
    open: 'Пригласить',
    close: 'Скрыть приглашение',
    title: 'Пригласить клиента',
    loading: 'Загружаем список клиентов...',
    empty: 'Нет подходящих записей',
    refresh: 'Обновить',
    refreshing: 'Обновляем...',
    send: 'Отправить',
    sentOk: 'Отправлено'
  },
  interface: {
    defaultRemoteDisplayName: 'Пользователь'
  },
  perms: {
    title: 'Доступ к микрофону и камере',
    text: 'Разрешите доступ к микрофону и камере в браузере. Если запрос не появился — обновите страницу и проверьте настройки браузера (Safari/Chrome). На iOS/Android убедитесь, что сайту разрешён доступ в системных настройках.',
    gotIt: 'Понятно'
  }
};

ru.common = {
  notAvailable: '—'
};

export default ru;

export const CLIENT_REASONS = [
  { id: 1, label: 'Создал по ошибке / Тестирую' },
  { id: 2, label: 'Мастер не выходит на связь' },
  { id: 3, label: 'Услуга больше не нужна' },
  { id: 4, label: 'Нашел исполнителя в другом месте' },
  { id: 5, label: 'Другое' },
] as const;

export const MASTER_REASONS = [
  { id: 10, label: 'Клиент неадекватен / не отвечает' },
  { id: 11, label: 'Неверно указан объем работ' },
  { id: 12, label: 'Форс-мажор / Заболел' },
] as const;

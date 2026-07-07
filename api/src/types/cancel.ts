// Source of truth for cancel reason IDs.
// Web mirror: web/src/data/cancel-reasons.ts (hardcoded labels)
// OrderDetail.tsx uses i18n keys instead of these labels.
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

export type CancelBody = {
  cancelled_by: 'client' | 'master';
  cancellation_reason_id: number;
  cancellation_reason_text?: string;
};

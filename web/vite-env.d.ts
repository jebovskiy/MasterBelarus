/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_ADMIN_TELEGRAM_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

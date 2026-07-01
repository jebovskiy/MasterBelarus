import { useTelegramAuth } from '@/hooks/useTelegramAuth';

export function SplashScreen() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-app-bg">
      <div className="w-16 h-16 rounded-bento bg-primary flex items-center justify-center mb-4">
        <span className="text-white text-2xl font-extrabold">М</span>
      </div>
      <p className="text-text-muted text-sm font-medium">МастерБай</p>
      <div className="mt-6 flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-primary animate-bounce"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticating, isAuthed } = useTelegramAuth();

  if (isAuthenticating) return <SplashScreen />;
  if (!isAuthed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-app-bg px-6">
        <div className="w-16 h-16 rounded-bento bg-error/10 flex items-center justify-center mb-4">
          <span className="text-error text-2xl">!</span>
        </div>
        <p className="text-text-main font-semibold text-lg">Ошибка авторизации</p>
        <p className="text-text-muted text-sm mt-2 text-center">
          Откройте приложение внутри Telegram
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

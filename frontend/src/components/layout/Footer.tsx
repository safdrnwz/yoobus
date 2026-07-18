import { useAppearance } from '@/theme/ThemeProvider';
import { Brand } from '@/components/ui/Brand';

export function Footer() {
  const appearance = useAppearance();
  if (!appearance.showFooter) return null;

  return (
    <footer className="mt-auto bg-footer px-gutter py-4 text-footer-fg">
      <div className="mx-auto flex max-w-content flex-wrap items-center justify-between gap-2">
        <p className="text-step--1">{appearance.footerText}</p>
        <Brand size="sm" tone="inherit" className="text-footer-fg opacity-90" />
      </div>
    </footer>
  );
}

import { SettingsForm } from "@/components/SettingsForm";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export default function SettingsPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-sand px-4 py-12 sm:px-6 md:px-8 md:py-20">
        <div className="mx-auto max-w-3xl">
          <p className="font-[family-name:var(--font-display)] text-sm tracking-[0.2em] text-turf">
            SETTINGS
          </p>
          <h1 className="mt-2 text-2xl font-bold text-ink sm:text-3xl md:text-5xl">選別設定</h1>
          <p className="mt-3 text-ink/70">
            オッズ閾値・最低スコア・券種 ON/OFF。ブラウザの localStorage に保存されます。
          </p>
          <div className="mt-10">
            <SettingsForm />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

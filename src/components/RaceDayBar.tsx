"use client";

import { RaceDayPicker } from "@/components/RaceDayPicker";

/** 全ページ共通の開催日バー（ヘッダー直下） */
export function RaceDayBar() {
  return (
    <div className="border-b border-ink/10 bg-sand-dim/80">
      <div className="mx-auto flex max-w-6xl items-center px-6 py-3 md:px-8">
        <RaceDayPicker variant="compact" className="w-full justify-start sm:w-auto" />
      </div>
    </div>
  );
}

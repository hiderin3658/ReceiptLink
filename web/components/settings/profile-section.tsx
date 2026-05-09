"use client";

import { useState, useTransition } from "react";
import { updateProfile, type ProfileActionState } from "@/lib/auth/profile-actions";
import type { UserProfile } from "@/types/database";

interface Props {
  initial: Pick<UserProfile, "display_name" | "birth_year"> | null;
}

export function ProfileSection({ initial }: Props) {
  const [displayName, setDisplayName] = useState(initial?.display_name ?? "");
  const [birthYear, setBirthYear] = useState<string>(
    initial?.birth_year ? String(initial.birth_year) : "",
  );
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<ProfileActionState>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      const result = await updateProfile(null, {
        display_name: displayName,
        birth_year: birthYear || null,
      });
      setFeedback(result);
    });
  }

  return (
    <section className="rounded-lg border border-[var(--color-border)] bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold">プロフィール</h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs text-[var(--color-muted-foreground)]">表示名</span>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={50}
            placeholder="例: 山田"
            className="w-full rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-[var(--color-muted-foreground)]">生年（任意）</span>
          <input
            type="number"
            inputMode="numeric"
            min={1900}
            max={new Date().getFullYear()}
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value)}
            placeholder="例: 1990"
            className="w-40 rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
          />
        </label>
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] disabled:opacity-50"
          >
            {pending ? "保存中..." : "保存"}
          </button>
          {feedback?.ok === true && (
            <span className="text-xs text-[var(--color-muted-foreground)]">✓ 更新しました</span>
          )}
          {feedback?.ok === false && (
            <span className="text-xs text-[var(--color-destructive)]">{feedback.message}</span>
          )}
        </div>
      </form>
    </section>
  );
}

// 最小限の E2E スモークテスト
//
// 目的:
//   - 本番ビルドで主要画面が起動するか
//   - 未認証アクセスが正しく /login へリダイレクトされるか（認証ガードの保証）
//
// 実 DB やログインフローは含まない。OAuth は対話式で CI 化が困難なため、
// ログイン後のシナリオは将来 Supabase JS で session を作ってから検証する想定。

import { test, expect } from "@playwright/test";

test.describe("ReceiptLink smoke", () => {
  test("/login が表示される", async ({ page }) => {
    await page.goto("/login");
    // Google ログインボタンや関連テキストの存在を確認
    await expect(page).toHaveTitle(/ReceiptLink/);
    await expect(page.locator("body")).toBeVisible();
  });

  test("未認証で / にアクセスすると /login へ遷移", async ({ page }) => {
    const response = await page.goto("/");
    // / → /dashboard → (app) layout で未認証なら /login にリダイレクト
    expect(response).not.toBeNull();
    await page.waitForURL((url) => url.pathname.startsWith("/login"), { timeout: 10_000 });
    expect(page.url()).toContain("/login");
  });

  test("未認証で /expense にアクセスしても /login へ遷移", async ({ page }) => {
    await page.goto("/expense");
    await page.waitForURL((url) => url.pathname.startsWith("/login"), { timeout: 10_000 });
    expect(page.url()).toContain("/login");
  });

  test("未認証で /reports にアクセスしても /login へ遷移", async ({ page }) => {
    await page.goto("/reports");
    await page.waitForURL((url) => url.pathname.startsWith("/login"), { timeout: 10_000 });
    expect(page.url()).toContain("/login");
  });
});

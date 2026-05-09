# PWA アイコン

`manifest.webmanifest` で参照されるアイコン placeholder ディレクトリ。

## 必要なファイル

本番デプロイ前に以下のファイルを配置してください：

- `icon-192.png` (192x192)
- `icon-512.png` (512x512)
- `favicon.ico` (任意、`/web/app/favicon.ico` に配置すれば Next.js が自動認識)

## 暫定ファイルの作り方

ロゴ未確定の段階では、単色 PNG を置いておくだけでも PWA は機能します。

例（macOS の場合）:
```sh
# 192x192 と 512x512 の単色 PNG を用意
sips -z 192 192 -p 192 192 -s format png --setProperty pixelHeight 192 \
  --setProperty pixelWidth 192 some-logo.png --out web/public/icons/icon-192.png
```

または ImageMagick:
```sh
magick -size 192x192 xc:'#0ea5e9' web/public/icons/icon-192.png
magick -size 512x512 xc:'#0ea5e9' web/public/icons/icon-512.png
```

## 本番品質のアイコン

最終的には専用ロゴを SVG → PNG エクスポートしたものを配置してください。
背景色は `manifest.webmanifest` の `theme_color` (`#0ea5e9`) と整合させると統一感が出ます。

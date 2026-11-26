# What's New in This Version

The text for App Store Connect's **What's New in This Version** and Google Play's
release notes, for the version being released, so it can be copied as it is once the
release merges. Update it in the release's own PRs.

## Version 1.9.1 (1.9.0 → 1.9.1)

This covers what changed from 1.9.0 to 1.9.1. Before pasting, check that each store's
public version is 1.9.0; if one is older, its text needs that version's changes too.

Both stores get the same text. The Library is called 精選書庫 and 精选书库 in the app's
Chinese, and Biblioteca in its Spanish. The hymn line is the English hymnal's SDAH 262
(#779), which now opens the 1985 hymnal's directory on Hymns for Worship. Each text is
well under Play's 500 characters: en-US 185, Chinese 68, Spanish 234.

### App Store

#### English (U.S.)

• Tablets: the Library's book cards in a row are now the same height.
• A hymn with no score page now opens the hymnal's index instead of a missing page.
• Other fixes and improvements.

#### Chinese (Simplified)

• 平板：精选书库中同一行的书卡现在高度一致。
• 没有乐谱页面的诗歌，现在会打开诗歌本目录，而不是找不到的页面。
• 其他修复与改进。

#### Chinese (Traditional)

• 平板：精選書庫中同一行的書卡現在高度一致。
• 沒有樂譜頁面的詩歌，現在會開啟詩歌本目錄，而不是找不到的頁面。
• 其他修正與改進。

#### Spanish (Mexico), and the same text for Spanish (Spain)

• Tabletas: las tarjetas de libros de la Biblioteca en una misma fila ahora tienen la misma altura.
• Un himno sin página de partitura ahora abre el índice del himnario en vez de una página inexistente.
• Otras correcciones y mejoras.

### Google Play (production), at most 500 characters each

Promoting the internal testing build to production copies the testers' notes, the
release PR's title; replace them with these. Keep Play's language tags: `en-US`;
`zh-TW` and `zh-HK` (Traditional, the same text); `zh-CN` (Simplified); `es-US` and
`es-419` (Spanish, the same text).

```
<en-US>
• Tablets: the Library's book cards in a row are now the same height.
• A hymn with no score page now opens the hymnal's index instead of a missing page.
• Other fixes and improvements.
</en-US>

<zh-TW>
• 平板：精選書庫中同一行的書卡現在高度一致。
• 沒有樂譜頁面的詩歌，現在會開啟詩歌本目錄，而不是找不到的頁面。
• 其他修正與改進。
</zh-TW>

<zh-HK>
• 平板：精選書庫中同一行的書卡現在高度一致。
• 沒有樂譜頁面的詩歌，現在會開啟詩歌本目錄，而不是找不到的頁面。
• 其他修正與改進。
</zh-HK>

<zh-CN>
• 平板：精选书库中同一行的书卡现在高度一致。
• 没有乐谱页面的诗歌，现在会打开诗歌本目录，而不是找不到的页面。
• 其他修复与改进。
</zh-CN>

<es-US>
• Tabletas: las tarjetas de libros de la Biblioteca en una misma fila ahora tienen la misma altura.
• Un himno sin página de partitura ahora abre el índice del himnario en vez de una página inexistente.
• Otras correcciones y mejoras.
</es-US>

<es-419>
• Tabletas: las tarjetas de libros de la Biblioteca en una misma fila ahora tienen la misma altura.
• Un himno sin página de partitura ahora abre el índice del himnario en vez de una página inexistente.
• Otras correcciones y mejoras.
</es-419>
```

# What's New in This Version

The text for App Store Connect's **What's New in This Version** and Google Play's
release notes, for the version being released, so it can be copied as it is once the
release merges. Update it in the release's own PRs.

## Version 1.9.0

This covers what changed from 1.8.0 to 1.9.0. Before pasting, check that each store's
public version is 1.8.0; if one is older, its text needs that version's changes too.

The verse of the day widget is Android only (#235; the iPhone's is #614), so only
Google Play's text has its line.

The Library line is only in English and Spanish: Chinese readers already had those
books.

### App Store

#### English (U.S.)

• Weekly Bulletin: a new Announcements section shows this week's announcement, in your language.
• Saved Verses now open full screen, with each passage in full.
• Tap a verse to see its footnotes first, then the Greek or Hebrew. A psalm's title shows there too.
• Verse links from Home, the Weekly Bulletin and search now go straight to the verse, even when its chapter is already open.
• Bible audio in Mandarin, Cantonese and Spanish now plays and downloads from HelloAO first, with the church's own copy as a backup.
• Library: seven more free books in English, including The Kneeling Christian, and a new Adventist Writers Today shelf.
• Hymns in the Weekly Bulletin link to the right hymn more often, plus other fixes and improvements.

#### Chinese (Simplified)

• 每周周报：新增“报告事项”，以您的语言显示本周的报告。
• “已保存经文”现在以全屏打开，每段经文完整显示。
• 点按经文时，先显示脚注，再显示希腊文或希伯来文；诗篇的标题也会显示在这里。
• 从首页、每周周报或搜索打开经文链接时，会直接跳到该节经文，即使该章已经打开。
• 普通话、粤语和西班牙语的圣经音频现在优先从 HelloAO 播放和下载，教会自己的副本作为备用。
• 每周周报中的诗歌会更准确地链接到对应的诗歌，以及其他修复与改进。

#### Chinese (Traditional)

• 每週週報：新增「報告事項」，以您的語言顯示本週的報告。
• 「已儲存經文」現在以全螢幕開啟，每段經文完整顯示。
• 點按經文時，先顯示腳注，再顯示希臘文或希伯來文；詩篇的標題也會顯示在這裡。
• 從首頁、每週週報或搜尋開啟經文連結時，會直接跳到該節經文，即使該章已經開啟。
• 國語、粵語和西班牙語的聖經音訊現在優先從 HelloAO 播放和下載，教會自己的副本作為備用。
• 每週週報中的詩歌會更準確地連結到對應的詩歌，以及其他修正與改進。

#### Spanish (Mexico), and the same text for Spanish (Spain)

• Boletín Semanal: una nueva sección de Anuncios muestra el anuncio de la semana, en tu idioma.
• Versículos guardados ahora se abre a pantalla completa, con cada pasaje completo.
• Al tocar un versículo, primero ves sus notas al pie y luego el griego o el hebreo. El título de un salmo también aparece ahí.
• Los enlaces a versículos desde Inicio, el Boletín Semanal y la búsqueda ahora van directo al versículo, aunque su capítulo ya esté abierto.
• El audio bíblico en español, mandarín y cantonés ahora se reproduce y se descarga primero desde HelloAO, con la copia de la iglesia como respaldo.
• Biblioteca: seis libros gratuitos en español en el nuevo estante Autores adventistas de hoy, y The Kneeling Christian en inglés.
• Los himnos del Boletín Semanal enlazan con más precisión al himno correcto, además de otras correcciones y mejoras.

### Google Play (production), at most 500 characters each

Promoting the internal testing build to production copies the testers' notes, the
release PR's title; replace them with these. Keep Play's language tags: `en-US`;
`zh-TW` and `zh-HK` (Traditional, the same text); `zh-CN` (Simplified); `es-US` and
`es-419` (Spanish, the same text).

```
<en-US>
• Weekly Bulletin: a new Announcements section, in your language.
• Saved Verses open full screen.
• Tap a verse: its footnotes come first, then the Greek or Hebrew.
• Verse links go straight to the verse.
• The Today’s Verse widget opens its verse every time.
• Mandarin, Cantonese and Spanish Bible audio plays from HelloAO first.
• Library: seven more free books in English and a new Adventist Writers Today shelf.
• Better hymn links in the bulletin, and more.
</en-US>

<zh-TW>
• 每週週報新增「報告事項」，以您的語言顯示。
• 「已儲存經文」改為全螢幕顯示。
• 點按經文：先顯示腳注，再顯示希臘文或希伯來文。
• 經文連結直接跳到該節經文。
• 「今日經文」小工具每次都開啟該節經文。
• 國語、粵語和西班牙語聖經音訊優先從 HelloAO 播放。
• 週報的詩歌連結更準確，以及其他改進。
</zh-TW>

<zh-HK>
• 每週週報新增「報告事項」，以您的語言顯示。
• 「已儲存經文」改為全螢幕顯示。
• 點按經文：先顯示腳注，再顯示希臘文或希伯來文。
• 經文連結直接跳到該節經文。
• 「今日經文」小工具每次都開啟該節經文。
• 國語、粵語和西班牙語聖經音訊優先從 HelloAO 播放。
• 週報的詩歌連結更準確，以及其他改進。
</zh-HK>

<zh-CN>
• 每周周报新增“报告事项”，以您的语言显示。
• “已保存经文”改为全屏显示。
• 点按经文：先显示脚注，再显示希腊文或希伯来文。
• 经文链接直接跳到该节经文。
• “今日经文”小组件每次都打开该节经文。
• 普通话、粤语和西班牙语圣经音频优先从 HelloAO 播放。
• 周报的诗歌链接更准确，以及其他改进。
</zh-CN>

<es-US>
• Boletín Semanal: nueva sección de Anuncios, en tu idioma.
• Versículos guardados, a pantalla completa.
• Al tocar un versículo: primero las notas al pie, luego el griego o el hebreo.
• Los enlaces van directo al versículo.
• El widget Versículo de hoy abre su versículo cada vez.
• Audio bíblico en español, mandarín y cantonés: primero desde HelloAO.
• Biblioteca: seis libros gratuitos en español en el nuevo estante Autores adventistas de hoy.
• Mejores enlaces a himnos, y más.
</es-US>

<es-419>
• Boletín Semanal: nueva sección de Anuncios, en tu idioma.
• Versículos guardados, a pantalla completa.
• Al tocar un versículo: primero las notas al pie, luego el griego o el hebreo.
• Los enlaces van directo al versículo.
• El widget Versículo de hoy abre su versículo cada vez.
• Audio bíblico en español, mandarín y cantonés: primero desde HelloAO.
• Biblioteca: seis libros gratuitos en español en el nuevo estante Autores adventistas de hoy.
• Mejores enlaces a himnos, y más.
</es-419>
```

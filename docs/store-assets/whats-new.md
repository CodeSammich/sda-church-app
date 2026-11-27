# What's New in This Version

The text for App Store Connect's **What's New in This Version** and Google Play's
release notes, for the version being released, so it can be copied as it is once the
release merges. Update it in the release's own PRs.

Each store and language has its own block of plain text, with no Markdown inside, so
GitHub's **Copy** button on a block copies exactly what goes into the store. The notes
stay outside the blocks.

## Since 1.9.0 (1.9.1 and 1.9.2), for 1.10.0's store submission

Not submitted to the stores: 1.9.1 and 1.9.2 went to testers only. Extend this for
1.10.0's store submission.

The App Store and Google Play stay at 1.9.0 until 1.10.0, so this covers what changed
from 1.9.0 to 1.9.2, 1.9.1's changes merged into 1.9.2's list. Before pasting, check
that each store's public version is 1.9.0; if one is older, its text needs that
version's changes too.

The names are the app's own. Offline Bible Audio is 離線聖經音訊 and 离线圣经音频 in
the app's Chinese, and Audio bíblico sin conexión in its Spanish; About Denomination is
關於教派, 关于教派 and Sobre la Denominación; the Library is 精選書庫, 精选书库 and
Biblioteca; the Bible's player is 聖經有聲書 and 圣经有声书; its translation popup is
Reader languages (閱讀語言, 阅读语言, Idiomas de lectura). The hymn with no score page
is the English hymnal's SDAH 262 (#779), which opens the 1985 hymnal's directory on
Hymns for Worship (诗歌本目录, 詩歌本目錄, el índice del himnario).

The two stores' texts differ:
- **The App Store** gets the full list.
- **Google Play's** is shorter, to stay under 500 characters: en-US 484, zh-TW 256,
  zh-CN 256, es-US 458. Its "other fixes" cover the smaller items, and also the
  Android-only fix the App Store leaves out: the Bible stays on its chapter while
  audio retries offline, where it jumped to another book for a few seconds (#811).
  The iPhone plays without a native playlist, so it never had that bug. Play's Spanish
  also leaves out hymn titles in the reader's Chinese script (#810), and names only
  large text among the clearer pages, to fit.
- **Only the Chinese texts** say that the Fellowship page calls the Saturday service
  安息日崇拜 (#854). The other languages never showed 主日崇拜.

### App Store

Paste each block into App Store Connect's **What's New in This Version** for that
language.

#### App Store · English (U.S.)

```text
• Bible: the book list is grouped by Old and New Testament, and by section, such as Law and Gospels.
• Bible audio picks up where you stopped, even after the app is closed.
• With no connection, the audio player says "No connection · not downloaded" for a chapter that isn't on your phone, and links to Offline Bible Audio.
• The audio notification and lock screen show the chapter and narrator in your language.
• With the app in Chinese, hymn titles show in your script, Traditional or Simplified.
• The bulletin opens the right hymn more often, such as for a song title that starts with a number.
• A hymn with no score page now opens the hymnal's index instead of a missing page.
• Tablets: the Library's book cards in a row are now the same height.
• In popups, the round "more below" arrow now scrolls instead of opening the row under it.
• Bible: in Reader languages, tap anywhere on a setting's row to turn it on or off.
• At large text sizes, words stay whole and text stays in view.
• Offline Bible Audio says what isn't downloaded yet, and its delete buttons say Delete.
• About Denomination: the three pillars show their words whole and no longer look like buttons.
• Other fixes and improvements.
```

#### App Store · Chinese (Simplified)

```text
• 圣经：书卷列表现在按旧约、新约及类别（如摩西五经、福音书）分组。
• 圣经有声书会从上次停止的地方继续播放，关闭应用后也一样。
• 没有网络时，播放器会对手机上没有的章节显示“没有网络 · 未下载”，并可前往“离线圣经音频”。
• 有声书的通知和锁屏画面以您的语言显示章节与朗读者。
• 诗歌标题以您选择的简体或繁体显示。
• 周报更能打开正确的诗歌，例如以数字开头的歌名。
• 没有乐谱页面的诗歌，现在会打开诗歌本目录，而不是找不到的页面。
• 平板：精选书库中同一行的书卡现在高度一致。
• 弹出窗口中的圆形向下箭头现在会向下滚动，而不会打开下方的项目。
• 圣经：在“阅读语言”中，点一下设置行的任何地方即可开启或关闭。
• 大字体时，字词不再被拆开，文字也不会被遮住。
• “离线圣经音频”会显示尚未下载的部分，删除按钮也标明“删除”。
• 关于教派：“以圣经为中心”等三项的文字完整显示，也不再像按钮。
• 团契页面上星期六的崇拜现在称为“安息日崇拜”，不再是“主日崇拜”。
• 其他修复与改进。
```

#### App Store · Chinese (Traditional)

```text
• 聖經：書卷清單現在按舊約、新約及類別（如摩西五經、福音書）分組。
• 聖經有聲書會從上次停止的地方繼續播放，關閉應用程式後也一樣。
• 沒有網路時，播放器會對手機上沒有的章節顯示「沒有網路 · 未下載」，並可前往「離線聖經音訊」。
• 有聲書的通知和鎖定畫面以您的語言顯示章節與朗讀者。
• 詩歌標題以您選擇的繁體或簡體顯示。
• 週報更能開啟正確的詩歌，例如以數字開頭的歌名。
• 沒有樂譜頁面的詩歌，現在會開啟詩歌本目錄，而不是找不到的頁面。
• 平板：精選書庫中同一行的書卡現在高度一致。
• 彈出視窗中的圓形向下箭頭現在會向下捲動，而不會開啟下方的項目。
• 聖經：在「閱讀語言」中，點一下設定列的任何地方即可開啟或關閉。
• 大字體時，字詞不再被拆開，文字也不會被遮住。
• 「離線聖經音訊」會顯示尚未下載的部分，刪除按鈕也標明「刪除」。
• 關於教派：「以聖經為中心」等三項的文字完整顯示，也不再像按鈕。
• 團契頁面上星期六的崇拜現在稱為「安息日崇拜」，不再是「主日崇拜」。
• 其他修正與改進。
```

#### App Store · Spanish (Mexico), and the same text for Spanish (Spain)

```text
• Biblia: la lista de libros se agrupa por Antiguo y Nuevo Testamento, y por sección, como Pentateuco y Evangelios.
• El audio de la Biblia sigue donde lo dejaste, aunque cierres la App.
• Sin conexión, el reproductor muestra «Sin conexión · no descargado» en un capítulo que no está en tu teléfono, con un enlace a Audio bíblico sin conexión.
• La notificación de audio y la pantalla bloqueada muestran el capítulo y el narrador en tu idioma.
• Con la App en chino, los títulos de los himnos se muestran en tu escritura, tradicional o simplificada.
• El boletín abre el himno correcto más a menudo, por ejemplo si el título de un canto empieza con un número.
• Un himno sin página de partitura ahora abre el índice del himnario en vez de una página inexistente.
• Tabletas: las tarjetas de libros de la Biblioteca en una misma fila ahora tienen la misma altura.
• En las ventanas emergentes, la flecha redonda de «más abajo» ahora desplaza la lista en vez de abrir la fila de debajo.
• Biblia: en Idiomas de lectura, toca cualquier parte de la fila de un ajuste para activarlo o desactivarlo.
• Con texto grande, las palabras quedan enteras y el texto se mantiene a la vista.
• Audio bíblico sin conexión indica lo que aún no se ha descargado, y sus botones de borrar dicen Borrar.
• Sobre la Denominación: los tres pilares muestran sus palabras enteras y ya no parecen botones.
• Otras correcciones y mejoras.
```

### Google Play (production), at most 500 characters each

Promoting the internal testing build to production copies the testers' notes, the
release PR's title; replace them with these. Keep Play's language tags: `en-US`;
`zh-TW` and `zh-HK` (Traditional, the same text); `zh-CN` (Simplified); `es-US` and
`es-419` (Spanish, the same text).

#### Google Play · all languages (paste as one block)

Paste it into the Play Console's release notes as it is, tags included.

```text
<en-US>
• Bible: books grouped by Testament and section.
• Bible audio resumes after a restart and says when it can't play offline.
• The audio notification uses your language.
• Hymn titles in your Chinese script; better bulletin hymn links.
• A hymn with no score page opens the hymnal's index.
• Tablets: Library book cards in a row are the same height.
• The "more below" arrow now scrolls.
• Clearer large text, Offline Bible Audio and About Denomination.
• Other fixes and improvements.
</en-US>

<zh-TW>
• 聖經：書卷按舊約、新約及類別分組。
• 聖經有聲書會從上次停止的地方繼續播放，重新開啟後也一樣。
• 沒有網路時，播放器會顯示章節未下載。
• 有聲書的通知以您的語言顯示章節與朗讀者。
• 詩歌標題以您選擇的繁體或簡體顯示，週報也更能找到正確的詩歌。
• 沒有樂譜頁面的詩歌，現在會開啟詩歌本目錄。
• 平板：精選書庫中同一行的書卡現在高度一致。
• 彈出視窗中的向下箭頭現在會捲動清單。
• 大字體、「離線聖經音訊」與「關於教派」更清楚。
• 團契頁面的星期六崇拜改稱「安息日崇拜」。
• 其他修正與改進。
</zh-TW>

<zh-HK>
• 聖經：書卷按舊約、新約及類別分組。
• 聖經有聲書會從上次停止的地方繼續播放，重新開啟後也一樣。
• 沒有網路時，播放器會顯示章節未下載。
• 有聲書的通知以您的語言顯示章節與朗讀者。
• 詩歌標題以您選擇的繁體或簡體顯示，週報也更能找到正確的詩歌。
• 沒有樂譜頁面的詩歌，現在會開啟詩歌本目錄。
• 平板：精選書庫中同一行的書卡現在高度一致。
• 彈出視窗中的向下箭頭現在會捲動清單。
• 大字體、「離線聖經音訊」與「關於教派」更清楚。
• 團契頁面的星期六崇拜改稱「安息日崇拜」。
• 其他修正與改進。
</zh-HK>

<zh-CN>
• 圣经：书卷按旧约、新约及类别分组。
• 圣经有声书会从上次停止的地方继续播放，重新打开后也一样。
• 没有网络时，播放器会显示章节未下载。
• 有声书的通知以您的语言显示章节与朗读者。
• 诗歌标题以您选择的简体或繁体显示，周报也更能找到正确的诗歌。
• 没有乐谱页面的诗歌，现在会打开诗歌本目录。
• 平板：精选书库中同一行的书卡现在高度一致。
• 弹出窗口中的向下箭头现在会滚动列表。
• 大字体、“离线圣经音频”与“关于教派”更清楚。
• 团契页面的星期六崇拜改称“安息日崇拜”。
• 其他修复与改进。
</zh-CN>

<es-US>
• Biblia: libros agrupados por Testamento y sección.
• El audio sigue donde lo dejaste al reabrir la App, y avisa si no puede sonar sin conexión.
• La notificación del audio está en tu idioma.
• El boletín elige mejor los himnos.
• Un himno sin partitura abre el índice del himnario.
• Tabletas: tarjetas de la Biblioteca de igual altura en cada fila.
• La flecha «más abajo» ahora desplaza la lista.
• Texto grande más claro.
• Otras correcciones y mejoras.
</es-US>

<es-419>
• Biblia: libros agrupados por Testamento y sección.
• El audio sigue donde lo dejaste al reabrir la App, y avisa si no puede sonar sin conexión.
• La notificación del audio está en tu idioma.
• El boletín elige mejor los himnos.
• Un himno sin partitura abre el índice del himnario.
• Tabletas: tarjetas de la Biblioteca de igual altura en cada fila.
• La flecha «más abajo» ahora desplaza la lista.
• Texto grande más claro.
• Otras correcciones y mejoras.
</es-419>
```

# Announcements in the App, and Notifications for Them

## Purpose

The church's weekly announcements, such as a fellowship lunch, a change of time or
a coming event, reach the people in the pew on the printed bulletin. Members who
can't come that Sabbath, and anyone who opens the app midweek, never see them. This
design puts the same announcements in the app (#562) and, in a second step, lets
members choose to be notified of them (#709).

It's written for whoever builds or changes either part. What the people running
the spreadsheet need to know, such as how to fill in the columns, is in
[Bulletin automation](../operations/bulletin-automation.md#3-weekly-data).

**Status:** part 1, announcements in the app and the printed bulletin, shipped in 1.9.0
(#743). Part 2, the notifications (#709), is built and tested against fake spreadsheets
and on the Android emulator.

## Decisions

### Staff type it in `Weekly Data`

One column, `Announcements`: one announcement, kept short, in any language, on
each Sabbath's `Queens` and `Brooklyn` rows. Brevity is expected, since nobody reads
a long list, so the cell isn't split into numbered items: it's kept as written,
except that blank lines are dropped, and a line break in it stays part of the same
text. The app and the printed bulletin both read the column, so there's one place
to type. `Weekly Data` already has a row for each Sabbath and location, and the
people who make the bulletin fill it in every week.

The first build had an `English Announcements` and a `Chinese Announcements`
column, one announcement per line, so staff could type their own Chinese. #743
chose one column with one announcement instead: it's less to fill in, and two
columns were paired line by line, so a Chinese line typed alone was matched to the
first English line, not the one it translated.

Three other places were weighed:

- **The `Special Remark` cell in the
  [`Sabbath Calendar`](../operations/bulletin-automation.md#2-sabbath-calendar).**
  It's already in the app, as the banner at the top of the bulletin. But it holds
  the Sabbath's occasion, such as "Thanksgiving" or "Christmas", one line for both
  locations. Notifying members of a holiday would be odd, and its one line for both
  locations can't hold each location's own announcement. It stays the banner.
- **A Google Form.** Answers pile up in a response tab, where fixing one means
  editing that tab: the kind of workflow the bulletin dropped before `Weekly Data`
  came. A form's link can also reach every member's phone unless someone reviews
  each answer first.
- **A tab of its own,** with a title, details, a link and dates for each
  announcement. That's #49, events with sign-up deadlines, and more than a week's
  announcements need.

The print dialog let each announcement pick both locations, Queens, or Brooklyn;
now one for both goes in both rows. #622 made the same move for the Bible verse:
the dialog's own verse went, and the app and the printout both read `Weekly Data`.

The column's cells show what to type when one is selected, as `Date`'s do, in
English and Simplified Chinese (`WEEKLY_DATA_ANNOUNCEMENTS_HELP_TEXT`): any
language, keep it short, the key for a new line in a cell, that it's public, to
check names in the Doc, and that phones are notified only after **Publish & Notify
Phones…** (#709). It names no languages, so it stays true as the app adds
them. **Create Word Doc…** sets it, and the header's note where the header has
none, as on a column added by hand. That's a menu click, not `onOpen`, which has no
time to spare (#639). Setting the rule again replaces it, so it never doubles, and
the next click puts back one that pasted cells replaced.

### It's machine-translated into every language

The bulletin API, the deployed Apps Script the app reads, translates the
announcement into each language in one list, `BULLETIN_ANNOUNCEMENT_LANGUAGES`:
English, Traditional Chinese and Spanish today. It goes line by line, so a line
break stays one, and a language is sent only when every line has it. It uses
`LanguageApp`, Apps Script's built-in translator
([LanguageApp](https://developers.google.com/apps-script/reference/language/language-app)),
which needs no key or billing, only a daily number of calls
([quotas](https://developers.google.com/apps-script/guides/services/quotas)), and is
already used for `Special Remark`.

- The translator detects the language each line is typed in, so a line can be in
  any language. A line typed in Chinese, in either script, is kept as typed: it has
  more Chinese characters than words in Latin letters, so "Please pray for
  黃姊妹's family" isn't one.
- Lines in Chinese and the rest go in separate requests, since the translator
  detects one language a request. If neither English nor Chinese comes out whole,
  the announcement is sent as typed, as the English.
- Machine-made Chinese is Traditional, as the bulletin prints it. The app converts
  the Chinese for Simplified readers on the phone (`traditionalToSimplified`, the
  Bible's converter), rather than asking the translator, which could reword what
  staff wrote.
- Each translation is cached under a digest of its text for up to six hours, the
  longest the script cache allows
  ([Cache](https://developers.google.com/apps-script/reference/cache/cache)). The
  response cache is only two minutes, so without this a busy Sabbath would
  translate the same lines every two minutes.
- The lines not cached go to the translator in one request per language, or two
  when some lines are in Chinese and some aren't. If the translation runs lines
  together, it asks line by line, and stops at the first failure, such as the
  day's [quota](../operations/service-limits-and-costs.md#bulletin-api-apps-script)
  running out, rather than try every line. A week's announcements usually take well
  under a hundred requests a day, far below the quota.
- A translation that fails is blank. The app shows another language, and the
  printout prints the side it has. A line not in Chinese whose English failed is
  sent as typed. Nothing fails.
- Staff can't type over a translation in the sheet. A wrong one, most likely a
  name, such as "Wong" for 黃 or 王, is fixed for the print in the print dialog
  or the Google Doc, and the cells' help says to check names in the Google Doc
  before printing. The app keeps the machine's version. If machine Chinese proves
  poor, a Chinese column can come back as an Apps Script change alone, since the API
  already sends each language
  apart.

### Languages: no one-way doors

The app is built for English and Chinese first, and other languages, such as
Korean or Vietnamese, are added one at a time (#241). Some things are hardcoded to
English and Chinese, such as Bible book names, and that's accepted. What's new
stays language-neutral, so it doesn't close the door on the next language:

- **Sheet columns** name no language: one `Announcements` column, not one per
  language.
- **Staff wording** names no language: "type in any language".
- **Data shapes** take another language without breaking older app versions. An
  announcement is an object with a field per language. A new language is one
  more entry in `BULLETIN_ANNOUNCEMENT_LANGUAGES` and one more field, which older
  versions ignore, and the app reads it once it has that language. The printed
  bulletin prints only the Chinese and the English, side by side.
- **Counts** stay open too: the API sends a list, with one announcement at most
  today, so more could come back without breaking older app versions.

### The app shows it after the program

An **Announcements** section in each location's card, between the worship program
and the roster, as the printout has it beside the schedule. Members open the
bulletin during the service for the program, so the program stays first. A location
with no announcement has no section.

### They're public

The bulletin API answers anyone on the internet, and it hides roster names (Chinese
names become `Name withheld`, English ones are shortened). It can't do that inside
free text. So the `Announcements` column holds nothing private, such as health
news, addresses or phone numbers, and the cells' help says so, in English and
Simplified Chinese, like the sheet's other notes. Until #562, announcements typed in
the print dialog were printed only.

### The print dialog fills it in, to change for one print

The dialog keeps its **+ Add announcement** list, which the people making the
bulletin know, now filled in with that Sabbath and location's `Weekly Data`
announcement as the app shows it (`getPrintedBulletinPromptData`). They can change
or remove it, or add another, at the last minute. The print numbers them only when
there are two or more, as it does Sabbath School hymns. The changes are for that
print only:

- If nothing changed, the dialog sends none, and the print reads `Weekly Data`'s,
  so it matches the app.
- If something changed, it sends the whole list (`completePrintedAnnouncements_`).
  A side left blank, as on a new one typed in one language, is machine-translated.
  A side changed alone clears the other, so the other is translated again rather
  than kept from the old text.
- Nothing is saved, and nothing goes back to `Weekly Data`: the .docx is made from
  this print's Doc, and the app keeps showing the sheet's. A change that should
  last goes in `Weekly Data`.
- An announcement no longer has its own choice of location: each print is one
  location's. A dialog opened before the deploy may still send one; an
  announcement for the other location is left out.

The Script Properties where the dialog saved announcements before #562 are
cleaned up as
[Output names and Drive folders](../operations/bulletin-automation.md#output-names-and-drive-folders)
describes.

## The API's shape

Each location's `announcements` is a list of `{ english, chinese, spanish }`, with
the cell's one announcement or none, and a field for each language of
`BULLETIN_ANNOUNCEMENT_LANGUAGES` ([no one-way doors](#languages-no-one-way-doors)):

```json
"queens": {
  "announcements": [
    {
      "english": "Fellowship lunch after the service.",
      "chinese": "崇拜後有愛筵。",
      "spanish": "Almuerzo de confraternidad después del culto."
    }
  ]
}
```

Before #562 it was an always-blank string that no app read, and older app versions
still ignore it. The app treats anything that isn't a list, such as an old-shape
copy saved on the phone, as no announcements. The response cache's version went
from `v8` to `v9`, so no two-minute-old response of the old shape is served after
the deploy.

## Deploying

Nothing in the sheet has to change before the deploy, and the old script ignores
columns it doesn't know, so the
[header-change rules](../operations/bulletin-automation.md#change-checklist) ask
nothing more here. Deploy as usual
([Deploying the bulletin Apps Script](../operations/admin-runbook.md#deploying-the-bulletin-apps-script));
the next open on a computer by a technology-group account then adds the
`Announcements` column at the far right, as
[`Weekly Data`](../operations/bulletin-automation.md#3-weekly-data) says. Row 1 is
protected for that group, so another editor's open doesn't add the column; it just
does the rest of the upkeep, such as the next Sabbaths' rows. Google's docs don't
say whether the Sheets apps on phones run `onOpen`
([Simple triggers](https://developers.google.com/apps-script/guides/triggers)), so
don't count on a phone. Nothing else adds the column: the API never writes, and
there's no timed trigger. Until it's there, there are simply no announcements.

The column is found by its name, so one added by hand before the deploy is used
wherever it is, and no second one is added. The live sheet's was added by hand, as
column C.

That check runs in `onOpen`, a simple trigger with a 30-second limit
([restrictions](https://developers.google.com/apps-script/guides/triggers#restrictions))
that the upkeep already comes close to (#639). It's the existing column check with
one more name, read from the header row it already has. It writes only when it
adds the column, and the tagging step then tags it, once.

## Notifications (#709)

Members can choose to get a notification of the week's announcement. It goes out only
when someone presses **Publish** in the bulletin sheet, never because a cell changed.

### Staff publish it from its own menu

**Announcements → Publish & Notify Phones…**, a menu of its own, left of **Printed
Bulletin**. Renaming Printed Bulletin and adding a third item was weighed and turned down:
staff know **Printed Bulletin → Create Word Doc…**, so it keeps its name and place, and a
notice to every phone isn't one click away from the routine print. The cells' help text
points to the new menu. `onOpen` only builds it; the menu reads nothing from the sheet
(#639).

The dialog is for the coming Sabbath, or next week's on the Sabbath itself. It shows each
location's announcement as typed in `Weekly Data`, with a box to tick, and says plainly,
in English and Simplified Chinese, that everyone who has the app and turned these on for
that location gets it, within a few hours, in the daytime, and not after sunset on Friday,
and that it can't be taken back. **Publish & notify** confirms. A location already
published says when, and can't be published again while its text stays the same; one
with no announcement can't be ticked. If Weekly Data's text changed after the dialog
opened, nothing is published, and the dialog asks to open it again.

Phones are notified of the announcement a person saw and confirmed, translated into
each phone's language. The publish time is kept with that text, and the API sends the
time only while the cell still holds it. So changed text isn't published until someone
publishes it: the app's bulletin shows it, and the dialog offers it again, saying it
changed. Putting the published text back counts as published again. A phone learns of a
change the next time it checks: one that already holds a waiting notice, and doesn't
check again before that notice's time, still posts the text first published. Phones that
already notified don't notify again that Sabbath.

Only the accounts in the `ANNOUNCEMENT_PUBLISHER_EMAILS` Script Property can publish: the
technology team and one or two more. It's its own list, apart from
`PHYSICAL_BULLETIN_ADMIN_EMAILS`, so it stays short. Unset or blank, nobody can publish,
and a message says to ask the technology team, in place of the dialog. The check runs in
the one function that writes the publish times (`writeAnnouncementsPublished_`), as its
first step, as well as when the dialog opens and when **Publish & notify** is pressed. It
compares the account using the sheet (`Session.getActiveUser()`), and a blank one, which
Google gives where its policies hide the user
([Session](https://developers.google.com/apps-script/reference/base/session#getActiveUser())),
is refused.

### What the API sends

When each location's announcement was published, as `announcementsPublishedAt`, an ISO
time, or blank: until it's published, for a location with no announcement, and once the
cell no longer holds the text that was published:

```json
"queens": {
  "announcements": [{ "english": "Fellowship lunch after the service.", "chinese": "崇拜後有愛筵。", "spanish": "…" }],
  "announcementsPublishedAt": "2026-11-25T14:02:11.000Z"
}
```

The times are kept in one Script Property, `announcements.published`, by Sabbath and
location, with the text published, as
`{ "2026-11-28": { "queens": { "at": "2026-11-25T14:02:11.000Z", "text": "…" } } }`: not
in the sheet, so nothing in it changes, and older Sabbaths go after five weeks. The API and
the dialog reach it through one helper (`getAnnouncementsPublishedStore_`), and the
publishing code reaches the spreadsheet through another (`getBulletinSpreadsheet_`), so
the code can move into a project of its own later (#784). Publishing clears the API's two-minute copy of that Sabbath, so a phone
that checks at once gets it. Older app versions ignore the field. It names no language
([no one-way doors](#languages-no-one-way-doors)).

### Made on each phone

The app checks the coming Sabbath's bulletin when it opens, each time it comes back, and
every few hours in the background, and hands the notice to the phone, which posts it at
its time even with the app closed. Nothing about the member leaves the phone: no push
token, no server, no new account, and the store listings keep saying "Data Not
Collected" ([App Store](../operations/app-store-connect-answers.md#app-privacy)) and "No
data collected" ([Google Play](../operations/play-console-answers.md#data-safety)). Push
from the sheet was weighed and turned down: it needs every phone's token stored
somewhere, a Firebase or Expo push account with Apple and Google keys, and store and
privacy-policy changes, against [tenets](../project-tenets.md) 1 to 3.

- **Off until the member turns it on.** Below the bulletin's announcements, the app offers
  it, with **Not now** and **Turn on**, until the member answers, and You →
  **Announcement notifications** turns it on or off. It's never asked at launch.
- **Only a published announcement,** for the member's location, the bulletin tab they last
  chose, in the app's language, as "Announcements · Queens" with the announcement. A tap
  opens the bulletin through the app's own link, `sdachurchapp://home/bulletin`, which
  `app/+native-intent.tsx` hands to the router on Android.
- **At most one a Sabbath.** The phone keeps the ids it posted, so text published again
  after a change sends no second notice to a phone that already notified. Clearing or
  changing the cell takes away a phone's waiting notice the next time that phone checks.
- **In the daytime, and not during the Sabbath.** At once between 9 am and 8 pm, or else
  at the next 9 am, and only from sunset as one Sabbath ends to sunset on the Friday before
  the next, at the church's location (`getAnnouncementNoticeWindow`). One whose time
  passes that sunset isn't sent.
- **Quiet:** no sound or vibration. On Android it's its own channel, **Announcements**,
  which the member can turn off or change in Android's settings
  ([channels](https://developer.android.com/develop/ui/views/notifications/channels)).
  iOS's Settings give this app one set of notification switches
  ([Apple](https://support.apple.com/guide/iphone/change-notification-settings-iph7c3d96bab/ios)),
  with none for each kind as Android's channels are, so the app's switch is that.

The phone posts it through the app's own module, `modules/announcement-notifications`,
as the downloads' notifications are: no notification library. On Android, an inexact
alarm, which needs no leave for exact alarms, posts it near its time: Android 12 and
later normally deliver one within an hour, and later under battery saver or Doze
([alarms](https://developer.android.com/develop/background-work/services/alarms/schedule)), so a notice set for just before 8 pm can come after it. A restart clears the alarm
([AlarmManager](https://developer.android.com/reference/android/app/AlarmManager)), and
the next check sets it again. On the iPhone, iOS posts the notice it was handed. The
module also opens the bulletin on a tap, through the iPhone's notification delegate. The
iPhone side isn't tested on a device yet.

**The background check** is `expo-background-task`, Expo's own, with `expo-task-manager`,
every three hours (`services/AnnouncementNotificationTask.ts`). Android runs it some time
after that, through WorkManager, with no screens, so the task is defined in the app's
entry, `index.ts`, before Expo Router starts. iOS decides when, from battery, network and
how the member uses the app, and runs nothing for an app swiped away until it's opened
again ([Expo BackgroundTask](https://docs.expo.dev/versions/latest/sdk/background-task/)).
So most phones get it within a few hours of publishing, and some iPhones only once the
app is next opened. A check reads the stored bulletin while it's current, so it asks the
API at most every half hour, and none at all once this Sabbath's notice is posted.

## Open questions for the pastor

Part 1 ships with the answer in brackets, each easy to change:

1. Do printed announcements ever name members, or mention health, hospital visits
   or phone numbers? [No: the column is public. If yes, a second column, printed
   only, would hold those.]
2. Are most announcements for both locations, or separate? [Typed in both rows. If
   most are shared, a way to type one for both.]
3. Is a machine translation all right in the app and in print, with names checked
   in the printed Doc? [Yes, as for `Special Remark` in the app.]
4. ~~How early are announcements ready, and on which day should the notification
   come?~~ No longer a question: the notice goes out when someone publishes it (#709).

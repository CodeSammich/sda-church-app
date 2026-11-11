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

**Status:** part 1, announcements in the app and the printed bulletin, is built and
tested against fake spreadsheets. Part 2, the notifications, isn't built yet.

## Decisions

### Staff type them in `Weekly Data`

Two columns, `English Announcements` and `Chinese Announcements`, one announcement
per line, on each Sabbath's `Queens` and `Brooklyn` rows. The app and the printed
bulletin both read them, so there's one place to type.

Three other places were weighed:

- **The `Special Remark` cell in the
  [`Sabbath Calendar`](../operations/bulletin-automation.md#2-sabbath-calendar).**
  It's already in the app, as the banner at the top of the bulletin. But it holds
  the Sabbath's occasion, such as "Thanksgiving" or "Christmas", one line for both
  locations. Notifying members of a holiday would be odd, and one line is too small
  for a week's announcements. It stays the banner.
- **A Google Form.** Answers pile up in a response tab, where fixing one means
  editing that tab: the kind of workflow the bulletin dropped before `Weekly Data`
  came. A form's link can also reach every member's phone unless someone reviews
  each answer first.
- **A tab of its own,** with a title, details, a link and dates for each
  announcement. That's #49, events with sign-up deadlines, and more than a week's
  announcements need.

`Weekly Data` already has a row for each Sabbath and location, and the people who
make the bulletin fill it in every week. The print dialog gave each announcement
its own choice of both locations, Queens, or Brooklyn; one for both locations now
goes in both rows. #622 made the same move for the Bible verse: the dialog's own
verse went, and the app and the printout both read `Weekly Data`.

### One side can be machine-translated

A side staff leave blank is machine-translated by the API with `LanguageApp`, Apps
Script's built-in translator, which needs no key or billing
([LanguageApp](https://developers.google.com/apps-script/reference/language/language-app))
and is already used for `Special Remark`.

- Machine-made Chinese is Traditional, as the bulletin prints it. Chinese typed in
  either script is translated to English with an empty source language, which
  LanguageApp detects.
- Spanish is added from what staff typed, not from a translation.
- The app converts the Chinese for Simplified readers on the phone
  (`traditionalToSimplified`, the Bible's converter), rather than asking the
  translator, which could reword what staff wrote.
- The lines not already cached go to the translator in one request per source and
  target language, so at most four per location. If the translation runs lines
  together, it asks line by line. It stops at the first failure, such as the day's
  [quota](../operations/service-limits-and-costs.md#bulletin-api-apps-script)
  running out.
- Each translation is cached under a digest of its text for up to six hours, the
  longest the script cache allows
  ([Cache](https://developers.google.com/apps-script/reference/cache/cache)). The
  response cache is only two minutes, so without this a busy Sabbath would
  translate the same lines every two minutes.
- A translation that fails leaves its side blank. The app shows the other
  language, and the printout prints the typed side alone. Nothing fails.

### The app shows them after the program

An **Announcements** section in each location's card, between the worship program
and the roster, as the printout has them beside the schedule. Members open the
bulletin during the service for the program, so the program stays first. A location
with no announcements has no section.

### They're public

The bulletin API answers anyone on the internet, and it hides roster names (Chinese
names become `Name withheld`, English ones are shortened). It can't do that inside
free text. So the announcement columns hold nothing private, such as health news,
addresses or phone numbers, and each column's header note says so, in English and
Simplified Chinese, like the sheet's other notes. Until #562, announcements typed in
the print dialog were printed only.

### The print dialog no longer takes announcements

The dialog's **+ Add announcement** box is gone, and its saved Script Properties
are cleaned up as
[Output names and Drive folders](../operations/bulletin-automation.md#output-names-and-drive-folders)
describes. A dialog opened before the deploy still sends its announcements, and
they're ignored.

## The API's shape

Each location's `announcements` is a list of `{ english, chinese, spanish }`, one
per announcement:

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

Until #562 it was a string, always blank, that no app read. Older app versions
ignore the list, and the app treats anything that isn't a list as none, as a phone's
stored copy from before may have. The response cache's version went from `v8` to
`v9`, so no two-minute-old response of the old shape is served after the deploy.

## Deploying

Nothing in the sheet has to change before the deploy, and the old script ignores
columns it doesn't know, so the
[header-change rules](../operations/bulletin-automation.md#change-checklist) ask
nothing more here. Deploy as usual
([Deploying the bulletin Apps Script](../operations/admin-runbook.md#deploying-the-bulletin-apps-script));
the next open by a technology-group account then adds the two columns, as
[`Weekly Data`](../operations/bulletin-automation.md#3-weekly-data) says. Row 1 is
protected for that group, so another editor's open can't add them, and carries on
with the rest of its upkeep, such as the next Sabbaths' rows.

That check runs in `onOpen`, a simple trigger with a 30-second limit
([restrictions](https://developers.google.com/apps-script/guides/triggers#restrictions))
that the upkeep already comes close to (#639). It's the existing column check with
two more names, read from the header row it already has. It writes only when it
adds the columns, and the tagging step then tags them, once.

## Notifications (#709, not built yet)

Members choose to be notified of a week's announcements. Decided so far:

- **Made on each phone.** The app already downloads this Sabbath's bulletin and the
  next. When one has announcements for the member's location, the phone sets one
  notification for it, in the member's language. Nothing about the member leaves
  the phone: no push token, no server, no new account, and the store listings keep
  saying "Data Not Collected" (App Store) and "No data collected" (Google Play).
  Push from the sheet was weighed and turned down: it needs every phone's token
  stored somewhere, a Firebase or Expo push account with Apple and Google keys, and
  store and privacy-policy changes, against [tenets](../project-tenets.md) 1 to 3.
- **Off until the member turns it on,** asked when they first see announcements,
  never at launch, as the download notifications are (#610).
- **At most one per Sabbath,** and none for a week without announcements.
- **The policy changes first.** The notification policy in
  [UI/UX](../UI_UX.md#key-principles--exceptions) allows only download
  notifications, made on the phone, and `test/notification-guard.test.ts` holds the
  app to it. Both change with part 2.

**The limit:** a phone learns of announcements when the app opens, or when the phone
lets it check in the background. Android runs that check sometime after the
interval the app asks for, 15 minutes at the shortest. iOS decides when, from
battery, network and how the member uses the app, often ignores short intervals,
and runs nothing for an app swiped away until it's opened again
([Expo BackgroundTask](https://docs.expo.dev/versions/latest/sdk/background-task/)).
Most members open the app on the Sabbath, when it also downloads the next Sabbath's
bulletin. So announcements typed by the previous Sabbath reach every phone; ones
typed midweek reach Android phones and some iPhones.

Part 2 needs that background check, likely a new Expo package. It's added after
#733's Expo update, so the two don't conflict.

## Open questions for the pastor

Part 1 ships with the answer in brackets, each easy to change:

1. Do printed announcements ever name members, or mention health, hospital visits
   or phone numbers? [No: the columns are public. If yes, a third column, printed
   only, would hold those.]
2. Are most announcements for both locations, or separate? [Typed in both rows. If
   most are shared, a way to type one for both.]
3. Is a machine translation all right in the app and in print, if staff can replace
   it by typing their own? [Yes, as for `Special Remark`.]
4. How early are announcements ready, and on which day should the notification
   come? [For part 2. A fixed time each week, such as Wednesday morning, three days
   ahead, gives staff a deadline.]

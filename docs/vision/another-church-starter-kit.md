# What another church would have to do

A plan, not a how-to. It sorts everything in
[the inventory](church-specific-inventory.md) by what it should become, then walks
through what a second church would do under each of the two ways described in
[the vision](../VISION.md#one-church-to-many-two-ways): a copy of the app for each
church, or one app for many churches. The project has not chosen between them; the maintainers
[lean toward one app](../VISION.md#one-church-to-many-two-ways).

Nothing here is built yet. The steps are written for a church with **one volunteer
who can follow instructions**, no developer, and no money beyond store fees.

## Contents

- [What each church-specific thing should become](#what-each-church-specific-thing-should-become)
  - [Church details](#church-details)
  - [Content that needs its own permission](#content-that-needs-its-own-permission)
  - [Code that assumes this church's shape](#code-that-assumes-this-churchs-shape)
  - [Left as it is](#left-as-it-is)
- [The steps under a copy for each church](#the-steps-under-a-copy-for-each-church)
- [The steps under one app for many churches](#the-steps-under-one-app-for-many-churches)
- [What the two lists show](#what-the-two-lists-show)
- [Proposed follow-up work](#proposed-follow-up-work)

## What each church-specific thing should become

Four groups. The first three need work under both ways; the last column of each table
says where the two ways differ.

### Church details

Facts about a church that should live in **one set of church details**, read by the
app, the web pages, the printed bulletin and the tests. Under a copy for each church,
that set is read when the copy is built. Under one app for many churches, there is one
set for each church, and the app reads the chosen one.

| What | Why it belongs here | Effort | Where the two ways differ |
| --- | --- | --- | --- |
| Church names in each language, the short name, the email subject prefix | A handful of strings repeated as literals in dozens of places | Medium: many files touched once | With one app, the installed app's own name is shared and no longer a church detail |
| Locations, addresses, map searches, coordinates, the city named beside the sunset countdown | Already a data file; one screen reads it by position, and the house numbers are spelled differently in different places | Small | None |
| Service and fellowship times | The same times are written in several places and don't all agree | Medium: one schedule that the app shows and the bulletin prints | None |
| Giving: the online giving link, donor-advised fund text, legal name and tax number, cash instructions, giving QR codes | Half are constants already | Small | None |
| Contacts: role emails, phone, the technology group | Mostly constants; the web pages and bulletin scripts repeat them | Small | With one app, support for the app itself goes to the publisher, not each church |
| Links: livestream, sermon archive, podcast, online class, conference and union | Already constants | Small | None |
| Team: people, roles, bios, photos | Already a data file with a fixed list of roles | Small | With one app, each church's people and photos are published by the publisher; each church must agree to that |
| History, milestones, affiliations, fellowship descriptions | Text in four languages inside one screen | Small | None |
| Which hymnals the bulletin uses, the default Bible for each language, the order of audio languages | Each is already one setting | Trivial | With one app, every hymnal and Bible any church uses ships to everyone |
| Which Library books the church shows, and its own publications | The catalog is shared; the selection is the church's | Small | With one app, a church selects from the shared shelf; adding a book is the publisher's decision |
| Time zone | Repeated in the app, scripts and scheduled jobs | Small | With one app, a time zone for each church |
| The bulletin's address, and the names of the spreadsheet tabs it reads | Partly settings already | Small | With one app, a list of addresses, one for each church |
| Store identity: app name, bundle and package IDs, store IDs, domain, download page, privacy and legal pages | Partly read from `app.json` already | Medium | **A copy for each church only.** With one app there is one identity, the publisher's |
| Brand colours, icon, launch symbol | Files a church replaces | Small | **A copy for each church only** |

### Content that needs its own permission

These came with permissions given to this church, or belong to it. Another church
can't simply reuse them under either way.

| What | Under a copy for each church | Under one app for many churches |
| --- | --- | --- |
| Bible text, and audio in English, Mandarin, Cantonese and Spanish, from [HelloAO](../operations/service-limits-and-costs.md#helloao), with the verse times made from those recordings | Usable as it is. HelloAO's Cantonese and Spanish copies depend on an answer that is still awaited ([#769](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/769)) | The same |
| The fallback copies of the Mandarin, Cantonese and Spanish audio that this church hosts | Optional. A church that wants a fallback asks each rights holder and hosts its own copies | The publisher asks each rights holder whether this church's copies may serve every church, or goes without a fallback for the others |
| The church symbol in the icon and launch animation | Each official Seventh-day Adventist church needs its own approval; any other organization replaces the symbol ([Branding](../LEGAL_BRANDING.md)) | Approval has to cover an app that serves many churches |
| The church's own publications, photos and hymn chart images | Left out, or replaced with the church's own | Shown only to the church they belong to |
| Store listing text, screenshots and graphics | Remade for each church from its details | One set, written about the shared app |
| Printed bulletin layouts | One layout file for each congregation; a church keeps or rewrites one | The same. Printing stays each church's own, outside the shared app |

### Code that assumes this church's shape

| What | What it would take | Where the two ways differ |
| --- | --- | --- |
| The bulletin's two named congregations, in the app, the bulletin's answers and the spreadsheet columns | Changing all three together to "any number of locations" | A copy can delete the half it doesn't use and wait. One app can't start without this |
| The fixed set of four languages, with every screen holding its own text | A new language is a translation project across nearly every screen | A copy removes languages it doesn't need. One app carries every language any church needs |
| Chinese features: pinyin, the Traditional and Simplified rules, the name dictionary | Nothing; a church that doesn't need them leaves them off | None |
| Checks that compare against this repository's name, the website's path, and the scheduled jobs that are skipped in a GitHub fork | Reading the name from one place, and deciding which jobs a church's copy should run | **A copy for each church only** |
| The church's short name inside the names of the app's own Android and iOS code | Nothing has to change for the app to work; renaming is tidiness | **A copy for each church only** |
| Reminders about this church's accounts: the yearly checkup, backups, signing dates | Rewritten or removed by each church | **A copy for each church only.** With one app they are the publisher's |

### Left as it is

- The printed bulletin stays one layout file for each congregation.
- The church symbol doesn't get an on-off switch. It is a file that is replaced.
- Nothing is built for churches outside the Seventh-day Adventist Church. They may use
  the code under its license, without the symbol.

## The steps under a copy for each church

Days are calendar time, waiting included.

| # | Step | Needs | What it really costs |
| --- | --- | --- | --- |
| 1 | Confirm the church is an official Seventh-day Adventist church and may use the symbol. If not, replace it. | The pastor's approval | A conversation |
| 2 | Copy the repository and fill in the church details. | A GitHub account | Half a day |
| 3 | Publish the web app from the copy, as a free preview of the church's details. | Nothing more | An hour |
| 4 | Apple: enrol as a nonprofit organization and join the developer programme ([setup](../operations/app-store-setup.md#apple-app-store)). | A legal entity, its tax number, a D-U-N-S number, someone who can sign for the church | **Weeks of waiting.** This step stops most churches. |
| 5 | Google Play: an organization account, with identity and website checks ([setup](../operations/app-store-setup.md#google-play)). | The same entity; a domain the church controls | One to two weeks |
| 6 | A domain, and Google Workspace for Nonprofits for shared mailboxes and files. | The entity's paperwork | One to two weeks |
| 7 | Signing files and upload access for both stores, saved as secrets in the copy ([Native builds](../operations/native-builds.md)). | A second careful person | **A full day, and the hardest one.** The instructions assume some comfort with a terminal. |
| 8 | The bulletin, if wanted: copy the spreadsheet, **deploy the bulletin script from the church's own Google account**, and put its address in the church details. | Step 6; someone who will fill in the roster every week | A day to set up, then **an hour every week**. Without it the bulletin goes stale. A church can leave the bulletin out. |
| 9 | Fallback copies of the Bible audio, if wanted. The audio itself already plays from HelloAO in English, Mandarin, Cantonese and Spanish. | Each rights holder's permission; somewhere to host the files | Days, with technical help. Most churches can skip this. |
| 10 | Store listings: screenshots, text, privacy policy. Submit for review. | Steps 4 to 7 | Two or three days, plus the stores' review |
| 11 | Keep it going: take each update, renew the Apple signing files and nonprofit status each year, answer the reminder issues. | A volunteer who looks in monthly | A few hours a quarter |

## The steps under one app for many churches

What a **church** would do:

| # | Step | Needs | What it really costs |
| --- | --- | --- | --- |
| 1 | Ask to be added, and show the church is an official Seventh-day Adventist church. | The pastor's approval | A conversation, plus the publisher's answer |
| 2 | Fill in the church details and send them in. | A form or a file; no accounts | Half a day |
| 3 | The bulletin, if wanted: copy the spreadsheet, **deploy the bulletin script from the church's own Google account**, and send in its address. | A Google account the church owns; someone who will fill in the roster every week | A day to set up, then **an hour every week** |
| 4 | Check the church in a preview before it reaches members. | A phone | An hour |
| 5 | Keep the details current: send a change when times, people or links change. | Someone who notices | Minutes, a few times a year |

What the **publisher** would do, once and then for every church:

| # | Step | What it really costs |
| --- | --- | --- |
| 1 | Hold the store accounts, signing files, domain and yearly renewals for everyone. | What this church does today |
| 2 | Decide who may be added, and review each church's details and each later change before release. | Time for each church, for as long as it is in the app |
| 3 | Get approvals that cover every church: the symbol, and this church's fallback audio copies if they are to serve everyone. | Unknown until each one answers |
| 4 | Answer to Apple and Google for everything every church shows. | The publisher carries the risk for all |
| 5 | Remove a church that asks to leave, or whose details nobody keeps up. | Rules that have to be written first |
| 6 | Test every release against every church's details. | Grows with each church |

## What the two lists show

- **Any church can have the web app in a day** under a copy for each church. That
  much is real today.
- **The store accounts are the wall** for a copy for each church. They are paperwork,
  not code, and nothing in this repository can remove them. One experienced volunteer
  can carry several churches through them much faster than each church alone.
- **One app moves the wall, it doesn't remove it.** A church's list drops from eleven
  steps to five. The publisher's list is new, never ends, and grows with each church.
- **The bulletin costs the same under both.** A person fills in the roster every week,
  and each church deploys from its own Google account
  ([why](../VISION.md#the-bulletin-under-each)).
- **Bible audio is no longer a barrier.** It plays from HelloAO for every church under
  both ways. What stays open is the church symbol and this church's own fallback
  copies. Under one app those have to be settled before the first other church is
  added, because one answer covers everyone.

## Proposed follow-up work

Proposed, not filed. The first group helps under both ways and can start before the
choice is made.

**Under both ways**

1. Gather the church details into one place: names, contacts, links, giving, team,
   locations, time zone. Remove the unused church-name constant.
2. Agree one spelling of each address and one set of service times, and have the app
   and the printed bulletin read the same source.
3. Read locations as a list of any length instead of by position.
4. Build the hosted web pages from the church details.
5. Design the bulletin for any number of locations, in the app, the bulletin's
   answers and the spreadsheet together. Design only; no change until a second church
   needs it or one app is chosen.
6. For each permission, record whether another church may rely on it, and ask the
   rights holder where the answer is unknown.

**Only for a copy for each church**

7. Read the repository's name and the time zone from one place in scheduled jobs and
   scripts.
8. Build the store graphics and listing text from the church details.
9. A guide for a church making its own copy, replacing the short note in
   [Development setup](../README.md).

**Only for one app for many churches**

10. Decide the publisher, and what today's app and store listings are called once they
    serve more than one church.
11. Write the rules for adding, reviewing and removing a church.
12. Design the "choose your church" step for older members, asked once.
13. Ship each church's details inside the app, with no server.

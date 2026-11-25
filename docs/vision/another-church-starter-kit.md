# What another church would have to do

Two ways are being considered for bringing this app to another church
([the vision](../VISION.md#one-church-to-many-two-ways)). This page says what each one
would take: the money, the time, the people, and the steps. The project has not chosen
between them; the maintainers
[lean toward one app](../VISION.md#one-church-to-many-two-ways).

## In short

| | Publish its own copy | Join this app |
| --- | --- | --- |
| Money | About $25 once and about $11 a year, if Apple waives its $99 yearly fee for the church as a nonprofit | Nothing |
| Time to start | About 6 to 8 working days of a volunteer's time, spread over one to two months of waiting | About a day |
| Time every year | About 15 hours of upkeep | Minutes |
| People | A volunteer at ease with typing commands, a second careful person, access to a Mac, and someone who can sign for the church | Someone who can fill in a form |
| The bulletin, if wanted | A day to set up, then about an hour every week | The same |
| Who carries the rest | The church itself | The New York Chinese SDA Church's IT team, for every church in the app |

Neither way works like this yet. The steps describe the app once the
[follow-up work](#for-the-technical-team-proposed-follow-up-work) is done. Every time
on this page is the maintainers' estimate: no second church has done this. The waiting
times come from Apple's and Google's own pages, linked beside each one.

Each section opens with its bottom line. The parts marked **For the technical team**
can be skipped by everyone else.

## Contents

- [What it takes for a church to publish its own copy of this app](#what-it-takes-for-a-church-to-publish-its-own-copy-of-this-app)
- [What it takes for a church to join this app, under the New York Chinese SDA Church's IT umbrella](#what-it-takes-for-a-church-to-join-this-app-under-the-new-york-chinese-sda-churchs-it-umbrella)
- [The bulletin under each way](#the-bulletin-under-each-way)
- [For the technical team: what each church-specific thing should become](#for-the-technical-team-what-each-church-specific-thing-should-become)
  - [Church details](#church-details)
  - [Content that needs its own permission](#content-that-needs-its-own-permission)
  - [Code that assumes this church's shape](#code-that-assumes-this-churchs-shape)
  - [Left as it is](#left-as-it-is)
- [For the technical team: proposed follow-up work](#for-the-technical-team-proposed-follow-up-work)

## What it takes for a church to publish its own copy of this app

**Bottom line.** The church gets an app under its own name and icon, and carries all
of it: store accounts, yearly renewals, and every update. The money is small. The
paperwork and the technical day are what stop a small church, and it needs a volunteer
who stays.

### What it really costs

| | What it really costs | Where the figure comes from |
| --- | --- | --- |
| Money, once | **$25** for the Google Play account | [Google](https://support.google.com/googleplay/android-developer/answer/6112435): "US$25 one-time registration fee" |
| Money, every year | **About $11** for a domain. Apple's **$99** yearly fee is waived for a nonprofit that sells nothing through its apps, and the church confirms that each year | This church's domain price in 2026 ([costs](../operations/service-limits-and-costs.md#summary)); [Apple's price](https://developer.apple.com/programs/enroll/) and [fee waiver](https://developer.apple.com/help/account/membership/fee-waivers/) |
| Everything else | **$0**. Each service the app uses is free | [Service limits and costs](../operations/service-limits-and-costs.md#summary) |
| Time to start | **About 6 to 8 working days** of volunteer time, over **one to two months**, most of it waiting for the business ID and the stores | The steps below, added up. Apple says to allow [up to 5 business days](https://developer.apple.com/help/account/membership/D-U-N-S/) for the business ID; Google says [up to 30 days](https://support.google.com/googleplay/android-developer/answer/13628312) |
| Time every year | **About 15 hours**: taking each update, the yearly Apple renewals, and answering reminders | Step 11, estimated at a few hours a quarter |
| The bulletin, if wanted | **A day** to set up, then **about an hour every week**, about 50 hours a year | Step 8, an estimate |
| People and skills | One volunteer at ease with typing commands. A second careful person for the signing day. Someone who can sign for the church. Access to a Mac | Steps 5 to 7 |
| The hardest parts | Waiting for the store accounts (step 5), and the signing day (step 7) | |

### The steps

Days are calendar time, waiting included. Steps 8 and 9 are optional.

| # | Step | What it needs | What it really costs |
| --- | --- | --- | --- |
| 1 | Confirm the church is an official Seventh-day Adventist church and may use the church symbol. If not, the symbol is replaced. | The pastor's approval | A conversation |
| 2 | Make the church's own copy of the code and fill in the church's details: names, addresses, times, giving, contacts, links. | A free GitHub account (GitHub is the website that holds the code) | Half a day |
| 3 | Put the copy on the web as a free preview, to check the details before any store work. | A computer | An hour |
| 4 | Get a domain (a web address the church owns) with a working website and email on it. | The church's legal paperwork; about $11 a year | One to two weeks; about half a day of work |
| 5 | Apple: join its developer program as an organization, and apply for its nonprofit fee waiver. | A legal entity and its tax number; a D-U-N-S number (a free business ID from Dun & Bradstreet that Apple and Google both check); someone who can sign for the church; the domain from step 4 | **Weeks of waiting**; about half a day of work. The step most likely to stall |
| 6 | Google Play: open an organization account and pass its identity and website checks. | The same entity and business ID; the domain; a credit card for the one-time $25 | One to two weeks; about half a day of work |
| 7 | Create the signing keys (files that prove each update comes from the church) for both stores, and connect them to the copy so it can build and upload the app. | A volunteer at ease with typing commands; a second careful person; a Mac | **A full day, and the hardest one** |
| 8 | The bulletin, if wanted: copy the bulletin spreadsheet and set up its program **from the church's own Google account**. | A Google account the church owns; someone who will fill in the roster every week | A day to set up, then **an hour every week**. Without that person the bulletin goes stale. A church can leave the bulletin out |
| 9 | Backup copies of the Bible audio, if wanted. The audio already plays from a free public source in English, Mandarin, Cantonese and Spanish. | The recordings' publishers' permission or terms; somewhere to keep the files | Days, with technical help. Most churches can skip this |
| 10 | Write the store listings: screenshots, text, privacy policy. Send the app for review. | Steps 4 to 7 | Two or three days, plus the stores' review |
| 11 | Keep it going: take each update, renew the Apple signing keys and confirm the nonprofit waiver each year, answer the reminders the copy sends. | A volunteer who looks in every month; a Mac once a year | A few hours a quarter |
| | **Total: what it really costs** | **Three or four people for moments, one volunteer throughout** | **$25 once and about $11 a year; about 6 to 8 working days over one to two months; then about 15 hours a year, plus an hour a week for the bulletin** |

<details>
<summary><strong>For the technical team</strong></summary>

- **Step 2.** The copy is a fork. Today the church's details are spread over many
  files in four languages ([inventory](church-specific-inventory.md#what-would-surprise-another-church));
  "half a day" assumes follow-up 1 is done.
- **Step 3.** The website deploy job skips itself in a GitHub fork, so the preview is
  published by hand with `npm run deploy:dev`, from a computer with Node.js
  ([Web builds and the website](../README.md#web-builds-and-the-website)). The
  bulletin's address has to be changed or removed first, or the copy shows this
  church's bulletin.
- **Steps 5 and 6.** The account steps are in
  [App Store and Google Play setup](../operations/app-store-setup.md). Google Workspace
  for Nonprofits gives the shared mailboxes and files for free.
- **Step 7.** The keys are saved as GitHub secrets
  ([Native builds](../operations/native-builds.md)). The signed build jobs also skip
  themselves in a fork, so the copy must not be a GitHub fork, or those jobs must be
  changed to run in one.
- **Step 8.** The program is the bulletin Apps Script
  ([Bulletin automation](../operations/bulletin-automation.md)); see
  [The bulletin under each way](#the-bulletin-under-each-way).
- **Step 9.** A church that skips it removes this church's backup copies from its
  copy. The Mandarin recording needs its publisher's permission; the Cantonese and
  Spanish ones come under their publisher's published terms
  ([Legal](../LEGAL.md#bible-sources-and-licensing)).
- **Staying connected.** A copy made from a GitHub template has no link back to this
  repository, so fixes don't flow to it. A fork keeps the link. The repository isn't
  offered as a template until the direction is chosen ([#617](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/617)).
- **Many copies.** One experienced volunteer can carry several churches through steps
  5 to 7 much faster than each church alone.

</details>

## What it takes for a church to join this app, under the New York Chinese SDA Church's IT umbrella

**Bottom line.** The church opens no accounts and pays nothing. It sends in its
details, and its members choose it inside the app. The New York Chinese SDA Church's IT
team then carries the stores, the releases and the responsibility for every church in
the app, so the cost moves to that team and grows with each church.

This is the way the maintainers lean toward. Whether this church or a wider body, such
as a conference, would be the publisher is [still open](../VISION.md#what-is-undecided).

### What it really costs

| | For the church that joins | For this church's IT team |
| --- | --- | --- |
| Money | **$0** | **Nothing new.** The store accounts and domain it already has serve every church ([costs](../operations/service-limits-and-costs.md#summary)) |
| Time to start | **About a day**: half a day for the details, an hour to check them | **About half a day** for each church, to review and add it. An estimate; none has been added yet |
| Time every year | **Minutes**, when times, people or links change | **A few hours for each church**: reviewing its changes and checking it in each release. An estimate |
| The bulletin, if wanted | **A day** to set up, then **about an hour every week** | Help with the first setup |
| People and skills | Someone who can fill in a form, and the pastor's approval | The volunteers it has today, with more of their time |
| Before the first church | Nothing | The app has to learn to serve more than one church, and the approvals and agreements below have to be in place. Not started |
| The hardest part | Finding the person who keeps the details and the bulletin current | Answering for every church's content, for as long as it is in the app |

### The steps for the church

| # | Step | What it needs | What it really costs |
| --- | --- | --- | --- |
| 1 | Ask to be added, and show the church is an official Seventh-day Adventist church. | The pastor's approval | A conversation, plus the IT team's answer |
| 2 | Fill in the church's details and send them in. | A form or a file; no accounts | Half a day |
| 3 | The bulletin, if wanted: copy the bulletin spreadsheet and set up its program **from the church's own Google account**. | A Google account the church owns; someone who will fill in the roster every week | A day to set up, then **an hour every week** |
| 4 | Check the church in a preview before it reaches members. | A phone | An hour |
| 5 | Keep the details current: send a change when times, people or links change. | Someone who notices | Minutes, a few times a year. Members see the change after the next release |
| | **Total: what it really costs** | **One person, and the pastor's approval** | **$0; about a day to start; minutes a year, plus an hour a week for the bulletin** |

### The steps for this church's IT team

| # | Step | What it really costs |
| --- | --- | --- |
| 1 | Hold the store accounts, signing keys, domain and yearly renewals for everyone. | What it does today |
| 2 | Decide who may be added, and review each church's details and each later change before release. | About half a day for each new church, then a few hours a year for each. An estimate |
| 3 | Get approvals that cover every church: the church symbol, and this church's backup audio copies if they are to serve everyone. | Unknown until each one answers |
| 4 | Answer to Apple and Google for everything every church shows, with an agreement with each church. | The team, and this church, carry the risk for all. It needs legal advice and the church board's approval ([#617](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/617)) |
| 5 | Remove a church that asks to leave, or whose details nobody keeps up. | Rules that have to be written first |
| 6 | Test every release against every church's details. | Grows with each church |
| | **Total: what it really costs** | **No new money. About half a day to add each church and a few hours a year to keep it, on top of the one-time work of making the app serve many churches. The lasting cost is responsibility, not hours** |

<details>
<summary><strong>For the technical team</strong></summary>

- Each church's details would be a plain file, shipped inside the app or downloaded
  from a free website that only serves files. No shared server and no accounts
  ([vision](../VISION.md#how-they-compare)).
- The bulletin, the locations and the languages have to stop assuming this church's
  shape before a second church can be added
  ([Code that assumes this church's shape](#code-that-assumes-this-churchs-shape)).
- The "choose your church" step is asked once, in the member's language.
- The work is listed under
  [proposed follow-up work](#for-the-technical-team-proposed-follow-up-work), items 10
  to 13.

</details>

## The bulletin under each way

**Bottom line.** Under both ways, the bulletin needs one person every week, and each
church must set it up from its own Google account. It is the part of the app that
costs the most to keep going, and a church can leave it out.

<details>
<summary><strong>For the technical team</strong></summary>

The bulletin is a small program in Google Apps Script that runs under the Google
account that set it up (deployed it), and Google lets one account answer 30 requests
at the same moment. Reading Google's quota pages together, every request from every
phone counts against it
([Bulletin API](../operations/service-limits-and-costs.md#bulletin-api-apps-script)).
One church family uses a small part of that. Several churches set up from one account
would share it.

- **A church's own copy** gets this right without trying. Each church sets up its own
  bulletin and builds its address into its own app.
- **One app for many churches** has to hold to it on purpose. The app would keep a
  list of bulletin addresses, one for each church, each set up from that church's
  account. One shared bulletin for every church would need something other than a
  single Apps Script deployment.

Under both, account ownership has to be settled on the first day. A bulletin's address
is built into the app today, so moving a church's bulletin to another account later
takes an app release, and older versions of the app keep asking the old address.

</details>

## For the technical team: what each church-specific thing should become

This part is for the people who maintain the code. It sorts everything in
[the inventory](church-specific-inventory.md) into four groups. The first three need work under both ways; the last columns of each table
say where the two ways differ. Effort is the maintainers' work, done once, not a
church's.

### Church details

Facts about a church that should live in **one set of church details**, read by the
app, the web pages, the printed bulletin and the tests. Under a copy for each church,
that set is read when the copy is built. Under one app for many churches, there is one
set for each church, and the app reads the chosen one.

| What | Why it belongs here | Effort | Where the two ways differ |
| --- | --- | --- | --- |
| Church names in each language, the short name, the email subject prefix | A handful of strings repeated as literals in dozens of places | Medium: many files touched once | With one app, the installed app's own name is shared and no longer a church detail |
| Locations, addresses, map searches, coordinates, the city named beside the sunset countdown | Mostly a data file; two screens read it by position, one of them assuming exactly three, and the house numbers are spelled differently in different places | Small | None |
| Service and fellowship times | The same times are written in several places and don't all agree | Medium: one schedule that the app shows and the bulletin prints | None |
| Giving: the online giving link, donor-advised fund text, legal name and tax number, cash instructions, giving QR codes | Half are constants already | Small | None |
| Contacts: role emails, phone, the technology group | Mostly constants; the web pages and bulletin scripts repeat them | Small | With one app, support for the app itself goes to the publisher, not each church |
| Links: livestream, sermon archive, podcast, online class, conference and union | Already constants | Small | None |
| Team: people, roles, bios, photos | Already a data file with a fixed list of roles | Small | With one app, each church's people and photos are published by the publisher; each church must agree to that |
| History, milestones, affiliations, fellowship descriptions | Text in four languages inside two screens | Small | None |
| Which hymnals the bulletin uses, the default Bible for each language, the order of audio languages | Each is already one setting | Trivial | With one app, every hymnal and Bible any church uses ships to everyone |
| Which Library books the church shows, and its own publications | The catalog is shared; the selection is the church's | Small | With one app, a church selects from the shared shelf; adding a book is the publisher's decision |
| Time zone | Repeated in the bulletin scripts, other scripts, tests and scheduled jobs | Small | With one app, a time zone for each church |
| The bulletin's address, and the names of the spreadsheet tabs it reads | Partly settings already | Small | With one app, a list of addresses, one for each church |
| Store identity: app name, bundle and package IDs, store IDs, domain, download page, privacy and legal pages | Partly read from `app.json` already | Medium | **A copy for each church only.** With one app there is one identity, the publisher's |
| Brand colours, icon, launch symbol | Files a church replaces | Small | **A copy for each church only** |

### Content that needs its own permission

These came with permissions given to this church, or belong to it. Another church
can't simply reuse most of them under either way.

| What | Under a copy for each church | Under one app for many churches |
| --- | --- | --- |
| Bible text, and audio in English, Mandarin, Cantonese and Spanish, from [HelloAO](../operations/service-limits-and-costs.md#helloao), with the verse times made from those recordings | Usable as it is. The publisher of the Cantonese and Spanish recordings hasn't yet answered HelloAO about them; if it objects, the app plays the backup copies instead ([#769](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/769)) | The same |
| The backup copies of the Mandarin, Cantonese and Spanish audio that this church hosts | Optional. A church that wants a backup asks each rights holder and hosts its own copies | The publisher asks each rights holder whether this church's copies may serve every church, or goes without a backup for the others |
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
| Checks that compare against this repository's name, the website's path, and the 19 automated jobs, including the signed builds and the website deploy, that skip themselves in a GitHub fork | Reading the name from one place, and deciding which jobs a church's copy should run | **A copy for each church only** |
| The church's short name inside the names of the app's own Android and iOS code | Nothing has to change for the app to work; renaming is tidiness | **A copy for each church only** |
| Reminders about this church's accounts: the yearly checkup, backups, signing dates | Rewritten or removed by each church | **A copy for each church only.** With one app they are the publisher's |

### Left as it is

- The printed bulletin stays one layout file for each congregation.
- The church symbol doesn't get an on-off switch. It is a file that is replaced.
- Nothing is built for churches outside the Seventh-day Adventist Church. They may use
  the code under its license, without the symbol.

## For the technical team: proposed follow-up work

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

7. Read the repository's name and the time zone from one place in automated jobs and
   scripts.
8. Build the store graphics and listing text from the church details.
9. A guide for a church making its own copy, replacing the short note in
   [Development setup](../README.md).

**Only for one app for many churches**

10. Decide the publisher, and what today's app and store listings are called once they
    serve more than one church. The questions for counsel and the conference are in
    [#617](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/617).
11. Write the rules for adding, reviewing and removing a church.
12. Design the "choose your church" step for older members, asked once.
13. Ship each church's details inside the app, or download them from a free website
    that only serves files, with no server.

# Vision

Where the app is going, and what is still undecided. The
[project tenets](project-tenets.md) say how we choose; this page says what we're
choosing toward.

One question on this page is open on purpose:
[one copy of the app for each church, or one app for many churches](#one-church-to-many-two-ways).

## Contents

- [Who the app is for](#who-the-app-is-for)
- [What the app is](#what-the-app-is)
- [What the app isn't](#what-the-app-isnt)
- [Why it's open source](#why-its-open-source)
- [One church to many: two ways](#one-church-to-many-two-ways)
  - [What both ways share](#what-both-ways-share)
  - [How they compare](#how-they-compare)
  - [In between](#in-between)
  - [What is undecided](#what-is-undecided)

## Who the app is for

The app was built for one church family in New York: two congregations and a
fellowship group, in three places, mostly Chinese-speaking, many of them older. It is
built first for:

- **Older members** who read Traditional or Simplified Chinese, use large text, and
  would rather not tap a small icon to find out what it does.
- **People who listen more than they read**, in Mandarin, Cantonese, English or
  Spanish, often on poor Wi-Fi or none.
- **Visitors** who found the church online and want to know where it is, when it
  meets, and what it believes, before they walk in.
- **The volunteers and staff** who prepare the Sabbath: the person who fills in the
  roster, the one who prints the bulletin, the deacon checking who is on duty.

A feature that helps none of these people doesn't belong, however good it is.

Beyond this church, it is meant for other small Seventh-day Adventist churches with no
budget for an app and no developer.
[One church to many](#one-church-to-many-two-ways) is how they could get it.

## What the app is

- **This Sabbath, in your pocket.** The bulletin, the hymns in it, the Bible reading,
  and how to get to church.
- **A Bible and a hymnal that work without a signal**, in English, Chinese (Traditional
  and Simplified) and Spanish, with audio and with the Chinese and English hymn numbers
  side by side.
- **A short shelf, chosen by people the members trust.** The Library
  [curates rather than collects](project-tenets.md#7-focused). It goes deep only where
  it can do so well, and links out for the rest. It is balanced on purpose: a Christian
  library with an Adventist section
  ([Christian Library](feature_designs/christian_library.md#initial-catalog)).
- **Free to run and free to use.** No service the app uses can bill the church for
  usage; the only recurring cost is the domain
  ([Service limits and costs](operations/service-limits-and-costs.md#summary)).
- **Run by volunteers.** The tasks a maintainer does by hand are written down in the
  [admin runbook](operations/admin-runbook.md), so the next volunteer can take over.

## What the app isn't

Whichever way the open question is settled:

- **Not a social network.** It has no member accounts, no feed, no comments, and nothing
  that [tracks who opened what](project-tenets.md#3-sanctuary).
- **Not a church management system.** It holds no membership list, attendance record,
  or giving history. Giving opens the church's existing giving page.
- **Not a full library.** Large collections already have good homes; the app points
  to them.
- **Not a business.** No paid tiers, ads, or in-app purchases
  ([App stores](architecture.md#app-stores)), and no service that can send a bill for
  usage ([Governance principles](architecture.md#governance-principles)).
- **Not a substitute for coming.** It exists to make it easier to
  [show up in person](project-tenets.md#4-community).

## Why it's open source

The code is under the [Apache 2.0 license](../LICENSE). Three reasons:

1. **Other churches have the same needs and the same budget.** A small church can't
   pay for an app. What one church's volunteers have already built should be theirs to
   use.
2. **Members can see what the app does.** An app that promises not to track anyone
   should be checkable.
3. **The work should outlast the people doing it.** Volunteers move on. Public code,
   public docs and a public history are how the next ones start.

The license covers the code only. The church symbol may be used only by official
Seventh-day Adventist organizations ([Branding](LEGAL_BRANDING.md)). The church's
photos and publications are its own, and one recording permission was given to this
church alone ([Audio Power permission scope](LEGAL.md#audio-power-permission-scope)).
None of these comes with the code.

## One church to many: two ways

The long-term hope is that any small church can give its members what this church's
members have. There are two ways to get there, and **the project has not chosen between
them**.

- **A copy for each church.** Each church takes the code, fills in its own details, and
  publishes its own app under its own name, from its own store accounts. This is what
  the code supports today, though filling in a church's details still means editing
  many files ([the inventory](vision/church-specific-inventory.md#what-would-surprise-another-church)). A copy
  of the code on GitHub is called a fork
  ([Building an independent fork](operations/native-builds.md#building-an-independent-fork)).
- **One app for many churches.** One app in each store. On first opening, a member
  chooses their church, and the app shows that church's bulletin, times, addresses and
  giving link. Everything shared, such as the Bible, the hymnals and the Library, is
  the same for everyone.

**Where the maintainers lean, as of November 2026:** one app for many churches, with a
step where a member chooses their church. The reasons are that one app is easier to
maintain, and that a small church with no IT volunteer could join without opening store
accounts or publishing anything. The picture is today's app and store listings gaining
a choice of church, not a new app.

The case for a copy for each church is as plain: each church keeps its own name and
icon, decides when to update, and depends on no single publisher that answers for every
church and whose failure would reach every church.

Nothing may be built yet that closes off either way.

### What both ways share

Most of the work is the same under either:

- **Every fact about a church kept in one place.** Today the church's name, addresses,
  service times and contacts are spread across screens, web pages, the bulletin
  scripts and the tests ([the inventory](vision/church-specific-inventory.md) lists
  them). Under either way they have to become one set of church details that the app,
  the web pages and the printed bulletin all read, so they stop disagreeing.
- **No assumptions about this church's shape.** The bulletin assumes two congregations
  by name, and one screen assumes three locations in a fixed order. A second church
  won't match.
- **Bible text and audio that any church can use.** The Bible's text ships with the
  app from public-domain sources, and its audio in English, Mandarin, Cantonese and
  Spanish plays from [HelloAO](operations/service-limits-and-costs.md#helloao) first,
  a free public source, so any church using the app gets them.
- **Permissions checked for who they cover.** The church symbol is for official
  Seventh-day Adventist organizations. The photos and publications are this church's
  own. The backup copies of the audio that this church hosts, which the app plays when
  HelloAO can't be reached, rest on one permission given to this church and on a
  publisher's terms that ask each user to host its own copies
  ([Legal](LEGAL.md#bible-sources-and-licensing)). Each needs an answer to "may another
  church use this?" before another church relies on it.
- **Each church keeps its own data.** The roster behind a bulletin holds names. It
  stays in that church's own accounts under both ways.
- **Each church's bulletin runs from that church's own Google account**, and someone
  fills in its roster every week
  ([why](vision/another-church-starter-kit.md#the-bulletin-under-each-way)).

This work helps this church today and comes first either way
([proposed follow-up work](vision/another-church-starter-kit.md#proposed-follow-up-work)).

The main difference in the code is *when* a church's details are read: when a church's
copy of the app is built, or when a member picks their church. One app also needs the
choice-of-church step, and must fit every church's shape at once. If the church details
are plain data from the start, the choice can still be made late.

### How they compare

| Question | A copy for each church | One app for many churches |
| --- | --- | --- |
| What must a church do to start? | Open store accounts as an organization, set up the stores' signing keys (files that prove each update comes from the church), and publish. The accounts and paperwork take weeks, and it is the step most likely to stall a small church ([what another church would have to do](vision/another-church-starter-kit.md)). | Ask the publisher to be added, send in its details, and set up a bulletin if it wants one. No store accounts. |
| What does it cost a church? | Google Play's one-time $25 fee, a domain, and Apple's yearly fee unless it is waived for a nonprofit ([App stores](architecture.md#app-stores)). | Nothing; the publisher pays these once for everyone. |
| Who publishes the app and answers to the stores? | Each church, for its own app. | One publisher, for every church in the app. Who that would be is open. |
| Whose name and icon do members see? | Their own church's. | One shared name; their church appears inside. |
| How do updates reach members? | Each church takes each update and releases it when it chooses. A church without a volunteer falls behind. | One release reaches every church, on the publisher's schedule. |
| What happens if a church's volunteer leaves? | Its app stops being updated, and may leave the store when a yearly renewal is missed. | Its details go out of date, and the publisher may have to remove the church. |
| What happens if the publisher stops? | The other churches aren't affected. | Every church is affected at once. |
| Who decides what content a church shows? | Each church, fully. | Each church, within what the shared app offers. |
| Who may use the church symbol? | Each official church, with its own approval. | Approval must cover an app that serves many churches. |
| How much new code? | Less in total, but each copy makes its own changes, such as a different number of locations or a new language. Every change it makes to shared code makes later updates harder to take. | More. The app must handle any number of locations, a way to choose a church, and each church's own languages and hymnals. |
| What do Apple's rules say? | Allowed when each church submits its own copy. Apple discourages near-identical apps, so a reviewer may ask how the copies differ ([guidelines 4.2.6 and 4.3](https://developer.apple.com/app-store/review/guidelines/#design), read 2026-11-24). | Apple names one app with a "picker" as an accepted model (guideline 4.2.6). |
| What about a member visiting another church? | They install that church's app. | They switch churches inside the app. |
| What does a bad release break? | One church's app. | Every church's app. |

Three things follow from the table.

**A copy for each church spreads the paperwork across churches. One app gathers it, and
the responsibility, in one publisher.** The store accounts are the hard part of a copy
for each church, and nothing in the code can remove them. One app removes them for
everyone except the publisher, who then answers for every church's content.

**One app must still keep every tenet.** It could not have a shared server holding
churches' data, or member accounts ([tenets 1 to 3](project-tenets.md)). Each church's
public details would be a plain file, shipped in the app or downloaded from a free
website, and the choice of church would stay on the phone, like the language setting.

**The choice of church must be easy.** For an older member, "choose your church" is
one more screen that can go wrong. It has to be asked once, in their language, and
[understood in seconds](project-tenets.md#5-simplicity).

### In between

The two ways aren't the only ones:

- **A conference edition.** One app run by a conference (the regional body over a group
  of Adventist churches) for its churches. It is one app for many churches at a smaller
  size, with a publisher that already exists and already answers for those churches.
- **One helper, many copies.** Each church keeps its own app, and one experienced
  volunteer carries several churches through the store accounts and signing. The
  volunteer is shared; the accounts aren't.
- **The web app first.** A church can run its own copy as a website, which opens in a
  phone's browser and needs no store accounts. Today that takes someone who can edit
  code and publish it by hand
  ([Development setup](README.md#web-builds-and-the-website)); once the
  church details are in one place, it should take about a day. It is a
  way to find out whether a church will keep its details up to date before anyone
  commits to more.

### What is undecided

- **Who would publish one app for many churches?** This church, a conference, or
  another body.
- **What would the shared app be called?** Today's app and listings carry this church's
  name.
- **Will the approvals stretch?** The church's use of the symbol, and the backup audio
  copies it hosts, were settled for one church. The answers come from the North
  American Division for the symbol and from each rights holder for the audio.
- **Does a second church want this?** Until one asks, every answer is a guess. The
  first real request should decide more than this page does.

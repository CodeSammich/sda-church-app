# Vision

Where the app is going, and what is still undecided. The
[project tenets](project-tenets.md) say how we choose; this page says what we're
choosing toward.

One question on this page is open on purpose:
[one copy of the app for each church, or one app for many churches](#one-church-to-many-two-ways).
Both are described here so the choice can be made with the facts in view.

## Contents

- [Who the app is for](#who-the-app-is-for)
- [What the app is](#what-the-app-is)
- [What the app isn't](#what-the-app-isnt)
- [Why it's open source](#why-its-open-source)
- [One church to many: two ways](#one-church-to-many-two-ways)
  - [What both ways share](#what-both-ways-share)
  - [How they compare](#how-they-compare)
  - [The bulletin under each](#the-bulletin-under-each)
  - [In between](#in-between)
  - [What is undecided, and what would settle it](#what-is-undecided-and-what-would-settle-it)
- [What comes first either way](#what-comes-first-either-way)
- [What we won't do](#what-we-wont-do)

## Who the app is for

The app was built for one church family in New York: three congregations, mostly
Chinese-speaking, many of them older. Its first users are the people least served by
ordinary apps:

- **Older members** who read Traditional or Simplified Chinese, use large text, and
  would rather not tap a small icon to find out what it does.
- **People who listen more than they read**, in Mandarin, Cantonese, English or
  Spanish, often on poor Wi-Fi or none.
- **Visitors** who found the church online and want to know where it is, when it
  meets, and what it believes, before they walk in.
- **The volunteers and staff** who prepare the Sabbath: the person who fills in the
  roster, the one who prints the bulletin, the deacon checking who is on duty.

A feature that helps none of these people doesn't belong, however good it is.

## What the app is

- **This Sabbath, in your pocket.** The bulletin, the hymns in it, the Bible reading,
  and how to get to church.
- **A Bible and a hymnal that work without a signal**, in the languages the church
  worships in, with audio and with the Chinese and English hymn numbers side by side.
- **A short shelf, chosen by people the members trust.** The Library
  [curates rather than collects](project-tenets.md#7-focused). It goes deep only where
  it can do so well, and links out for the rest.
- **Free to run and free to use.** No service the app uses can bill the church for
  usage; the only recurring cost is the domain
  ([Service limits and costs](operations/service-limits-and-costs.md#summary)).
- **Run by volunteers.** Everything a maintainer does by hand is written down in the
  [admin runbook](operations/admin-runbook.md), so the next volunteer can take over.

## What the app isn't

- **Not a social network.** It has no accounts, no feed, no comments, and nothing that
  [tracks who opened what](project-tenets.md#3-sanctuary).
- **Not a church management system.** It holds no membership list, attendance record,
  or giving history. Giving opens the church's existing giving page.
- **Not a full library.** Large collections already have good homes; the app points
  to them.
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

The license covers the code only. The church symbol, the church's photos, and several
audio and book permissions were given to this church and
[don't pass to anyone else](LEGAL_BRANDING.md). The details are in
[Legal, licensing, and privacy](LEGAL.md).

## One church to many: two ways

The long-term hope is that any small church can give its members what this church's
members have. There are two honest ways to get there, and **the project has not chosen
between them**.

- **A copy for each church.** Each church takes the code, fills in its own details, and
  publishes its own app under its own name, from its own store accounts. This is how
  the repository is arranged today (see
  [Building an independent fork](operations/native-builds.md#building-an-independent-fork)).
- **One app for many churches.** One app in each store. On first opening, a member
  chooses their church, and the app shows that church's bulletin, times, addresses and
  giving link. Everything shared, such as the Bible, the hymnals and the Library, is
  the same for everyone.

**Where the maintainers lean, as of November 2026:** one app for all churches, with a
step where a member chooses their church. The reasons are that one app is easier to
maintain, and that a small church with no IT volunteer could join without opening store
accounts or publishing anything. The picture is today's app and store listings gaining
a choice of church, not a new app.

That is a lean, not a decision. Both ways are compared below, and nothing may be built
yet that closes off the other one.

### What both ways share

Most of the work is the same under either:

- **Every fact about a church kept in one place.** Today the church's name, addresses,
  service times and contacts are spread across screens, web pages, the bulletin
  scripts and the tests ([the inventory](vision/church-specific-inventory.md) lists
  them). Under either way they have to become one set of church details that the rest
  of the app reads.
- **No assumptions about this church's shape.** The bulletin assumes two congregations
  by name, and one screen assumes three locations in a fixed order. A second church
  won't match.
- **Bible text and audio that any church can use.** The Bible's text and its audio in
  English, Mandarin, Cantonese and Spanish come from
  [HelloAO](operations/service-limits-and-costs.md#helloao) first, a free public
  source, so any church using the app gets them. HelloAO's copies of the Cantonese and
  Spanish recordings depend on an answer from the recordings' publisher that is still
  awaited ([#769](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/769)).
- **Rights that are honest about who they were given to.** The church symbol, the
  church's own photos and publications, and the fallback copies of the audio that this
  church hosts were approved for this church. Each needs an answer to "may another
  church use this?" before another church relies on it.
- **Each church keeps its own data.** The roster behind a bulletin holds names. It
  stays in that church's own accounts under both ways.

The only real difference in the code is *when* a church's details are read: when a
church's copy of the app is built, or when a member picks their church. If the church
details are designed as plain data from the start, that difference stays small, and the
choice can be made late.

### How they compare

| Question | A copy for each church | One app for many churches |
| --- | --- | --- |
| What must a church do to start? | Open store accounts as an organization, get signing files, and publish. The accounts and paperwork take weeks and stop most small churches ([starter kit](vision/another-church-starter-kit.md)). | Send in its details, and set up a bulletin if it wants one. No store accounts. |
| What does it cost a church? | Its own store fees and domain. | Nothing. |
| Who publishes the app and answers to the stores? | Each church, for its own app. | One publisher, for every church in the app. Who that would be is open. |
| Whose name and icon do members see? | Their own church's. | One shared name; their church appears inside. |
| How do updates reach members? | Each church takes each update and releases it. A church without a volunteer falls behind. | One release reaches every church. |
| What happens if a church's volunteer leaves? | Its app stops being updated, and may leave the store when a yearly renewal is missed. | Its details go out of date, but the app keeps working. |
| What happens if the publisher stops? | The other churches aren't affected. | Every church is affected at once. |
| Who decides what content a church shows? | Each church, fully. | Each church, within what the shared app offers. |
| Where does Bible audio come from? | HelloAO, the same for every church. A church that wants its own fallback copies hosts them itself. | HelloAO, the same for every church. This church's fallback copies were approved for this church; using them for every church needs the rights holders' agreement. |
| Who may use the church symbol? | Each official church, with its own approval. | Approval must cover an app that serves many churches. |
| How much new code? | Less. A copy can delete what its church doesn't need. | More. The app must handle any number of locations, a way to choose a church, and each church's own languages and hymnals. |
| What about a member visiting another church? | They install that church's app. | They switch churches inside the app. |
| What does a bad release break? | One church's app. | Every church's app. |

Three things follow from the table.

**A copy for each church spreads the paperwork. One app spreads the responsibility.**
The store accounts are the hard part of a copy for each church, and nothing in the
code can remove them. One app removes them for everyone except the publisher, who then
answers for every church's content.

**One app must still keep every tenet.** The first three tenets are that the app is
[free to run](project-tenets.md#1-sustainable), brings
[no legal risk](project-tenets.md#2-liability-free), and
[collects nothing about members](project-tenets.md#3-sanctuary). So one app for many
churches could not have a shared server holding churches' data, or accounts. Each
church's public details would be a plain file that ships inside the app or is fetched
from a free static host. The choice of church would be kept only on the phone, like
the language setting.

**The choice of church must be easy.** For an older member, "choose your church" is
one more screen that can go wrong. It has to be asked once, in their language, and
[understood in seconds](project-tenets.md#5-simplicity).

### The bulletin under each

The bulletin is what makes the app a church's own, and it is the part that costs the
most to keep going: someone has to fill in the roster every week.

Under both ways, **each church's bulletin must be deployed from that church's own
Google account**. The bulletin is a Google Apps Script web app that runs as the account
that deployed it, and Google allows that account 30 executions at once. Every request
from every phone counts against it
([Bulletin API](operations/service-limits-and-costs.md#bulletin-api-apps-script)).
One church family uses a small part of that. Several churches deployed from one
account would share it.

- **A copy for each church** gets this right without trying. Each church sets up its
  own bulletin and builds its address into its own app.
- **One app for many churches** has to hold to it on purpose. The app would keep a
  list of bulletin addresses, one for each church, each deployed from that church's
  account. One shared bulletin for every church would need something other than a
  single Apps Script deployment.

Under both, account ownership has to be settled on the first day. A bulletin's address
is built into the app, so moving a church's bulletin to another account later takes an
app release, and older versions of the app keep asking the old address.

### In between

The two ways aren't the only ones:

- **A conference edition.** One copy of the app run by a conference for its churches.
  It is one app for many churches at a smaller size, with a publisher that already
  exists and already answers for those churches.
- **One helper, many copies.** Each church keeps its own app, and one experienced
  volunteer carries several churches through the store accounts and signing. The
  volunteer is shared; the accounts aren't.
- **The web app first.** Any church can run its own copy as a website today, with no
  store accounts. It is a way to find out whether a church will keep its details up to
  date before anyone commits to more.

### What is undecided, and what would settle it

- **Who would publish one app for many churches?** This church, a conference, or
  another body. The publisher answers to Apple and Google for everything in the app.
- **What would the shared app be called?** The lean is today's app and store listings
  gaining a choice of church. They carry this church's name today.
- **Will the approvals stretch?** The church symbol, and the fallback audio copies this
  church hosts, were approved for one church.
- **Does a second church want this?** Until one asks, every answer is a guess. The
  first real request should decide more than this page does.

## What comes first either way

These help under both ways, and help this church today:

1. Put every fact about the church in one place, and have the app, the web pages, the
   printed bulletin and the tests read it.
2. Make the app and the printed bulletin agree on addresses and service times, from
   one source.
3. Stop assuming three locations and two named congregations.
4. For each permission given to this church, write down whether another church may rely
   on it, and ask where the answer is unknown.

The steps a church would follow under each way, and the follow-up work proposed for
each, are in the [starter kit](vision/another-church-starter-kit.md).

## What we won't do

Whichever way is chosen:

- **No paid tiers, ads, or in-app purchases.** The app stays free
  ([App stores](architecture.md#app-stores)).
- **No member accounts and no tracking.**
- **No shared server holding churches' rosters or members' details.**
- **No service that can send a bill for usage**
  ([Governance principles](architecture.md#governance-principles)).
- **No promise the code can't keep.** This page is updated when the answer to the
  open question changes.

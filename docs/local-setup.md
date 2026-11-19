# Running SimbaCasa on your own computer

A step-by-step guide for trying the site locally: on your computer, and on your
phone over Wi-Fi. No programming needed to follow it. It takes about 20 minutes
the first time, and a minute every time after that.

You'll need a Mac (these steps are for macOS) and two things from Ezequiel:

- **Access to the code on GitHub**: an invitation to the `simbacasa/app`
  repository. Accept it from the email GitHub sends you.
- **A file called `.env.local`**: the site's settings and keys (database, photo
  storage). He'll send it to you privately. It's like a set of passwords:
  don't share it, post it or put it anywhere public.

---

## 1. Install the tools (once)

Open the **Terminal** app (press ⌘ Space, type "Terminal", press Enter). You'll
paste the commands below into it, one at a time, pressing Enter after each.

**Git**, to download the code. Check if you already have it:

```bash
git --version
```

If it prints a version number, you're set. If a window asks to install the
"command line developer tools", click **Install** and wait for it to finish.

**Node.js**, which runs the site. Download the **LTS** version from
[nodejs.org](https://nodejs.org) and install it like any other app. Then check:

```bash
node --version
```

It should print `v22` or higher.

## 2. Download the code (once)

This puts the code in a folder called `simbacasa` inside your Documents:

```bash
cd ~/Documents
git clone https://github.com/simbacasa/app.git simbacasa
cd simbacasa
git switch feature/ux
```

The first time, GitHub may ask you to sign in. Follow what it shows.

`feature/ux` is the branch (a working copy of the code) for trying design and
usability changes, separate from what's live.

## 3. Add the settings file (once)

Put the `.env.local` file Ezequiel sent you inside the `simbacasa` folder (in
Documents). Its name starts with a dot, so Finder hides it; that's normal. To
check it's in the right place:

```bash
ls -a | grep env.local
```

It should print `.env.local`.

## 4. Install and start the site

Install what the site needs (once, and again whenever you get new code, see
step 7):

```bash
npm install
```

Start it:

```bash
npm run dev
```

When it prints **Ready**, open [http://localhost:4000](http://localhost:4000)
in your browser. Leave the Terminal window open: the site only runs while it
does. To stop it, click the Terminal window and press **Ctrl C**.

## 5. Sign in as a test member

Go to **Sign in**. Under "Testing: sign in as a test member" you can be any of
these, no password needed:

| Member | What to try with them |
|---|---|
| **Anna** | Admin: approving people and ID checks under **Admin** |
| **Cleo** | A normal member with places up: Mark as taken, reviews |
| **Dara** | A member: posting, searching, asking for a contact |
| **Ben** | A member with no Telegram username: can't post or be contacted |
| **Finn** | Asked to join, waiting for approval |
| **Gil** | Signed in but hasn't asked to join yet |

Sign out from **Profile** to switch to someone else.

## 6. Try it on your phone

Your phone needs to be on the **same Wi-Fi** as your computer.

When you ran `npm run dev`, the Terminal printed two addresses:

```
- Local:    http://localhost:4000
- Network:  http://192.168.x.x:4000
```

Open the **Network** one on your phone. The first time, your Mac may ask
whether to allow incoming connections for "node": say **Allow**.

## 7. Get the latest changes

When Ezequiel tells you there's something new, stop the site (Ctrl C), then:

```bash
git pull
npm install
npm run dev
```

## Things to know

- **The data is the real one.** Your copy uses the same database as the
  published site. Anything you post, edit, approve or delete happens there too.
  That's fine for test members and sample places, but don't touch real people.
- **Never run `npm run db:seed`.** It deletes everything in the database and
  starts over with sample data, including on the published site.
- **The little "N" button** in the bottom corner, and any red "Issues" box,
  only appear on your own copy. They're developer tools; you can ignore them.
- **The Telegram bot and "Create with AI" are off** until their keys are set up,
  so no Telegram messages are sent.
- **Something looks wrong after a change?** Reload the page (⌘ R, or pull down
  on the phone). If that doesn't help, stop the site and start it again.

## If something doesn't work

| What you see | What to do |
|---|---|
| `command not found: npm` | Node.js isn't installed: go back to step 1 |
| `Port 4000 is in use` | The site is already running in another Terminal window. Use that one, or close it |
| The page says it can't connect | The site isn't running: `npm run dev` in the `simbacasa` folder |
| The phone can't open the Network address | Check it's on the same Wi-Fi, and that you allowed "node" on the Mac |
| Errors mentioning `DATABASE_URL` or `R2` | `.env.local` is missing or in the wrong folder: step 3 |

Anything else: copy what the Terminal says and send it to Ezequiel.

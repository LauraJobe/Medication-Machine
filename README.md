# MedStation Practice Simulator

A browser-based practice version of an automated medication dispensing cabinet, built so nursing students can rehearse **Pyxis-style** and **Omnicell-style** workflows before clinical. It runs on computers, tablets and phones, with no install and no accounts.

> Educational simulator. Workflows are modeled on published BD Pyxis™ MedStation™ ES job aids, a Pyxis MedStation 3000 training manual, and the Omnicell® Color Touch 22.5 user guide. This project is not affiliated with or endorsed by BD or Omnicell. All patients, orders and users are fictional. Do not enter real patient information.

## Signing in

- Type the user ID **student**, then sign in with a fingerprint: **touch and hold** the on-screen scanner (phones and tablets) or **click and hold** the mouse (computers) until the ring fills. Lifting early practices a failed scan. Nothing has to be registered.
- The password **nurse1** also works; the user ID and password are printed under each box.
- When a witness is needed (waste, controlled returns, discrepancies), **Kelly Jones, RN** walks up and signs with a fingerprint automatically — students never type anyone else's credentials.

Vital signs (pain, RR, HR, BP) are not entered at the cabinet; they are documented in the EMR, so the simulator never asks for them.

## Two cabinet types

Switch at the top of the **Practice Coach**. Patients, medications and scenarios are shared.

| | Pyxis mode | Omnicell mode (Color Touch 22.5 user guide) |
| --- | --- | --- |
| Log on | Touch screen → User ID → fingerprint (or password) | "Welcome! Please Enter:" User ID + fingerprint (hold about 2 s) or password |
| Home | My Patients / All Available Patients | Patient list: Global / Local / Partial Dose / My Patients tabs; Main Menu |
| Taking meds out | Patient → **Remove** → Due Now / PRN / All Orders | Patient → **Remove Meds** → Scheduled Meds / PRN Only / Active / Inactive / Stocked Meds → **Remove Now** |
| Controlled count | **Blind count** before removing | **Countback** (quantity remaining) after removing |
| Override | Override → reason at Remove Med | **Stocked Meds** tab → "Do you wish to override?" → reason |
| Waste | Waste Now / Waste Later | **Waste Partial Dose** or Close Bin → Partial Dose List → Waste Meds |
| Log off | Sign Out | **Exit** |

Counts in controlled-substance pockets are **random** every time, so students have to actually count.

**Real time.** The cabinet uses the device's real clock (shown large, with seconds, on the cabinet and in the coach). Scheduled doses are due at the hour nearest to when the student starts (on time within ±60 minutes), one dose is two hours past due, and later doses are hours ahead. Scenario and task text show the actual due time, and PRN intervals, "last removed" alerts and transaction times all use real minutes.

## Ways to practice (Practice Coach → Mode)

- **Practice mode: random tasks** — an endless stream of tasks: scheduled and PRN meds, controlled substances with count and waste, emergency overrides, returns, and **safety checks to refuse** (morphine for a patient allergic to it, a PRN requested too soon, a scheduled dose that was already removed). Filter by task type. Work is graded automatically when the removal or return finishes, with a *Task needs* vs *You did* table and the waste math. Buttons: **Can't give: hold and clarify**, **Show the answer**, **Skip**. Score, streak and best streak are kept.
- **Free practice** — no checklist; the **Event history** shows everything the cabinet recorded.
- **Guided scenarios** — checklist with progress bar, hints revealed one at a time, safety-error detection, and a debrief:
  1. Beginner — Remove a scheduled oral med (digoxin)
  2. Beginner — Several scheduled meds at once
  3. Intermediate — Controlled substance: remove + waste the partial dose (morphine 2 mg from a 4 mg/mL Carpuject)
  4. Intermediate — Nurse-prepared med order (cefTRIAXone vial + sterile water diluent)
  5. Advanced — Emergency override (naloxone), with a Name Alert

Also in free practice: returns, kits, temporary patients (Add Temporary Patient / Add New Patient), and discrepancy resolution.

## Phones and tablets

Large touch targets, no double-tap zoom, a bigger fingerprint scanner, full-width dialog buttons on phones, and **haptics** — short vibrations on taps, fingerprint scans, drawers opening and alerts (Android browsers; iPhone and iPad browsers do not allow vibration). Haptics can be turned off under **Coach → Settings**.

## Running it

It is a static site: open `index.html`, or serve the folder (`python3 -m http.server 8000`). To publish for a class, turn on **GitHub Pages** (Settings → Pages → Deploy from a branch → `main`, `/ (root)`).

Progress (score, streak, scenario results) is saved in each student's own browser. **Coach → Settings → Reset** clears it.

## Project layout

```
index.html       page shell
css/styles.css   cabinet and coach styling (responsive, light/dark page chrome)
js/data.js       formulary, fictional patients and orders, kits, scenarios, debriefs
js/app.js        screens, workflows, practice tasks, scenario engine
```

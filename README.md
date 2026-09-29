# MedStation Practice Simulator

A browser-based practice version of an automated medication dispensing cabinet, built so nursing students can rehearse **Pyxis-style** and **Omnicell-style** workflows before clinical. It runs on laptops, tablets and phones and needs no install, accounts or server.

> Educational simulator. Workflows are modeled on published BD Pyxis™ MedStation™ ES job aids, a Pyxis MedStation 3000 training manual, and common Omnicell® XT cabinet workflows. This project is not affiliated with or endorsed by BD or Omnicell. All patients, orders and users are fictional. Do not enter real patient information.

## Two cabinet types

Switch at the top of the **Practice Coach**. Patients, inventory and scenarios are shared, so students can practice the same task on both.

| | Pyxis mode | Omnicell mode |
| --- | --- | --- |
| Workflow order | Patient first, then Remove / Return / Waste / Override | Action first (Issue / Return / Waste from the main menu), then patient |
| Taking a medication out | **Remove** | **Issue** |
| Order tabs | Due Now · PRN · All Orders | Scheduled · PRN · All Orders |
| Waste left for later | Undocumented Waste | Pending Waste |
| Drawer terms | MiniDrawer, Matrix, CUBIE, pocket light | SinglePointe drawer, open matrix, lidded bin, Guiding Light |

The Omnicell mode follows general Omnicell XT conventions. Facility builds differ, so share your facility's Omnicell job aids to tune the wording.

## What students can practice

| Skill | What happens in the simulator |
| --- | --- |
| **Sign in** | Standby screen → User ID → password or **BioID**. First sign-in forces a password change (6–8 letters/numbers), as described in the training manual. |
| **BioID fingerprint** | Enroll with 3 scans on a simulated scanner (press and hold). Lifting early fails the scan; 3 failures fall back to password. On phones/laptops with a fingerprint reader or Face ID, students can also link the **device's real biometrics** (WebAuthn, stays on the device). |
| **My Patients / All Available Patients** | Build an assignment list. The list shows blue due-now dots, orange past-due bars, allergy and **Name Alert** flags (two patients named Thompson). |
| **Remove from profile** | Due Now / PRN / All Orders tabs, Selected Meds column, early-dose, double-dose and PRN "too soon" warnings. |
| **Clinical Data (CDC) prompts** | Apical pulse for digoxin, HR/BP for metoprolol, pain score and RR for opioids, blood glucose for insulin. Hold parameters trigger a hold warning. |
| **Range doses** | Enter the amount to administer; it must fall inside the ordered range. |
| **Override** | Striped override list, override reason, **Order Exists** warning, and an **allergy alert** (morphine for a morphine-allergic patient). |
| **Drawer / blind count** | Cabinet graphic lights the drawer and pocket. Controlled substances require a blind count of the items shown. Two mismatched counts create a discrepancy. |
| **Waste** | Waste Now or Waste Later with a witness who signs in with their own credentials. A reason is required when the amount differs from expected. Undocumented waste shows on the Home screen. |
| **Return** | Return unopened items to the return bin (witness required for controlled substances). |
| **Discrepancies** | Investigate recent transactions, recount, pick a reason, comment and have a witness co-sign. |
| **Global Find & Reports** | Locate any medication; activity report by current user or the whole device (copy or print). |

## Guided scenarios

The **Practice Coach** panel walks through 10 scenarios with step checklists, hints, safety-error detection and a copyable result for instructors:

1. Sign in & build My Patients
2. Remove a scheduled oral med (digoxin with apical pulse CDC)
3. Controlled substance: remove + Waste Now (morphine 2 mg from a 4 mg/mL Carpuject)
4. Range dose (HYDROmorphone 0.4 mg, waste 0.6 mg)
5. Emergency override (naloxone), with a Name Alert trap
6. Waste Later & resolve undocumented waste (LORazepam)
7. Return an unused controlled med (oxyCODONE)
8. Safety stop: allergy alert on override
9. Hold parameter: metoprolol (HR 54, SBP 98)
10. Blind count discrepancy (fentaNYL pocket is one short)

**Dosage-calculation challenge** (Coach → Settings) hides the calculated waste, so students must work out the amount and the volume (amount ÷ concentration) themselves.

## Practice accounts

| Role | User ID | Password |
| --- | --- | --- |
| Student | `student` | `123456` (temporary; changed at first sign-in) |
| Witness RN | `kjones` | `pyxis1` |
| Witness RN | `mlee` | `pyxis2` |

Students can also select **Create Practice User** to get their own ID (first initial + last name, e.g. `jsmith`, temporary password `123456`).

Progress is saved in the student's own browser (localStorage). **Coach → Settings → Reset** clears it.

## Running it

It is a static site: open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

To publish for a class, turn on **GitHub Pages** (repository **Settings → Pages → Deploy from a branch**, folder `/ (root)`). Device biometrics (fingerprint/Face ID) require HTTPS, which GitHub Pages provides.

## Project layout

```
index.html       page shell
css/styles.css   device and coach styling (responsive, light/dark page chrome)
js/data.js       formulary, fictional patients and orders, practice users, scenarios
js/app.js        screens, workflows, BioID, scenario engine
```

To add patients, medications or scenarios, edit `js/data.js`. Each scenario step has a `match` function that listens for events such as `removed`, `waste`, `returned`, `allergy_alert` or `signout`.

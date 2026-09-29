/* MedStation Practice Simulator — seed data.
 * All patients, orders and users are fictional and for education only. */

// Storage locations drawn on the cabinet graphic.
// type: MiniDrawer (single-dose, controlled), Matrix (open pockets), CUBIE (lidded), Fridge, Tower
const FORMULARY = {
  digoxin_tab:      { name: 'digoxin', brand: 'Lanoxin', strength: 0.125, unit: 'mg', form: 'tab', route: 'PO', loc: { drawer: 4, type: 'Matrix', pocket: 3 }, count: 24,
                      cdc: { fields: [{ key: 'hr', label: 'Apical pulse (beats/min) — count for 1 full minute', min: 20, max: 250 }],
                             hold: v => v.hr < 60 ? 'Apical pulse is below 60 bpm. Hold digoxin and notify the provider per protocol.' : null } },
  metoprolol_tab:   { name: 'metoprolol tartrate', brand: 'Lopressor', strength: 25, unit: 'mg', form: 'tab', route: 'PO', loc: { drawer: 4, type: 'Matrix', pocket: 7 }, count: 30,
                      cdc: { fields: [{ key: 'hr', label: 'Heart rate (beats/min)', min: 20, max: 250 }, { key: 'sbp', label: 'Systolic BP (mmHg)', min: 40, max: 260 }],
                             hold: v => (v.hr < 60 || v.sbp < 100) ? 'Hold parameters met (HR < 60 or SBP < 100). Hold metoprolol and notify the provider.' : null } },
  furosemide_inj:   { name: 'furosemide', brand: 'Lasix', strength: 40, unit: 'mg', volume: 4, form: 'vial', desc: '10 mg/mL, 4 mL vial', route: 'IV', loc: { drawer: 5, type: 'Matrix', pocket: 2 }, count: 12 },
  kcl_tab:          { name: 'potassium chloride ER', brand: 'K-Dur', strength: 20, unit: 'mEq', form: 'tab', route: 'PO', loc: { drawer: 4, type: 'Matrix', pocket: 9 }, count: 18 },
  apixaban_tab:     { name: 'apixaban', brand: 'Eliquis', strength: 5, unit: 'mg', form: 'tab', route: 'PO', loc: { drawer: 4, type: 'Matrix', pocket: 11 }, count: 14 },
  apap_tab:         { name: 'acetaminophen', brand: 'Tylenol', strength: 325, unit: 'mg', form: 'tab', route: 'PO', loc: { drawer: 3, type: 'Matrix', pocket: 1 }, count: 60, override: true },
  morphine_inj:     { name: 'morphine', brand: '', strength: 4, unit: 'mg', volume: 1, form: 'Carpuject', desc: '4 mg/mL, 1 mL Carpuject', route: 'IV', controlled: 'C-II', loc: { drawer: 1, type: 'MiniDrawer', pocket: 2 }, count: 10, override: true,
                      cdc: { fields: [{ key: 'pain', label: 'Current pain score (0–10)', min: 0, max: 10 }, { key: 'rr', label: 'Respiratory rate (breaths/min)', min: 0, max: 60 }],
                             hold: v => v.rr < 12 ? 'Respiratory rate is below 12. Hold the opioid, assess sedation, and notify the provider.' : null } },
  hydromorphone_inj:{ name: 'HYDROmorphone', brand: 'Dilaudid', strength: 1, unit: 'mg', volume: 1, form: 'Carpuject', desc: '1 mg/mL, 1 mL Carpuject', route: 'IV', controlled: 'C-II', loc: { drawer: 1, type: 'MiniDrawer', pocket: 4 }, count: 8, override: true,
                      cdc: { fields: [{ key: 'pain', label: 'Current pain score (0–10)', min: 0, max: 10 }, { key: 'rr', label: 'Respiratory rate (breaths/min)', min: 0, max: 60 }],
                             hold: v => v.rr < 12 ? 'Respiratory rate is below 12. Hold the opioid, assess sedation, and notify the provider.' : null } },
  oxycodone_tab:    { name: 'oxyCODONE', brand: 'Roxicodone', strength: 5, unit: 'mg', form: 'tab', route: 'PO', controlled: 'C-II', loc: { drawer: 1, type: 'MiniDrawer', pocket: 6 }, count: 15,
                      cdc: { fields: [{ key: 'pain', label: 'Current pain score (0–10)', min: 0, max: 10 }] } },
  fentanyl_inj:     { name: 'fentaNYL', brand: 'Sublimaze', strength: 100, unit: 'mcg', volume: 2, form: 'vial', desc: '50 mcg/mL, 2 mL vial', route: 'IV', controlled: 'C-II', loc: { drawer: 1, type: 'MiniDrawer', pocket: 8 }, count: 10, physicalOffset: -1,
                      cdc: { fields: [{ key: 'pain', label: 'Current pain score (0–10)', min: 0, max: 10 }, { key: 'rr', label: 'Respiratory rate (breaths/min)', min: 0, max: 60 }],
                             hold: v => v.rr < 12 ? 'Respiratory rate is below 12. Hold the opioid, assess sedation, and notify the provider.' : null } },
  lorazepam_inj:    { name: 'LORazepam', brand: 'Ativan', strength: 2, unit: 'mg', volume: 1, form: 'vial', desc: '2 mg/mL, 1 mL vial', route: 'IV', controlled: 'C-IV', loc: { drawer: 'F', type: 'Fridge', pocket: 2 }, count: 6, override: true },
  ondansetron_inj:  { name: 'ondansetron', brand: 'Zofran', strength: 4, unit: 'mg', volume: 2, form: 'vial', desc: '2 mg/mL, 2 mL vial', route: 'IV', loc: { drawer: 5, type: 'Matrix', pocket: 5 }, count: 20, override: true },
  enoxaparin_40:    { name: 'enoxaparin', brand: 'Lovenox', strength: 40, unit: 'mg', volume: 0.4, form: 'syringe', desc: '40 mg/0.4 mL prefilled syringe', route: 'subcut', loc: { drawer: 6, type: 'CUBIE', pocket: 'A3' }, count: 10 },
  enoxaparin_30:    { name: 'enoxaparin', brand: 'Lovenox', strength: 30, unit: 'mg', volume: 0.3, form: 'syringe', desc: '30 mg/0.3 mL prefilled syringe', route: 'subcut', loc: { drawer: 6, type: 'CUBIE', pocket: 'A4' }, count: 10 },
  docusate_cap:     { name: 'docusate sodium', brand: 'Colace', strength: 100, unit: 'mg', form: 'cap', route: 'PO', loc: { drawer: 3, type: 'Matrix', pocket: 4 }, count: 40 },
  pantoprazole_tab: { name: 'pantoprazole', brand: 'Protonix', strength: 40, unit: 'mg', form: 'tab', route: 'PO', loc: { drawer: 3, type: 'Matrix', pocket: 6 }, count: 20 },
  senna_tab:        { name: 'sennosides', brand: 'Senokot', strength: 8.6, unit: 'mg', form: 'tab', route: 'PO', loc: { drawer: 3, type: 'Matrix', pocket: 8 }, count: 40 },
  lispro_pen:       { name: 'insulin lispro', brand: 'HumaLOG', strength: 300, unit: 'units', volume: 3, form: 'pen', desc: '100 units/mL, 3 mL pen (patient-specific)', route: 'subcut', loc: { drawer: 'F', type: 'Fridge', pocket: 4 }, count: 5, noSplit: true,
                      cdc: { fields: [{ key: 'bg', label: 'Point-of-care blood glucose (mg/dL)', min: 10, max: 900 }],
                             hold: v => v.bg < 70 ? 'Blood glucose is below 70 mg/dL. Do NOT give insulin — initiate the hypoglycemia protocol.' : null } },
  glargine_pen:     { name: 'insulin glargine', brand: 'Lantus', strength: 300, unit: 'units', volume: 3, form: 'pen', desc: '100 units/mL, 3 mL pen (patient-specific)', route: 'subcut', loc: { drawer: 'F', type: 'Fridge', pocket: 5 }, count: 5, noSplit: true },
  ceftriaxone_inj:  { name: 'cefTRIAXone', brand: 'Rocephin', strength: 1, unit: 'g', form: 'vial', desc: '1 g vial (reconstitute)', route: 'IV', loc: { drawer: 5, type: 'Matrix', pocket: 8 }, count: 8 },
  azithromycin_inj: { name: 'azithromycin', brand: 'Zithromax', strength: 500, unit: 'mg', form: 'vial', desc: '500 mg vial (reconstitute)', route: 'IV', loc: { drawer: 5, type: 'Matrix', pocket: 9 }, count: 6 },
  cefazolin_inj:    { name: 'ceFAZolin', brand: 'Ancef', strength: 2, unit: 'g', form: 'vial', desc: '2 g vial (reconstitute)', route: 'IV', loc: { drawer: 5, type: 'Matrix', pocket: 11 }, count: 8 },
  albuterol_neb:    { name: 'albuterol', brand: 'Ventolin', strength: 2.5, unit: 'mg', volume: 3, form: 'neb', desc: '2.5 mg/3 mL nebulizer vial', route: 'inhalation', loc: { drawer: 2, type: 'CUBIE', pocket: 'B1' }, count: 25, override: true },
  naloxone_inj:     { name: 'naloxone', brand: 'Narcan', strength: 0.4, unit: 'mg', volume: 1, form: 'vial', desc: '0.4 mg/mL, 1 mL vial', route: 'IV', loc: { drawer: 2, type: 'CUBIE', pocket: 'A1' }, count: 10, override: true },
  dextrose50_inj:   { name: 'dextrose 50%', brand: '', strength: 25, unit: 'g', volume: 50, form: 'syringe', desc: '25 g/50 mL Abboject syringe', route: 'IV', loc: { drawer: 2, type: 'CUBIE', pocket: 'A2' }, count: 6, override: true },
  glucagon_inj:     { name: 'glucagon', brand: 'GlucaGen', strength: 1, unit: 'mg', form: 'kit', desc: '1 mg emergency kit', route: 'IM', loc: { drawer: 2, type: 'CUBIE', pocket: 'A3' }, count: 4, override: true },
  epinephrine_inj:  { name: 'EPINEPHrine', brand: '', strength: 1, unit: 'mg', volume: 1, form: 'vial', desc: '1 mg/mL (1:1,000), 1 mL vial', route: 'IM', loc: { drawer: 2, type: 'CUBIE', pocket: 'A4' }, count: 6, override: true },
  diphenhydramine_inj: { name: 'diphenhydrAMINE', brand: 'Benadryl', strength: 50, unit: 'mg', volume: 1, form: 'vial', desc: '50 mg/mL, 1 mL vial', route: 'IV', loc: { drawer: 2, type: 'CUBIE', pocket: 'B2' }, count: 10, override: true },
  nitroglycerin_sl: { name: 'nitroglycerin SL', brand: 'Nitrostat', strength: 0.4, unit: 'mg', form: 'tab', route: 'SL', loc: { drawer: 2, type: 'CUBIE', pocket: 'B3' }, count: 25, override: true },
};

const ALLERGY_CLASSES = {
  morphine: ['morphine_inj'],
  codeine: [],
  penicillin: [],
  sulfa: [],
  latex: [],
};

// dueIn = minutes from shift start (negative = past due). Scheduled orders only.
const PATIENTS = [
  { id: 'P1', last: 'Jenkins', first: 'Harold', mi: 'M', sex: 'M', dob: '1954-03-14', mrn: '4012245', room: '412-A',
    allergies: [{ agent: 'Penicillin', reaction: 'rash', key: 'penicillin' }], dx: 'CHF exacerbation, atrial fibrillation', provider: 'Dr. A. Patel',
    orders: [
      { id: 'o101', med: 'digoxin_tab', dose: 0.125, freq: 'daily', dueIn: 15 },
      { id: 'o102', med: 'metoprolol_tab', dose: 25, freq: 'BID', dueIn: 15 },
      { id: 'o103', med: 'furosemide_inj', dose: 40, freq: 'BID', dueIn: 15 },
      { id: 'o104', med: 'kcl_tab', dose: 20, freq: 'daily', dueIn: 15 },
      { id: 'o105', med: 'apixaban_tab', dose: 5, freq: 'BID', dueIn: 15 },
      { id: 'o106', med: 'apap_tab', dose: 650, freq: 'q6h', prn: 'mild pain or temp > 38.3 °C' },
      { id: 'o107', med: 'morphine_inj', dose: 2, freq: 'q4h', prn: 'severe pain (7–10)' },
      { id: 'o108', med: 'ondansetron_inj', dose: 4, freq: 'q6h', prn: 'nausea/vomiting' },
    ] },
  { id: 'P2', last: 'Delgado', first: 'Maria', mi: 'E', sex: 'F', dob: '1981-07-02', mrn: '4019871', room: '415-B',
    allergies: [{ agent: 'Sulfa', reaction: 'hives', key: 'sulfa' }, { agent: 'Codeine', reaction: 'nausea/vomiting', key: 'codeine' }], dx: 'POD 1 laparoscopic cholecystectomy', provider: 'Dr. S. Morgan',
    orders: [
      { id: 'o201', med: 'hydromorphone_inj', doseMin: 0.2, doseMax: 0.6, freq: 'q2h', prn: 'severe pain (7–10)' },
      { id: 'o202', med: 'oxycodone_tab', doseMin: 5, doseMax: 10, freq: 'q4h', prn: 'moderate pain (4–6)' },
      { id: 'o203', med: 'ondansetron_inj', dose: 4, freq: 'q6h', prn: 'nausea/vomiting' },
      { id: 'o204', med: 'enoxaparin_40', dose: 40, freq: 'daily', dueIn: -40 },
      { id: 'o205', med: 'docusate_cap', dose: 100, freq: 'BID', dueIn: 15 },
      { id: 'o206', med: 'pantoprazole_tab', dose: 40, freq: 'daily before breakfast', dueIn: 15 },
    ] },
  { id: 'P3', last: 'Carter', first: 'Evelyn', mi: 'R', sex: 'F', dob: '1958-11-23', mrn: '4020334', room: '418-A',
    allergies: [], dx: 'Community-acquired pneumonia, type 2 diabetes', provider: 'Dr. A. Patel',
    orders: [
      { id: 'o301', med: 'ceftriaxone_inj', dose: 1, freq: 'daily', dueIn: 15 },
      { id: 'o302', med: 'azithromycin_inj', dose: 500, freq: 'daily', dueIn: 240 },
      { id: 'o303', med: 'lispro_pen', doseMin: 0, doseMax: 10, freq: 'AC & HS per sliding scale', dueIn: 15 },
      { id: 'o304', med: 'glargine_pen', dose: 20, freq: 'at bedtime', dueIn: 720 },
      { id: 'o305', med: 'lorazepam_inj', dose: 0.5, freq: 'q6h', prn: 'anxiety' },
      { id: 'o306', med: 'albuterol_neb', dose: 2.5, freq: 'q4h', prn: 'wheezing/shortness of breath' },
      { id: 'o307', med: 'apap_tab', dose: 650, freq: 'q6h', prn: 'mild pain or temp > 38.3 °C' },
    ] },
  { id: 'P4', last: 'Thompson', first: 'Robert', mi: 'L', sex: 'M', dob: '1968-05-09', mrn: '4021756', room: '420-A', nameAlert: true,
    allergies: [{ agent: 'Morphine', reaction: 'hives, pruritus', key: 'morphine' }, { agent: 'Latex', reaction: 'contact dermatitis', key: 'latex' }], dx: 'POD 0 right total knee arthroplasty', provider: 'Dr. K. Brennan',
    orders: [
      { id: 'o401', med: 'fentanyl_inj', dose: 25, freq: 'q1h', prn: 'severe pain (7–10)' },
      { id: 'o402', med: 'oxycodone_tab', dose: 5, freq: 'q4h', prn: 'moderate pain (4–6)' },
      { id: 'o403', med: 'cefazolin_inj', dose: 2, freq: 'q8h', dueIn: 15 },
      { id: 'o404', med: 'enoxaparin_30', dose: 30, freq: 'q12h', dueIn: 15 },
      { id: 'o405', med: 'apap_tab', dose: 650, freq: 'q6h', dueIn: 15 },
      { id: 'o406', med: 'senna_tab', dose: 8.6, freq: 'at bedtime', dueIn: 720 },
    ] },
  { id: 'P5', last: 'Thompson', first: 'Roberta', mi: 'A', sex: 'F', dob: '1945-01-30', mrn: '4017702', room: '406-B', nameAlert: true,
    allergies: [], dx: 'Left hip fracture, dementia', provider: 'Dr. K. Brennan',
    orders: [
      { id: 'o501', med: 'hydromorphone_inj', dose: 0.2, freq: 'q3h', prn: 'severe pain (7–10)' },
      { id: 'o502', med: 'apap_tab', dose: 650, freq: 'q6h', dueIn: 15 },
      { id: 'o503', med: 'enoxaparin_40', dose: 40, freq: 'daily', dueIn: 240 },
      { id: 'o504', med: 'docusate_cap', dose: 100, freq: 'BID', dueIn: 15 },
    ] },
];

// Practice accounts. The student account starts with the pharmacy-issued temporary password.
const USERS = {
  student: { id: 'student', first: 'Nursing', last: 'Student', title: 'SN', password: '123456', mustChange: true },
  kjones:  { id: 'kjones',  first: 'Kelly',   last: 'Jones',   title: 'RN', password: 'pyxis1', witness: true, bioid: true },
  mlee:    { id: 'mlee',    first: 'Marcus',  last: 'Lee',     title: 'RN', password: 'pyxis2', witness: true, bioid: true },
};

const OVERRIDE_REASONS = [
  'Emergency / rapid response / code',
  'STAT order — not yet verified by pharmacy',
  'Pharmacy closed (after hours)',
  'Verbal order — provider at bedside',
];

const WASTE_SHORT_REASONS = [
  'Patient required more than initially planned (titrated)',
  'Waste amount previously documented in error',
  'Dose drawn up but patient refused',
  'Medication dropped / contaminated',
];

const DISCREPANCY_REASONS = [
  'Typo / miscount by me during blind count',
  'Previous user miscounted and did not correct inventory',
  'Previous user removed more or less than ordered (verified on MAR)',
  'Medication found (e.g., in return bin or wrong pocket)',
  'Unable to determine — incident report filed & charge nurse notified',
];

/* Guided practice scenarios.
 * Each step has a matcher on emitted events. `patient` is the correct patient for
 * wrong-patient error checks. */
const SCENARIOS = [
  { id: 's1', title: 'Sign in & build My Patients', level: 'Beginner',
    brief: 'You are starting day shift on 4 West Med-Surg. Your assignment is <b>Harold Jenkins (412-A)</b> and <b>Maria Delgado (415-B)</b>. Sign in for the first time with the temporary password from pharmacy, set a new password, and add your two patients to your <b>My Patients</b> list.',
    steps: [
      { text: 'Sign in as <code>student</code> (temporary password <code>123456</code>) and create a new password', hint: 'Tap the screen, enter User ID student, then password 123456. You will be asked to change it (6–8 letters/numbers).', match: e => e.type === 'signin' },
      { text: 'Open <b>My Patients</b> and add Jenkins and Delgado, then Accept', hint: 'Home → My Patients → Edit. Tap each patient on the left to add them. Tap Accept.', match: e => e.type === 'mypatients_saved' && e.ids.includes('P1') && e.ids.includes('P2') },
      { text: 'Sign out of the MedStation', hint: 'Always sign out when you walk away — use Sign Out in the top-right corner.', match: e => e.type === 'signout' },
    ] },
  { id: 's2', title: 'Remove a scheduled oral med (profiled)', level: 'Beginner', patient: 'P1',
    brief: 'It is time for <b>Harold Jenkins\'</b> 0900 medications. You assessed his <b>apical pulse: 72 bpm</b> for a full minute. Remove his scheduled <b>digoxin 0.125 mg PO</b> from his medication profile.',
    steps: [
      { text: 'Sign in', match: e => e.type === 'signin' },
      { text: 'Select Harold Jenkins and choose <b>Remove</b>', hint: 'My Patients or All Available Patients → tap Jenkins → Remove.', match: e => e.type === 'patient_action' && e.patient === 'P1' && e.action === 'remove' },
      { text: 'Answer the Clinical Data prompt (apical pulse 72)', hint: 'The CDC appears when you remove digoxin. Enter the pulse you assessed.', match: e => e.type === 'cdc' && e.med === 'digoxin_tab' && !e.held },
      { text: 'Remove digoxin 0.125 mg (1 tab) and close the drawer', match: e => e.type === 'removed' && e.med === 'digoxin_tab' && e.patient === 'P1' },
      { text: 'Sign out', match: e => e.type === 'signout' },
    ] },
  { id: 's3', title: 'Controlled substance: remove + Waste Now', level: 'Intermediate', patient: 'P1',
    brief: '<b>Harold Jenkins</b> reports <b>pain 8/10</b>, RR 18. He has an order for <b>morphine 2 mg IV q4h PRN severe pain</b>. The unit stocks morphine <b>4 mg/1 mL</b> Carpujects. Remove the dose, perform the blind count, and document the waste with a witness (practice witness: <code>kjones</code> / <code>pyxis1</code>).',
    steps: [
      { text: 'Sign in and open Jenkins → <b>Remove</b>', match: e => e.type === 'patient_action' && e.patient === 'P1' && e.action === 'remove' },
      { text: 'Select morphine 2 mg from the <b>PRN</b> tab and complete the CDC', match: e => e.type === 'cdc' && e.med === 'morphine_inj' && !e.held },
      { text: 'Perform an accurate <b>blind count</b> of the MiniDrawer pocket', hint: 'Count the Carpujects you see in the open pocket BEFORE removing one.', match: e => e.type === 'count' && e.med === 'morphine_inj' && e.correct },
      { text: 'Remove 1 Carpuject (4 mg)', match: e => e.type === 'removed' && e.med === 'morphine_inj' && e.patient === 'P1' },
      { text: 'Choose <b>Waste Now</b> and waste <b>2 mg (0.5 mL)</b> with a witness', hint: '4 mg removed − 2 mg dose = 2 mg waste. 2 mg ÷ 4 mg/mL = 0.5 mL.', match: e => e.type === 'waste' && e.med === 'morphine_inj' && Math.abs(e.amount - 2) < 0.001 },
      { text: 'Sign out', match: e => e.type === 'signout' },
    ] },
  { id: 's4', title: 'Range dose (HYDROmorphone) + waste', level: 'Intermediate', patient: 'P2',
    brief: '<b>Maria Delgado</b> rates her pain <b>7/10</b>, RR 16. Order: <b>HYDROmorphone 0.2–0.6 mg IV q2h PRN severe pain</b>. Using the unit titration guideline you decide to give <b>0.4 mg</b>. Stock is <b>1 mg/1 mL</b>. Remove the range dose and waste the remainder.',
    steps: [
      { text: 'Open Delgado → <b>Remove</b> → HYDROmorphone', match: e => e.type === 'patient_action' && e.patient === 'P2' && e.action === 'remove' },
      { text: 'Enter the amount to <b>administer</b>: 0.4 mg', hint: 'Range doses ask for the amount you will ADMINISTER, which must fall inside the ordered range.', match: e => e.type === 'dose_entered' && e.med === 'hydromorphone_inj' && Math.abs(e.dose - 0.4) < 0.001 },
      { text: 'Blind count and remove 1 Carpuject', match: e => e.type === 'removed' && e.med === 'hydromorphone_inj' && e.patient === 'P2' },
      { text: 'Waste <b>0.6 mg (0.6 mL)</b> with a witness', hint: '1 mg removed − 0.4 mg given = 0.6 mg. At 1 mg/mL that is 0.6 mL.', match: e => e.type === 'waste' && e.med === 'hydromorphone_inj' && Math.abs(e.amount - 0.6) < 0.001 },
      { text: 'Sign out', match: e => e.type === 'signout' },
    ] },
  { id: 's5', title: 'Emergency override (naloxone)', level: 'Advanced', patient: 'P4',
    brief: 'Rapid response! <b>Robert Thompson (420-A)</b>, POD 0 knee replacement, received fentanyl. He is now <b>RR 7, SpO₂ 86%, pinpoint pupils</b>, and arousable only to sternal rub. The provider gives a verbal order: <b>naloxone 0.4 mg IV now</b>. Pharmacy has not verified it. Remove on <b>Override</b>. <i>Watch for the Name Alert — there are two Thompsons on the unit!</i>',
    steps: [
      { text: 'Select the <b>correct</b> Thompson (Robert, 420-A) and choose <b>Override</b>', hint: 'Verify two identifiers: name + DOB or MRN. Roberta Thompson in 406-B is a different patient.', match: e => e.type === 'patient_action' && e.patient === 'P4' && e.action === 'override' },
      { text: 'Select <b>naloxone</b> and enter 0.4 mg', match: e => e.type === 'dose_entered' && e.med === 'naloxone_inj' && Math.abs(e.dose - 0.4) < 0.001 },
      { text: 'Choose an override reason', hint: 'Emergency / rapid response is the appropriate reason.', match: e => e.type === 'override_reason' },
      { text: 'Remove naloxone from the drawer', match: e => e.type === 'removed' && e.med === 'naloxone_inj' && e.patient === 'P4' && e.override },
      { text: 'Sign out', match: e => e.type === 'signout' },
    ] },
  { id: 's6', title: 'Waste Later & resolve undocumented waste', level: 'Intermediate', patient: 'P3',
    brief: '<b>Evelyn Carter</b> is anxious and requesting her PRN. Order: <b>LORazepam 0.5 mg IV q6h PRN anxiety</b>. Stock is <b>2 mg/1 mL</b> (refrigerated). No witness is available right now, so choose <b>Waste Later</b>. After you give the dose, come back and <b>resolve the undocumented waste</b> with a witness.',
    steps: [
      { text: 'Remove LORazepam 0.5 mg for Carter', match: e => e.type === 'removed' && e.med === 'lorazepam_inj' && e.patient === 'P3' },
      { text: 'Choose <b>Waste Later</b>', match: e => e.type === 'waste_later' && e.med === 'lorazepam_inj' },
      { text: 'From Home, open <b>Undocumented Waste</b> (or Carter → Waste) and waste <b>1.5 mg (0.75 mL)</b> with a witness', hint: '2 mg − 0.5 mg = 1.5 mg. 1.5 mg ÷ 2 mg/mL = 0.75 mL.', match: e => e.type === 'waste' && e.med === 'lorazepam_inj' && Math.abs(e.amount - 1.5) < 0.001 },
      { text: 'Sign out', match: e => e.type === 'signout' },
    ] },
  { id: 's7', title: 'Return an unused controlled med', level: 'Intermediate', patient: 'P2',
    brief: '<b>Maria Delgado</b> reports pain 5/10 and asks for an oral pain pill. Order: <b>oxyCODONE 5–10 mg PO q4h PRN moderate pain</b>. Remove <b>5 mg</b>. When you reach the bedside she says the pain has eased and <b>declines</b> the dose. The package is <b>unopened</b> — return it with a witness.',
    steps: [
      { text: 'Remove oxyCODONE 5 mg for Delgado', match: e => e.type === 'removed' && e.med === 'oxycodone_tab' && e.patient === 'P2' },
      { text: 'Select Delgado → <b>Return</b>', match: e => e.type === 'patient_action' && e.patient === 'P2' && e.action === 'return' },
      { text: 'Return the unopened tablet to the return bin with a witness', match: e => e.type === 'returned' && e.med === 'oxycodone_tab' },
      { text: 'Sign out', match: e => e.type === 'signout' },
    ] },
  { id: 's8', title: 'Safety stop: allergy alert on override', level: 'Advanced', patient: 'P4',
    brief: 'A covering provider in the hallway asks you to "just grab <b>morphine 2 mg IV</b>" for <b>Robert Thompson (420-A)</b> using override. Attempt the override and respond appropriately to what the MedStation tells you.',
    steps: [
      { text: 'Open Robert Thompson → <b>Override</b> and select morphine', match: e => e.type === 'allergy_alert' && e.patient === 'P4' },
      { text: 'Recognize the allergy and <b>cancel</b> the removal', hint: 'Robert Thompson is allergic to morphine (hives). Cancel and clarify the order with the provider.', match: e => e.type === 'allergy_alert' && e.patient === 'P4' && e.action === 'cancel' },
      { text: 'Sign out', match: e => e.type === 'signout' },
    ],
    errorRules: [{ match: e => e.type === 'allergy_alert' && e.action === 'proceed', msg: 'Proceeded past an allergy alert for a documented allergy.' }] },
  { id: 's9', title: 'Hold parameter: metoprolol', level: 'Intermediate', patient: 'P1',
    brief: 'Before <b>Harold Jenkins\'</b> 0900 <b>metoprolol tartrate 25 mg PO</b>, you assess <b>HR 54</b>, <b>BP 98/60</b>. Go to remove the dose and respond to the Clinical Data prompt appropriately.',
    steps: [
      { text: 'Open Jenkins → Remove → metoprolol', match: e => e.type === 'cdc_shown' && e.med === 'metoprolol_tab' },
      { text: 'Enter HR 54 and SBP 98 in the Clinical Data prompt', match: e => e.type === 'cdc' && e.med === 'metoprolol_tab' && e.held },
      { text: 'Hold the medication — <b>cancel</b> the removal', match: e => e.type === 'hold_cancel' && e.med === 'metoprolol_tab' },
      { text: 'Sign out', match: e => e.type === 'signout' },
    ],
    errorRules: [{ match: e => e.type === 'removed' && e.med === 'metoprolol_tab', msg: 'Removed metoprolol even though hold parameters were met.' }] },
  { id: 's10', title: 'Blind count discrepancy', level: 'Advanced',
    brief: '<b>Robert Thompson</b> reports pain 8/10, RR 16. Order: <b>fentaNYL 25 mcg IV q1h PRN</b>. Stock is <b>100 mcg/2 mL</b>. Count the MiniDrawer pocket carefully — <i>the physical count may not match what the system expects</i>. Complete the removal, waste 75 mcg, then <b>resolve the discrepancy</b> with a witness.',
    patient: 'P4',
    steps: [
      { text: 'Remove fentaNYL 25 mcg for Robert Thompson (count accurately)', match: e => e.type === 'removed' && e.med === 'fentanyl_inj' && e.patient === 'P4' },
      { text: 'Waste <b>75 mcg (1.5 mL)</b> with a witness', match: e => e.type === 'waste' && e.med === 'fentanyl_inj' && Math.abs(e.amount - 75) < 0.001 },
      { text: 'From Home, open <b>Discrepancies</b> and resolve with a recount, reason and witness', hint: 'You counted correctly — the previous user miscounted. Recount, pick the matching reason, add a comment, and have your witness co-sign.', match: e => e.type === 'discrepancy_resolved' },
      { text: 'Sign out', match: e => e.type === 'signout' },
    ] },
];

/* Cabinet profiles. Pyxis is patient-first (pick the patient, then Remove/Return/Waste).
 * Omnicell is action-first (pick Issue/Return/Waste, then the patient) and uses its own terms. */
const DEVICES = {
  pyxis: {
    key: 'pyxis', name: 'MedStation', model: 'Pyxis-style MedStation ES', station: '4W-MAIN', actionFirst: false,
    L: { remove: 'Remove', removeMed: 'Remove Med', removeMeds: 'Remove Meds', removing: 'Remove Medications', selected: 'Selected Meds', allPts: 'All Available Patients',
         undoc: 'Undocumented Waste', due: 'Due Now', find: 'Global Find', prefs: 'User Preferences', past: 'Past Removed', profile: 'Patient Profile', removed: 'removed' },
    types: { MiniDrawer: 'MiniDrawer', Matrix: 'Matrix', CUBIE: 'CUBIE', Fridge: 'Refrigerator' }, pocket: 'Pocket',
    openMsg: 'The drawer is open and the pocket light is on.',
  },
  omnicell: {
    key: 'omnicell', name: 'Omnicell XT', model: 'Omnicell-style XT cabinet', station: '4W-OMNI', actionFirst: true,
    L: { remove: 'Issue', removeMed: 'Issue', removeMeds: 'Issue Meds', removing: 'Issue Medications', selected: 'Med Selection', allPts: 'All Patients',
         undoc: 'Pending Waste', due: 'Scheduled', find: 'Find Med', prefs: 'User Settings', past: 'Issue History', profile: 'Med Profile', removed: 'issued' },
    types: { MiniDrawer: 'SinglePointe drawer', Matrix: 'Open matrix drawer', CUBIE: 'Lidded bin drawer', Fridge: 'Refrigerator' }, pocket: 'Bin',
    openMsg: 'The drawer is open. Follow the Guiding Light to the lit bin.',
  },
};

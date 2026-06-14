import os

docs = {
    "rulebooks/mess.md": """# Mess and Dining Facility Regulations
## Section 1: Operating Hours
- Breakfast: 07:30 AM to 09:30 AM
- Lunch: 12:30 PM to 02:30 PM
- Snacks: 04:30 PM to 05:45 PM
- Dinner: 07:30 PM to 09:30 PM

## Section 2: Mess Wastage Policy
1. Students must use the Demeure AI Mess Planner to indicate their absence from any meal at least 12 hours in advance.
2. Leaving food on the plate exceeding 50 grams will incur a fine of ₹50 per instance, automatically charged to the semester mess bill.

## Section 3: Dietary Preferences
- Changes between Vegetarian and Non-Vegetarian menus must be applied for on the 25th of the preceding month.
- Specific allergy notifications must be registered with the Chief Medical Officer and the Mess Manager.
""",

    "rulebooks/admission.md": """# Hostel Admission and Allotment Policy
## Section 1: Allotment Criteria
1. Room allocation is primarily driven by the Demeure AI Compatibility Engine, prioritizing CGPA, sleep cycle alignment, and mutual preferences.
2. Students with disciplinary records from previous semesters are ineligible for AC and Single-occupancy rooms.

## Section 2: Check-in Protocol
1. New residents must complete biometric registration at the SOC Gate within 24 hours of arrival.
2. Room inventory must be verified and acknowledged in the student portal within 48 hours. Missing items reported later will be charged to the student.

## Section 3: Check-out Protocol
1. At the end of the academic year, rooms must be vacated within 48 hours of the last scheduled examination.
2. A clearance certificate must be obtained from the warden after a physical inspection.
""",

    "rulebooks/fees.md": """# Fee Structure and Payments
## Section 1: Annual Hostel Fees
- Single AC Room: ₹1,50,000
- Double Non-AC Room: ₹95,000
- 4-Bed Non-AC Room: ₹65,000

## Section 2: Mess Advances
- A mandatory annual mess advance of ₹45,000 is collected at the start of the year.
- Unused mess balances (from approved leave of absences) are refunded at the end of the year or carried forward.

## Section 3: Penalties and Late Fees
- Late payment of hostel fees incurs a penalty of ₹100 per day after the due date.
- Property damage fines are directly debited from the caution deposit (₹10,000).
""",

    "rulebooks/room.md": """# Room Operations and Maintenance
## Section 1: Permitted Appliances
1. Laptops, personal computers, and low-voltage lamps are permitted.
2. STRICTLY PROHIBITED: Electric kettles, induction cooktops, iron boxes, room heaters. Confiscation will result in a ₹500 fine.

## Section 2: Complaint and SLA
1. Maintenance requests must be logged via the Demeure AI Complaint Desk.
2. Critical (Electrical/Water leak) SLA: 4 hours.
3. Medium (Furniture/IT) SLA: 24 hours.

## Section 3: Room Cleaning
1. Housekeeping staff are available daily between 10:00 AM and 04:00 PM.
2. Students must be present during room cleaning or leave a digitally signed consent form.
""",

    "rulebooks/ethics.md": """# Disciplinary Code and Ethics
## Section 1: Curfew and Late Entry
1. General campus curfew is 10:00 PM.
2. Late entries between 10:00 PM and 11:30 PM require biometric authentication and a digital reason log.
3. 3 unexplained late entries trigger an automatic notification to parents/guardians.

## Section 2: Anti-Ragging Policy
1. The institution operates a Zero Tolerance policy towards ragging.
2. Any physical, mental, or digital harassment will result in immediate expulsion and filing of a police FIR.

## Section 3: Substance Abuse
1. Alcohol, narcotics, and tobacco products (including e-cigarettes) are strictly banned inside the hostel premises.
2. Detection via room inspection or biometric impairment checks will lead to semester suspension.
""",

    "rulebooks/laundry.md": """# Laundry Facilities
## Section 1: Facility Hours
- Basement washing machines operate from 06:00 AM to 11:00 PM.

## Section 2: Usage Limits
- Each student is allotted 2 wash cycles per week.
- Machines must be pre-booked via the Demeure Utility Panel.
- Unclaimed clothes left in the machine for over 30 minutes will be removed by staff to a common lost-and-found bin.

## Section 3: Maintenance
- Detergent must be provided by the student.
- Machine malfunctions must be reported immediately to the Complaint Desk.
"""
}

ml_data = {
    "ml/power_baseline.csv": """timestamp,node_id,node_type,current_draw_kw,baseline_expected_kw,anomaly_score,flag
2026-06-13T08:00:00,A_HVAC_01,HVAC,45.2,46.0,0.02,OK
2026-06-13T08:15:00,A_HVAC_01,HVAC,46.1,46.0,0.01,OK
2026-06-13T02:00:00,C_LIGHT_04,LIGHTING,12.5,2.1,0.89,VAMPIRE_LOAD
2026-06-13T14:30:00,B_PUMP_02,WATER_PUMP,88.4,40.0,0.95,MOTOR_SURGE
""",
    "ml/student_profiles.csv": """student_id,name,sleep_schedule,cleanliness,study_noise,diet,sociability_score
101,Pratik Kumar,NIGHT_OWL,HIGH,QUIET,VEG,0.4
102,Dev Sharma,EARLY_BIRD,MEDIUM,MODERATE,NON_VEG,0.8
103,Kabir Malhotra,NIGHT_OWL,HIGH,QUIET,VEG,0.3
104,Rohan Das,EARLY_BIRD,LOW,LOUD,NON_VEG,0.9
"""
}

for path, content in {**docs, **ml_data}.items():
    full_path = os.path.join(os.path.dirname(__file__), path)
    with open(full_path, "w") as f:
        f.write(content)

print("All datasets generated.")

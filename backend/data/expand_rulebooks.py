import os
import random

data_dir = os.path.join(os.path.dirname(__file__), "rulebooks")

# Bureaucratic filler phrases to generate realistic-looking university legalese
VERBS = ["shall", "must", "is required to", "will", "is obliged to", "undertakes to", "agrees to"]
ACTIONS = ["comply with", "adhere to", "observe", "maintain", "uphold", "respect", "execute", "acknowledge"]
ENTITIES = ["the resident", "the student", "the allottee", "the occupant", "the registered individual"]
CONDITIONS = [
    "under all circumstances", "without exception", "as deemed necessary by the administration",
    "at all times within the premises", "subject to periodic review", "unless otherwise stated in written authorization"
]
SUBJECTS = [
    "institutional policy", "statutory regulations", "the prescribed code of conduct",
    "the addendum guidelines", "the overarching operational mandate", "hostel standing orders"
]

def generate_bureaucratic_clause(index):
    verb = random.choice(VERBS)
    action = random.choice(ACTIONS)
    entity = random.choice(ENTITIES)
    condition = random.choice(CONDITIONS)
    subject = random.choice(SUBJECTS)
    return f"{entity.capitalize()} {verb} {action} {subject} {condition}."

def expand_file(filepath, base_topic):
    with open(filepath, 'a') as f:
        f.write("\n\n# OVERARCHING INSTITUTIONAL ANNEXURES AND PROCEDURAL CLAUSES\n")
        f.write(f"## Document Reference: {base_topic.upper()}-PROT-2026-V1.0\n\n")
        
        # Generate 100 chapters to make it extremely long (50+ pages)
        for chapter in range(1, 101):
            f.write(f"### Chapter {chapter}: Extensive Operational Mandates\n\n")
            
            # Generate 20 sections per chapter
            for section in range(1, 21):
                f.write(f"#### Section {chapter}.{section}: Administrative Sub-Clause\n")
                
                # Generate paragraphs
                paragraphs = []
                for p in range(5):
                    sentences = [generate_bureaucratic_clause(p) for _ in range(8)]
                    paragraphs.append(" ".join(sentences))
                
                f.write("\n\n".join(paragraphs) + "\n\n")
                
            # Add a schedule/table
            f.write(f"#### Schedule of Fines - Chapter {chapter}\n")
            f.write("| Violation Code | Description | Penalty Amount | Resolution SLA |\n")
            f.write("| --- | --- | --- | --- |\n")
            for v in range(1, 15):
                f.write(f"| {base_topic.upper()}-V{chapter}-{v} | Infraction of clause {chapter}.{v} | ₹{random.randint(5, 50)*100} | {random.randint(1, 72)} hours |\n")
            f.write("\n")

files = {
    "mess.md": "mess",
    "admission.md": "admission",
    "fees.md": "fees",
    "room.md": "room",
    "ethics.md": "ethics",
    "laundry.md": "laundry"
}

for filename, topic in files.items():
    filepath = os.path.join(data_dir, filename)
    if os.path.exists(filepath):
        print(f"Expanding {filename}...")
        expand_file(filepath, topic)

print("Expansion complete! Files are now massive.")

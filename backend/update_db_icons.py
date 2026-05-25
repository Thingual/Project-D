import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

# Definition of correct UTF-8 icons and descriptions for each unit
units_data = [
    # A1 Units
    {"level": "A1", "order": 1, "icon": "👋", "description": "Greetings to Daily Life — master the core of everyday English."},
    {"level": "A1", "order": 2, "icon": "🛒", "description": "Learn vocabulary for food and drink, express preferences, and practise ordering politely."},
    {"level": "A1", "order": 3, "icon": "🏠", "description": "Talk about your body, clothes, feelings, and the home you live in."},
    {"level": "A1", "order": 4, "icon": "🛒", "description": "Order food, shop at the market, and express preferences."},
    {"level": "A1", "order": 5, "icon": "👨‍👩‍👧‍👦", "description": "Talk about family members and describe people's appearance."},
    {"level": "A1", "order": 6, "icon": "⏰", "description": "Learn to talk about your daily habits."},
    
    # A2 Units
    {"level": "A2", "order": 1, "icon": "📜", "description": "Learn to talk about rules, obligations, and giving advice."},
    {"level": "A2", "order": 2, "icon": "⚖️", "description": "Learn to make comparatives stronger and more expressive."},
    {"level": "A2", "order": 3, "icon": "🕰️", "description": "Understand when to use the present perfect vs past simple in everyday English."},
    {"level": "A2", "order": 4, "icon": "📅", "description": "Talk about the future, make plans, write formal emails and give directions."},
    {"level": "A2", "order": 5, "icon": "💬", "description": "Master question tags, polite requests, phone English, small talk and expressing opinions."},
    {"level": "A2", "order": 6, "icon": "🎓", "description": "Master life experiences using the present perfect tense with ever, never, already, yet, just, and still."}
]

db_configs = [
    {
        "name": "Local SQLite (thingual.db)",
        "engine": create_engine("sqlite:///./thingual.db")
    },
    {
        "name": "Remote Neon Database",
        "engine": create_engine("postgresql://neondb_owner:npg_VDh1O5cTSlau@ep-dry-sound-a1rwnia5-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&connect_timeout=10")
    }
]

for db in db_configs:
    print(f"\nUpdating icons/descriptions in {db['name']}...")
    try:
        engine = db["engine"]
        with engine.connect() as conn:
            for u in units_data:
                # We identify unit uniquely by level and order
                result = conn.execute(text("""
                    UPDATE units
                    SET icon = :icon, description = :description
                    WHERE level = :level AND "order" = :order
                """), {
                    "icon": u["icon"],
                    "description": u["description"],
                    "level": u["level"],
                    "order": u["order"]
                })
                print(f"  Updated level {u['level']} Unit {u['order']}")
            
            conn.execute(text("COMMIT"))
            print("  Changes committed successfully.")
            
    except Exception as e:
        print(f"  Error updating {db['name']}: {e}")

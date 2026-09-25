from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Provider, ProviderService, ServiceCategory

SERVICE_CATEGORIES = [
    ("air_conditioning", "Air conditioning", "AC repair, installation and maintenance."),
    ("plumbing", "Plumbing", "Leaks, pipes and water issues."),
    ("electricity", "Electricity", "Electrical repairs and safety checks."),
    ("cleaning", "Cleaning", "Home and office cleaning."),
    ("appliance_repair", "Appliance repair", "Washing machines, fridges and appliances."),
    ("car_repair", "Car repair", "Vehicle diagnostics and repair tasks."),
    ("painting", "Painting", "Interior and exterior painting."),
    ("moving", "Moving", "Small moves and relocation help."),
    ("beauty", "Beauty", "Personal care and salon appointments."),
    ("home_maintenance", "Home maintenance", "General home repair and maintenance tasks."),
]


def seed_demo_data(db: Session) -> None:
    if db.scalar(select(ServiceCategory).limit(1)):
        return

    categories: dict[str, ServiceCategory] = {}
    for slug, name, description in SERVICE_CATEGORIES:
        category = ServiceCategory(slug=slug, name=name, description=description)
        db.add(category)
        categories[slug] = category
    db.flush()

    providers = [
        Provider(
            name="Demo AC Care",
            description="Seeded demo provider for AC diagnostics. Not a real business.",
            location="Ariana",
            verified=False,
            demo=True,
            rating=None,
            review_count=None,
            data={"disclaimer": "Demo provider. No live availability, price or booking guarantee."},
        ),
        Provider(
            name="Demo Home Fix",
            description="Seeded demo provider for plumbing and appliance examples. Not a real business.",
            location="Ariana",
            verified=False,
            demo=True,
            rating=None,
            review_count=None,
            data={"disclaimer": "Demo provider. No live availability, price or booking guarantee."},
        ),
    ]
    db.add_all(providers)
    db.flush()
    db.add(ProviderService(provider_id=providers[0].id, category_id=categories["air_conditioning"].id))
    db.add(ProviderService(provider_id=providers[1].id, category_id=categories["plumbing"].id))
    db.add(ProviderService(provider_id=providers[1].id, category_id=categories["appliance_repair"].id))
    db.add(ProviderService(provider_id=providers[1].id, category_id=categories["home_maintenance"].id))
    db.commit()

"""Keep one night active per headcount event.

Night 1 opens on its date; each following night opens 24 hours after the
previous one's date, and the earlier night is closed. Run hourly from cron so
the admin day list and the gate agree with the computed rule.
"""
import asyncio

from sqlalchemy import select

from app.core.database import async_session
from app.models.event import Event
from app.models.event_day import EventDay
from app.services.event_days import list_days, local_today


def active_index(days) -> int:
    if not days:
        return -1
    ordered = sorted(days, key=lambda d: (d.date or local_today(), d.day_number))
    first = ordered[0].date
    if first is None:
        return -1
    return max(0, min((local_today() - first).days, len(ordered) - 1))


async def main():
    async with async_session() as db:
        events = (await db.execute(
            select(Event).where(Event.headcount_mode.is_(True))
        )).scalars().all()
        for event in events:
            days = await list_days(db, event.id, include_inactive=True)
            index = active_index(days)
            if index < 0:
                continue
            ordered = sorted(days, key=lambda d: (d.date or local_today(), d.day_number))
            active_ids = {ordered[index].id}
            changed = 0
            for day in ordered:
                should = day.id in active_ids
                if bool(day.is_active) != should:
                    day.is_active = should
                    changed += 1
            if changed:
                print(f"[nights] event {event.id}: activated {ordered[index].label}, changed {changed}")
        await db.commit()


if __name__ == "__main__":
    asyncio.run(main())

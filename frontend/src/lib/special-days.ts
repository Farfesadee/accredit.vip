/* Special days and their themed backgrounds */

export interface SpecialDay {
  month: number;
  day: number;
  name: string;
  bgImage: string;
  accentColor?: string;
}

const SPECIAL_DAYS: SpecialDay[] = [
  {
    month: 1,
    day: 1,
    name: "New Year",
    bgImage: "linear-gradient(120deg, rgba(25,118,210,0.70) 0%, rgba(13,71,161,0.52) 42%, rgba(21,101,192,0.18) 100%), url('https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=2400&q=88')",
    accentColor: "#1976D2",
  },
  {
    month: 5,
    day: 29,
    name: "Nigeria Independence Day",
    bgImage: "linear-gradient(120deg, rgba(25,87,16,0.70) 0%, rgba(56,142,60,0.52) 42%, rgba(76,175,80,0.18) 100%), url('https://images.unsplash.com/photo-1511379938547-c1f69b13d835?auto=format&fit=crop&w=2400&q=88')",
    accentColor: "#1B5E20",
  },
  {
    month: 12,
    day: 25,
    name: "Christmas",
    bgImage: "linear-gradient(120deg, rgba(139,0,0,0.70) 0%, rgba(178,34,34,0.52) 42%, rgba(220,20,60,0.18) 100%), url('https://images.unsplash.com/photo-1543269865-cbdf26861551?auto=format&fit=crop&w=2400&q=88')",
    accentColor: "#8B0000",
  },
  {
    month: 12,
    day: 31,
    name: "New Year's Eve",
    bgImage: "linear-gradient(120deg, rgba(75,0,130,0.70) 0%, rgba(138,43,226,0.52) 42%, rgba(186,85,211,0.18) 100%), url('https://images.unsplash.com/photo-1519046904884-53103b34b206?auto=format&fit=crop&w=2400&q=88')",
    accentColor: "#4B0082",
  },
];

export function getTodaySpecialDay(): SpecialDay | null {
  const today = new Date();
  const month = today.getMonth() + 1;
  const day = today.getDate();

  return SPECIAL_DAYS.find((sd) => sd.month === month && sd.day === day) || null;
}

export function getHeroBackground(): string {
  const specialDay = getTodaySpecialDay();
  if (specialDay) {
    return specialDay.bgImage;
  }
  // Default background
  return "linear-gradient(120deg, rgba(5,10,20,0.70) 0%, rgba(13,27,42,0.52) 42%, rgba(9,16,30,0.18) 100%), url('https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=2400&q=88')";
}

export function getHeroBackgroundColor(): string {
  const specialDay = getTodaySpecialDay();
  if (specialDay) {
    return "#07101d";
  }
  return "#07101d";
}

export function getSpecialDayName(): string | null {
  const specialDay = getTodaySpecialDay();
  return specialDay ? specialDay.name : null;
}

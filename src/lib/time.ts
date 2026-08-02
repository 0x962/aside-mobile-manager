// The sessions-screen title: a greeting picked by date and time of day. The
// day-of-year index keeps it stable within a day and varied across days.
export function greeting(now = new Date()): string {
  const month = now.getMonth();
  const date = now.getDate();
  const hour = now.getHours();
  if (month === 0 && date === 1) return 'Happy new year!';
  if (month === 8 && date === 19) return 'Ahoy!';
  if (month === 9 && date === 31) return 'Boo!';
  if (now.getDay() === 5 && hour >= 16) return 'Happy Friday!';
  const pool =
    hour < 5
      ? ['Up late?', 'Late night?', 'Still going?']
      : hour < 12
        ? ['Good morning!', 'Morning!', 'Rise and shine!']
        : hour < 17
          ? ['Good afternoon!', 'Afternoon!', 'Hello again!']
          : hour < 22
            ? ['Good evening!', 'Evening!', 'Welcome back!']
            : ['Up late?', 'Late night?', 'Still going?'];
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
  return pool[dayOfYear % pool.length];
}

// One rule for all timestamps: relative under 7 days, date after.
export function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

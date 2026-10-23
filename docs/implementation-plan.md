Good — I have both issues now. Here's the full list to fix in one build session:

1. **"Unexpected token '<', <!DOCTYPE..." on booking** — the booking intent API call is hitting Vercel instead of Railway (returns HTML). The `BookingFlow.tsx` is calling `/api/bookings/intent` which isn't hitting the Railway URL. Same VITE_API_URL issue for this specific call.

2. **"Failed to create booking"** — the booking creation fails, likely same root cause plus the bookings route still has SQLite issues.

3. **Profile edit "Profile not found"** — `profilesApi.updateMe()` calls `PATCH /profiles/me` which doesn't exist; needs to use `profilesApi.update(username)` instead.

4. **Onboarding back button + "sign in instead" link** — already coded, needs to be confirmed deployed.

5. **PWA manifest** — proper icon and manifest for mobile install.

Any more issues to add before I switch to Build mode?

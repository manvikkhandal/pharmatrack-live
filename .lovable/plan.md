

## Route-Task System Upgrade

### Overview
Transform the current simple tracker into a full route-task management system with admin employee/route management, MR route execution with geofenced check-ins, and route history visualization.

### Firestore Data Model

```text
users/{mrId}
  ├── email, name, role, createdAt

routes/{routeId}
  ├── mrId, mrName, status (assigned|in-progress|completed), createdAt
  └── clinics: [{ id, name, lat, lng, order }]

visits/{visitId}
  ├── routeId, mrId, clinicId, clinicName, lat, lng, checkedInAt

history/{mrId}/points/{autoId}
  ├── lat, lng, timestamp
```

### Files to Create/Modify

**New files:**
1. `src/lib/firebaseAuth.ts` — Firebase Auth helpers (createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChange listener)
2. `src/contexts/AuthContext.tsx` — Auth context providing current user + role
3. `src/pages/AdminDashboard.tsx` — Tabbed admin page replacing current AdminView:
   - **Map tab**: existing live map (moved here)
   - **Employees tab**: create MR accounts (email/password via Firebase Auth), list existing MRs from `users` collection
   - **Route Builder tab**: select MR, add clinic checkpoints (name, lat, lng), save route to `routes` collection
   - **Route History tab**: select completed route, fetch `history/{mrId}/points`, draw polyline on map
4. `src/pages/MRDashboard.tsx` — Replaces current MRView:
   - Shows assigned route as a checklist of clinics
   - Each clinic has a "Check-in" button, disabled unless GPS is within 100m (Haversine formula)
   - GPS tracking continues writing to `history/{mrId}/points` every 20 seconds
   - "Route Complete" button enabled only when all clinics checked
   - On completion, updates route status to `completed`
5. `src/lib/geo.ts` — Haversine distance utility function

**Modified files:**
6. `src/pages/Login.tsx` — Replace role buttons with email/password login form. After login, read user doc from `users` collection to determine role and redirect.
7. `src/App.tsx` — Wrap routes in AuthContext, add protected routing based on role
8. `src/pages/AdminView.tsx` — Delete (merged into AdminDashboard)
9. `src/pages/MRView.tsx` — Delete (merged into MRDashboard)

### Key Implementation Details

- **Firebase Auth**: Use `firebase/auth` for real authentication. Admin creates MR accounts via `createUserWithEmailAndPassword`, then writes a `users/{uid}` doc with `role: "mr"`. Admin account is seeded or hardcoded.
- **Geofencing**: Haversine formula calculates distance between MR's current GPS and clinic coordinates. Check-in button only enabled when distance < 100m.
- **Background GPS**: `watchPosition` + 20s interval writes to `history/{mrId}/points` subcollection with `addDoc`.
- **Route History polyline**: Fetch all docs from `history/{mrId}/points`, sort by timestamp, draw as Leaflet polyline on the map.
- **Admin Dashboard** uses Tabs component (already available via shadcn) for switching between Map, Employees, Route Builder, and Route History views.

### Step-by-step

1. Create `firebaseAuth.ts` and `AuthContext.tsx` with Firebase Auth integration
2. Update `Login.tsx` to email/password form with role-based redirect
3. Create `geo.ts` with Haversine distance function
4. Build `AdminDashboard.tsx` with all four tabs (Map, Employees, Route Builder, Route History)
5. Build `MRDashboard.tsx` with route checklist, geofenced check-in, GPS tracking to history, and route completion
6. Update `App.tsx` routing and delete old view files


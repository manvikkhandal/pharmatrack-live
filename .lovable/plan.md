

## Enterprise UI/UX Polish

### 1. Visual Design — Theme & Typography
- **`index.html`**: Add Google Fonts link for **Inter** (weights 400, 500, 600, 700). Update `<title>` to "Pharma Field Force Tracker".
- **`tailwind.config.ts`**: Set `fontFamily.sans` to `['Inter', ...defaultTheme.fontFamily.sans]`.
- **`src/index.css`**: Refine the Medical Blue theme — keep current `--primary: 210 80% 45%`, update `--background` to a subtle cool-white (`210 20% 98%`), add card shadow utility class (`.card-elevated { @apply shadow-md shadow-primary/5 border-border/50; }`).

### 2. Card Shadows & Polish
- **`AdminDashboard.tsx`**: Add `shadow-md` to all `<Card>` components across all four tabs.
- **`MRDashboard.tsx`**: Add `shadow-md` to both GPS and Route cards.
- **`Login.tsx`**: Add `shadow-xl` to the login card for a floating feel.

### 3. Responsiveness
- **Admin tabs**: Change `grid-cols-4` on `TabsList` to `grid-cols-2 sm:grid-cols-4` so tabs stack 2x2 on mobile.
- **Route Builder clinic inputs**: Stack lat/lng vertically on mobile with `flex-col sm:flex-row`.
- **MR Dashboard**: Already `max-w-md mx-auto` — just ensure buttons don't overflow by adding `text-xs sm:text-sm` to check-in buttons.
- **Admin map container**: Use `h-[calc(100vh-10rem)]` for proper mobile fit.

### 4. Toast Notifications (already mostly present)
- Verify and ensure these toasts exist:
  - Route Builder `handleSave`: `toast.success("Route assigned successfully!")` — update wording.
  - MR `handleCheckIn`: `toast.success("Check-in successful!")` — update wording.
  - Login `handleLogin` catch: `toast.error("Login failed: ...")` — already present, refine message.

### 5. Route History Polyline Color
- **`AdminDashboard.tsx`** `RouteHistoryTab.loadHistory`: Change polyline color from `hsl(221.2, 83.2%, 53.3%)` (blue) to `#22c55e` (bright green, weight 5, opacity 0.9) so it stands out.

### 6. Logout Button
- **Admin**: Already has logout in header — ensure it's styled prominently with `variant="outline"` and visible icon+text.
- **MR**: Already has logout — same treatment, ensure it's in the top-right header area.

### Files Modified
1. `index.html` — Add Inter font, update title
2. `tailwind.config.ts` — Set Inter as default font
3. `src/index.css` — Subtle background tweak, card utility
4. `src/pages/AdminDashboard.tsx` — Card shadows, responsive tabs, polyline color, toast wording, logout styling
5. `src/pages/MRDashboard.tsx` — Card shadows, responsive button text, toast wording
6. `src/pages/Login.tsx` — Card shadow, title update


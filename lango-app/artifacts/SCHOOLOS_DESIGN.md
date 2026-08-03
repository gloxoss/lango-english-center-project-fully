# SchoolOS V1 — Design System & Visual Intelligence

## 1. Design Aesthetics & Visual Identity
SchoolOS adopts a **Modern Moroccan Institutional Aesthetic** — authoritative, crisp, highly scannable, and warm. Designed for high data density without cognitive overload.

- **Primary Colors**: Deep Emerald Ink (`#0F382C`), Moroccan Atlas Green (`#1B4D3E`).
- **Accent Colors**: Warm Sand Amber (`#D97706`), Moroccan Terra Cotta (`#C2410C`), Sapphire Blue (`#1D4ED8`).
- **Background & Surfaces**: Crisp Off-White Parchment (`#FAFAFA`), Glass Panel (`#FFFFFF`), Muted Slate Borders (`#E2E8F0`).
- **Typography**: Inter / Outfit for English/French, Cairo / Noto Sans Arabic for mirrored Arabic RTL.

## 2. Layout Grid & Surface Hierarchy
- **Sidebar**: Persistent 260px collapsible navigation sidebar with tenant school switcher and active role badge.
- **Top Bar**: Global breadcrumbs, Quick Action trigger, Language switcher (FR / AR RTL / EN), Notifications badge, User Profile.
- **Main Canvas**: Fluid responsive grid (`grid-cols-12`) with 16px gap, modular cards with subtle borders (`border-slate-200`) and soft shadows (`shadow-sm`).
- **RTL Mirroring**: Automatic flex/grid direction flipping when locale is Arabic (`dir="rtl"`).

## 3. Data Visualization & Component Language
- **Status Badges**:
  - Present / Paid / Active: Soft Emerald background (`bg-emerald-50 text-emerald-700 border-emerald-200`)
  - Absent / Overdue: Soft Crimson background (`bg-red-50 text-red-700 border-red-200`)
  - Late / Partial: Soft Amber background (`bg-amber-50 text-amber-700 border-amber-200`)
  - Excused / Pending: Soft Slate background (`bg-slate-100 text-slate-700 border-slate-200`)
- **Tables & Data Grids**: High-density rows with alternating subtle stripes, sticky header row, inline search, and column sorting.
- **Action Buttons**: Solid Atlas Green primary button with smooth micro-hover transitions (`transition-all duration-150`).

## 4. Mobile Responsiveness Rules
- Teachers accessing attendance or grade entry on smartphones receive a mobile-first touch grid with target touch zones (minimum 44px x 44px).
- Navigation switches to a bottom navbar or mobile slide-out drawer on screen widths < 768px.

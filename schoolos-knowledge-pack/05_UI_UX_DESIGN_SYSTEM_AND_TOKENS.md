# 🎨 UI/UX Design System, Tokens & Conventions

## 1. Design Tokens & Color Palette

SchoolOS utilizes a tailored, modern palette inspired by contemporary educational interfaces and Moroccan regional aesthetics:

### 1.1 Brand & Semantic Tokens

| Token | Hex Value | Semantic Usage |
| :--- | :---: | :--- |
| **Primary Brand Blue** | `#2487B8` | Primary buttons, active nav tabs, key accents, focus rings |
| **Primary Blue Hover** | `#1B6C93` | Hover & pressed state for primary interactions |
| **Slate Charcoal** | `#0F172A` | Primary typography, headers, dark badges |
| **Muted Slate** | `#64748B` | Secondary descriptions, column headers, meta timestamps |
| **Surface Background** | `#F8FAFC` | App canvas background, table headers, inactive chip fills |
| **Moroccan Emerald** | `#059669` | Success states, paid invoices, WhatsApp indicators |
| **Emerald Soft Surface** | `#ECFDF5` | Green status badges, success alert containers |
| **Moroccan Amber** | `#D97706` | Pending invoices, warnings, simulation mode tags |
| **Amber Soft Surface** | `#FFFBEB` | Warning banners, reminder tags |
| **Crimson / Rose** | `#E11D48` | Destructive actions, over-quota barriers, overdue flags |
| **Rose Soft Surface** | `#FFF1F2` | Error alerts, over-quota warnings, failed dispatches |

---

## 2. Component Conventions & Interaction Patterns

### 2.1 Buttons & Interactive Controls
- **Border Radius**: Consistent `rounded-xl` (12px) for buttons and inputs; `rounded-2xl` (16px) for cards and modals.
- **States**:
  - Always provide an animated loading state using `<Loader2 className="w-4 h-4 animate-spin" />`.
  - When disabled, use `disabled:opacity-50 cursor-not-allowed`.
  - Use `cursor-pointer` explicitly on interactive elements.

### 2.2 Status Badges
SchoolOS uses the typed `Badge` component with standardized variants:
```typescript
variant?: 'success' | 'danger' | 'warning' | 'info' | 'neutral' | 'signal';
```
- `success`: Emerald green fill and border for connected gateways, paid invoices, present attendance.
- `danger`: Rose red for overdue fees, Meta quota exceeded, unexcused absences.
- `warning`: Amber for pending items, simulation modes, late arrivals.
- `info`: Blue for informational badges, academic terms.
- `neutral`: Slate gray for secondary tags.

### 2.3 Modal Dialogs
- Built on top of Radix UI primitives (`@/components/ui/dialog`).
- Header includes a colored icon, clear title, and concise subtitle.
- Footer provides prominent confirmation and secondary "Fermer / Annuler" action.

### 2.4 Quick-Action Chips
- Quick preset buttons (e.g. Absence injustifiée, Retard matinal, Rappel scolarité, Convocation parent) allow 1-click loading of Moroccan institutional templates.

### 2.5 Directory Tables & High-Standard Empty States
- Table headers use `bg-[#F8FAFC]` with uppercase tracking (`text-slate-500 font-semibold`).
- **Never display dead-end blank screens**: Empty states render an illustrative badge, a positive message (e.g. *"Tous les indicateurs sont au vert ! Aucun élève à risque"*), and an actionable shortcut button.

---

## 3. Multi-Lingual & RTL Conventions (Arabic, French, English)

SchoolOS is natively tri-lingual (`ar`, `fr`, `en`):
1. **RTL Directional Compatibility**:
   - Never use physical margins like `ml-4` or `mr-4`. Use Tailwind logical properties:
     - `ms-4` (margin-inline-start)
     - `me-4` (margin-inline-end)
     - `ps-4` (padding-inline-start)
     - `pe-4` (padding-inline-end)
     - `text-start` / `text-end`
2. **Translation Dictionaries**:
   - All client and server text is managed via `next-intl` located in `locales/ar.json`, `locales/fr.json`, and `locales/en.json`.

---

## 4. UI Reality Ratchet Invariant

SchoolOS enforces strict UI fidelity rules checked by `scripts/check-ui-reality.ts`:
- **No Dead Controls**: Every `<Button>` or `<button>` must have an `onClick` handler, `type="submit"`, link wrapper (`<Link>`), or modal trigger.
- **No Mock Arrays**: UI views must never render static invented arrays (e.g. `const students = [...]`). All data must be fetched from the database or API.
- **No Unlinked Pages**: Dashboard pages must be discoverable in the sidebar or navigation portal manifest.

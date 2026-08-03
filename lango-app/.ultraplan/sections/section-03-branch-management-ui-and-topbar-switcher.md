# Section 03: Branch Settings UI & Topbar Selector

## Overview
Builds the 2-tab Branch Management view in School Settings (`/dashboard/settings/branches`) and integrates the Topbar Campus Switcher dropdown.

## Risk: [yellow] — UI state management & topbar context syncing

## Tasks

<task type="auto" id="03-01">
  <name>Build Branch Settings UI View</name>
  <files>src/features/settings/ui/branches-manage-view.tsx, src/app/[locale]/dashboard/settings/branches/page.tsx</files>
  <action>
    Create white card panel view (`bg-white rounded-2xl border border-slate-200/80 shadow-2xs`) with 2 tabs:
    - Tab 1: *"Liste des Succursales"* (DataTable showing Name, Code, City, Address, Phone, Email, Status badge, Edit & Deactivate actions).
    - Tab 2: *"Créer une Succursale"* (Form with inputs for Name, Code, City, Address, Phone, Email, Save button).
    Gated by `hasMultiBranchAddon` check; displays upsell banner if addon is disabled.
  </action>
  <verify>Navigate to `/dashboard/settings/branches` and test form submit and table listing.</verify>
  <done>Branch settings view live and functional.</done>
</task>

<task type="auto" id="03-02">
  <name>Build Topbar Campus Switcher Component</name>
  <files>src/components/shared/header-campus-switcher.tsx, src/components/shared/header.tsx</files>
  <action>
    Create a clean dropdown in the top header displaying the currently selected campus branch (e.g. *"Toutes les succursales"* or *"Campus Anfa"*).
    Persists selection in localStorage / cookie and triggers context refresh across active pages.
  </action>
  <verify>Click header dropdown and select a branch; verify selection persists across page navigation.</verify>
  <done>Topbar campus switcher active and synchronized.</done>
</task>

# Employee Self-Service Portal — Manual Testing Guide

## Overview

This guide details manual test cases to verify the **Employee Self-Service Portal** in `schoolos-app`. It ensures that staff users can manage their personal profiles, submit leave applications, request salary advances, view clock punches, and download published payslips securely.

---

## Pre-requisites & Setup

1. **Dev Server**: Run `npm run dev` or `npx next dev` on `http://localhost:3000`.
2. **Test Accounts**:
   - **Teacher / Staff Account with Employee Profile**: User with base role `teacher` linked to an active `employeeProfiles` row.
   - **Accountant / Admin Account**: User with `school_admin` or `accountant` role to process requests and publish payslips.
   - **User without Employee Profile**: User without an `employeeProfiles` record (to test the 403 non-employee guard).

---

## Test Cases

### TC-01: Non-Employee Guard Verification

- **Goal**: Verify that users without an employee profile cannot access the self-service workspace.
- **Steps**:
  1. Log in as a user who has no `employeeProfiles` record.
  2. Navigate to `/dashboard/hr/self-service`.
- **Expected Result**:
  - The UI displays an "Accès réservé aux employés" card informing the user that no employee profile is linked.
  - The server API `/api/employee/me/home` returns HTTP status `403` with error code `NOT_AN_EMPLOYEE`.

---

### TC-02: Employee Self-Service Overview Dashboard

- **Goal**: Verify that an active employee can view their aggregated summary.
- **Steps**:
  1. Log in as a teacher/staff member with an active employee profile.
  2. Navigate to `/dashboard/hr/self-service`.
- **Expected Result**:
  - The KPI banner renders available leave days, latest net salary, clock punch state, and pending requests.
  - Tab navigation presents "Accueil", "Mon profil", "Congés", "Avances sur salaire", "Pointage", "Fiches de paie", "Distinctions", "Documents", and "Mes demandes".

---

### TC-03: Safe Profile Update

- **Goal**: Verify that safe contact fields can be updated directly by the employee.
- **Steps**:
  1. Click on the "Mon profil" tab.
  2. Modify telephone number or address.
  3. Click "Enregistrer mes informations".
- **Expected Result**:
  - A success banner "Profil mis à jour" appears.
  - The user row in the database is updated with the new contact details.

---

### TC-04: Sensitive Profile Edit with Password Re-Authentication

- **Goal**: Verify that sensitive fields (Bank RIB, CNSS/AMO) require current password and route to HR approval.
- **Steps**:
  1. On the "Mon profil" tab, click "Proposer une modification".
  2. Enter a new RIB number and enter the account's password.
  3. Click "Soumettre aux RH".
- **Expected Result**:
  - If password is valid, a notification confirm "Demande de modification envoyée aux RH pour validation".
  - A new record is created in `employeeProfileEditRequests` with status `pending`.
  - If an incorrect password is entered, the request is rejected with HTTP `403 REAUTH_FAILED`.

---

### TC-05: Leave Application & Cancellation Flow

- **Goal**: Verify submitting a leave request and canceling a pending request.
- **Steps**:
  1. Click on the "Congés" tab.
  2. Select a category (e.g. Congé payé), pick start and end dates, and enter a reason.
  3. Click "Envoyer la demande".
  4. Find the newly created pending request in "Mes demandes" and click "Annuler".
- **Expected Result**:
  - The request is saved and displayed in the leave history list as "En attente".
  - Upon clicking "Annuler", the request status transitions to "Annulée".

---

### TC-06: Salary Advance Application

- **Goal**: Verify requesting a salary advance.
- **Steps**:
  1. Click on the "Avances sur salaire" tab.
  2. Enter a requested amount (e.g. 3000 DH) and reason.
  3. Click "Soumettre l'avance".
- **Expected Result**:
  - A new advance application appears in "Mes demandes d'avances" with status "En attente".
  - Submitting a second advance while one is pending returns HTTP `409 PENDING_ADVANCE_EXISTS`.

---

### TC-07: Published Payslip View & Download

- **Goal**: Verify that employees can view and download only published payslips.
- **Steps**:
  1. Click on the "Fiches de paie" tab.
  2. Click the download icon next to a published payslip.
- **Expected Result**:
  - Only payslips in `published` status are displayed.
  - Clicking download initiates a PDF download from `/api/employee/me/payroll/[payslipId]/download`.

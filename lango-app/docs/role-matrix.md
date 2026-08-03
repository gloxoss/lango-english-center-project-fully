# SchoolOS — Canonical Role-Guard Matrix

| Endpoint Path | Allowed Roles | Description |
|---|---|---|
| `/api/students` | `school_admin`, `teacher` | List/create students |
| `/api/teachers` | `school_admin` | List/create staff teachers |
| `/api/users` | `school_admin` | List/create user accounts |
| `/api/users/unlock` | `school_admin` | Unlock locked accounts |
| `/api/attendance` | `school_admin`, `teacher` | Attendance recording |
| `/api/academics/class-sections` | `school_admin`, `teacher` | Academic structure sections |
| `/api/academics/classes` | `school_admin`, `teacher` | Academic classes |
| `/api/finance/invoices` | `school_admin`, `accountant` | Financial invoices |
| `/api/finance/payments` | `school_admin`, `accountant` | Payments processing |
| `/api/audit-logs` | `school_admin`, `super_admin` | System audit logs |
| `/api/settings` | `school_admin` | Tenant settings |
| `/api/super-admin/schools` | `super_admin` | Platform multi-school management |

# SchoolOS Dashboard UI & API Architecture Specification

```json
{
  "system": "SchoolOS (Lango Platform) V1",
  "archetype": "Moroccan K-12 & Higher-Ed Operating System",
  "brandTokens": {
    "primary": "#2487B8",
    "ink": "#16212B",
    "cararra": "#EBECE8",
    "canvas": "#EDF3F8",
    "signalCyan": "#0EA5C4",
    "states": {
      "success": { "text": "#17A673", "bg": "#DDF5EC" },
      "warning": { "text": "#E8A33D", "bg": "#FCF0DC" },
      "danger": { "text": "#E5544B", "bg": "#FCE4E2" },
      "info": { "text": "#5B8DEF", "bg": "#E4EDFD" }
    },
    "typography": {
      "latin": "Plus Jakarta Sans",
      "arabic": "IBM Plex Sans Arabic"
    }
  },
  "layoutArchitecture": {
    "pattern": "Server-First Next.js 16 App Router",
    "grid": "Fluid 12-column responsive layout with 20px gap",
    "sidebar": "Persistent 260px collapsible desktop drawer, bottom navigation bar on mobile (<768px)",
    "rtl": "Native dir='rtl' mirroring for Arabic locale"
  },
  "components": [
    {
      "id": "top_bar",
      "name": "Global Header Controls",
      "serverComponent": "src/components/shared/header.tsx",
      "dataModel": {
        "tenantName": "Groupe scolaire Atlas",
        "currentDate": "Mardi 20 mai 2025",
        "unreadNotificationsCount": 3,
        "currentLocale": "fr",
        "user": {
          "name": "Y. El Amrani",
          "role": "Directeur",
          "avatarUrl": "/avatars/amrani.jpg"
        }
      },
      "responsiveness": {
        "desktop": "Inline 800px search bar + right-aligned controls",
        "mobile": "Collapsible search drawer + mobile avatar drop"
      },
      "apiEndpoint": "/api/v1/tenant/context"
    },
    {
      "id": "alert_banners",
      "name": "Top Operational Status Banners",
      "data": [
        { "id": 1, "type": "success", "title": "Présence stable", "sub": "Excellente tendance", "icon": "check-circle" },
        { "id": 2, "type": "warning", "title": "4 retards de paiement", "sub": "Actions requises", "icon": "lock" },
        { "id": 3, "type": "danger", "title": "2 absences non justifiées", "sub": "À suivre", "icon": "clock" },
        { "id": 4, "type": "info", "title": "1 message en attente", "sub": "Parent à répondre", "icon": "message-square" }
      ],
      "responsiveness": {
        "desktop": "4-column grid (grid-cols-4)",
        "mobile": "2-column grid (grid-cols-2) or horizontal snap carousel"
      }
    },
    {
      "id": "primary_metrics",
      "name": "Executive KPI Cards Row",
      "metrics": [
        { "label": "Total élèves", "value": "1 248", "delta": "+5,1% vs mois dernier", "icon": "users" },
        { "label": "Classes actives", "value": "42", "delta": "+2 nouvelles", "icon": "graduation-cap" },
        { "label": "Professeurs présents", "value": "87 / 92", "delta": "94,6% présents", "icon": "user-check" },
        { "label": "Taux de présence", "value": "92,3%", "delta": "+4,6% vs hier", "icon": "clock" },
        { "label": "Paiements du mois", "value": "187 450 MAD", "delta": "68% collectés", "icon": "wallet" }
      ],
      "responsiveness": {
        "desktop": "5-column grid (grid-cols-5)",
        "mobile": "1-column stacked cards"
      },
      "apiEndpoint": "/api/v1/dashboard/kpis"
    },
    {
      "id": "presence_tracker",
      "name": "Attendance Analytics & Program Breakdown",
      "chartType": "Daily Line Chart (7 days)",
      "data": {
        "days": ["Mer 14", "Jeu 15", "Ven 16", "Sam 17", "Dim 18", "Lun 19", "Mar 20"],
        "series": [88, 92, 90, 91, 92, 93, 92.3],
        "programs": [
          { "name": "Primaire", "rate": "94,2%", "delta": "+3,8%" },
          { "name": "Collège", "rate": "91,3%", "delta": "+4,1%" },
          { "name": "Lycée", "rate": "91,0%", "delta": "+5,2%" }
        ]
      },
      "apiEndpoint": "/api/v1/analytics/attendance"
    },
    {
      "id": "financial_tracker",
      "name": "Financial Overview & Recent Payments",
      "totals": {
        "collected": "187 450 MAD",
        "pending": "58 300 MAD",
        "overdue": "29 750 MAD"
      },
      "recentPayments": [
        { "student": "Yassine El Amrani", "grade": "2nde Année Collège", "amount": "5 400 MAD", "time": "Aujourd'hui, 09:21" },
        { "student": "Aya Benjelloun", "grade: "5ème Année Primaire", "amount": "4 800 MAD", "time": "Hier, 16:45" },
        { "student": "Omar El Idrissi", "grade": "1ère Année Lycée", "amount": "6 200 MAD", "time": "Hier, 11:32" },
        { "student": "Salma Bouazza", "grade": "4ème Année Collège", "amount": "3 600 MAD", "time": "18 mai 2025, 10:15" }
      ],
      "apiEndpoint": "/api/v1/finance/summary"
    },
    {
      "id": "vigilance_alerts",
      "name": "Vigilance Alerts & Unread Messages",
      "items": [
        { "name": "Salma Bennani", "grade": "3ème Année Collège", "issue": "Absence non justifiée", "badge": "danger", "time": "il y a 1h" },
        { "name": "Omar Tazi", "grade": "2nde Année Lycée", "issue": "Paiement en retard", "badge": "warning", "time": "il y a 3h" },
        { "name": "Lina Bakkali", "grade": "1ère Année Collège", "issue": "Dossier incomplet", "badge": "warning", "time": "il y a 5h" }
      ],
      "unreadMessages": 3,
      "apiEndpoint": "/api/v1/dashboard/alerts"
    },
    {
      "id": "sms_communication",
      "name": "SMS Communication Monitor",
      "metrics": {
        "pending": 12,
        "sent": 128,
        "delivered": 112,
        "deliveryRate": "87,5%"
      },
      "lastSent": {
        "title": "Rappel: Réunion parents-professeurs",
        "status": "Délivré",
        "time": "Aujourd'hui, 09:15"
      },
      "apiEndpoint": "/api/v1/communication/sms/stats"
    },
    {
      "id": "daily_timetable",
      "name": "Live Daily Schedule Matrix",
      "timeSlots": ["08:00", "09:00", "10:00", "11:00", "14:00", "15:00"],
      "classes": [
        { "name": "6A", "slots": ["Maths", "Français", "SVT", "Arabe", "Anglais", "EPS"] },
        { "name": "3B", "slots": ["Français", "Maths", "Hist-Géo", "Arabe", "SVT", "Techno"] },
        { "name": "2nde A", "slots": ["Physique", "Maths", "Français", "Anglais", "Philo", "EPS"] },
        { "name": "1ère B", "slots": ["SES", "Histoire", "Maths", "Arabe", "SVT", "Anglais"] },
        { "name": "Tle C", "slots": ["Maths", "Physique", "Philo", "Anglais", "SES", "EPS"] }
      ],
      "apiEndpoint": "/api/v1/academics/timetable/daily"
    },
    {
      "id": "recent_transactions",
      "name": "Recent Financial Ledger Transactions",
      "transactions": [
        { "id": "#F-2025-1187", "student": "Yassine El Amrani", "amount": "+5 400 MAD", "type": "credit", "time": "Aujourd'hui, 09:21" },
        { "id": "#F-2025-1186", "student": "Aya Benjelloun", "amount": "+4 800 MAD", "type": "credit", "time": "Hier, 16:45" },
        { "id": "#F-2025-1185", "student": "Omar El Idrissi", "amount": "+6 200 MAD", "type": "credit", "time": "Hier, 11:32" },
        { "id": "#F-2025-1184", "student": "Salma Bouazza", "amount": "+3 600 MAD", "type": "credit", "time": "18 mai 2025, 10:15" },
        { "id": "#NC-2025-042", "student": "Rachid Ait Ali", "amount": "-1 200 MAD", "type": "debit", "time": "17 mai 2025, 14:08" }
      ],
      "apiEndpoint": "/api/v1/finance/transactions/recent"
    },
    {
      "id": "at_risk_students",
      "name": "At-Risk Students Early Warning System",
      "students": [
        { "name": "Youssef El Haddad", "grade": "1ère Année Lycée", "riskLevel": "Risque élevé", "indicators": 3, "badge": "danger" },
        { "name": "Hajar El Mansouri", "grade": "4ème Année Collège", "riskLevel": "Risque moyen", "indicators": 2, "badge": "warning" },
        { "name": "Mehdi Ouahbi", "grade": "3ème Année Collège", "riskLevel": "Risque moyen", "indicators": 2, "badge": "warning" },
        { "name": "Sara Amrani", "grade": "5ème Année Primaire", "riskLevel": "À surveiller", "indicators": 1, "badge": "info" }
      ],
      "apiEndpoint": "/api/v1/students/at-risk"
    }
  ]
}
```

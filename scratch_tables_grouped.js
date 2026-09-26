const fs = require('fs');
const tables = JSON.parse(fs.readFileSync('tables.json', 'utf8'));

const groups = {
  academics: [],
  assessment: [],
  attendance: [],
  students_alumni: [],
  finance_accounting: [],
  hr_workforce: [],
  communication_crm: [],
  library: [],
  hostel: [],
  transport: [],
  inventory: [],
  security_guard: [],
  settings_platform: [],
  other: []
};

tables.forEach(t => {
  const name = t.dbTable;
  if (/class|subject|teacher|room|timetable|semester|medium|stream|shift|schedule|syllabus|academic|session_year/.test(name)) groups.academics.push(name);
  else if (/exam|assessment|homework|grade|marksheet|result/.test(name)) groups.assessment.push(name);
  else if (/attendance/.test(name)) groups.attendance.push(name);
  else if (/alumni|placement|transfer|matricule|applicant|admission|guardian/.test(name)) groups.students_alumni.push(name);
  else if (/invoice|payment|receipt|refund|credit_note|fee_|fine_|cashier|ledger|journal|bank_|accounting|voucher|account_/.test(name)) groups.finance_accounting.push(name);
  else if (/employee|payroll|salary|department|designation|leave_|award/.test(name)) groups.hr_workforce.push(name);
  else if (/broadcast|announcement|sms|campaign|message|contact|lead|form|template/.test(name)) groups.communication_crm.push(name);
  else if (/library|book/.test(name)) groups.library.push(name);
  else if (/hostel/.test(name)) groups.hostel.push(name);
  else if (/transport|vehicle|route|stop/.test(name)) groups.transport.push(name);
  else if (/inventory|warehouse|supplier|item|stock|sale/.test(name)) groups.inventory.push(name);
  else if (/guard|visitor|emergency|incident|gate|pickup|security/.test(name)) groups.security_guard.push(name);
  else if (/tenant|domain|branch|setting|permission|role|cndp|audit|token|session|user|verification|support_ticket/.test(name)) groups.settings_platform.push(name);
  else groups.other.push(name);
});

for (const [k, v] of Object.entries(groups)) {
  console.log(`\n=== ${k.toUpperCase()} (${v.length} tables) ===`);
  console.log(v.join(', '));
}

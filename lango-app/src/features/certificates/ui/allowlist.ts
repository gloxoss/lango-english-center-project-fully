// Fields available to the certificate designer. These mirror the render data
// produced by issue-service (privacy-filtered: no NID / DOB / guardian).
export const CERTIFICATE_FIELD_ALLOWLIST = {
  allowedFields: [
    'photo',
    'subjectName',
    'firstName',
    'lastName',
    'matricule',
    'role',
    'employeeId',
    'department',
    'qualification',
    'hireDate',
    'phone',
    'title',
    'subtitle',
    'serial',
    'issueDate',
    'qrCode',
  ],
};

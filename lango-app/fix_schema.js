const fs = require('fs');
const file = 'src/models/Schema.ts';
let content = fs.readFileSync(file, 'utf8');

// The corrupted section is between account table and studentGroups table
// account ends with: refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
// and studentGroups starts with: export const studentGroups = pgTable('student_groups', {

const accountEndStr = 'refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),';
const studentGroupsStr = 'export const studentGroups = pgTable(\\'student_groups\\', {';

const accountEndIndex = content.indexOf(accountEndStr);
const studentGroupsIndex = content.indexOf(studentGroupsStr);

if (accountEndIndex !== -1 && studentGroupsIndex !== -1) {
  const replacement = \efreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

// --- FRAPPE EDUCATION DOMAIN ---
export const academicYears = pgTable('academic_years', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(), // e.g., "2026-2027"
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date').notNull(),
  isActive: boolean('is_active').default(false).notNull(),
});

export const academicTerms = pgTable('academic_terms', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  academicYearId: uuid('academic_year_id').notNull().references(() => academicYears.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(), // e.g., 'Fall 2026'
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date').notNull(),
  isCurrent: boolean('is_current').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const programs = pgTable('programs', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(), // e.g., "General English Program"
  description: text('description'),
  status: statusEnum('status').default('active').notNull(),
});

export const courses = pgTable('courses', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  programId: uuid('program_id').notNull().references(() => programs.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(), // e.g., "Level 1 Beginners"
  courseCode: varchar('course_code', { length: 50 }),
  // LMS Fields
  description: text('description'),
  thumbnailUrl: text('thumbnail_url'),
  price: doublePrecision('price'),
  isPublished: boolean('is_published').default(false).notNull(),
  isFree: boolean('is_free').default(false).notNull(),
  durationHours: integer('duration_hours').default(5),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

\;
  
  content = content.substring(0, accountEndIndex) + replacement + content.substring(studentGroupsIndex);
  fs.writeFileSync(file, content);
  console.log('Fixed schema successfully');
} else {
  console.log('Could not find indices');
}

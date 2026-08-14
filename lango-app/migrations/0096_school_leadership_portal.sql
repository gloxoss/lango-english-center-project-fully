CREATE TABLE IF NOT EXISTS leadership_scope_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE, scope_type varchar(20) NOT NULL,
  branch_id uuid REFERENCES branches(id) ON DELETE RESTRICT, department_id uuid REFERENCES departments(id) ON DELETE RESTRICT,
  starts_on date NOT NULL, ends_on date, status varchar(20) NOT NULL DEFAULT 'active',
  created_by_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT leadership_scope_assignments_type_check CHECK (scope_type IN ('tenant', 'branch', 'department')),
  CONSTRAINT leadership_scope_assignments_status_check CHECK (status IN ('active', 'revoked', 'expired')),
  CONSTRAINT leadership_scope_assignments_target_check CHECK ((scope_type='tenant' AND branch_id IS NULL AND department_id IS NULL) OR (scope_type='branch' AND branch_id IS NOT NULL AND department_id IS NULL) OR (scope_type='department' AND department_id IS NOT NULL)),
  CONSTRAINT leadership_scope_assignments_dates_check CHECK (ends_on IS NULL OR ends_on >= starts_on),
  CONSTRAINT leadership_scope_assignments_tenant_id_unique UNIQUE (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS leadership_scope_assignments_actor_active_idx ON leadership_scope_assignments(tenant_id,user_id,status,starts_on,ends_on);

CREATE TABLE IF NOT EXISTS leadership_approval_authorities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  assignment_id uuid NOT NULL, domain varchar(30) NOT NULL, action varchar(60) NOT NULL,
  max_amount numeric(14,2), starts_on date NOT NULL, ends_on date,
  delegated_from_authority_id uuid REFERENCES leadership_approval_authorities(id) ON DELETE RESTRICT,
  status varchar(20) NOT NULL DEFAULT 'active', created_by_id text NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT leadership_approval_authorities_domain_check CHECK (domain IN ('academics','attendance','finance','workforce','operations','reporting')),
  CONSTRAINT leadership_approval_authorities_status_check CHECK (status IN ('active','revoked','expired')),
  CONSTRAINT leadership_approval_authorities_amount_check CHECK (max_amount IS NULL OR max_amount >= 0),
  CONSTRAINT leadership_approval_authorities_dates_check CHECK (ends_on IS NULL OR ends_on >= starts_on),
  CONSTRAINT leadership_approval_authorities_tenant_id_unique UNIQUE (tenant_id,id),
  CONSTRAINT leadership_approval_authorities_assignment_tenant_fk FOREIGN KEY (tenant_id,assignment_id) REFERENCES leadership_scope_assignments(tenant_id,id) ON DELETE CASCADE,
  CONSTRAINT leadership_approval_authorities_delegation_not_self_check CHECK (delegated_from_authority_id IS NULL OR delegated_from_authority_id <> id)
);
CREATE INDEX IF NOT EXISTS leadership_approval_authorities_assignment_idx ON leadership_approval_authorities(tenant_id,assignment_id,domain,action,status);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='user_tenant_id_id_unique') THEN
    ALTER TABLE "user" ADD CONSTRAINT user_tenant_id_id_unique UNIQUE (tenant_id,id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='branches_tenant_id_id_unique') THEN
    ALTER TABLE branches ADD CONSTRAINT branches_tenant_id_id_unique UNIQUE (tenant_id,id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='departments_tenant_id_id_unique') THEN
    ALTER TABLE departments ADD CONSTRAINT departments_tenant_id_id_unique UNIQUE (tenant_id,id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='leadership_scope_assignments_user_tenant_fk') THEN
    ALTER TABLE leadership_scope_assignments ADD CONSTRAINT leadership_scope_assignments_user_tenant_fk FOREIGN KEY (tenant_id,user_id) REFERENCES "user"(tenant_id,id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='leadership_scope_assignments_branch_tenant_fk') THEN
    ALTER TABLE leadership_scope_assignments ADD CONSTRAINT leadership_scope_assignments_branch_tenant_fk FOREIGN KEY (tenant_id,branch_id) REFERENCES branches(tenant_id,id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='leadership_scope_assignments_department_tenant_fk') THEN
    ALTER TABLE leadership_scope_assignments ADD CONSTRAINT leadership_scope_assignments_department_tenant_fk FOREIGN KEY (tenant_id,department_id) REFERENCES departments(tenant_id,id) ON DELETE RESTRICT;
  END IF;
END $$;

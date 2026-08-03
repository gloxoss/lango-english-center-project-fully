-- Migration 0045: fee-structure-to-class assignment (which fee structure a
-- class owes), backing the previously-mock fee-allocation-view.tsx.
CREATE TABLE fee_structure_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  fee_structure_id UUID NOT NULL REFERENCES fee_structures(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, fee_structure_id, class_id)
);

CREATE INDEX fee_structure_assignments_class_idx ON fee_structure_assignments (tenant_id, class_id);

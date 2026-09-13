/**
 * Reorder policy: when a product is low, and how much to buy.
 *
 * Kept free of database access so the arithmetic can be tested directly. The
 * suggestion engine in purchases-service supplies the rows; this module only
 * decides.
 */

/** Applied to products with no reorder point of their own. */
export const DEFAULT_REORDER_THRESHOLD = 5;

/**
 * How much cover a suggestion aims to restore, as a multiple of the reorder
 * point, when a product has no reorder quantity of its own. Buying exactly back
 * up to the reorder point would leave the product due to reorder again on the
 * next issue, so the target sits above it.
 */
export const DEFAULT_COVER_MULTIPLE = 3;

/** The smallest suggestion worth raising a purchase order line for. */
export const MIN_SUGGESTED_QUANTITY = 1;

export type ReorderPolicyInput = {
  /** Per-product reorder point in sale units; null when never configured. */
  reorderPoint: number | null | undefined;
  /** Per-product reorder quantity in sale units; null when never configured. */
  reorderQuantity: number | null | undefined;
};

export type ResolvedReorderPolicy = {
  reorderPoint: number;
  /** Where the reorder point came from, so the UI can say "default" honestly. */
  source: 'product' | 'tenant-default';
  reorderQuantity: number | null;
};

/**
 * A configured 0 is a real decision ("let it run to empty"), so only null and
 * undefined fall back to the tenant threshold. Reading 0 as unset is the bug
 * this function exists to avoid.
 */
export function resolveReorderPolicy(
  product: ReorderPolicyInput,
  tenantThreshold: number = DEFAULT_REORDER_THRESHOLD,
): ResolvedReorderPolicy {
  const configured = product.reorderPoint ?? null;

  return {
    reorderPoint: configured === null ? tenantThreshold : configured,
    source: configured === null ? 'tenant-default' : 'product',
    reorderQuantity: product.reorderQuantity ?? null,
  };
}

/**
 * Low means at or below the reorder point. The boundary is inclusive: a product
 * sitting exactly on its reorder point is the moment the point exists to catch.
 */
export function isBelowReorderPoint(currentStock: number, reorderPoint: number): boolean {
  return currentStock <= reorderPoint;
}

/**
 * How many sale units to suggest.
 *
 * A configured reorder quantity is a fixed order size (a supplier's case pack,
 * typically) and is used as-is. Without one, top up to DEFAULT_COVER_MULTIPLE
 * times the reorder point and subtract what is already on the shelf.
 *
 * Negative stock is possible — the ledger allows an oversold balance — and must
 * increase the order rather than corrupt the arithmetic, which subtracting it
 * does naturally.
 */
export function suggestQuantity(currentStock: number, policy: ResolvedReorderPolicy): number {
  if (policy.reorderQuantity !== null) {
    return Math.max(MIN_SUGGESTED_QUANTITY, Math.ceil(policy.reorderQuantity));
  }

  // A reorder point of 0 gives a target of 0, which would suggest nothing at all
  // for a product that has hit empty; the floor keeps the suggestion actionable.
  const target = policy.reorderPoint * DEFAULT_COVER_MULTIPLE;
  return Math.max(MIN_SUGGESTED_QUANTITY, Math.ceil(target - currentStock));
}

export type ReorderDecision = {
  shouldReorder: boolean;
  reorderPoint: number;
  reorderPointSource: 'product' | 'tenant-default';
  suggestedQuantity: number;
};

/** One product's full decision: whether to reorder, and how much. */
export function decideReorder(
  currentStock: number,
  product: ReorderPolicyInput,
  tenantThreshold: number = DEFAULT_REORDER_THRESHOLD,
): ReorderDecision {
  const policy = resolveReorderPolicy(product, tenantThreshold);
  const shouldReorder = isBelowReorderPoint(currentStock, policy.reorderPoint);

  return {
    shouldReorder,
    reorderPoint: policy.reorderPoint,
    reorderPointSource: policy.source,
    suggestedQuantity: shouldReorder ? suggestQuantity(currentStock, policy) : 0,
  };
}

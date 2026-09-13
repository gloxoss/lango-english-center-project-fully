import { describe, expect, it } from 'vitest';
import {
  decideReorder,
  DEFAULT_COVER_MULTIPLE,
  DEFAULT_REORDER_THRESHOLD,
  isBelowReorderPoint,
  resolveReorderPolicy,
  suggestQuantity,
} from './reorder-policy';

describe('resolveReorderPolicy', () => {
  it('uses the product’s own reorder point when it has one', () => {
    const policy = resolveReorderPolicy({ reorderPoint: 40, reorderQuantity: null });

    expect(policy.reorderPoint).toBe(40);
    expect(policy.source).toBe('product');
  });

  it('falls back to the tenant threshold when the product has none', () => {
    const policy = resolveReorderPolicy({ reorderPoint: null, reorderQuantity: null }, 12);

    expect(policy.reorderPoint).toBe(12);
    expect(policy.source).toBe('tenant-default');
  });

  it('treats a configured 0 as a real decision, not as unset', () => {
    // The regression this guards: `product.reorderPoint || threshold` would
    // silently reorder a run-to-empty product at the default threshold.
    const policy = resolveReorderPolicy({ reorderPoint: 0, reorderQuantity: null }, 5);

    expect(policy.reorderPoint).toBe(0);
    expect(policy.source).toBe('product');
  });

  it('defaults the tenant threshold when none is passed', () => {
    expect(resolveReorderPolicy({ reorderPoint: null, reorderQuantity: null }).reorderPoint)
      .toBe(DEFAULT_REORDER_THRESHOLD);
  });
});

describe('isBelowReorderPoint', () => {
  it('is inclusive at the boundary — sitting on the point is the moment to act', () => {
    expect(isBelowReorderPoint(10, 10)).toBe(true);
    expect(isBelowReorderPoint(11, 10)).toBe(false);
    expect(isBelowReorderPoint(9, 10)).toBe(true);
  });

  it('catches an oversold (negative) balance', () => {
    expect(isBelowReorderPoint(-3, 0)).toBe(true);
  });
});

describe('suggestQuantity', () => {
  it('uses a configured reorder quantity verbatim, ignoring current stock', () => {
    const policy = resolveReorderPolicy({ reorderPoint: 10, reorderQuantity: 48 });

    expect(suggestQuantity(2, policy)).toBe(48);
    expect(suggestQuantity(9, policy)).toBe(48);
  });

  it('tops up to a multiple of the reorder point when no quantity is configured', () => {
    const policy = resolveReorderPolicy({ reorderPoint: 10, reorderQuantity: null });

    // target = 10 * DEFAULT_COVER_MULTIPLE, less the 4 already on the shelf.
    expect(suggestQuantity(4, policy)).toBe(10 * DEFAULT_COVER_MULTIPLE - 4);
  });

  it('orders more, not less, when the balance is negative', () => {
    const policy = resolveReorderPolicy({ reorderPoint: 10, reorderQuantity: null });

    expect(suggestQuantity(-5, policy)).toBe(10 * DEFAULT_COVER_MULTIPLE + 5);
  });

  it('never suggests zero for a run-to-empty product that has hit empty', () => {
    // reorderPoint 0 gives a target of 0; without a floor the suggestion would
    // be an order for nothing.
    const policy = resolveReorderPolicy({ reorderPoint: 0, reorderQuantity: null });

    expect(suggestQuantity(0, policy)).toBeGreaterThan(0);
  });

  it('rounds a fractional top-up up, so it clears the reorder point', () => {
    const policy = resolveReorderPolicy({ reorderPoint: 2.5, reorderQuantity: null });

    expect(suggestQuantity(1.2, policy)).toBe(Math.ceil(2.5 * DEFAULT_COVER_MULTIPLE - 1.2));
  });
});

describe('decideReorder', () => {
  it('does not reorder a product that is comfortably stocked', () => {
    const decision = decideReorder(500, { reorderPoint: 40, reorderQuantity: 100 });

    expect(decision.shouldReorder).toBe(false);
    expect(decision.suggestedQuantity).toBe(0);
  });

  it('reorders a bulk product on its own high reorder point', () => {
    // The bug the per-product point fixes: under one global threshold of 5, a
    // product that should be restocked at 40 would sit at 39 and look fine.
    const decision = decideReorder(39, { reorderPoint: 40, reorderQuantity: 200 }, 5);

    expect(decision.shouldReorder).toBe(true);
    expect(decision.reorderPoint).toBe(40);
    expect(decision.reorderPointSource).toBe('product');
    expect(decision.suggestedQuantity).toBe(200);
  });

  it('leaves an expensive product alone until it truly runs out', () => {
    const decision = decideReorder(2, { reorderPoint: 0, reorderQuantity: 1 }, 5);

    expect(decision.shouldReorder).toBe(false);
  });

  it('reports the tenant default as the source for untuned products', () => {
    const decision = decideReorder(3, { reorderPoint: null, reorderQuantity: null }, 5);

    expect(decision.shouldReorder).toBe(true);
    expect(decision.reorderPointSource).toBe('tenant-default');
  });

  it('handles undefined fields the same as null, for rows read before the migration', () => {
    const decision = decideReorder(1, { reorderPoint: undefined, reorderQuantity: undefined }, 5);

    expect(decision.shouldReorder).toBe(true);
    expect(decision.reorderPointSource).toBe('tenant-default');
  });
});

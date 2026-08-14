import { NextResponse } from 'next/server';
import { requireRequestContext, requireTenant } from '@/libs/api/context';
import { apiErrorResponse } from '@/libs/api/errors';
import { requireCapability } from '@/libs/api/permissions';
import { requireAddon } from '@/libs/api/entitlements';
import { listProducts } from '@/features/inventory/services/catalog-service';
import { listMovements, listStockBalances } from '@/features/inventory/services/reconcile-service';

const esc = (v: unknown): string => {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const toCsv = (header: string[], rows: string[][]) =>
  '﻿' + [header.join(','), ...rows.map((r) => r.map(esc).join(','))].join('\r\n');

export async function GET(request: Request) {
  try {
    const context = await requireRequestContext(request);
    const tenantId = requireTenant(context);
    await requireAddon(tenantId, 'inventory');
    await requireCapability(context, 'inventory.export');

    const url = new URL(request.url);
    const type = url.searchParams.get('type') ?? 'stock';

    let filename = `inventory-${type}-${new Date().toISOString().slice(0, 10)}.csv`;
    let csv = '';

    if (type === 'products') {
      const products = await listProducts(tenantId);
      csv = toCsv(
        ['Nom', 'Code', 'Prix achat', 'Prix vente', 'Stock total', 'Stock par magasin'],
        products.map((p) => [
          p.name,
          p.code,
          p.purchasePrice?.toFixed(2) ?? '',
          p.salePrice?.toFixed(2) ?? '',
          p.totalStock,
          p.stockByStore.map((b) => `${b.storeName}: ${b.quantity}`).join('; '),
        ]),
      );
    } else if (type === 'movements') {
      const opts = {
        storeId: url.searchParams.get('storeId'),
        productId: url.searchParams.get('productId'),
        movementType: url.searchParams.get('movementType'),
        refType: url.searchParams.get('refType'),
        from: url.searchParams.get('from'),
        to: url.searchParams.get('to'),
        limit: 1000,
        offset: 0,
      };
      const { rows } = await listMovements(tenantId, opts);
      csv = toCsv(
        ['Date', 'Magasin', 'Produit', 'Code', 'Type', 'Quantité', 'Référence', 'Raison', 'Acteur'],
        rows.map((m) => [
          m.recordedAt,
          m.storeName,
          m.productName,
          m.productCode,
          m.movementType,
          m.qty,
          m.refId ?? '',
          m.reason ?? '',
          m.actorId ?? '',
        ]),
      );
    } else {
      const balances = await listStockBalances(tenantId, {
        storeId: url.searchParams.get('storeId'),
        productId: url.searchParams.get('productId'),
        lowStockQty: url.searchParams.get('lowStock'),
      });
      csv = toCsv(
        ['Magasin', 'Code magasin', 'Produit', 'Code produit', 'Quantité', 'Mis à jour'],
        balances.map((b) => [b.storeName, b.storeCode, b.productName, b.productCode, b.quantity, b.updatedAt]),
      );
    }

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

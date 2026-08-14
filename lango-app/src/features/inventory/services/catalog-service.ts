// Catalog master-data service: categories, units, stores, suppliers, products.
// Every query is tenant-scoped; every foreign id from a request body is re-verified
// `WHERE id=? AND tenantId=?`; "delete" is archive-only and guarded by IN_USE.
import { and, asc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { ApiError } from '@/libs/api/errors';
import { branches } from '@/models/Schema';
import {
  inventoryCategories,
  inventoryIssues,
  inventoryProducts,
  inventoryPurchases,
  inventorySales,
  inventoryStockBalances,
  inventoryStockMovements,
  inventoryStores,
  inventorySuppliers,
  inventoryUnits,
} from '@/models/Schema';
import { qtyToMilli, milliToQty } from './inventory-math';

function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string })?.code === '23505';
}

async function verifyRef(table: any, tenantId: string, id: string | null | undefined, label: string): Promise<void> {
  if (!id) return;
  const [row] = await db.select({ id: table.id }).from(table).where(and(eq(table.id, id), eq(table.tenantId, tenantId))).limit(1);
  if (!row) {
    throw new ApiError(422, 'INVALID_REF', `${label} introuvable dans cet établissement.`);
  }
}

async function existsWhere(conditions: any[]): Promise<boolean> {
  const [row] = await db.select({ one: sql<number>`1` }).from(inventoryProducts).where(and(...conditions)).limit(1);
  return !!row;
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export type CategoryInput = {
  name: string;
  description?: string | null;
  status?: 'active' | 'archived';
};

export async function listCategories(tenantId: string, opts: { status?: 'active' | 'archived'; search?: string } = {}) {
  const conditions = [eq(inventoryCategories.tenantId, tenantId)];
  if (opts.status) conditions.push(eq(inventoryCategories.status, opts.status));
  if (opts.search) conditions.push(ilike(inventoryCategories.name, `%${opts.search}%`));
  return db.select().from(inventoryCategories).where(and(...conditions)).orderBy(asc(inventoryCategories.name));
}

export async function getCategory(tenantId: string, id: string) {
  const [row] = await db.select().from(inventoryCategories).where(and(eq(inventoryCategories.id, id), eq(inventoryCategories.tenantId, tenantId))).limit(1);
  return row ?? null;
}

export async function createCategory(tenantId: string, input: CategoryInput) {
  try {
    const [row] = await db.insert(inventoryCategories).values({
      tenantId,
      name: input.name,
      description: input.description ?? null,
      status: input.status ?? 'active',
    }).returning();
    return row;
  } catch (err) {
    if (isUniqueViolation(err)) throw new ApiError(409, 'DUPLICATE', 'Une catégorie avec ce nom existe déjà.');
    throw err;
  }
}

export async function updateCategory(tenantId: string, id: string, input: Partial<CategoryInput>) {
  const existing = await getCategory(tenantId, id);
  if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Catégorie introuvable dans cet établissement.');
  try {
    const [row] = await db.update(inventoryCategories).set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      updatedAt: sql`now()`,
    }).where(and(eq(inventoryCategories.id, id), eq(inventoryCategories.tenantId, tenantId))).returning();
    return row;
  } catch (err) {
    if (isUniqueViolation(err)) throw new ApiError(409, 'DUPLICATE', 'Une catégorie avec ce nom existe déjà.');
    throw err;
  }
}

export async function archiveCategory(tenantId: string, id: string) {
  const existing = await getCategory(tenantId, id);
  if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Catégorie introuvable dans cet établissement.');
  if (await existsWhere([eq(inventoryProducts.tenantId, tenantId), eq(inventoryProducts.categoryId, id)])) {
    throw new ApiError(409, 'IN_USE', 'Cette catégorie est utilisée par au moins un produit.');
  }
  const [row] = await db.update(inventoryCategories)
    .set({ status: 'archived', updatedAt: sql`now()` })
    .where(and(eq(inventoryCategories.id, id), eq(inventoryCategories.tenantId, tenantId)))
    .returning();
  return row;
}

// ---------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------

export type UnitInput = {
  name: string;
  abbreviation?: string | null;
  status?: 'active' | 'archived';
};

export async function listUnits(tenantId: string, opts: { status?: 'active' | 'archived'; search?: string } = {}) {
  const conditions = [eq(inventoryUnits.tenantId, tenantId)];
  if (opts.status) conditions.push(eq(inventoryUnits.status, opts.status));
  if (opts.search) conditions.push(ilike(inventoryUnits.name, `%${opts.search}%`));
  return db.select().from(inventoryUnits).where(and(...conditions)).orderBy(asc(inventoryUnits.name));
}

export async function getUnit(tenantId: string, id: string) {
  const [row] = await db.select().from(inventoryUnits).where(and(eq(inventoryUnits.id, id), eq(inventoryUnits.tenantId, tenantId))).limit(1);
  return row ?? null;
}

async function unitInUse(tenantId: string, id: string): Promise<boolean> {
  const [row] = await db.select({ one: sql<number>`1` }).from(inventoryProducts)
    .where(and(
      eq(inventoryProducts.tenantId, tenantId),
      or(eq(inventoryProducts.purchaseUnitId, id), eq(inventoryProducts.saleUnitId, id)),
    )).limit(1);
  return !!row;
}

export async function createUnit(tenantId: string, input: UnitInput) {
  try {
    const [row] = await db.insert(inventoryUnits).values({
      tenantId,
      name: input.name,
      abbreviation: input.abbreviation ?? null,
      status: input.status ?? 'active',
    }).returning();
    return row;
  } catch (err) {
    if (isUniqueViolation(err)) throw new ApiError(409, 'DUPLICATE', 'Une unité avec ce nom existe déjà.');
    throw err;
  }
}

export async function updateUnit(tenantId: string, id: string, input: Partial<UnitInput>) {
  const existing = await getUnit(tenantId, id);
  if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Unité introuvable dans cet établissement.');
  try {
    const [row] = await db.update(inventoryUnits).set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.abbreviation !== undefined ? { abbreviation: input.abbreviation } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      updatedAt: sql`now()`,
    }).where(and(eq(inventoryUnits.id, id), eq(inventoryUnits.tenantId, tenantId))).returning();
    return row;
  } catch (err) {
    if (isUniqueViolation(err)) throw new ApiError(409, 'DUPLICATE', 'Une unité avec ce nom existe déjà.');
    throw err;
  }
}

export async function archiveUnit(tenantId: string, id: string) {
  const existing = await getUnit(tenantId, id);
  if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Unité introuvable dans cet établissement.');
  if (await unitInUse(tenantId, id)) {
    throw new ApiError(409, 'IN_USE', 'Cette unité est utilisée par au moins un produit.');
  }
  const [row] = await db.update(inventoryUnits)
    .set({ status: 'archived', updatedAt: sql`now()` })
    .where(and(eq(inventoryUnits.id, id), eq(inventoryUnits.tenantId, tenantId)))
    .returning();
  return row;
}

// ---------------------------------------------------------------------------
// Stores
// ---------------------------------------------------------------------------

export type StoreInput = {
  name: string;
  code: string;
  branchId?: string | null;
  mobile?: string | null;
  address?: string | null;
  description?: string | null;
  status?: 'active' | 'archived';
};

export async function listStores(tenantId: string, opts: { status?: 'active' | 'archived'; search?: string } = {}) {
  const conditions = [eq(inventoryStores.tenantId, tenantId)];
  if (opts.status) conditions.push(eq(inventoryStores.status, opts.status));
  const searchCond = opts.search ? or(ilike(inventoryStores.name, `%${opts.search}%`), ilike(inventoryStores.code, `%${opts.search}%`)) : undefined;
  if (searchCond) conditions.push(searchCond);
  return db.select().from(inventoryStores).where(and(...conditions)).orderBy(asc(inventoryStores.name));
}

export async function getStore(tenantId: string, id: string) {
  const [row] = await db.select().from(inventoryStores).where(and(eq(inventoryStores.id, id), eq(inventoryStores.tenantId, tenantId))).limit(1);
  return row ?? null;
}

export async function createStore(tenantId: string, input: StoreInput) {
  await verifyRef(branches, tenantId, input.branchId, 'La succursale');
  try {
    const [row] = await db.insert(inventoryStores).values({
      tenantId,
      name: input.name,
      code: input.code,
      branchId: input.branchId ?? null,
      mobile: input.mobile ?? null,
      address: input.address ?? null,
      description: input.description ?? null,
      status: input.status ?? 'active',
    }).returning();
    return row;
  } catch (err) {
    if (isUniqueViolation(err)) throw new ApiError(409, 'DUPLICATE', 'Un magasin avec ce code existe déjà.');
    throw err;
  }
}

export async function updateStore(tenantId: string, id: string, input: Partial<StoreInput>) {
  const existing = await getStore(tenantId, id);
  if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Magasin introuvable dans cet établissement.');
  await verifyRef(branches, tenantId, input.branchId !== undefined ? input.branchId : existing.branchId, 'La succursale');
  try {
    const [row] = await db.update(inventoryStores).set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.code !== undefined ? { code: input.code } : {}),
      ...(input.branchId !== undefined ? { branchId: input.branchId } : {}),
      ...(input.mobile !== undefined ? { mobile: input.mobile } : {}),
      ...(input.address !== undefined ? { address: input.address } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      updatedAt: sql`now()`,
    }).where(and(eq(inventoryStores.id, id), eq(inventoryStores.tenantId, tenantId))).returning();
    return row;
  } catch (err) {
    if (isUniqueViolation(err)) throw new ApiError(409, 'DUPLICATE', 'Un magasin avec ce code existe déjà.');
    throw err;
  }
}

export async function archiveStore(tenantId: string, id: string) {
  const existing = await getStore(tenantId, id);
  if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Magasin introuvable dans cet établissement.');
  const usedIn = (t: any, cond: any) => db.select({ one: sql<number>`1` }).from(t).where(cond).limit(1);
  const checks = [
    usedIn(inventoryPurchases, and(eq(inventoryPurchases.tenantId, tenantId), eq(inventoryPurchases.storeId, id))),
    usedIn(inventorySales, and(eq(inventorySales.tenantId, tenantId), eq(inventorySales.storeId, id))),
    usedIn(inventoryIssues, and(eq(inventoryIssues.tenantId, tenantId), eq(inventoryIssues.storeId, id))),
    usedIn(inventoryStockMovements, and(eq(inventoryStockMovements.tenantId, tenantId), eq(inventoryStockMovements.storeId, id))),
    usedIn(inventoryStockBalances, and(eq(inventoryStockBalances.tenantId, tenantId), eq(inventoryStockBalances.storeId, id))),
  ];
  for (const check of checks) {
    const [row] = await check;
    if (row) throw new ApiError(409, 'IN_USE', 'Ce magasin est utilisé par des mouvements ou documents de stock.');
  }
  const [row] = await db.update(inventoryStores)
    .set({ status: 'archived', updatedAt: sql`now()` })
    .where(and(eq(inventoryStores.id, id), eq(inventoryStores.tenantId, tenantId)))
    .returning();
  return row;
}

// ---------------------------------------------------------------------------
// Suppliers
// ---------------------------------------------------------------------------

export type SupplierInput = {
  name: string;
  companyName?: string | null;
  address?: string | null;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  status?: 'active' | 'archived';
};

export async function listSuppliers(tenantId: string, opts: { status?: 'active' | 'archived'; search?: string } = {}) {
  const conditions = [eq(inventorySuppliers.tenantId, tenantId)];
  if (opts.status) conditions.push(eq(inventorySuppliers.status, opts.status));
  const searchCond = opts.search ? or(ilike(inventorySuppliers.name, `%${opts.search}%`), ilike(inventorySuppliers.companyName, `%${opts.search}%`)) : undefined;
  if (searchCond) conditions.push(searchCond);
  return db.select().from(inventorySuppliers).where(and(...conditions)).orderBy(asc(inventorySuppliers.name));
}

export async function getSupplier(tenantId: string, id: string) {
  const [row] = await db.select().from(inventorySuppliers).where(and(eq(inventorySuppliers.id, id), eq(inventorySuppliers.tenantId, tenantId))).limit(1);
  return row ?? null;
}

export async function createSupplier(tenantId: string, input: SupplierInput) {
  try {
    const [row] = await db.insert(inventorySuppliers).values({
      tenantId,
      name: input.name,
      companyName: input.companyName ?? null,
      address: input.address ?? null,
      contactName: input.contactName ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      status: input.status ?? 'active',
    }).returning();
    return row;
  } catch (err) {
    if (isUniqueViolation(err)) throw new ApiError(409, 'DUPLICATE', 'Un fournisseur avec ce nom existe déjà.');
    throw err;
  }
}

export async function updateSupplier(tenantId: string, id: string, input: Partial<SupplierInput>) {
  const existing = await getSupplier(tenantId, id);
  if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Fournisseur introuvable dans cet établissement.');
  try {
    const [row] = await db.update(inventorySuppliers).set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.companyName !== undefined ? { companyName: input.companyName } : {}),
      ...(input.address !== undefined ? { address: input.address } : {}),
      ...(input.contactName !== undefined ? { contactName: input.contactName } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      updatedAt: sql`now()`,
    }).where(and(eq(inventorySuppliers.id, id), eq(inventorySuppliers.tenantId, tenantId))).returning();
    return row;
  } catch (err) {
    if (isUniqueViolation(err)) throw new ApiError(409, 'DUPLICATE', 'Un fournisseur avec ce nom existe déjà.');
    throw err;
  }
}

export async function archiveSupplier(tenantId: string, id: string) {
  const existing = await getSupplier(tenantId, id);
  if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Fournisseur introuvable dans cet établissement.');
  const [used] = await db.select({ one: sql<number>`1` }).from(inventoryPurchases)
    .where(and(eq(inventoryPurchases.tenantId, tenantId), eq(inventoryPurchases.supplierId, id))).limit(1);
  if (used) throw new ApiError(409, 'IN_USE', 'Ce fournisseur est référencé par des achats.');
  const [row] = await db.update(inventorySuppliers)
    .set({ status: 'archived', updatedAt: sql`now()` })
    .where(and(eq(inventorySuppliers.id, id), eq(inventorySuppliers.tenantId, tenantId)))
    .returning();
  return row;
}

// ---------------------------------------------------------------------------
// Products (stock lives only in the ledger/balance projection — see §19)
// ---------------------------------------------------------------------------

export type ProductInput = {
  name: string;
  code: string;
  categoryId?: string | null;
  purchaseUnitId?: string | null;
  saleUnitId?: string | null;
  unitRatio?: string;
  purchasePrice?: number | null;
  salePrice?: number | null;
  remarks?: string | null;
  isActive?: boolean;
};

type BalanceRow = { productId: string; storeId: string; storeName: string; storeCode: string; quantity: string };

async function loadBalances(tenantId: string, productIds: string[]): Promise<BalanceRow[]> {
  if (productIds.length === 0) return [];
  const rows = await db.select({
    productId: inventoryStockBalances.productId,
    storeId: inventoryStockBalances.storeId,
    storeName: inventoryStores.name,
    storeCode: inventoryStores.code,
    quantity: inventoryStockBalances.quantity,
  })
    .from(inventoryStockBalances)
    .innerJoin(inventoryStores, eq(inventoryStores.id, inventoryStockBalances.storeId))
    .where(and(
      eq(inventoryStockBalances.tenantId, tenantId),
      inArray(inventoryStockBalances.productId, productIds),
    ))
    .orderBy(asc(inventoryStores.name));
  return rows;
}

export async function listProducts(
  tenantId: string,
  opts: { status?: 'active' | 'archived'; categoryId?: string | null; search?: string; includeArchived?: boolean } = {},
) {
  const conditions = [eq(inventoryProducts.tenantId, tenantId)];
  if (opts.categoryId) conditions.push(eq(inventoryProducts.categoryId, opts.categoryId));
  if (opts.includeArchived !== true) conditions.push(eq(inventoryProducts.isActive, true));
  const searchCond = opts.search ? or(ilike(inventoryProducts.name, `%${opts.search}%`), ilike(inventoryProducts.code, `%${opts.search}%`)) : undefined;
  if (searchCond) conditions.push(searchCond);

  const products = await db.select().from(inventoryProducts).where(and(...conditions)).orderBy(asc(inventoryProducts.name));
  const balances = await loadBalances(tenantId, products.map((p) => p.id));

  const grouped = new Map<string, BalanceRow[]>();
  for (const b of balances) {
    const list = grouped.get(b.productId) ?? [];
    list.push(b);
    grouped.set(b.productId, list);
  }

  return products.map((p) => {
    const stockByStore = grouped.get(p.id) ?? [];
    const totalMilli = stockByStore.reduce((acc, b) => acc + qtyToMilli(b.quantity), BigInt(0));
    return {
      ...p,
      stockByStore,
      totalStock: milliToQty(totalMilli),
      marginWarning: p.purchasePrice !== null && p.purchasePrice !== undefined && p.salePrice !== null && p.salePrice !== undefined
        ? p.salePrice < p.purchasePrice
        : false,
    };
  });
}

export async function getProduct(tenantId: string, id: string) {
  const [product] = await db.select().from(inventoryProducts).where(and(eq(inventoryProducts.id, id), eq(inventoryProducts.tenantId, tenantId))).limit(1);
  if (!product) return null;
  const balances = await loadBalances(tenantId, [id]);
  const totalMilli = balances.reduce((acc, b) => acc + qtyToMilli(b.quantity), BigInt(0));
  return {
    ...product,
    stockByStore: balances,
    totalStock: milliToQty(totalMilli),
    marginWarning: product.purchasePrice !== null && product.purchasePrice !== undefined && product.salePrice !== null && product.salePrice !== undefined
      ? product.salePrice < product.purchasePrice
      : false,
  };
}

export async function createProduct(tenantId: string, input: ProductInput) {
  await verifyRef(inventoryCategories, tenantId, input.categoryId, 'La catégorie');
  await verifyRef(inventoryUnits, tenantId, input.purchaseUnitId, 'L\'unité d\'achat');
  await verifyRef(inventoryUnits, tenantId, input.saleUnitId, 'L\'unité de vente');
  try {
    const [row] = await db.insert(inventoryProducts).values({
      tenantId,
      name: input.name,
      code: input.code,
      categoryId: input.categoryId ?? null,
      purchaseUnitId: input.purchaseUnitId ?? null,
      saleUnitId: input.saleUnitId ?? null,
      unitRatio: input.unitRatio ?? '1',
      purchasePrice: input.purchasePrice ?? null,
      salePrice: input.salePrice ?? null,
      remarks: input.remarks ?? null,
      isActive: input.isActive ?? true,
    }).returning();
    if (!row) throw new ApiError(500, 'INSERT_FAILED', 'Échec de l\'enregistrement du produit.');
    return getProduct(tenantId, row.id);
  } catch (err) {
    if (isUniqueViolation(err)) throw new ApiError(409, 'DUPLICATE', 'Un produit avec ce code existe déjà.');
    throw err;
  }
}

export async function updateProduct(tenantId: string, id: string, input: Partial<ProductInput>) {
  const existing = await getProduct(tenantId, id);
  if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Produit introuvable dans cet établissement.');
  await verifyRef(inventoryCategories, tenantId, input.categoryId !== undefined ? input.categoryId : existing.categoryId, 'La catégorie');
  await verifyRef(inventoryUnits, tenantId, input.purchaseUnitId !== undefined ? input.purchaseUnitId : existing.purchaseUnitId, 'L\'unité d\'achat');
  await verifyRef(inventoryUnits, tenantId, input.saleUnitId !== undefined ? input.saleUnitId : existing.saleUnitId, 'L\'unité de vente');
  try {
    const [row] = await db.update(inventoryProducts).set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.code !== undefined ? { code: input.code } : {}),
      ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
      ...(input.purchaseUnitId !== undefined ? { purchaseUnitId: input.purchaseUnitId } : {}),
      ...(input.saleUnitId !== undefined ? { saleUnitId: input.saleUnitId } : {}),
      ...(input.unitRatio !== undefined ? { unitRatio: input.unitRatio } : {}),
      ...(input.purchasePrice !== undefined ? { purchasePrice: input.purchasePrice } : {}),
      ...(input.salePrice !== undefined ? { salePrice: input.salePrice } : {}),
      ...(input.remarks !== undefined ? { remarks: input.remarks } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      updatedAt: sql`now()`,
    }).where(and(eq(inventoryProducts.id, id), eq(inventoryProducts.tenantId, tenantId))).returning();
    if (!row) throw new ApiError(500, 'UPDATE_FAILED', 'Échec de la mise à jour du produit.');
    return getProduct(tenantId, row.id);
  } catch (err) {
    if (isUniqueViolation(err)) throw new ApiError(409, 'DUPLICATE', 'Un produit avec ce code existe déjà.');
    throw err;
  }
}

export async function archiveProduct(tenantId: string, id: string) {
  const existing = await getProduct(tenantId, id);
  if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Produit introuvable dans cet établissement.');
  const [used] = await db.select({ one: sql<number>`1` }).from(inventoryStockMovements)
    .where(and(eq(inventoryStockMovements.tenantId, tenantId), eq(inventoryStockMovements.productId, id))).limit(1);
  if (used) throw new ApiError(409, 'IN_USE', 'Ce produit a déjà un historique de stock.');
  const [row] = await db.update(inventoryProducts)
    .set({ isActive: false, updatedAt: sql`now()` })
    .where(and(eq(inventoryProducts.id, id), eq(inventoryProducts.tenantId, tenantId)))
    .returning();
  if (!row) throw new ApiError(500, 'UPDATE_FAILED', 'Échec de l\'archivage du produit.');
  return getProduct(tenantId, row.id);
}

import { checkDomainReadiness } from '../services/readiness-checker';

export class InventoryAdapter {
  private static ensureReady() {
    const readiness = checkDomainReadiness('Inventory');
    if (!readiness.isReady) {
      throw new Error(`Module Gestion des Stocks non disponible: ${readiness.reason}`);
    }
  }

  /**
   * 1. Stock Valuation Report.
   */
  static async getStockValuationReport(tenantId: string, params?: any) {
    this.ensureReady();
    return [
      { itemCode: 'MAN-ENG-B2', itemName: 'Manuel Anglais B2 (Student Book)', quantityOnHand: 150, unitPrice: 220, totalValuation: 33000 },
      { itemCode: 'MAN-ENG-C1', itemName: 'Manuel Anglais C1 (Advanced)', quantityOnHand: 80, unitPrice: 250, totalValuation: 20000 },
    ];
  }

  /**
   * 2. Purchase Summary Report.
   */
  static async getPurchaseSummaryReport(tenantId: string, params?: any) {
    this.ensureReady();
    return [
      { poNumber: 'BC-2026-045', supplierName: 'Éditions Oxford University Press', orderDate: '2026-07-15', totalAmount: 45000 },
    ];
  }

  /**
   * 3. Sales Revenue Report.
   */
  static async getSalesRevenueReport(tenantId: string, params?: any) {
    this.ensureReady();
    return [
      { receiptNumber: 'VENTE-0012', customerName: 'Yassine Alami', itemsCount: 2, totalRevenue: 470 },
    ];
  }

  /**
   * 4. Issues & Custody Report.
   */
  static async getIssuesCustodyReport(tenantId: string, params?: any) {
    this.ensureReady();
    return [
      { issueId: 'PRET-089', borrowerName: 'Enseignant Karim', itemName: 'Projecteur Epson HDMI #3', issueDate: '2026-08-01', dueDate: '2026-08-10', isOverdue: false },
    ];
  }
}

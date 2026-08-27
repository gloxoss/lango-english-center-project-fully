import { requireServerPage } from '@/libs/api/page-guard';
import { PayrollHub } from '@/features/workforce/ui/payroll-workspace';
export default async function Page({params}:{params:Promise<{locale:string}>}){const{locale}=await params;await requireServerPage(locale,{ requiredCapability: 'payroll.review' });return <PayrollHub/>}

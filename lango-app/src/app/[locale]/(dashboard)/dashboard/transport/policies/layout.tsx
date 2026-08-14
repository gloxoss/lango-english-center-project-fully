import { requireTransportPage, type TransportLayoutProps } from '@/features/transport/ui/page-guard';
export default async function Layout({ children, params }: TransportLayoutProps) { const { locale } = await params; await requireTransportPage(locale, { allowedRoles: ['school_admin', 'super_admin'], requiredCapability: 'transport.policy.manage' }); return children; }

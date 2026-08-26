import { AcceptInviteClient } from './accept-invite-client';

export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  return <AcceptInviteClient locale={locale} token={token} />;
}

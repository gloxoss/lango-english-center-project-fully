// Barrel that registers every provider adapter into the registry. Import this
// (instead of an individual provider file) anywhere provider lookups must see
// the full adapter set.
import './test-provider';
import './webhook-provider';
import './whatsapp-waha-provider';
import './android-sms-provider';
import './twilio-sms-provider';
import './smsto-provider';
import './resend-email-provider';
import './brevo-email-provider';

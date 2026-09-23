import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { getProvider } from '../provider';
import '../index'; // loads all providers
import { WhatsAppWahaProvider, formatWhatsAppChatId } from '../whatsapp-waha-provider';
import { AndroidSmsProvider } from '../android-sms-provider';
import { TwilioSmsProvider } from '../twilio-sms-provider';
import { SmsToProvider } from '../smsto-provider';
import { ResendEmailProvider } from '../resend-email-provider';
import { BrevoEmailProvider } from '../brevo-email-provider';

describe('Broadcast Concrete Providers', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('Registry Integration', () => {
    it('registers all real providers with expected identifiers', () => {
      expect(getProvider('whatsapp-waha')).toBeInstanceOf(WhatsAppWahaProvider);
      expect(getProvider('android-sms')).toBeInstanceOf(AndroidSmsProvider);
      expect(getProvider('twilio')).toBeInstanceOf(TwilioSmsProvider);
      expect(getProvider('smsto')).toBeInstanceOf(SmsToProvider);
      expect(getProvider('resend')).toBeInstanceOf(ResendEmailProvider);
      expect(getProvider('brevo')).toBeInstanceOf(BrevoEmailProvider);
    });
  });

  describe('WhatsApp WAHA Provider', () => {
    it('normalizes Moroccan phone to WhatsApp chatId', () => {
      expect(formatWhatsAppChatId('0661223344')).toBe('212661223344@c.us');
      expect(formatWhatsAppChatId('+212712345678')).toBe('212712345678@c.us');
      expect(formatWhatsAppChatId('12345678@s.whatsapp.net')).toBe('12345678@s.whatsapp.net');
    });

    it('sends text message via WAHA endpoint', async () => {
      const provider = new WhatsAppWahaProvider();
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ id: 'msg_waha_123' }),
      });

      const res = await provider.send({
        channel: 'whatsapp',
        to: '0661223344',
        bodyText: 'Bonjour de SchoolOS',
        config: {
          endpointUrl: 'https://waha.example.com',
          apiKey: 'secret_waha',
          session: 'atlas',
        },
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.status).toBe('delivered');
        expect(res.providerRef).toBe('msg_waha_123');
      }

      expect(global.fetch).toHaveBeenCalledWith(
        'https://waha.example.com/api/sendText',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-Api-Key': 'secret_waha',
          }),
          body: JSON.stringify({
            chatId: '212661223344@c.us',
            text: 'Bonjour de SchoolOS',
            session: 'atlas',
          }),
        })
      );
    });

    it('tests WAHA connection against sessions endpoint', async () => {
      const provider = new WhatsAppWahaProvider();
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [{ name: 'default', status: 'WORKING' }],
      });

      const conn = await provider.testConnection({
        endpointUrl: 'http://localhost:3000',
        session: 'default',
      });

      expect(conn.ok).toBe(true);
      expect(conn.message).toContain('WORKING');
    });
  });

  describe('Android SMS Gateway Provider', () => {
    it('normalizes Moroccan phone number and interpolates device ID', async () => {
      const provider = new AndroidSmsProvider();
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ id: 'sms_relay_001' }),
      });

      const res = await provider.send({
        channel: 'sms',
        to: '06 61 22 33 44',
        bodyText: 'Rappel absence élève',
        config: {
          endpointUrl: 'https://api.textbee.dev/api/v1/gateway/devices/{deviceId}/send-sms',
          deviceId: 'device-xyz',
          apiKey: 'tb_key_123',
          simSlot: 1,
        },
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.providerRef).toBe('sms_relay_001');
      }

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.textbee.dev/api/v1/gateway/devices/device-xyz/send-sms',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('+212661223344'),
        })
      );
    });

    it('tests connection to Android SMS gateway', async () => {
      const provider = new AndroidSmsProvider();
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      const conn = await provider.testConnection({
        endpointUrl: 'http://192.168.1.50:8080/send-sms',
        apiKey: 'phone_token',
      });

      expect(conn.ok).toBe(true);
      expect(conn.message).toContain('joignable');
    });
  });

  describe('Twilio Provider', () => {
    it('sends SMS with basic auth and url-encoded body', async () => {
      const provider = new TwilioSmsProvider();
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        text: async () => JSON.stringify({ sid: 'SM123456789' }),
      });

      const res = await provider.send({
        channel: 'sms',
        to: '0712345678',
        bodyText: 'Code de sécurité SchoolOS',
        config: {
          accountSid: 'AC_TEST_SID',
          authToken: 'AUTH_TOKEN_TEST',
          fromNumber: '+1234567890',
        },
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.providerRef).toBe('SM123456789');
      }

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.twilio.com/2010-04-01/Accounts/AC_TEST_SID/Messages.json',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: expect.stringMatching(/^Basic /),
          }),
        })
      );
    });

    it('handles WhatsApp channel by prefixing whatsapp:', async () => {
      const provider = new TwilioSmsProvider();
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        text: async () => JSON.stringify({ sid: 'SM_WA_999' }),
      });

      await provider.send({
        channel: 'whatsapp',
        to: '+212600000000',
        bodyText: 'Notification WhatsApp Twilio',
        config: {
          accountSid: 'AC_TEST_SID',
          authToken: 'AUTH_TOKEN_TEST',
          fromNumber: '+14155238886',
        },
      });

      const callArgs = (global.fetch as any).mock.calls[0];
      const body = callArgs[1].body as string;
      expect(body).toContain('whatsapp%3A%2B212600000000');
      expect(body).toContain('whatsapp%3A%2B14155238886');
    });

    it('tests Twilio connection by querying account details', async () => {
      const provider = new TwilioSmsProvider();
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ friendly_name: 'SchoolOS Prod' }),
      });

      const conn = await provider.testConnection({
        accountSid: 'AC_TEST_SID',
        authToken: 'AUTH_TOKEN_TEST',
      });

      expect(conn.ok).toBe(true);
      expect(conn.message).toContain('SchoolOS Prod');
    });
  });

  describe('SMS.to Provider', () => {
    it('sends SMS via SMS.to JSON API', async () => {
      const provider = new SmsToProvider();
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ message_id: 'smsto_9988' }),
      });

      const res = await provider.send({
        channel: 'sms',
        to: '0661001122',
        bodyText: 'Rappel paiement scolarite',
        config: {
          apiKey: 'smsto_key_secret',
          senderId: 'AtlasSchool',
        },
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.providerRef).toBe('smsto_9988');
      }

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.sms.to/sms/send',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer smsto_key_secret',
          }),
          body: JSON.stringify({
            to: '+212661001122',
            message: 'Rappel paiement scolarite',
            sender_id: 'AtlasSchool',
          }),
        })
      );
    });

    it('tests SMS.to balance endpoint', async () => {
      const provider = new SmsToProvider();
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ balance: 150.5, currency: 'EUR' }),
      });

      const conn = await provider.testConnection({
        apiKey: 'smsto_key_secret',
      });

      expect(conn.ok).toBe(true);
      expect(conn.message).toContain('150.5 EUR');
    });
  });

  describe('Resend Email Provider', () => {
    it('sends email with HTML and text', async () => {
      const provider = new ResendEmailProvider();
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ id: 'resend_email_777' }),
      });

      const res = await provider.send({
        channel: 'email',
        to: 'parent@famille.ma',
        subject: 'Bulletin Trimestriel',
        bodyText: 'Veuillez trouver ci-joint votre bulletin.',
        bodyHtml: '<p>Veuillez trouver ci-joint votre bulletin.</p>',
        config: {
          apiKey: 're_12345678',
          fromAddress: 'SchoolOS <bulletins@schoolos.ma>',
        },
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.providerRef).toBe('resend_email_777');
      }

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.resend.com/emails',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer re_12345678',
          }),
        })
      );
    });

    it('tests Resend api-keys endpoint', async () => {
      const provider = new ResendEmailProvider();
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });

      const conn = await provider.testConnection({
        apiKey: 're_12345678',
      });

      expect(conn.ok).toBe(true);
      expect(conn.message).toContain('authentifié avec succès');
    });
  });

  describe('Brevo Email Provider', () => {
    it('sends transactional email via Brevo SMTP API', async () => {
      const provider = new BrevoEmailProvider();
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        text: async () => JSON.stringify({ messageId: '<brevo-uuid@smtp-relay.mailin.fr>' }),
      });

      const res = await provider.send({
        channel: 'email',
        to: 'contact@parent.ma',
        subject: 'Reçu de paiement frais scolarité',
        bodyText: 'Reçu de paiement N° 2026-0045.',
        config: {
          apiKey: 'xkeysib-1234567890',
          fromAddress: 'finance@atlas.ma',
          fromName: 'Groupe Scolaire Atlas',
        },
      });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.providerRef).toBe('<brevo-uuid@smtp-relay.mailin.fr>');
      }

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.brevo.com/v3/smtp/email',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'api-key': 'xkeysib-1234567890',
          }),
        })
      );
    });

    it('tests Brevo account endpoint', async () => {
      const provider = new BrevoEmailProvider();
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ email: 'directeur@atlas.ma' }),
      });

      const conn = await provider.testConnection({
        apiKey: 'xkeysib-1234567890',
      });

      expect(conn.ok).toBe(true);
      expect(conn.message).toContain('directeur@atlas.ma');
    });
  });
});

# Section 37: Moroccan Telco Gateway Wizard & GSM-7 SMS Assistant

## 1. Overview & Business Value
Protects schools from unintended telecom billing spikes across Moroccan networks (Maroc Telecom, Orange Maroc, Inwi) by enforcing strict GSM-7 character encoding and cost optimization. Provides an interactive testing wizard to verify credentials and send live test SMS messages in 1 click.

## 2. Target Files & Architecture
- **GSM-7 Helper**: `src/libs/sms/gsm7.ts` [NEW]
  - `isGsm7String(text: string): boolean`: Detects whether text contains characters outside standard 7-bit GSM alphabet.
  - `countSmsSegments(text: string): { charsCount: number; segmentCount: number; isGsm7: boolean; remainingInCurrentSegment: number; nonGsmChars: string[] }`:
    - GSM-7: 160 chars for 1 segment, 153 chars/segment for concatenated SMS.
    - UCS-2/Unicode: 70 chars for 1 segment, 67 chars/segment for concatenated SMS.
  - `sanitizeToGsm7(text: string): string`: Converts non-GSM characters into standard French/Moroccan GSM-7 equivalents (`ê` -> `e`, `à` -> `a`, `’` -> `'`, `«` -> `"`, etc.).
- **UI Enhancements**:
  - `src/features/communication/ui/sms-reminders-view.tsx` & broadcast message composer:
    - Real-time character & segment counter: "142 / 160 car. (1 SMS)" in green, or "⚠️ Unicode détecté (72 car. = 2 SMS)" in amber.
    - 1-click button "Optimiser pour GSM-7 économique" to replace costly accents without altering the meaning.
  - Test modal in `src/features/broadcast/ui/connections-view.tsx`:
    - Enter Moroccan phone number (`06...` or `07...`), type custom test text, and click "Envoyer SMS réel".
    - Displays real-time API response and delivery receipt ID.

## 3. Acceptance Criteria
1. GSM-7 character calculations accurately predict operator segment charging.
2. Sanitizer preserves French and Arabic phonetics while stripping UTF-16 cost traps.
3. Live SMS test modal supports all configured providers (`smsto`, `twilio`, `android-sms`, `webhook`).

import type { Font } from '@pdfme/common';

export const loadFonts = async (): Promise<Font> => {
  const getFontData = async (url: string) => {
    if (typeof window === 'undefined') {
      // Server-side
      const fs = await import('fs/promises');
      const path = await import('path');
      const filePath = path.join(process.cwd(), 'public', url);
      const buffer = await fs.readFile(filePath);
      return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
    } else {
      // Client-side
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to load font: ${url}`);
      }
      return await res.arrayBuffer();
    }
  };

  const [robotoRegular, notoSansArabic] = await Promise.all([
    getFontData('/fonts/Roboto-Regular.ttf'),
    getFontData('/fonts/NotoSansArabic-Regular.ttf'),
  ]);

  return {
    Roboto: {
      data: robotoRegular,
      fallback: true,
    },
    'Noto Sans Arabic': {
      data: notoSansArabic,
      fallback: false,
    },
  };
};

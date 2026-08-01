export interface MarketingNavItem {
  id: string;
  labelKey: string;
  href: string;
}

export interface HeroContent {
  title: string;
  subtitle: string;
  primaryCtaText: string;
  secondaryCtaText: string;
  tickerLogos: Array<{ id: string; name: string; logoUrl: string }>;
  heroCardMainUrl: string;
  heroCardSecondaryUrl: string;
}

export interface ProcessStep {
  stepNumber: string;
  title: string;
  description: string;
}

export interface FeatureTab {
  id: string;
  tag: string;
  title: string;
  description: string;
  iconSvg?: string;
  imageUrl?: string;
}

export interface IntegrationTool {
  id: string;
  name: string;
  category: string;
  logoUrl: string;
}

export interface PricingTier {
  id: number;
  menuTitle: string;
  menuSubtitle: string;
  planName: string;
  price: string;
  currency: string;
  period: string;
  description: string;
  features: string[];
  isMain: boolean;
}

export interface TestimonialItem {
  id: string;
  quote: string;
  authorName: string;
  authorTitle: string;
  institution: string;
  avatarUrl?: string;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface RatingProfile {
  src: string;
  alt: string;
}

export interface ContactContent {
  title: string;
  subtitle: string;
  phone: string;
  email: string;
  ratingText: string;
  ratingSubtext: string;
  profiles: RatingProfile[];
}

export interface FooterLink {
  label: string;
  href: string;
}

export interface FooterContent {
  newsletterTitle: string;
  newsletterButtonText: string;
  contactEmail: string;
  designedByText: string;
  poweredByText: string;
  navLinks: FooterLink[];
}

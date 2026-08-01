'use client';

import React from 'react';
import { HeroSection } from './hero-section';
import { ProcessSection } from './process-section';
import { FeaturesSection } from './features-section';
import { IntegrationSection } from './integration-section';
import { TestimonialsSection } from './testimonials-section';
import { PricingSection } from './pricing-section';
import { FaqSection } from './faq-section';
import { ContactSection } from './contact-section';

export const MarketingHomeView: React.FC = () => {
  return (
    <div className="w-full min-h-screen bg-[#F8FAFC]">
      <HeroSection />
      <ProcessSection />
      <FeaturesSection />
      <IntegrationSection />
      <TestimonialsSection />
      <PricingSection />
      <FaqSection />
      <ContactSection />
    </div>
  );
};

'use client';

import React, { useState } from 'react';
import { X, CheckCircle, School, Phone, Mail, Building, Users, MapPin, Send } from 'lucide-react';

interface DemoRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DemoRequestModal: React.FC<DemoRequestModalProps> = ({ isOpen, onClose }) => {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    fullName: '',
    schoolName: '',
    schoolType: 'k12_private',
    city: 'Casablanca',
    studentCount: '200_600',
    phone: '',
    email: '',
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 800);
  };

  const handleReset = () => {
    setSubmitted(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#16212B]/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden border border-[#E4EBF2]">
        {/* Header */}
        <div className="bg-[#EDF3F8] px-6 py-4 flex items-center justify-between border-b border-[#E4EBF2]">
          <div className="flex items-center gap-2">
            <School className="w-5 h-5 text-[#2487B8]" />
            <h3 className="text-base font-bold text-[#16212B]">
              Demander une démonstration
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#8FA0AE] hover:text-[#16212B] rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {submitted ? (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 bg-[#DDF5EC] text-[#17A673] rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-10 h-10" />
              </div>
              <h4 className="text-xl font-bold text-[#16212B]">
                Demande envoyée avec succès !
              </h4>
              <p className="text-sm text-[#5A6B7A] max-w-xs mx-auto">
                Merci {formData.fullName}. Notre équipe dédiée prendra contact avec vous sur le{' '}
                <span className="font-semibold text-[#16212B]">{formData.phone}</span> pour planifier votre démo personnalisée.
              </p>
              <button
                onClick={handleReset}
                className="mt-4 px-6 py-2.5 bg-[#2487B8] text-white font-semibold rounded-xl text-sm hover:bg-[#1B6C93] transition-colors"
              >
                Fermer
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-xs text-[#5A6B7A]">
                Remplissez ce formulaire pour découvrir comment SchoolOS peut optimiser la gestion de votre établissement au Maroc.
              </p>

              <div>
                <label className="block text-xs font-semibold text-[#16212B] mb-1">
                  Nom du Responsable / Directeur *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex: M. Youssef El Amrani"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-[#CFDAE4] focus:outline-none focus:ring-2 focus:ring-[#2487B8]/30 focus:border-[#2487B8]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#16212B] mb-1">
                    Établissement *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ex: Groupe Scolaire Atlas"
                    value={formData.schoolName}
                    onChange={(e) => setFormData({ ...formData, schoolName: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-[#CFDAE4] focus:outline-none focus:ring-2 focus:ring-[#2487B8]/30 focus:border-[#2487B8]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#16212B] mb-1">
                    Type d'établissement
                  </label>
                  <select
                    value={formData.schoolType}
                    onChange={(e) => setFormData({ ...formData, schoolType: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-[#CFDAE4] focus:outline-none focus:ring-2 focus:ring-[#2487B8]/30 focus:border-[#2487B8]"
                  >
                    <option value="k12_private">Écoles Privées (K-12)</option>
                    <option value="language_center">Centre de Langues</option>
                    <option value="higher_ed">Enseignement Supérieur</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#16212B] mb-1">
                    Ville *
                  </label>
                  <select
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-[#CFDAE4] focus:outline-none focus:ring-2 focus:ring-[#2487B8]/30 focus:border-[#2487B8]"
                  >
                    <option value="Casablanca">Casablanca</option>
                    <option value="Rabat">Rabat</option>
                    <option value="Tanger">Tanger</option>
                    <option value="Marrakech">Marrakech</option>
                    <option value="Fès">Fès</option>
                    <option value="Agadir">Agadir</option>
                    <option value="Autre">Autre ville</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#16212B] mb-1">
                    Effectif estimé
                  </label>
                  <select
                    value={formData.studentCount}
                    onChange={(e) => setFormData({ ...formData, studentCount: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-[#CFDAE4] focus:outline-none focus:ring-2 focus:ring-[#2487B8]/30 focus:border-[#2487B8]"
                  >
                    <option value="under_200">&lt; 200 élèves</option>
                    <option value="200_600">200 - 600 élèves</option>
                    <option value="over_600">600+ élèves</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#16212B] mb-1">
                    Téléphone (WhatsApp / SMS) *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="06 61 23 45 67"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-[#CFDAE4] focus:outline-none focus:ring-2 focus:ring-[#2487B8]/30 focus:border-[#2487B8]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#16212B] mb-1">
                    Email professionnel *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="directeur@atlas.ma"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-[#CFDAE4] focus:outline-none focus:ring-2 focus:ring-[#2487B8]/30 focus:border-[#2487B8]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 rounded-xl bg-[#2487B8] hover:bg-[#1B6C93] text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span>Validation en cours...</span>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Confirmer la réservation de démo</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

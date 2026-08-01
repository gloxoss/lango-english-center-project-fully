export interface Permission {
  id: string;
  name: string;
  module: string;
  description: string;
}

export interface Role {
  id: string;
  name: string;
  guardName: string;
  customRole: boolean;
  editable: boolean;
  schoolId: string;
  permissions: string[];
}

export interface User {
  id: string;
  schoolId: string;
  fullName: string;
  email: string;
  phone: string;
  role: 'Super Admin' | 'Admin' | 'Enseignant' | 'Tuteur' | 'Élève' | 'Comptable';
  status: 'Actif' | 'Inactif' | 'Suspendu';
  avatarUrl?: string;
  createdAt: string;
  lastLogin?: string;
  qualification?: string;
  salary?: number;
}

export interface UserSession {
  user: User;
  schoolName: string;
  token: string;
}

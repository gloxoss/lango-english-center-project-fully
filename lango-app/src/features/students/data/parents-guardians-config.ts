export type HouseholdItem = {
  id: string;
  familyName: string;
  householdCode: string;
  address: string;
  city: string;
  financialStatus: 'À jour' | 'En retard';
  portalAccess?: boolean;
  primaryTutorName: string;
  primaryAvatar: string;
  primaryTutorPhone: string;
  primaryTutorEmail: string;
  primaryTutorRelation: string;
  secondaryTutorName?: string;
  secondaryAvatar?: string;
  secondaryTutorPhone?: string;
  secondaryTutorRelation?: string;
  children: { name: string; gradeLevel: string; classSection: string }[];
};




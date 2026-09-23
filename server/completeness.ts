/**
 * Modular Profile Completeness Calculator for Ship Asaan
 * Computes profile health, percentage completeness, and pending missing fields.
 */

import { CustomerProfileRow, EmployeeProfileRow, UserRow } from './db.js';

export interface CompletenessSection {
  id: string;
  title: string;
  weight: number;
  completed: boolean;
  missingFields: string[];
}

export interface CompletenessReport {
  score: number;
  sections: CompletenessSection[];
  isComplete: boolean;
}

export function computeCustomerCompleteness(user: UserRow, profile: Partial<CustomerProfileRow>): CompletenessReport {
  const sections: CompletenessSection[] = [];

  // 1. Basic Account (20%)
  const basicMissing: string[] = [];
  if (!user.name || user.name.trim().length === 0) basicMissing.push('Full Legal Name');
  if (!user.email || user.email.trim().length === 0) basicMissing.push('Account Email');
  sections.push({
    id: 'account',
    title: 'Account Identity',
    weight: 20,
    completed: basicMissing.length === 0,
    missingFields: basicMissing
  });

  // 2. Business & Tax Identity (30%)
  const businessMissing: string[] = [];
  if (!profile.business_name || profile.business_name.trim().length === 0) businessMissing.push('Registered Business Name');
  if (!profile.brand_name || profile.brand_name.trim().length === 0) businessMissing.push('Consumer Brand Name');
  if (!profile.cnic_or_ntn || profile.cnic_or_ntn.trim().length === 0) businessMissing.push('CNIC or NTN Number');
  sections.push({
    id: 'business',
    title: 'Business & Tax Registration',
    weight: 30,
    completed: businessMissing.length === 0,
    missingFields: businessMissing
  });

  // 3. Contact & Physical Operations (25%)
  const contactMissing: string[] = [];
  if (!profile.phone || profile.phone.trim().length === 0) contactMissing.push('Direct Contact Phone');
  if (!profile.address || profile.address.trim().length === 0) contactMissing.push('Physical Street Address');
  if (!profile.city || profile.city.trim().length === 0) contactMissing.push('Operating City');
  sections.push({
    id: 'contact',
    title: 'Contact & Physical Operations',
    weight: 25,
    completed: contactMissing.length === 0,
    missingFields: contactMissing
  });

  // 4. Financial & Settlement Banking (25%)
  const bankMissing: string[] = [];
  if (!profile.bank_name || profile.bank_name.trim().length === 0) bankMissing.push('Bank Name');
  if (!profile.bank_account_title || profile.bank_account_title.trim().length === 0) bankMissing.push('Account Title');
  if (!profile.bank_iban || profile.bank_iban.trim().length === 0) bankMissing.push('Settlement IBAN');
  sections.push({
    id: 'financial',
    title: 'Bank & Settlement Profile',
    weight: 25,
    completed: bankMissing.length === 0,
    missingFields: bankMissing
  });

  const totalScore = sections.reduce((sum, s) => sum + (s.completed ? s.weight : 0), 0);

  return {
    score: totalScore,
    sections,
    isComplete: totalScore === 100
  };
}

export function computeEmployeeCompleteness(user: UserRow, profile: Partial<EmployeeProfileRow>): CompletenessReport {
  const sections: CompletenessSection[] = [];

  // 1. Account Identity (20%)
  const basicMissing: string[] = [];
  if (!user.name || user.name.trim().length === 0) basicMissing.push('Full Legal Name');
  if (!user.email || user.email.trim().length === 0) basicMissing.push('Corporate Email');
  sections.push({
    id: 'account',
    title: 'Employee Identity',
    weight: 20,
    completed: basicMissing.length === 0,
    missingFields: basicMissing
  });

  // 2. Employment Details (25%)
  const empMissing: string[] = [];
  if (!profile.designation || profile.designation.trim().length === 0) empMissing.push('Job Designation');
  if (!profile.department || profile.department.trim().length === 0) empMissing.push('Operating Department');
  if (!profile.joining_date || profile.joining_date.trim().length === 0) empMissing.push('Joining Date');
  sections.push({
    id: 'employment',
    title: 'Employment Information',
    weight: 25,
    completed: empMissing.length === 0,
    missingFields: empMissing
  });

  // 3. Contact & Identity (25%)
  const contactMissing: string[] = [];
  if (!profile.phone || profile.phone.trim().length === 0) contactMissing.push('Direct Mobile Number');
  if (!profile.cnic || profile.cnic.trim().length === 0) contactMissing.push('National Identity CNIC');
  if (!profile.address || profile.address.trim().length === 0) contactMissing.push('Residential Address');
  sections.push({
    id: 'contact',
    title: 'Contact & National Identity',
    weight: 25,
    completed: contactMissing.length === 0,
    missingFields: contactMissing
  });

  // 4. Banking & Payroll (15%)
  const bankMissing: string[] = [];
  if (!profile.bank_name || profile.bank_name.trim().length === 0) bankMissing.push('Salary Bank Name');
  if (!profile.bank_account_title || profile.bank_account_title.trim().length === 0) bankMissing.push('Salary Account Title');
  if (!profile.bank_iban || profile.bank_iban.trim().length === 0) bankMissing.push('Salary IBAN');
  sections.push({
    id: 'banking',
    title: 'Payroll & Banking Information',
    weight: 15,
    completed: bankMissing.length === 0,
    missingFields: bankMissing
  });

  // 5. Verification Documents (15%)
  const docsMissing: string[] = [];
  if (!profile.cv_uploaded) docsMissing.push('Curriculum Vitae / Resume');
  if (!profile.cnic_uploaded) docsMissing.push('Scanned CNIC Copy');
  sections.push({
    id: 'documents',
    title: 'Verification Documents',
    weight: 15,
    completed: docsMissing.length === 0,
    missingFields: docsMissing
  });

  const totalScore = sections.reduce((sum, s) => sum + (s.completed ? s.weight : 0), 0);

  return {
    score: totalScore,
    sections,
    isComplete: totalScore === 100
  };
}

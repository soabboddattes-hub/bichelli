
export interface Schedule {
  id: string;
  farmerName: string;
  phoneNumber: string;
  fieldName: string;
  branch: string; // الخط المائي (1، 2، 3، 4)
  valve: string;  // الفانة (المحبس)
  day: string;
  time: string;
  endTime?: string;
  endDay?: string;
  irrigationHours: number;
  supervisorName: string;
  supervisorPhone: string;
  status: 'upcoming' | 'completed' | 'ongoing';
}

export type Page = 'login' | 'farmer-dashboard' | 'admin-panel';

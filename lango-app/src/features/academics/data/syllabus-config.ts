export type Resource = {
  id: string;
  name: string;
  type: 'pdf' | 'video' | 'link';
  size?: string;
  url?: string;
};

export type Chapter = {
  id: string;
  number: number;
  title: string;
  status: 'Completed' | 'In Progress' | 'Upcoming';
  hoursAllocated: number;
  resources: Resource[];
};



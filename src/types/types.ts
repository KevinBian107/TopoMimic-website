export type Author = {
  name: string;
  url?: string;
  institution?: string;
  affiliations?: string[];
  notes?: string[];
};

export type Affiliation = {
  id: string;
  name: string;
};

export type Link = {
  url: string;
  name: string;
  icon?: string;
};

export type Note = {
  symbol: string;
  text: string;
};

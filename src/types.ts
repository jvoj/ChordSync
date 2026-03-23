export interface Song {
  id: string;
  title: string;
  author: string;
  content: string;
  rating: number;
}

export interface Room {
  id: string;
  leaderId: string;
  songId: string | null;
  scrollPos: number;
}

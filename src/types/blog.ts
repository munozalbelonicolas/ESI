import { Timestamp } from 'firebase/firestore';

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  body: string;
  excerpt: string;
  coverImage: string;
  author: string;
  isPublished: boolean;
  publishedAt: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  tags: string[];
}

export interface BlogPostFormData {
  title: string;
  body: string;
  excerpt: string;
  coverImage: string;
  isPublished: boolean;
  tags: string[];
}

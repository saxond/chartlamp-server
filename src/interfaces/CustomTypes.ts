import { Request, Response } from 'express';

export interface TPaginationRequest extends Request {
  query: {
    limit: string;
    page: string;
    orderBy: string;
    sortBy: string;
    filterBy: string;
    category: string;
    search: string;
    content: string;
    role: string;
    sort: string;
    fields: string;
  };
}

export interface TPaginationResponse extends Response {
  paginatedResults?: {
    results: any;
    next: string;
    previous: string;
    currentPage: string;
    totalDocs: string;
    totalPages: string;
    lastPage: string;
  };
}

export interface IAuthRefreshTokenRequest extends Request {
  headers: { authorization?: string; Authorization?: string };
  cookies: { authToken?: string };
  accessToken?: string;
  refreshToken?: string;
}

export interface IRequestObject {
  type: string;
  description: string;
  url: string;
}

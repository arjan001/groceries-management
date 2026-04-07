/**
 * Tests for API routes — validation, error handling, and response format
 * Covers: /api/auth/create-user, /api/mpesa, /api/mpesa/settings, /api/distance
 *
 * These tests verify input validation and error paths without connecting to real APIs.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      admin: {
        createUser: vi.fn().mockResolvedValue({ data: { user: { id: 'new-user-id' } }, error: null }),
        listUsers: vi.fn().mockResolvedValue({ data: { users: [] } }),
        updateUserById: vi.fn().mockResolvedValue({ data: {}, error: null }),
      },
      signUp: vi.fn().mockResolvedValue({ data: { user: { id: 'new-user-id' } }, error: null }),
    },
    from: () => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
        in: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    }),
  }),
}));

// ────────────────────────────── /api/auth/create-user ──────────────────────────────
describe('API: /api/auth/create-user', () => {
  let POST: (req: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('@/app/api/auth/create-user/route');
    POST = mod.POST;
  });

  it('should return 400 when email is missing', async () => {
    const req = new NextRequest('http://localhost/api/auth/create-user', {
      method: 'POST',
      body: JSON.stringify({ password: 'pass123' }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.message).toContain('Email and password are required');
  });

  it('should return 400 when password is missing', async () => {
    const req = new NextRequest('http://localhost/api/auth/create-user', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@test.com' }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
  });

  it('should return 400 when password is too short', async () => {
    const req = new NextRequest('http://localhost/api/auth/create-user', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@test.com', password: '123' }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.message).toContain('at least 6 characters');
  });

  it('should return 400 for invalid email format', async () => {
    const req = new NextRequest('http://localhost/api/auth/create-user', {
      method: 'POST',
      body: JSON.stringify({ email: 'not-an-email', password: 'pass123456' }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.message).toContain('Invalid email format');
  });

  it('should successfully create a user with valid input', async () => {
    const req = new NextRequest('http://localhost/api/auth/create-user', {
      method: 'POST',
      body: JSON.stringify({
        email: 'newuser@test.com',
        password: 'secure123',
        fullName: 'New User',
        role: 'Baker',
      }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.userId).toBeDefined();
  });
});

// ────────────────────────────── /api/mpesa (STK Push) ──────────────────────────────
describe('API: /api/mpesa', () => {
  let POST: (req: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('@/app/api/mpesa/route');
    POST = mod.POST;
  });

  it('should return 400 when phone is missing', async () => {
    const req = new NextRequest('http://localhost/api/mpesa', {
      method: 'POST',
      body: JSON.stringify({ amount: 100 }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.message).toContain('Phone number and amount are required');
  });

  it('should return 400 when amount is missing', async () => {
    const req = new NextRequest('http://localhost/api/mpesa', {
      method: 'POST',
      body: JSON.stringify({ phone: '0712345678' }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(400);
  });

  it('should return 400 when match action has no amount', async () => {
    const req = new NextRequest('http://localhost/api/mpesa', {
      method: 'POST',
      body: JSON.stringify({ action: 'match' }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.message).toContain('Amount is required');
  });
});

// ────────────────────────────── /api/mpesa/settings ──────────────────────────────
describe('API: /api/mpesa/settings', () => {
  it('should return 400 when settings object is missing (POST)', async () => {
    const mod = await import('@/app/api/mpesa/settings/route');
    const req = new NextRequest('http://localhost/api/mpesa/settings', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const res = await mod.POST(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.message).toContain('Settings object is required');
  });

  it('should return success for GET request', async () => {
    const mod = await import('@/app/api/mpesa/settings/route');
    const res = await mod.GET();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body).toHaveProperty('env');
    expect(body).toHaveProperty('source_info');
  });
});

// ────────────────────────────── /api/distance ──────────────────────────────
describe('API: /api/distance', () => {
  let POST: (req: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('@/app/api/distance/route');
    POST = mod.POST;
  });

  it('should return 400 when origin is missing', async () => {
    const req = new NextRequest('http://localhost/api/distance', {
      method: 'POST',
      body: JSON.stringify({ destination: 'Nairobi' }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.message).toContain('Both origin and destination are required');
  });

  it('should return 400 when destination is missing', async () => {
    const req = new NextRequest('http://localhost/api/distance', {
      method: 'POST',
      body: JSON.stringify({ origin: 'Mombasa' }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(400);
  });
});

// ────────────────────────────── /api/mpesa/callback ──────────────────────────────
describe('API: /api/mpesa/callback', () => {
  let POST: (req: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('@/app/api/mpesa/callback/route');
    POST = mod.POST;
  });

  it('should handle empty body gracefully', async () => {
    const req = new NextRequest('http://localhost/api/mpesa/callback', {
      method: 'POST',
      body: '',
    });
    const res = await POST(req);
    const body = await res.json();
    expect(body.ResultCode).toBe(0);
    expect(body.ResultDesc).toBe('Accepted');
  });

  it('should handle invalid JSON body gracefully', async () => {
    const req = new NextRequest('http://localhost/api/mpesa/callback', {
      method: 'POST',
      body: 'not-valid-json',
    });
    const res = await POST(req);
    const body = await res.json();
    expect(body.ResultCode).toBe(0);
    expect(body.ResultDesc).toBe('Accepted');
  });

  it('should handle successful payment callback', async () => {
    const callbackBody = {
      Body: {
        stkCallback: {
          ResultCode: 0,
          ResultDesc: 'The service request is processed successfully.',
          CheckoutRequestID: 'ws_CO_test123',
          CallbackMetadata: {
            Item: [
              { Name: 'Amount', Value: 100 },
              { Name: 'MpesaReceiptNumber', Value: 'QJH7ABCDEF' },
              { Name: 'PhoneNumber', Value: 254712345678 },
            ],
          },
        },
      },
    };
    const req = new NextRequest('http://localhost/api/mpesa/callback', {
      method: 'POST',
      body: JSON.stringify(callbackBody),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(body.ResultCode).toBe(0);
  });

  it('should handle failed payment callback', async () => {
    const callbackBody = {
      Body: {
        stkCallback: {
          ResultCode: 1032,
          ResultDesc: 'Request cancelled by user',
          CheckoutRequestID: 'ws_CO_test456',
        },
      },
    };
    const req = new NextRequest('http://localhost/api/mpesa/callback', {
      method: 'POST',
      body: JSON.stringify(callbackBody),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(body.ResultCode).toBe(0);
  });
});

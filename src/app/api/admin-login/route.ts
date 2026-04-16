import { NextRequest, NextResponse } from 'next/server';

const ADMIN_CREDENTIALS = [
  { username: 'admin', password: 'admin123', role: 'super_admin', name: 'Super Admin' },
  { username: 'principal', password: 'principal123', role: 'admin', name: 'Principal' },
  { username: 'coordinator', password: 'coord123', role: 'coordinator', name: 'Coordinator' },
];

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
    }

    const admin = ADMIN_CREDENTIALS.find(
      a => a.username === username.trim() && a.password === password
    );

    if (!admin) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      admin: { username: admin.username, role: admin.role, name: admin.name },
    });
  } catch {
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}

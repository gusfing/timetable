'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast, Toaster } from 'sonner';
import { LogIn, User, Shield } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [employeeId, setEmployeeId] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loginType, setLoginType] = useState<'teacher' | 'admin'>('teacher');

  const handleTeacherLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId.trim()) { toast.error('Please enter your Employee ID'); return; }
    setIsLoading(true);
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: employeeId.trim() }),
      });
      const data = await response.json();
      if (!response.ok) { 
        toast.error(data.error || 'Invalid Employee ID'); 
        setIsLoading(false); 
        return; 
      }
      
      toast.success(`Welcome ${data.teacher.name}!`);
      // Session is now in HTTP-only cookies, redirecting...
      setTimeout(() => router.push('/teacher'), 500);
    } catch {
      toast.error('Login failed');
      setIsLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) { toast.error('Please enter username and password'); return; }
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await response.json();
      if (!response.ok) { 
        toast.error(data.error || 'Invalid credentials'); 
        setIsLoading(false); 
        return; 
      }
      
      toast.success(`Welcome ${data.admin.name}!`);
      // Session is now in HTTP-only cookies, redirecting...
      setTimeout(() => router.push('/admin/dashboard'), 500);
    } catch {
      toast.error('Login failed');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <Toaster position="top-right" richColors />
      <Card className="rounded-3xl border-none shadow-2xl w-full max-w-md">
        <CardHeader className="text-center pb-6">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
            <User className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-3xl font-bold">
            Anti-Gravity <span className="text-primary">Login</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={loginType} onValueChange={(v) => setLoginType(v as 'teacher' | 'admin')}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="teacher"><User className="h-4 w-4 mr-2" />Teacher</TabsTrigger>
              <TabsTrigger value="admin"><Shield className="h-4 w-4 mr-2" />Admin</TabsTrigger>
            </TabsList>

            <TabsContent value="teacher">
              <form onSubmit={handleTeacherLogin} className="space-y-4">
                <Input type="text" placeholder="Employee ID (e.g. EMP1)" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} disabled={isLoading} autoFocus />
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? <div className="animate-spin h-5 w-5 border-2 border-white/30 border-t-white rounded-full" /> : <><LogIn className="mr-2 h-5 w-5" />Sign In</>}
                </Button>
                <p className="text-xs text-center text-muted-foreground">Demo IDs: EMP1, EMP2, EMP3, EMP5, EMP20</p>
              </form>
            </TabsContent>

            <TabsContent value="admin">
              <form onSubmit={handleAdminLogin} className="space-y-4">
                <Input type="text" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} disabled={isLoading} autoFocus />
                <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={isLoading} />
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? <div className="animate-spin h-5 w-5 border-2 border-white/30 border-t-white rounded-full" /> : <><Shield className="mr-2 h-5 w-5" />Admin Sign In</>}
                </Button>
                <p className="text-xs text-center text-muted-foreground">admin / admin123 &nbsp;|&nbsp; principal / principal123</p>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Filter, Plus } from 'lucide-react';
import SubstitutionCard from '@/components/SubstitutionCard';
import { toast, Toaster } from 'sonner';

export default function SubstitutionsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'assigned' | 'accepted' | 'declined' | 'expired'>('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchSubstitutionRequests();
  }, []);

  useEffect(() => {
    filterRequests();
  }, [requests, searchQuery, statusFilter]);

  const fetchSubstitutionRequests = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/substitutions');
      const data = await res.json();
      setRequests(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching substitution requests:', error);
      toast.error('Failed to load substitution requests');
    } finally {
      setIsLoading(false);
    }
  };

  const filterRequests = () => {
    let filtered = requests;

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(req => req.status === statusFilter);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(req =>
        req.originalTeacher.toLowerCase().includes(query) ||
        req.period.subject.toLowerCase().includes(query) ||
        req.period.className.toLowerCase().includes(query)
      );
    }

    setFilteredRequests(filtered);
  };

  const handleAssign = async (requestId: string, teacherId: string) => {
    try {
      const res = await fetch(`/api/substitutions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          substituteTeacherId: teacherId,
          action: 'manual_assign'
        })
      });
      
      const data = await res.json();
      if (data.success) {
        toast.success('Substitute assigned successfully');
        fetchSubstitutionRequests();
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to assign teacher');
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <Toaster position="top-right" richColors />
      
      <header className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-4xl font-bold text-foreground">
              Substitution <span className="text-primary">Marketplace</span>
            </h1>
            <p className="text-muted-foreground mt-2">
              Fair distribution of substitution work with AI-powered ranking
            </p>
          </div>
          <Button className="rounded-xl bg-primary">
            <Plus className="mr-2 h-4 w-4" />
            New Request
          </Button>
        </div>

        {/* Search and Filter Bar */}
        <Card className="rounded-2xl border-none shadow-soft p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by teacher, subject, or class..."
                className="pl-10 rounded-xl bg-secondary/50 border-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => setStatusFilter('all')}
              >
                <Filter className="mr-2 h-4 w-4" />
                All
              </Button>
            </div>
          </div>
        </Card>
      </header>

      {/* Tabs for Status Filtering */}
      <Tabs value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)} className="mb-6">
        <TabsList className="bg-secondary p-1 rounded-xl">
          <TabsTrigger value="all" className="rounded-lg px-6">All</TabsTrigger>
          <TabsTrigger value="pending" className="rounded-lg px-6">Pending</TabsTrigger>
          <TabsTrigger value="assigned" className="rounded-lg px-6">Assigned</TabsTrigger>
          <TabsTrigger value="accepted" className="rounded-lg px-6">Accepted</TabsTrigger>
          <TabsTrigger value="declined" className="rounded-lg px-6">Declined</TabsTrigger>
          <TabsTrigger value="expired" className="rounded-lg px-6">Expired</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Substitution Cards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="rounded-2xl border-none shadow-soft h-64 animate-pulse bg-secondary/20" />
          ))}
        </div>
      ) : filteredRequests.length === 0 ? (
        <Card className="rounded-2xl border-none shadow-soft p-12 text-center">
          <p className="text-muted-foreground">No substitution requests found</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRequests.map((request) => (
            <SubstitutionCard
              key={request.id}
              request={request}
              onAssign={(teacherId) => handleAssign(request.id, teacherId)}
              showActions={true}
            />
          ))}
        </div>
      )}
    </div>
  );
}

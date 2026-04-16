'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Download, Filter, Calendar } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast, Toaster } from 'sonner';

interface AuditLog {
  id: string;
  table_name: string;
  record_id: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  old_data?: any;
  new_data?: any;
  changed_by?: string;
  changed_at: string;
  ip_address?: string;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [tableFilter, setTableFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  useEffect(() => {
    filterLogs();
  }, [logs, searchQuery, tableFilter, actionFilter]);

  const fetchAuditLogs = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('changed_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      toast.error('Failed to load audit logs');
    } finally {
      setIsLoading(false);
    }
  };

  const filterLogs = () => {
    let filtered = logs;

    // Filter by table
    if (tableFilter !== 'all') {
      filtered = filtered.filter(log => log.table_name === tableFilter);
    }

    // Filter by action
    if (actionFilter !== 'all') {
      filtered = filtered.filter(log => log.action === actionFilter);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(log =>
        log.table_name.toLowerCase().includes(query) ||
        log.action.toLowerCase().includes(query) ||
        log.record_id.toLowerCase().includes(query) ||
        log.changed_by?.toLowerCase().includes(query)
      );
    }

    setFilteredLogs(filtered);
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'INSERT': return 'bg-green-100 text-green-700';
      case 'UPDATE': return 'bg-blue-100 text-blue-700';
      case 'DELETE': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const exportLogs = () => {
    const csv = [
      ['Timestamp', 'Table', 'Action', 'Record ID', 'Changed By', 'IP Address'].join(','),
      ...filteredLogs.map(log => [
        new Date(log.changed_at).toISOString(),
        log.table_name,
        log.action,
        log.record_id,
        log.changed_by || 'System',
        log.ip_address || 'N/A'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString()}.csv`;
    a.click();
    toast.success('Audit logs exported successfully');
  };

  const uniqueTables = Array.from(new Set(logs.map(log => log.table_name)));

  return (
    <div className="min-h-screen bg-background p-8">
      <Toaster position="top-right" richColors />
      
      <header className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-4xl font-bold text-foreground">
              Audit <span className="text-primary">Logs</span>
            </h1>
            <p className="text-muted-foreground mt-2">
              Complete audit trail of all timetable changes
            </p>
          </div>
          <Button className="rounded-xl bg-primary" onClick={exportLogs}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>

        {/* Search and Filter Bar */}
        <Card className="rounded-2xl border-none shadow-soft p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                className="pl-10 rounded-xl bg-secondary/50 border-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <select
                className="px-4 py-2 rounded-xl bg-secondary/50 border-none text-sm"
                value={tableFilter}
                onChange={(e) => setTableFilter(e.target.value)}
              >
                <option value="all">All Tables</option>
                {uniqueTables.map(table => (
                  <option key={table} value={table}>{table}</option>
                ))}
              </select>
              <select
                className="px-4 py-2 rounded-xl bg-secondary/50 border-none text-sm"
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
              >
                <option value="all">All Actions</option>
                <option value="INSERT">INSERT</option>
                <option value="UPDATE">UPDATE</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>
          </div>
        </Card>
      </header>

      {/* Audit Logs Table */}
      <Card className="rounded-2xl border-none shadow-soft overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
            <p className="text-muted-foreground mt-4">Loading audit logs...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-muted-foreground">No audit logs found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-secondary/30">
                  <th className="px-6 py-4 text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b border-secondary">
                    Timestamp
                  </th>
                  <th className="px-6 py-4 text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b border-secondary">
                    Table
                  </th>
                  <th className="px-6 py-4 text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b border-secondary">
                    Action
                  </th>
                  <th className="px-6 py-4 text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b border-secondary">
                    Record ID
                  </th>
                  <th className="px-6 py-4 text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b border-secondary">
                    Changed By
                  </th>
                  <th className="px-6 py-4 text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b border-secondary">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary/20">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-secondary/10 transition-colors">
                    <td className="px-6 py-4 border-b border-secondary/20">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        <span>{new Date(log.changed_at).toLocaleString()}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 border-b border-secondary/20">
                      <Badge variant="outline" className="text-xs">
                        {log.table_name}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 border-b border-secondary/20">
                      <Badge className={`text-xs ${getActionColor(log.action)}`}>
                        {log.action}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 border-b border-secondary/20">
                      <code className="text-xs bg-secondary/50 px-2 py-1 rounded">
                        {log.record_id.substring(0, 8)}...
                      </code>
                    </td>
                    <td className="px-6 py-4 border-b border-secondary/20 text-sm">
                      {log.changed_by || 'System'}
                    </td>
                    <td className="px-6 py-4 border-b border-secondary/20">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="rounded-lg text-xs"
                        onClick={() => setSelectedLog(log)}
                      >
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedLog(null)}>
          <Card className="rounded-2xl border-none shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-4">Audit Log Details</h2>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">Timestamp</p>
                  <p className="text-sm">{new Date(selectedLog.changed_at).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">Table</p>
                  <p className="text-sm">{selectedLog.table_name}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">Action</p>
                  <Badge className={`text-xs ${getActionColor(selectedLog.action)}`}>
                    {selectedLog.action}
                  </Badge>
                </div>
                {selectedLog.old_data && (
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground mb-2">Old Data</p>
                    <pre className="text-xs bg-secondary/50 p-3 rounded-lg overflow-auto">
                      {JSON.stringify(selectedLog.old_data, null, 2)}
                    </pre>
                  </div>
                )}
                {selectedLog.new_data && (
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground mb-2">New Data</p>
                    <pre className="text-xs bg-secondary/50 p-3 rounded-lg overflow-auto">
                      {JSON.stringify(selectedLog.new_data, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
              <Button className="mt-6 w-full rounded-xl" onClick={() => setSelectedLog(null)}>
                Close
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

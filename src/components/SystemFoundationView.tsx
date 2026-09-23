import { useState, useEffect } from 'react';
import { api, UserSession, SystemOverview, AuditLogItem } from '../lib/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from './ui/Table';
import { EmptyState } from './ui/EmptyState';
import { Skeleton } from './ui/Skeleton';
import {
  ShieldCheck,
  Activity,
  Database,
  Lock,
  RefreshCw,
  Clock,
  Key,
  Server,
  Terminal,
  CheckCircle2
} from 'lucide-react';

interface SystemFoundationViewProps {
  user: UserSession;
}

export function SystemFoundationView({ user }: SystemFoundationViewProps) {
  const [overview, setOverview] = useState<SystemOverview | null>(null);
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await api.getSystemOverview();
      setOverview(data);

      if (user.role_id === 'role_administrator' || user.permissions.includes('system.audit')) {
        const auditData = await api.getAuditLogs();
        setLogs(auditData.logs);
      }
    } catch (err) {
      console.error('Failed to load system overview:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="space-y-6 max-w-6xl pb-10">
      {/* Top Header & Sync Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              System Infrastructure & Core Foundation
            </h1>
            <Badge variant="success" dot>Operational</Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Authoritative relational models, RBAC privilege containment, and cryptographically verified sessions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            loading={loading}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Sync Node Status
          </Button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="py-3 px-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Authoritative Users</span>
            <Database className="w-4 h-4 text-emerald-600" />
          </CardHeader>
          <CardContent className="py-2 px-4">
            <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {loading && !overview ? <Skeleton className="h-7 w-12" /> : overview?.totalUsers}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Active verified accounts</p>
          </CardContent>
          <CardFooter className="py-2 px-4 text-[11px] text-slate-400">
            <span>Clean baseline &bull; Zero fake data</span>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader className="py-3 px-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">System Roles</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </CardHeader>
          <CardContent className="py-2 px-4">
            <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {loading && !overview ? <Skeleton className="h-7 w-12" /> : overview?.totalRoles}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Protected operational roles</p>
          </CardContent>
          <CardFooter className="py-2 px-4 text-[11px] text-slate-400">
            <span>Admin, Manager, Staff, Customer</span>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader className="py-3 px-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active Sessions</span>
            <Lock className="w-4 h-4 text-emerald-600" />
          </CardHeader>
          <CardContent className="py-2 px-4">
            <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {loading && !overview ? <Skeleton className="h-7 w-12" /> : overview?.activeSessions}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Authenticated Bearer tokens</p>
          </CardContent>
          <CardFooter className="py-2 px-4 text-[11px] text-slate-400">
            <span>7-day cryptographic validity</span>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader className="py-3 px-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Audit Journal Entries</span>
            <Activity className="w-4 h-4 text-emerald-600" />
          </CardHeader>
          <CardContent className="py-2 px-4">
            <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {loading && !overview ? <Skeleton className="h-7 w-12" /> : overview?.totalAuditLogs}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Immutable server mutations</p>
          </CardContent>
          <CardFooter className="py-2 px-4 text-[11px] text-slate-400">
            <span>Append-only security log</span>
          </CardFooter>
        </Card>
      </div>

      {/* Main Content Split: Session Authorization Details & Live Audit Ledger */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Active Session & Privilege Scopes Card */}
        <div className="lg:col-span-4 space-y-4">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Session Authorization</CardTitle>
                <CardDescription>Active credentials & permission context</CardDescription>
              </div>
              <Key className="w-4 h-4 text-slate-400" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                  Active Operator
                </span>
                <div className="p-3 bg-slate-50 rounded-md border border-slate-200">
                  <div className="text-xs font-semibold text-slate-900">{user.name}</div>
                  <div className="text-[11px] font-mono text-emerald-700 mt-0.5">{user.email}</div>
                  <div className="text-[10px] text-slate-400 font-mono mt-1">UID: {user.id}</div>
                </div>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                  Assigned Operational Role
                </span>
                <div className="p-3 bg-slate-50 rounded-md border border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-900">{user.role_name}</span>
                    <Badge variant="success">Active</Badge>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-1">Role ID: {user.role_id}</div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Authoritative Scopes
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {user.permissions.length} granted
                  </span>
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1 pr-1 border border-slate-200 rounded-md p-2 bg-slate-50/50">
                  {user.permissions.map((p) => (
                    <div key={p} className="text-[11px] font-mono text-slate-700 bg-white px-2 py-1 rounded border border-slate-200/80">
                      {p}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Audit Log Data Grid */}
        <div className="lg:col-span-8">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>System Audit Journal</CardTitle>
                <CardDescription>Server-authoritative, immutable log of operational actions</CardDescription>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Recent {logs.length} entries</span>
              </div>
            </CardHeader>

            <div className="overflow-x-auto">
              {logs.length === 0 ? (
                <EmptyState
                  title="No Audit Logs Recorded"
                  description="When operations mutations take place, they are automatically stamped here."
                />
              ) : (
                <Table className="border-0 rounded-none shadow-none">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Target Entity</TableHead>
                      <TableHead>Actor Identity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-mono text-slate-500 whitespace-nowrap tabular-nums text-[11px]">
                          {new Date(log.created_at).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="neutral" className="font-mono text-[10px]">
                            {log.action}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium text-slate-800">{log.entity_type}</span>
                          {log.entity_id && (
                            <span className="block font-mono text-[10px] text-slate-400 mt-0.5 truncate max-w-[120px]">
                              {log.entity_id}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-slate-600 text-[11px]">
                          {log.actor_email || 'System Daemon'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            <CardFooter>
              <span>Security Policy: Sensitive passwords and OTPs are redacted prior to journal write.</span>
              <span className="font-mono text-emerald-700 font-medium">Node: SHA-512 Sealed</span>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { EmployeeItem, UserSession, api } from '../../lib/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/Card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../ui/Table';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { Skeleton } from '../ui/Skeleton';
import { EmployeeCreateModal } from './EmployeeCreateModal';
import { EmployeeProfileModal } from './EmployeeProfileModal';
import {
  UserPlus,
  Search,
  RefreshCw,
  Briefcase,
  Calendar,
  ExternalLink,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';

interface EmployeeListViewProps {
  user: UserSession;
}

export function EmployeeListView({ user }: EmployeeListViewProps) {
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeItem | null>(null);

  const canCreate = user.role_id === 'role_administrator' || user.permissions.includes('employees.create');
  const canEdit = user.role_id === 'role_administrator' || user.permissions.includes('employees.edit');

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const res = await api.getEmployees();
      setEmployees(res.employees);
    } catch (err) {
      console.error('Failed to load employees:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const departments = Array.from(
    new Set(employees.map(e => e.profile?.department).filter(Boolean))
  ) as string[];

  const filteredEmployees = employees.filter((e) => {
    if (selectedDept !== 'all' && e.profile?.department !== selectedDept) {
      return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      const matches =
        e.user.name.toLowerCase().includes(q) ||
        e.user.email.toLowerCase().includes(q) ||
        (e.profile?.designation && e.profile.designation.toLowerCase().includes(q)) ||
        (e.profile?.department && e.profile.department.toLowerCase().includes(q));
      if (!matches) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-6xl pb-10">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Staff & Operations Personnel
            </h1>
            <Badge variant="neutral">{employees.length} Personnel</Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Workforce roster, departmental assignments, privilege authorization, and HR compliance documentation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchEmployees}
            loading={loading}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Sync Roster
          </Button>

          {canCreate && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowCreateModal(true)}
              icon={<UserPlus className="w-3.5 h-3.5" />}
            >
              Onboard Employee
            </Button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Department Pills */}
        <div className="flex flex-wrap items-center gap-1 bg-slate-200/60 p-1 rounded-lg text-xs font-medium text-slate-600">
          <button
            onClick={() => setSelectedDept('all')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              selectedDept === 'all'
                ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                : 'hover:text-slate-900'
            }`}
          >
            All Departments ({employees.length})
          </button>
          {departments.map((dept) => {
            const count = employees.filter(e => e.profile?.department === dept).length;
            return (
              <button
                key={dept}
                onClick={() => setSelectedDept(dept)}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  selectedDept === dept
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'hover:text-slate-900'
                }`}
              >
                {dept} ({count})
              </button>
            );
          })}
        </div>

        {/* Live Search */}
        <div className="w-full sm:w-72">
          <Input
            placeholder="Search by name, email, role..."
            prefixIcon={<Search className="w-4 h-4" />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Main Table */}
      <Card>
        {loading && employees.length === 0 ? (
          <CardContent className="p-6 space-y-3">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        ) : filteredEmployees.length === 0 ? (
          <EmptyState
            title="No Employees Found"
            description={
              search
                ? `No staff member matching search query "${search}".`
                : 'No employees found in selected department.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <Table className="border-0 shadow-none">
              <TableHeader>
                <TableRow>
                  <TableHead>Staff Member</TableHead>
                  <TableHead>Designation & Dept</TableHead>
                  <TableHead>Operational Role</TableHead>
                  <TableHead>Joining Date</TableHead>
                  <TableHead>Profile Health</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmployees.map((emp) => (
                  <TableRow key={emp.user.id}>
                    <TableCell>
                      <div className="font-semibold text-slate-900">{emp.user.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{emp.user.email}</div>
                    </TableCell>

                    <TableCell>
                      <div className="font-medium text-slate-800 flex items-center gap-1.5">
                        <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{emp.profile?.designation || 'Staff'}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {emp.profile?.department || 'Operations'}
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge variant={emp.user.role_id === 'role_administrator' ? 'warning' : 'neutral'}>
                        {emp.user.role_name}
                      </Badge>
                    </TableCell>

                    <TableCell className="font-mono text-slate-600 text-xs">
                      {emp.profile?.joining_date || 'N/A'}
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-slate-200 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-1.5 rounded-full ${
                              (emp.profile?.completeness_score || 0) >= 80 ? 'bg-emerald-600' : 'bg-amber-500'
                            }`}
                            style={{ width: `${emp.profile?.completeness_score || 0}%` }}
                          />
                        </div>
                        <span className="font-mono text-[11px] text-slate-600 tabular-nums">
                          {emp.profile?.completeness_score || 0}%
                        </span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge variant={emp.user.status === 'active' ? 'success' : 'neutral'} dot>
                        {emp.user.status === 'active' ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedEmployee(emp)}
                        icon={<ExternalLink className="w-3 h-3" />}
                      >
                        Profile
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Create Employee Modal */}
      {showCreateModal && (
        <EmployeeCreateModal
          isOpen={true}
          onClose={() => setShowCreateModal(false)}
          onSuccess={(newEmp) => {
            fetchEmployees();
            setShowCreateModal(false);
          }}
        />
      )}

      {/* Employee Profile Modal */}
      {selectedEmployee && (
        <EmployeeProfileModal
          employee={selectedEmployee}
          isOpen={true}
          onClose={() => setSelectedEmployee(null)}
          onRefresh={() => {
            fetchEmployees();
            setSelectedEmployee(null);
          }}
          canEdit={canEdit}
        />
      )}
    </div>
  );
}

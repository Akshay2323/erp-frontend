"use client";

import { useEffect, useState } from "react";
import { Search, RefreshCw, Plus, Calendar, Edit2, X, BarChart3, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TableRowsSkeleton } from "@/components/ui/page-states";
import { API_BASE_URL } from "@/lib/config";
import { useAuthToken } from "@/lib/use-auth-token";

function authHeaders(token: string, extra?: Record<string, string>) {
  if (!token) throw new Error("Not authenticated");
  return {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
    "X-CSRF-TOKEN": "",
    ...extra,
  };
}

/** Backend may return a plain array or `{ items: [...] }` inside `data`. */
function normalizeListData(data: unknown): any[] {
  if (Array.isArray(data)) return data;
  if (
    data &&
    typeof data === "object" &&
    Array.isArray((data as { items?: unknown }).items)
  ) {
    return (data as { items: any[] }).items;
  }
  return [];
}

function SalaryStructureTab() {
  const token = useAuthToken();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    company_id: "",
    employee_id: "",
    basic_salary: 0,
    gross_salary: 0,
    effective_from: new Date().toISOString().split("T")[0],
    status: "active",
    items: [] as any[]
  });
  const [saving, setSaving] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [components, setComponents] = useState<any[]>([]);

  // Filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");

  const resetFilters = () => {
    setStatusFilter("all");
    setCompanyFilter("all");
  };

  const filteredData = data.filter((item) => {
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    const emp = employees.find((e: any) => e.id === item.employee_id);
    const matchesCompany = companyFilter === "all" || String(emp?.company?.id) === companyFilter;
    return matchesStatus && matchesCompany;
  });

  const uniqueCompanies = Array.from(new Map(employees.filter(e => e.company).map(e => [e.company.id, e.company])).values());

  const fetchData = async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}v1/payroll/salary-structures`, {
        headers: authHeaders(token),
      });
      const json = await res.json();
      if (json.success) setData(normalizeListData(json.data));

      const staffRes = await fetch(`${API_BASE_URL}v1/employees?per_page=100`, {
        headers: authHeaders(token),
      });
      const staffJson = await staffRes.json();
      if (staffJson.success) setEmployees(staffJson.data.items || []);

      const compRes = await fetch(`${API_BASE_URL}v1/payroll/components`, {
        headers: authHeaders(token),
      });
      const compJson = await compRes.json();
      if (compJson.success) setComponents(normalizeListData(compJson.data));
    } catch (error) {
      console.error("Failed to fetch salary structures:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  const openDrawer = (structure?: any) => {
    if (structure) {
      setIsEditing(true);
      setCurrentId(structure.id);
      const emp = employees.find((e: any) => e.id === structure.employee_id);
      setFormData({
        company_id: emp ? String(emp.company_id) : "",
        employee_id: structure.employee_id ? String(structure.employee_id) : "",
        basic_salary: structure.basic_salary || 0,
        gross_salary: structure.gross_salary || 0,
        effective_from: structure.effective_from || new Date().toISOString().split("T")[0],
        status: structure.status || "active",
        items: (structure.items || []).map((item: any) => ({
          salary_component_id: item.salary_component_id ? String(item.salary_component_id) : "",
          amount: item.amount,
          type: item.type,
        }))
      });
    } else {
      setIsEditing(false);
      setCurrentId(null);
      setFormData({
        company_id: "",
        employee_id: "",
        basic_salary: 0,
        gross_salary: 0,
        effective_from: new Date().toISOString().split("T")[0],
        status: "active",
        items: []
      });
    }
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const url = isEditing 
        ? `${API_BASE_URL}v1/payroll/salary-structures/${currentId}`
        : `${API_BASE_URL}v1/payroll/salary-structures`;
        
      const payload: any = { ...formData };
      payload.employee_id = Number(payload.employee_id);
      payload.basic_salary = Number(payload.basic_salary);
      payload.gross_salary = Number(payload.gross_salary);
      payload.items = formData.items.map((it: any) => ({
        ...it,
        salary_component_id: Number(it.salary_component_id),
        amount: Number(it.amount)
      }));

      const res = await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        headers: authHeaders(token, { "Content-Type": "application/json" }),
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json.success) {
        closeDrawer();
        fetchData();
      } else {
        alert(json.message || "Failed to save structure.");
      }
    } catch (error) {
      console.error("Error saving structure", error);
      alert("Error saving structure");
    } finally {
      setSaving(false);
    }
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { salary_component_id: "", amount: 0, type: "earning" }]
    }));
  };

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...formData.items];
    if (field === "salary_component_id") {
      newItems[index].salary_component_id = String(value);
      const comp = components.find((c) => c.id === Number(value));
      if (comp) {
        newItems[index].type = comp.type;
        newItems[index].amount = comp.default_amount ?? 0;
      }
    } else if (field === "amount") {
      newItems[index].amount = Number(value);
    } else {
      newItems[index][field] = value;
    }
    setFormData({ ...formData, items: newItems });
  };

  const removeItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };
  const selectedEmployee = employees.find((e: any) => e.id === Number(formData.employee_id));
  const availableComponents = components.filter((c: any) => selectedEmployee ? c.company_id === selectedEmployee.company_id : true);
  const filteredDrawerEmployees = employees.filter((e: any) => formData.company_id ? String(e.company_id) === formData.company_id : false);

  return (
    <>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <div className="lg:col-span-3">
        <Card className="rounded-xl border border-border bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border/50 pb-4 pt-5">
            <span className="font-semibold text-sm">Filters</span>
            <Button onClick={resetFilters} variant="link" className="h-auto p-0 text-sm text-primary font-medium">Reset</Button>
          </CardHeader>
          <CardContent className="pt-5 space-y-5">
            <div className="space-y-2">
              <Label className="text-xs font-normal text-muted-foreground">Company</Label>
              <select 
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="all">All Companies</option>
                {uniqueCompanies.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-normal text-muted-foreground">Status</Label>
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4 lg:col-span-9">
        <div className="flex justify-end mb-2">
          <Button onClick={() => openDrawer()} className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium">
            <Plus className="h-4 w-4 mr-2" />
            Create Structure
          </Button>
        </div>
        <Card className="flex min-h-[500px] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between p-4 border-b border-border/50 bg-background gap-4">
            <div className="flex items-center gap-3">
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input type="text" placeholder="Search by Employee ID" className="pl-9 h-9" />
              </div>
              <Button onClick={fetchData} variant="outline" className="h-9 border-primary/30 px-4 font-medium text-primary hover:bg-primary/10">
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-foreground font-medium">Showing {filteredData.length} structures</span>
            </div>
          </div>

          <div className="overflow-x-auto flex-1 bg-card">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/40 text-xs text-muted-foreground font-semibold border-b border-border/50">
                  <tr>
                    <th className="p-4">ID</th>
                    <th className="p-4">COMPANY</th>
                    <th className="p-4">EMPLOYEE</th>
                    <th className="p-4">BASIC SALARY</th>
                    <th className="p-4">GROSS SALARY</th>
                    <th className="p-4">EFFECTIVE FROM</th>
                    <th className="p-4">STATUS</th>
                    <th className="p-4 w-24">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {loading ? (
                    <TableRowsSkeleton rows={6} cols={8} />
                  ) : filteredData.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-muted-foreground">No salary structures found.</td>
                    </tr>
                  ) : (
                    filteredData.map((item: any) => (
                      <tr key={item.id} className="hover:bg-muted/50 transition-colors">
                        <td className="p-4 font-medium text-muted-foreground">#{item.id}</td>
                        <td className="p-4 text-muted-foreground font-medium">
                          {employees.find((e: any) => e.id === item.employee_id)?.company?.name || "Unknown"}
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col">
                            <span className="font-medium text-foreground">
                              {employees.find((e: any) => e.id === item.employee_id)?.full_name || "Unknown"}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {employees.find((e: any) => e.id === item.employee_id)?.employee_code || item.employee_id}
                            </span>
                          </div>
                        </td>
                        <td className="p-4 text-foreground font-medium">₹ {item.basic_salary?.toLocaleString()}</td>
                        <td className="p-4 text-foreground font-medium">₹ {item.gross_salary?.toLocaleString() || "0"}</td>
                        <td className="p-4 text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            {item.effective_from}
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`rounded-full px-2 py-1 text-xs font-medium ${item.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                            {item.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="p-4">
                          <Button onClick={() => openDrawer(item)} variant="outline" size="sm" className="h-8 font-medium text-muted-foreground">
                            <Edit2 className="h-3.5 w-3.5 mr-2" /> EDIT
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
          </div>
        </Card>
      </div>
    </div>

      {/* Structure Drawer Overlay */}
      {drawerOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={closeDrawer} />
          
          <div className="relative w-full max-w-xl bg-card h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between p-4 border-b border-border/50 bg-muted/50">
              <h2 className="text-lg font-bold text-foreground">{isEditing ? "Edit Salary Structure" : "Create Salary Structure"}</h2>
              <Button variant="ghost" size="icon" onClick={closeDrawer} className="h-8 w-8 rounded-full">
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2">
                  <Label>Company</Label>
                  <select 
                    value={formData.company_id} 
                    onChange={e => setFormData({...formData, company_id: e.target.value, employee_id: ""})}
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    <option value="" disabled>Select Company</option>
                    {uniqueCompanies.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2 col-span-2">
                  <Label>Employee</Label>
                  <select 
                    value={formData.employee_id} 
                    onChange={e => setFormData({...formData, employee_id: e.target.value})}
                    disabled={!formData.company_id}
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50"
                  >
                    <option value="" disabled>Select Employee</option>
                    {filteredDrawerEmployees.map((emp: any) => (
                      <option key={emp.id} value={emp.id}>{emp.full_name} ({emp.employee_code})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label>Basic Salary</Label>
                  <Input type="number" value={formData.basic_salary} onChange={e => setFormData({...formData, basic_salary: Number(e.target.value)})} placeholder="0" />
                </div>

                <div className="space-y-2">
                  <Label>Gross Salary</Label>
                  <Input type="number" value={formData.gross_salary} onChange={e => setFormData({...formData, gross_salary: Number(e.target.value)})} placeholder="0" />
                </div>

                <div className="space-y-2">
                  <Label>Effective From</Label>
                  <Input type="date" value={formData.effective_from} onChange={e => setFormData({...formData, effective_from: e.target.value})} />
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <select 
                    value={formData.status} 
                    onChange={e => setFormData({...formData, status: e.target.value})}
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Dynamic Items */}
              <div className="pt-4 border-t border-border/50">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-foreground">Salary Components</h3>
                  <Button onClick={addItem} variant="outline" size="sm" className="h-8 border-primary/30 text-primary hover:bg-primary/10">
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add Component
                  </Button>
                </div>

                <div className="space-y-3">
                  {formData.items.length === 0 && (
                    <div className="text-center p-6 border border-dashed rounded-lg text-muted-foreground text-sm">
                      No components added yet. Click above to add earnings or deductions.
                    </div>
                  )}
                  {formData.items.map((item, index) => (
                    <div key={index} className="flex items-end gap-3 p-3 bg-muted/50 border border-border rounded-lg">
                      <div className="flex-1 space-y-1.5">
                        <Label className="text-[11px] text-muted-foreground">Component</Label>
                        <select 
                          value={item.salary_component_id} 
                          onChange={e => updateItem(index, 'salary_component_id', e.target.value)}
                          className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-card px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                        >
                          <option value="" disabled>Select Component</option>
                          {availableComponents.map((c: any) => (
                            <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
                          ))}
                        </select>
                      </div>
                      <div className="w-32 space-y-1.5">
                        <Label className="text-[11px] text-muted-foreground">Amount (₹)</Label>
                        <Input type="number" className="h-9 bg-card" value={item.amount} onChange={e => updateItem(index, 'amount', e.target.value)} />
                      </div>
                      <Button onClick={() => removeItem(index)} variant="ghost" size="icon" className="h-9 w-9 text-rose-500 hover:text-rose-600 hover:bg-rose-50">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            <div className="bg-card border-t border-border/50 p-4 flex items-center justify-end gap-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
              <Button variant="ghost" onClick={closeDrawer} className="font-medium">Cancel</Button>
              <Button onClick={handleSave} disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium px-6">
                {saving ? "Saving..." : "Save Structure"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SalaryComponentsTab() {
  const token = useAuthToken();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: "", code: "", type: "earning", default_amount: 0, status: "active", company_id: "" });
  const [saving, setSaving] = useState(false);
  const [filterOptions, setFilterOptions] = useState<any>({});
  
  // Filters
  const [typeFilter, setTypeFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");

  const resetFilters = () => {
    setTypeFilter("all");
    setCompanyFilter("all");
  };

  const filteredData = data.filter((item) => {
    const matchesType = typeFilter === "all" || item.type === typeFilter;
    const matchesCompany = companyFilter === "all" || String(item.company_id) === companyFilter;
    return matchesType && matchesCompany;
  });

  const fetchData = async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}v1/payroll/components`, {
        headers: authHeaders(token),
      });
      const json = await res.json();
      if (json.success) setData(normalizeListData(json.data));

      const workspaceRes = await fetch(`${API_BASE_URL}v1/payroll/workspace?screen=summary`, {
        headers: authHeaders(token),
      });
      const workspaceJson = await workspaceRes.json();
      if (workspaceJson.success) setFilterOptions(workspaceJson.data.filter_options || {});
    } catch (error) {
      console.error("Failed to fetch salary components:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  const openDrawer = (component?: any) => {
    if (component) {
      setIsEditing(true);
      setCurrentId(component.id);
      setFormData({
        name: component.name,
        code: component.code,
        type: component.type,
        default_amount: component.default_amount || 0,
        status: component.status,
        company_id: component.company_id ? String(component.company_id) : "",
      });
    } else {
      setIsEditing(false);
      setCurrentId(null);
      setFormData({ name: "", code: "", type: "earning", default_amount: 0, status: "active", company_id: "" });
    }
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (!isEditing && formData.company_id === "all") {
        const promises = (filterOptions.companies || []).map((c: any) => {
          const payload = { ...formData, company_id: c.id };
          return fetch(`${API_BASE_URL}v1/payroll/components`, {
            method: "POST",
            headers: authHeaders(token, { "Content-Type": "application/json" }),
            body: JSON.stringify(payload)
          });
        });
        
        await Promise.all(promises);
        closeDrawer();
        fetchData();
        setSaving(false);
        return;
      }

      const url = isEditing 
        ? `${API_BASE_URL}v1/payroll/components/${currentId}`
        : `${API_BASE_URL}v1/payroll/components`;
        
      const payload: any = { ...formData };
      if (!isEditing && formData.company_id && formData.company_id !== "all") {
        payload.company_id = Number(formData.company_id);
      } else if (!isEditing) {
        delete payload.company_id;
      }

      const res = await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        headers: authHeaders(token, { "Content-Type": "application/json" }),
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json.success) {
        closeDrawer();
        fetchData();
      } else {
        alert(json.message || "Failed to save component.");
      }
    } catch (error) {
      console.error("Error saving component", error);
      alert("Error saving component");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-3">
          <Card className="rounded-xl border border-border bg-card shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border/50 pb-4 pt-5">
              <span className="font-semibold text-sm">Filters</span>
              <Button onClick={resetFilters} variant="link" className="h-auto p-0 text-sm text-primary font-medium">Reset</Button>
            </CardHeader>
            <CardContent className="pt-5 space-y-5">
              <div className="space-y-2">
                <Label className="text-xs font-normal text-muted-foreground">Company</Label>
                <select 
                  value={companyFilter}
                  onChange={(e) => setCompanyFilter(e.target.value)}
                  className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <option value="all">All Companies</option>
                  {filterOptions.companies?.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-normal text-muted-foreground">Type</Label>
                <select 
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <option value="all">All Types</option>
                  <option value="earning">Earning</option>
                  <option value="deduction">Deduction</option>
                </select>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 lg:col-span-9">
          <div className="flex justify-end mb-2">
            <Button onClick={() => openDrawer()} className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium">
              <Plus className="h-4 w-4 mr-2" />
              Add Component
            </Button>
          </div>
          <Card className="flex min-h-[500px] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="flex flex-wrap items-center justify-between p-4 border-b border-border/50 bg-background gap-4">
              <div className="flex items-center gap-3">
                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input type="text" placeholder="Search Components" className="pl-9 h-9" />
                </div>
                <Button onClick={fetchData} variant="outline" className="h-9 border-primary/30 px-4 font-medium text-primary hover:bg-primary/10">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-foreground font-medium">Showing {filteredData.length} components</span>
              </div>
            </div>

            <div className="overflow-x-auto flex-1 bg-card">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/40 text-xs text-muted-foreground font-semibold border-b border-border/50">
                    <tr>
                      <th className="p-4">NAME</th>
                      <th className="p-4">COMPANY</th>
                      <th className="p-4">CODE</th>
                      <th className="p-4">TYPE</th>
                      <th className="p-4">DEFAULT AMOUNT</th>
                      <th className="p-4">STATUS</th>
                      <th className="p-4 w-24">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {loading ? (
                      <TableRowsSkeleton rows={6} cols={7} />
                    ) : filteredData.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-6 text-center text-muted-foreground">No components found matching your filters.</td>
                      </tr>
                    ) : (
                      filteredData.map((item: any) => (
                        <tr key={item.id} className="hover:bg-muted/50 transition-colors">
                          <td className="p-4 font-medium text-foreground">{item.name}</td>
                          <td className="p-4 text-muted-foreground font-medium">
                            {filterOptions.companies?.find((c: any) => c.id === item.company_id)?.name || "Unknown"}
                          </td>
                          <td className="p-4 text-muted-foreground">{item.code}</td>
                          <td className="p-4">
                            <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${item.type === 'earning' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'}`}>
                              {item.type.toUpperCase()}
                            </span>
                          </td>
                          <td className="p-4 text-foreground font-medium">₹ {item.default_amount?.toLocaleString() || "0"}</td>
                          <td className="p-4">
                            <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${item.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                              {item.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="p-4">
                            <Button onClick={() => openDrawer(item)} variant="outline" size="sm" className="h-8 font-medium text-muted-foreground">
                              <Edit2 className="h-3.5 w-3.5 mr-2" /> EDIT
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
            </div>
          </Card>
        </div>
      </div>

      {/* Drawer Overlay */}
      {drawerOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={closeDrawer} />
          
          <div className="relative w-full max-w-md bg-card h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between p-4 border-b border-border/50 bg-muted/50">
              <h2 className="text-lg font-bold text-foreground">{isEditing ? "Edit Component" : "Add Component"}</h2>
              <Button variant="ghost" size="icon" onClick={closeDrawer} className="h-8 w-8 rounded-full">
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {!isEditing && (
                <div className="space-y-2">
                  <Label>Company</Label>
                  <select 
                    value={formData.company_id} 
                    onChange={e => setFormData({...formData, company_id: e.target.value})}
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    <option value="" disabled>Select a company</option>
                    <option value="all">All Companies</option>
                    {filterOptions.companies?.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-2">
                <Label>Component Name</Label>
                <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Basic Salary" />
              </div>

              <div className="space-y-2">
                <Label>Component Code</Label>
                <Input value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} placeholder="e.g. BASIC" />
              </div>

              <div className="space-y-2">
                <Label>Type</Label>
                <select 
                  value={formData.type} 
                  onChange={e => setFormData({...formData, type: e.target.value})}
                  className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <option value="earning">Earning</option>
                  <option value="deduction">Deduction</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label>Default Amount (₹)</Label>
                <Input type="number" value={formData.default_amount} onChange={e => setFormData({...formData, default_amount: Number(e.target.value)})} placeholder="0" />
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <select 
                  value={formData.status} 
                  onChange={e => setFormData({...formData, status: e.target.value})}
                  className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div className="bg-card border-t border-border/50 p-4 flex items-center justify-end gap-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
              <Button variant="ghost" onClick={closeDrawer} className="font-medium">Cancel</Button>
              <Button onClick={handleSave} disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium px-6">
                {saving ? "Saving..." : "Save Component"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function SalaryManagementPage() {
  const [activeTab, setActiveTab] = useState<"structures" | "components">("structures");

  return (
    <div className="space-y-6">
      {/* Page Header with Tabs */}
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between border-b border-border/50 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Salary Structure</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage employee salary structures and reusable salary components.
          </p>
        </div>

        {/* Custom Tabs List */}
        <div className="flex self-start overflow-hidden rounded-xl bg-muted p-1">
          <button
            type="button"
            onClick={() => setActiveTab("structures")}
            className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-all duration-200 ${
              activeTab === "structures"
                ? "bg-card text-primary shadow-sm ring-1 ring-border"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            Salary Structure
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("components")}
            className={`flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-all duration-200 ${
              activeTab === "components"
                ? "bg-card text-primary shadow-sm ring-1 ring-border"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            }`}
          >
            <WalletCards className="h-4 w-4" />
            Salary Component
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="mt-4">
        {activeTab === "structures" && <SalaryStructureTab />}
        {activeTab === "components" && <SalaryComponentsTab />}
      </div>
    </div>
  );
}

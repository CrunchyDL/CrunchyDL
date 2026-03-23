import React, { useState, useEffect } from 'react';
import { Shield, UserPlus, X, Check, Trash2, Key, Users, HardDrive, Database, Activity, Image as ImageIcon, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// Simple cn helper
function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

const Admin = () => {
  const { isAdmin: isSystemAdmin } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'user' as const });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [storageData, setStorageData] = useState<any[]>([]);
  const [isLoadingStorage, setIsLoadingStorage] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [activeTab, setActiveTab] = useState<'system' | 'users' | 'logs' | 'roles' | 'avatars'>('system');
  const [roles, setRoles] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [isLoadingRoles, setIsLoadingRoles] = useState(false);
  const [showRoleForm, setShowRoleForm] = useState(false);
  const [newRole, setNewRole] = useState({ name: '', description: '', permissions: [] as string[] });
  const [editingRoleId, setEditingRoleId] = useState<number | null>(null);

  // Stock Avatars states
  const [stockAvatars, setStockAvatars] = useState<any[]>([]);
  const [isLoadingAvatars, setIsLoadingAvatars] = useState(false);
  const [newAvatar, setNewAvatar] = useState({ url: '', name: '' });

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/users', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) setUsers(await res.json());
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStorage = async () => {
    setIsLoadingStorage(true);
    try {
      const res = await fetch('/api/system/storage', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) setStorageData(await res.json());
    } finally {
      setIsLoadingStorage(false);
    }
  };

  const fetchLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const res = await fetch('/api/system/logs', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) setLogs(await res.json());
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const fetchRolesData = async () => {
    setIsLoadingRoles(true);
    try {
      const [rRes, pRes] = await Promise.all([
        fetch('/api/admin/roles', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } }),
        fetch('/api/admin/permissions', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } })
      ]);
      if (rRes.ok) setRoles(await rRes.json());
      if (pRes.ok) setPermissions(await pRes.json());
    } finally {
      setIsLoadingRoles(false);
    }
  };

  const fetchAvatars = async () => {
    setIsLoadingAvatars(true);
    try {
        const res = await fetch('/api/stock-avatars');
        if (res.ok) setStockAvatars(await res.json());
    } finally {
        setIsLoadingAvatars(false);
    }
  };

  useEffect(() => {
    if (isSystemAdmin) {
      fetchUsers();
      fetchStorage();
      fetchLogs();
      fetchRolesData();
      fetchAvatars();
    }
  }, [isSystemAdmin]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(newUser)
      });
      if (res.ok) {
        setShowAddForm(false);
        setNewUser({ username: '', password: '', role: 'user' });
        fetchUsers();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const url = editingRoleId ? `/api/admin/roles/${editingRoleId}` : '/api/admin/roles';
      const method = editingRoleId ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(newRole)
      });
      if (res.ok) {
        setShowRoleForm(false);
        setNewRole({ name: '', description: '', permissions: [] });
        setEditingRoleId(null);
        fetchRolesData();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isSystemAdmin) return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-red-500 font-sans">
          <Shield size={48} className="mb-4 opacity-20" />
          <h1 className="text-xl font-black uppercase tracking-widest">Access Denied</h1>
      </div>
  );

  return (
    <div className="max-w-4xl mx-auto pb-24 font-sans animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-white tracking-tight">System <span className="text-primary">Admin</span></h1>
          <p className="text-gray-500 font-medium">Manage user accounts, roles and media constants.</p>
        </div>
        {activeTab === 'users' && (
          <button 
              onClick={() => { setShowAddForm(!showAddForm); setEditingRoleId(null); }}
              className="flex items-center gap-2 px-8 py-4 bg-primary text-secondary rounded-2xl font-black text-sm uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-primary/20"
            >
              {showAddForm ? <X size={20} /> : <UserPlus size={20} />}
              {showAddForm ? 'Cancel Creation' : 'Create New User'}
            </button>
        )}
        {activeTab === 'roles' && (
          <button 
              onClick={() => { setShowRoleForm(!showRoleForm); setEditingRoleId(null); setNewRole({ name: '', description: '', permissions: [] }); }}
              className="flex items-center gap-2 px-8 py-4 bg-primary text-secondary rounded-2xl font-black text-sm uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-primary/20"
            >
              {showRoleForm ? <X size={20} /> : <Shield size={20} />}
              {showRoleForm ? 'Cancel Creation' : 'Create New Role'}
            </button>
        )}
      </div>

      <div className="flex flex-wrap gap-4 mb-8">
        {[
          { id: 'system', label: 'System', icon: Database },
          { id: 'users', label: 'Users', icon: Users },
          { id: 'logs', label: 'Activity', icon: Activity },
          { id: 'roles', label: 'Roles', icon: Shield },
          { id: 'avatars', label: 'Stock Avatars', icon: ImageIcon }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
              activeTab === tab.id ? "bg-primary text-secondary" : "bg-white/5 text-gray-400 hover:bg-white/10"
            )}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'system' && (
        <div className="space-y-12">
          {/* Storage Mini-Dashboard */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {storageData.map((drive, idx) => (
              <div key={idx} className="bg-secondary/40 backdrop-blur-md rounded-3xl border border-white/5 p-6">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-3">
                    <HardDrive size={20} className="text-primary" />
                    <span className="text-xs font-black text-white uppercase truncate">{drive.path.split(/[\\/]/).pop() || drive.path}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-sm font-black text-white">{drive.percentage}%</span>
                    <span className="text-[9px] font-bold text-gray-500 uppercase tracking-tighter">{drive.free} available of {drive.total}</span>
                  </div>
                </div>
                <div className="relative h-2 bg-black/40 rounded-full overflow-hidden">
                  <div className="absolute h-full bg-primary transition-all duration-1000" style={{ width: `${drive.percentage}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="space-y-8 animate-in slide-in-from-bottom-4">
          {showAddForm && (
            <div className="bg-secondary/40 backdrop-blur-md rounded-3xl border border-primary/20 p-8">
              <h2 className="text-xs font-black text-primary uppercase mb-6 tracking-widest">New User Account</h2>
              <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <input type="text" required value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} className="bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white" placeholder="Username" />
                <input type="text" required value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} className="bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white" placeholder="Password" />
                <div className="flex gap-2">
                  <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as any})} className="flex-1 bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white capitalize">
                    {roles.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                  </select>
                  <button type="submit" className="bg-primary text-secondary px-6 rounded-2xl font-black">Create</button>
                </div>
              </form>
            </div>
          )}

          <div className="bg-secondary/40 backdrop-blur-md rounded-3xl border border-white/5 overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-black/40">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase">Identity</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase">Role Access</th>
                  <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {users.map(u => (
                  <tr key={u.id} className="group hover:bg-white/[0.02] transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center font-black text-primary text-xs italic">
                          {u.username[0].toUpperCase()}
                        </div>
                        <span className="font-bold text-white text-sm">{u.username}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <select 
                        value={u.role}
                        onChange={async (e) => {
                          const newRole = e.target.value;
                          await fetch(`/api/admin/users/${u.id}`, {
                            method: 'PUT',
                            headers: { 
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${localStorage.getItem('token')}`
                            },
                            body: JSON.stringify({ role: newRole })
                          });
                          fetchUsers();
                        }}
                        className="bg-black/30 border border-white/5 rounded-lg px-3 py-1.5 text-[10px] font-black text-primary uppercase tracking-wider outline-none focus:border-primary/50"
                      >
                        {roles.map(r => <option key={r.id} value={r.name} className="bg-secondary text-white">{r.name.toUpperCase()}</option>)}
                      </select>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {parseInt(u.id) !== useAuth().user?.id && (
                        <button 
                          onClick={async () => {
                            if(confirm(`Are you sure you want to delete ${u.username}?`)) {
                              await fetch(`/api/admin/users/${u.id}`, { 
                                method: 'DELETE', 
                                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                              });
                              fetchUsers();
                            }
                          }}
                          className="p-2 text-red-500/30 hover:text-red-500 transition-all hover:bg-red-500/10 rounded-lg"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="bg-secondary/40 backdrop-blur-md rounded-3xl border border-white/5 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-black/40">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase">User</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase">Action</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase">Target</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {logs.map(log => (
                <tr key={log.id} className="text-xs">
                  <td className="px-6 py-4 text-white font-bold">{log.username}</td>
                  <td className="px-6 py-4"><span className="bg-primary/10 text-primary px-2 py-1 rounded-md font-black italic">{log.action}</span></td>
                  <td className="px-6 py-4 text-gray-400">{log.target}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'roles' && (
        <div className="space-y-8 animate-in slide-in-from-bottom-4">
          {showRoleForm && (
            <div className="bg-secondary/40 backdrop-blur-md rounded-3xl border border-primary/20 p-8">
              <h2 className="text-xs font-black text-primary uppercase mb-6 tracking-widest">
                {editingRoleId ? 'Edit Security Role' : 'New Security Role'}
              </h2>
              <form onSubmit={handleCreateRole} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <input type="text" required value={newRole.name} onChange={e => setNewRole({...newRole, name: e.target.value})} className="bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white" placeholder="Role Name (e.g. Moderator)" />
                  <input type="text" value={newRole.description} onChange={e => setNewRole({...newRole, description: e.target.value})} className="bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white" placeholder="Description" />
                </div>
                
                <div className="space-y-4">
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Assign Permissions</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {permissions.map(p => (
                      <label key={p.id} className={cn(
                        "flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer",
                        newRole.permissions.includes(p.slug) ? "bg-primary/10 border-primary/30 text-primary" : "bg-black/20 border-white/5 text-gray-500 hover:border-white/10"
                      )}>
                        <input 
                          type="checkbox" 
                          hidden 
                          checked={newRole.permissions.includes(p.slug)}
                          onChange={() => {
                            const perms = newRole.permissions.includes(p.slug)
                              ? newRole.permissions.filter(s => s !== p.slug)
                              : [...newRole.permissions, p.slug];
                            setNewRole({...newRole, permissions: perms});
                          }}
                        />
                        <div className={cn("w-4 h-4 rounded border flex items-center justify-center", newRole.permissions.includes(p.slug) ? "bg-primary border-primary" : "border-white/20")}>
                          {newRole.permissions.includes(p.slug) && <Check size={10} className="text-secondary" />}
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-tighter">{p.slug.replace(':',' ')}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-4 pt-4 border-t border-white/5">
                   <button 
                    type="submit" 
                    className="bg-primary text-secondary px-10 py-4 rounded-2xl font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-primary/20"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Saving...' : (editingRoleId ? 'Update Role' : 'Create Role')}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             {roles.map(r => (
               <div key={r.id} className="bg-secondary/40 p-8 rounded-3xl border border-white/5 group hover:border-white/10 transition-all">
                 <div className="flex justify-between items-start mb-6">
                   <div className="space-y-1">
                    <h3 className="font-black text-white text-xl tracking-tight">{r.name.toUpperCase()}</h3>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{r.description || 'No description provided'}</p>
                   </div>
                   <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                      <button 
                        onClick={() => {
                          setEditingRoleId(r.id);
                          setNewRole({ name: r.name, description: r.description || '', permissions: r.permissions || [] });
                          setShowRoleForm(true);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="p-2 bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                      >
                        <Key size={14} />
                      </button>
                      <button 
                        onClick={async () => {
                          if (r.name === 'admin' || r.name === 'user') return alert('System roles cannot be deleted');
                          if (confirm(`Delete role ${r.name}?`)) {
                             await fetch(`/api/admin/roles/${r.id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }});
                             fetchRolesData();
                          }
                        }}
                        className="p-2 bg-red-500/10 text-red-500/50 hover:text-red-500 hover:bg-red-500/20 rounded-xl transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                   </div>
                 </div>
                 
                 <div className="flex flex-wrap gap-2">
                   {r.permissions?.length > 0 ? (
                     r.permissions.map((p:string) => (
                       <span key={p} className="text-[9px] bg-black/40 text-primary border border-primary/20 px-2 py-0.5 rounded-lg font-black uppercase tracking-tighter">{p.replace(':',' ')}</span>
                     ))
                   ) : (
                     <span className="text-[9px] text-gray-600 font-black uppercase italic">No atomic permissions</span>
                   )}
                 </div>
               </div>
             ))}
          </div>
        </div>
      )}

      {activeTab === 'avatars' && (
        <div className="space-y-8 animate-in slide-in-from-bottom-4">
          <div className="bg-secondary/40 p-8 rounded-3xl border border-white/5">
            <h2 className="text-xl font-black text-white mb-8 flex items-center gap-3">
              <ImageIcon className="text-primary" />
              Stock Avatars Library
            </h2>
            <form 
              onSubmit={async (e) => {
                e.preventDefault();
                const res = await fetch('/api/admin/stock-avatars', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                  body: JSON.stringify(newAvatar)
                });
                if (res.ok) { setNewAvatar({ url: '', name: '' }); fetchAvatars(); }
              }}
              className="flex flex-col md:flex-row gap-4 mb-10"
            >
              <input type="text" required placeholder="Image URL" value={newAvatar.url} onChange={e => setNewAvatar({...newAvatar, url: e.target.value})} className="flex-1 bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white" />
              <input type="text" placeholder="Friendly Name" value={newAvatar.name} onChange={e => setNewAvatar({...newAvatar, name: e.target.value})} className="md:w-48 bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white" />
              <button type="submit" className="bg-primary text-secondary px-8 rounded-2xl font-black uppercase tracking-widest hover:scale-105 transition-all"><Plus size={24}/></button>
            </form>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-6">
              {stockAvatars.map(avatar => (
                <div key={avatar.id} className="relative group aspect-square">
                  <div className="w-full h-full bg-black/40 rounded-2xl overflow-hidden border border-white/5 group-hover:border-primary/50 transition-all shadow-lg">
                    <img src={avatar.url} alt="" className="w-full h-full object-cover" />
                  </div>
                  <button 
                    onClick={async () => {
                      if(confirm('Delete from stock?')) {
                        await fetch(`/api/admin/stock-avatars/${avatar.id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }});
                        fetchAvatars();
                      }
                    }}
                    className="absolute -top-2 -right-2 p-2 bg-red-500 text-white rounded-xl opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
                  >
                    <Trash2 size={12} />
                  </button>
                  <p className="text-[10px] text-center mt-2 font-black text-gray-600 uppercase tracking-tighter truncate">{avatar.name}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;

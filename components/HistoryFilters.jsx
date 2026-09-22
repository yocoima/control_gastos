import React from 'react';
import { Search, X } from 'lucide-react';

export default function HistoryFilters({
  search,
  onSearchChange,
  category,
  onCategoryChange,
  type,
  onTypeChange,
  categories,
  types,
  sortConfig,
  onSortChange,
  onClear,
  hasFilters
}) {
  return (
    <div className="px-6 py-4 border-b border-slate-100 bg-white grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_180px_180px_180px_auto] gap-3">
      <label className="relative block">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={search}
          onChange={event => onSearchChange(event.target.value)}
          placeholder="Buscar detalle, categoría o tipo..."
          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-3 text-sm font-medium outline-none focus:border-blue-400 focus:bg-white"
        />
      </label>
      <select value={category} onChange={event => onCategoryChange(event.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-600 outline-none focus:border-blue-400">
        <option value="">Todas las categorías</option>
        {categories.map(item => <option key={item} value={item}>{item}</option>)}
      </select>
      <select value={type} onChange={event => onTypeChange(event.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-600 outline-none focus:border-blue-400">
        <option value="">Todos los tipos</option>
        {types.map(item => <option key={item} value={item}>{item}</option>)}
      </select>
      <select
        value={`${sortConfig.key}:${sortConfig.direction}`}
        onChange={event => {
          const [key, direction] = event.target.value.split(':');
          onSortChange({ key, direction });
        }}
        className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-600 outline-none focus:border-blue-400"
      >
        <option value="id:desc">Más recientes</option>
        <option value="Detalle:asc">Detalle A–Z</option>
        <option value="Detalle:desc">Detalle Z–A</option>
        <option value="Categoría:asc">Categoría A–Z</option>
        <option value="Categoría:desc">Categoría Z–A</option>
        <option value="Tipo:asc">Tipo A–Z</option>
        <option value="Tipo:desc">Tipo Z–A</option>
        <option value="Total:desc">Mayor monto</option>
        <option value="Total:asc">Menor monto</option>
        <option value="Mi Parte:desc">Mayor monto personal</option>
        <option value="Mi Parte:asc">Menor monto personal</option>
      </select>
      {hasFilters && (
        <button onClick={onClear} className="px-3 py-2.5 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 text-[10px] font-black uppercase flex items-center justify-center gap-1.5">
          <X size={14}/> Limpiar
        </button>
      )}
    </div>
  );
}


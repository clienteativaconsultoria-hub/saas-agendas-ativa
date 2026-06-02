import os

path = 'src/pages/Schedule.tsx'
with open(path, 'r') as f: content = f.read()

# Legend
content = content.replace('bg-emerald-400 inline-block', 'bg-navy-200 inline-block')
content = content.replace('bg-red-400 inline-block', 'bg-primary-500 inline-block')

# KPI Cards in Avail Overview
content = content.replace('className="bg-emerald-50 border border-emerald-100 rounded-xl p-5 text-center"', 'className="card p-5 text-center"')
content = content.replace('className="text-4xl font-bold text-emerald-600"', 'className="text-4xl font-bold text-navy-900"')
content = content.replace('className="text-xs font-semibold text-emerald-500 uppercase tracking-wide mt-1"', 'className="text-xs font-semibold text-navy-500 uppercase tracking-wide mt-1"')

content = content.replace('className="bg-red-50 border border-red-100 rounded-xl p-5 text-center"', 'className="card p-5 text-center"')
content = content.replace('className="text-4xl font-bold text-red-600"', 'className="text-4xl font-bold text-navy-900"')
content = content.replace('className="text-xs font-semibold text-red-500 uppercase tracking-wide mt-1"', 'className="text-xs font-semibold text-navy-500 uppercase tracking-wide mt-1"')

content = content.replace('className="bg-primary-50 border border-primary-100 rounded-xl p-5 text-center"', 'className="card p-5 text-center"')
content = content.replace('className="text-4xl font-bold text-primary-600"', 'className="text-4xl font-bold text-primary-600"')
content = content.replace('className="text-xs font-semibold text-primary-500 uppercase tracking-wide mt-1"', 'className="text-xs font-semibold text-navy-500 uppercase tracking-wide mt-1"')

# Table Headers
content = content.replace('className="grid grid-cols-[1fr_80px_80px_80px_1fr] gap-2 px-5 py-3.5 border-b border-navy-200 bg-navy-50 text-[11px] font-bold text-navy-500 uppercase tracking-wider"', 'className="grid grid-cols-[1fr_80px_80px_80px_1fr] gap-2 px-5 py-3.5 table-header border-t-0"')

# Table Rows
content = content.replace('bg-gradient-to-br from-navy-100 to-navy-200', 'bg-navy-100 text-navy-600')
content = content.replace('className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-red-50 text-base font-bold text-red-600 border border-red-100"', 'className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-navy-50 text-base font-bold text-primary-600 border border-navy-100"')
content = content.replace('className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-50 text-base font-bold text-emerald-600 border border-emerald-100"', 'className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-navy-50 text-base font-bold text-navy-600 border border-navy-100"')

# Table row occupancy colors
content = content.replace('''                                       "text-base font-bold",
                                       stat.occupancyPct >= 100 ? "text-red-600" :
                                       stat.occupancyPct >= 80 ? "text-amber-500" :
                                       stat.occupancyPct > 0 ? "text-emerald-600" :
                                       "text-navy-400"''', '''                                       "text-base font-bold",
                                       stat.occupancyPct >= 100 ? "text-primary-700" :
                                       stat.occupancyPct >= 80 ? "text-primary-600" :
                                       stat.occupancyPct > 0 ? "text-primary-500" :
                                       "text-navy-400"''')

content = content.replace('''                                             "px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap overflow-hidden text-ellipsis",
                                             proj.days >= 5 ? "bg-red-50 text-red-700 border border-red-100" :
                                             proj.days >= 3 ? "bg-amber-50 text-amber-700 border border-amber-100" :
                                             "bg-emerald-50 text-emerald-700 border border-emerald-100"''', '''                                             "px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap overflow-hidden text-ellipsis",
                                             proj.days >= 5 ? "bg-primary-100 text-primary-800" :
                                             proj.days >= 3 ? "bg-primary-50 text-primary-700" :
                                             "bg-navy-50 text-navy-600 border border-navy-100"''')

with open(path, 'w') as f: f.write(content)

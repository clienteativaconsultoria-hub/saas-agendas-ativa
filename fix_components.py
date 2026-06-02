import os
import re

def rewrite(path, changes):
    if not os.path.exists(path): return
    with open(path, 'r') as f: content = f.read()
    for o, n in changes: content = content.replace(o, n)
    with open(path, 'w') as f: f.write(content)

# Consultants.tsx
rewrite('src/pages/Consultants.tsx', [
    (
        """const roleColors: Record<string, string> = {
  ADM: 'bg-primary-100 text-primary-800',
  CONSULTOR: 'bg-emerald-100 text-emerald-800',
  GERENTE: 'bg-amber-100 text-amber-800',
};""",
        """const roleColors: Record<string, string> = {
  ADM: 'badge pill-info',
  CONSULTOR: 'badge pill-neutral',
  GERENTE: 'badge pill-neutral',
};"""
    ),
    ("'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-1',", "'mt-1',"),
    ("bg-navy-100 text-navy-800", "badge pill-neutral"),
    ("text-emerald-700 bg-emerald-50 hover:bg-emerald-100", "pill-success border border-emerald-100"),
    ("text-red-700 bg-red-50 hover:bg-red-100", "pill-danger border border-rose-100"),
    ("w-12 h-12 mx-auto mb-3 opacity-30", "w-12 h-12 mx-auto mb-3 opacity-20 text-navy-400"),
    ("bg-gradient-to-br from-navy-100 to-navy-200", "bg-navy-100 text-navy-600"),
    ("text-emerald-700", "text-navy-900"),
    ("text-amber-700", "text-navy-900"),
    ("text-primary-700", "text-navy-900"),
])

# Schedule.tsx
rewrite('src/pages/Schedule.tsx', [
    (
        "className='text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-navy-50 text-navy-600 transition-colors'",
        "className='btn-ghost px-3 py-1.5'"
    ),
    (
        "bg-navy-900 hover:bg-navy-800 text-white rounded-lg text-sm font-medium",
        "btn-primary"
    ),
    (
        "bg-white hover:bg-navy-50 text-navy-700 border border-navy-200 rounded-lg text-sm font-medium",
        "btn-secondary"
    ),
    (
        "px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium",
        "btn-primary bg-primary-600" # remove amber
    ),
    (
        "bg-amber-50 text-amber-700 border-amber-200",
        "bg-primary-50 text-primary-700 border-primary-200"
    ),
    (
        "bg-emerald-600 hover:bg-emerald-700",
        "bg-emerald-600 hover:bg-emerald-700" # keep success color
    ),
])

# Projects.tsx
rewrite('src/pages/Projects.tsx', [
    (
        "bg-primary-600 hover:bg-primary-700 text-white",
        "btn-primary"
    ),
    (
        "bg-white hover:bg-navy-50 text-navy-700 border border-navy-200",
        "btn-secondary"
    ),
    (
        "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border",
        "badge"
    )
])

print("Standardized more components.")
